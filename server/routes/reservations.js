import express from 'express';

import {
    getReservationsByUserId,
    getReservationEquipment,
    getReservationById,
    getFacilityById,
    getActiveReservationByFacilityId,
    getRequiredEquipmentForFacilityType,
    getEquipment,
    createReservation,
    addReservationEquipment,
    releaseReservation,
    decreaseUserScore,
    getLastReleasedReservationByUserAndFacilityType,
    updateReservationEquipment,
    getAvailableFacilityByTypeId,
    runInTransaction
} from '../dao.js';

const router = express.Router();

// GET /api/reservations
router.get('/reservations', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({
            error: 'Not authenticated'
        });
    }

    try {
        const reservations = await getReservationsByUserId(req.user.id);
        for (const reservation of reservations) {
            reservation.equipment = await getReservationEquipment(reservation.id);
        }
        res.json(reservations);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// POST /api/reservations
router.post('/reservations', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const { facility_id, facility_type_id, equipment } = req.body;

    if (!Array.isArray(equipment)) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    if (!facility_id && !facility_type_id) {
        return res.status(400).json({ error: 'facility_id or facility_type_id required' });
    }

    try {
        const result = await runInTransaction(async () => {
            let facility;

            if (facility_id) {
                facility = await getFacilityById(facility_id);
            } else {
                facility = await getAvailableFacilityByTypeId(facility_type_id);
            }

            if (!facility) {
                return { status: 404, body: { error: 'Facility not found' } };
            }

            const lastReleased = await getLastReleasedReservationByUserAndFacilityType(req.user.id, facility.facility_type_id);

            if (lastReleased) {
                const releasedAt = new Date(lastReleased.released_at.replace(' ', 'T') + 'Z');
                const now = new Date();
                const secondsPassed = (now.getTime() - releasedAt.getTime()) / 1000;

                if (secondsPassed < 30) {
                    return { status: 409, body: { error: 'Too early to reserve this type of facility again' } };
                }
            }

            const activeReservation = await getActiveReservationByFacilityId(facility.id);

            if (activeReservation) {
                return { status: 409, body: { error: 'Facility is already reserved' } };
            }

            const requiredEquipment = await getRequiredEquipmentForFacilityType(facility.facility_type_id);

            const requestedEquipment = new Map();
            for (const item of equipment) {
                requestedEquipment.set(Number(item.equipment_type_id), Number(item.quantity));
            }

            for (const item of requiredEquipment) {
                const requestedQuantity = requestedEquipment.get(item.id) || 0;

                if (requestedQuantity < item.min_quantity) {
                    return { status: 400, body: { error: `Minimum quantity for ${item.name} is ${item.min_quantity}` } };
                }
            }

            if (req.user.score < 0) {
                for (const item of equipment) {
                    const equipmentTypeId = Number(item.equipment_type_id);
                    const quantity = Number(item.quantity);

                    const requiredItem = requiredEquipment.find(required => required.id === equipmentTypeId);

                    if (!requiredItem || requiredItem.min_quantity === 0) {
                        return { status: 409, body: { error: 'Negative score users cannot request optional equipment' } };
                    }

                    if (quantity > requiredItem.min_quantity) {
                        return { status: 409, body: { error: 'Negative score users can only request minimum equipment quantities' } };
                    }
                }
            }

            const availableEquipment = await getEquipment();
            const availableMap = new Map();

            for (const item of availableEquipment) {
                availableMap.set(item.id, item.available);
            }

            for (const item of equipment) {
                const equipmentTypeId = Number(item.equipment_type_id);
                const quantity = Number(item.quantity);

                if (!Number.isInteger(quantity) || quantity <= 0) {
                    return { status: 400, body: { error: 'Invalid equipment quantity' } };
                }

                const available = availableMap.get(equipmentTypeId);

                if (available === undefined) {
                    return { status: 400, body: { error: 'Invalid equipment type' } };
                }

                if (quantity > available) {
                    return { status: 409, body: { error: 'Not enough equipment available' } };
                }
            }

            const reservationId = await createReservation(req.user.id, facility.id);

            for (const item of equipment) {
                await addReservationEquipment(reservationId, Number(item.equipment_type_id), Number(item.quantity));
            }

            return { status: 201, body: { id: reservationId } };
        });

        return res.status(result.status).json(result.body);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// PUT /api/reservations/:id/equipment
router.put('/reservations/:id/equipment', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const reservationId = Number(req.params.id);
    if (!Number.isInteger(reservationId)) {
        return res.status(400).json({ error: 'Invalid reservation id' });
    }

    const { equipment } = req.body;
    if (!Array.isArray(equipment)) {
        return res.status(400).json({ error: 'Invalid request' });
    }

    try {
        const result = await runInTransaction(async () => {
            const reservation = await getReservationById(reservationId);

            if (!reservation) {
                return { status: 404, body: { error: 'Reservation not found' } };
            }

            if (reservation.user_id !== req.user.id) {
                return { status: 403, body: { error: 'Not authorized' } };
            }

            if (reservation.released_at !== null) {
                return { status: 409, body: { error: 'Reservation already released' } };
            }

            const requiredEquipment = await getRequiredEquipmentForFacilityType(reservation.facility_type_id);
            const requiredMap = new Map();

            for (const item of requiredEquipment) {
                requiredMap.set(item.id, item.min_quantity);
            }

            const currentEquipment = await getReservationEquipment(reservationId);
            const currentMap = new Map();
            for (const item of currentEquipment) {
                currentMap.set(item.equipment_type_id, item.quantity);
            }

            const newMap = new Map();
            for (const item of equipment) {
                const equipmentTypeId = Number(item.equipment_type_id);
                const quantity = Number(item.quantity);

                if (!Number.isInteger(equipmentTypeId)) {
                    return { status: 400, body: { error: 'Invalid equipment type' } };
                }

                if (!Number.isInteger(quantity) || quantity < 0) {
                    return { status: 400, body: { error: 'Invalid equipment quantity' } };
                }

                if (quantity > 0) {
                    newMap.set(equipmentTypeId, quantity);
                }
            }

            for (const [equipmentTypeId, minQuantity] of requiredMap) {
                const quantity = newMap.get(equipmentTypeId) || 0;

                if (quantity < minQuantity) {
                    const requiredItem = requiredEquipment.find(item => item.id === equipmentTypeId);
                    return { status: 400, body: { error: `Minimum quantity for ${requiredItem.name} is ${minQuantity}` } };
                }
            }

            if (req.user.score < 0) {
                for (const [equipmentTypeId, quantity] of newMap) {
                    const minQuantity = requiredMap.get(equipmentTypeId);

                    if (minQuantity === undefined) {
                        return { status: 409, body: { error: 'Negative score users cannot request optional equipment' } };
                    }

                    if (quantity > minQuantity) {
                        return { status: 409, body: { error: 'Negative score users can only request minimum equipment quantities' } };
                    }
                }
            }

            const availableEquipment = await getEquipment();
            const availableMap = new Map();
            for (const item of availableEquipment) {
                availableMap.set(item.id, item.available);
            }

            for (const [equipmentTypeId, newQuantity] of newMap) {
                const currentQuantity = currentMap.get(equipmentTypeId) || 0;
                const available = availableMap.get(equipmentTypeId);

                if (available === undefined) {
                    return { status: 400, body: { error: 'Invalid equipment type' } };
                }

                const effectiveAvailable = available + currentQuantity;

                if (newQuantity > effectiveAvailable) {
                    const item = availableEquipment.find(e => e.id === equipmentTypeId);
                    return { status: 409, body: { error: `Not enough equipment available for ${item.name}` } };
                }
            }

            const equipmentIds = new Set([...currentMap.keys(), ...newMap.keys()]);

            for (const equipmentTypeId of equipmentIds) {
                const quantity = newMap.get(equipmentTypeId) || 0;
                await updateReservationEquipment(reservationId, equipmentTypeId, quantity);
            }

            return { status: 200, body: { message: 'Reservation equipment updated successfully' } };
        });

        return res.status(result.status).json(result.body);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/reservations/:id
router.delete('/reservations/:id', async (req, res) => {
    if (!req.isAuthenticated()) {
        return res.status(401).json({ error: 'Not authenticated' });
    }

    const reservationId = Number(req.params.id);
    if (!Number.isInteger(reservationId)) {
        return res.status(400).json({ error: 'Invalid reservation id' });
    }

    try {
        const result = await runInTransaction(async () => {
            const reservation = await getReservationById(reservationId);

            if (!reservation) {
                return { status: 404, body: { error: 'Reservation not found' } };
            }

            if (reservation.user_id !== req.user.id) {
                return { status: 403, body: { error: 'Not authorized' } };
            }

            if (reservation.released_at !== null) {
                return { status: 409, body: { error: 'Reservation already released' } };
            }

            await releaseReservation(reservationId);
            await decreaseUserScore(req.user.id);

            return { status: 204, body: null };
        });

        if (result.status === 204) {
            return res.status(204).send();
        }

        return res.status(result.status).json(result.body);

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;