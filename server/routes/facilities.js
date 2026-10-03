import express from 'express';
import {
    getFacilities,
    getEquipment,
    getFacilityById,
    getEquipmentForFacilityType
} from '../dao.js';

const router = express.Router();

router.get('/facilities', async (req, res) => {
    try {
        const facilities = await getFacilities();
        res.json(facilities);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

router.get('/equipment', async (req, res) => {
    try {
        const equipment = await getEquipment();
        res.json(equipment);
    } catch (err) {
        console.error(err);
        res.status(500).json({
            error: 'Internal server error'
        });
    }
});

// GET /api/facilities/:id/equipment
router.get('/facilities/:id/equipment', async (req, res) => {
    try {
        const facilityId = Number(req.params.id);
        if (!Number.isInteger(facilityId)) {
            return res.status(400).json({ error: 'Invalid facility id' });
        }

        const facility = await getFacilityById(facilityId);
        if (!facility) {
            return res.status(404).json({ error: 'Facility not found' });
        }

        const equipment = await getEquipmentForFacilityType(facility.facility_type_id);
        res.json(equipment);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

export default router;