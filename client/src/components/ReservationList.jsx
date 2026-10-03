import { useEffect, useState } from 'react';
import { Card, ListGroup, Badge, Button, Alert, Spinner } from 'react-bootstrap';

import {
    getReservations,
    getFacilityEquipment,
    updateReservationEquipment,
    releaseReservation
} from '../API/API.js';

function ReservationList({ user, onChanged }) {

    const [reservations, setReservations] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [editEquipment, setEditEquipment] = useState({});
    const [editRequired, setEditRequired] = useState([]);
    const [editLoading, setEditLoading] = useState(false);
    const [confirmingDeleteId, setConfirmingDeleteId] = useState(null);
    const [deleteLoading, setDeleteLoading] = useState(false);

    const loadReservations = async () => {
        try {
            setError('');
            const data = await getReservations();
            setReservations(data);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadReservations();
    }, []);

    const isRestrictedByScore = user.score < 0;

    const startEditing = async (reservation) => {
        try {
            setError('');
            setSuccessMessage('');
            setEditingId(reservation.id);

            const required = await getFacilityEquipment(reservation.facility_id);
            setEditRequired(required);

            const currentQuantities = {};

            reservation.equipment.forEach((item) => {
                currentQuantities[item.equipment_type_id] = item.quantity;
            });

            const initial = {};

            required.forEach((item) => {
                initial[item.id] =
                    currentQuantities[item.id] ?? item.min_quantity;
            });

            setEditEquipment(initial);

        } catch (err) {
            setError(err.message);
            cancelEditing();
        }
    };

    const cancelEditing = () => {
        setEditingId(null);
        setEditEquipment({});
        setEditRequired([]);
    };

    const getCurrentQuantity = (reservation, equipmentTypeId) => {
        const item = reservation.equipment.find(
            (eq) => eq.equipment_type_id === equipmentTypeId
        );

        return item ? item.quantity : 0;
    };

    const hasInvalidEditQuantity = (reservation) => {
        return editRequired.some((item) => {

            const quantity = editEquipment[item.id] ?? 0;
            const currentQuantity = getCurrentQuantity(reservation, item.id);

            const effectiveMax = item.available + currentQuantity;

            const maxQuantity = isRestrictedByScore ? currentQuantity : effectiveMax;

            return (quantity < item.min_quantity || quantity > maxQuantity);
        });
    };

    const handleSaveEquipment = async (reservation) => {
        try {
            setError('');
            setSuccessMessage('');
            setEditLoading(true);

            const equipmentPayload = Object.entries(editEquipment)
                .map(([equipmentTypeId, quantity]) => ({
                    equipment_type_id: Number(equipmentTypeId),
                    quantity: Number(quantity)
                }))
                .filter((item) => item.quantity > 0);

            await updateReservationEquipment( reservation.id, equipmentPayload);

            setSuccessMessage(`Equipment for reservation ${reservation.facility_code} updated successfully.`);

            cancelEditing();
            await loadReservations();

            if (onChanged) {
                onChanged();
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setEditLoading(false);
        }
    };

    const handleDelete = async (reservation) => {
        try {
            setError('');
            setSuccessMessage('');
            setDeleteLoading(true);

            await releaseReservation(reservation.id);

            setSuccessMessage(`Reservation ${reservation.facility_code} deleted successfully.`);

            setConfirmingDeleteId(null);
            await loadReservations();

            if (onChanged) {
                onChanged();
            }

        } catch (err) {
            setError(err.message);
        } finally {
            setDeleteLoading(false);
        }
    };

    const activeReservations = reservations.filter((reservation) => reservation.released_at === null);

    if (loading) {
        return (
            <div className="text-center my-4">
                <Spinner animation="border" style={{ color: '#8a2be2' }} />
            </div>
        );
    }

    return (
        <Card className="mb-4 card-custom">
            <Card.Header>My Reservations</Card.Header>
            <Card.Body>
                {error && (
                    <Alert variant="danger" dismissible onClose={() => setError('')}>
                        {error}
                    </Alert>
                )}

                {successMessage && (
                    <Alert variant="success" dismissible onClose={() => setSuccessMessage('')}>
                        {successMessage}
                    </Alert>
                )}

                {activeReservations.length === 0 ? (
                    <p>You have no active reservations.</p>
                ) : (
                    <ListGroup variant="flush">

                        {activeReservations.map((reservation) => {

                            const isEditing = editingId === reservation.id;

                            const isConfirmingDelete = confirmingDeleteId === reservation.id;

                            return (
                                <ListGroup.Item key={reservation.id} className="py-3">
                                    <div className="d-flex justify-content-between align-items-start">
                                        <div>
                                            <strong>
                                                {reservation.facility_code}
                                            </strong>
                                            {' — '}
                                            {reservation.facility_type}
                                        </div>

                                        {!isEditing &&
                                            !isConfirmingDelete && (

                                                <div className="d-flex gap-2">
                                                    <Button size="sm" className="btn-brand" onClick={() => startEditing(reservation)}>
                                                        Edit equipment
                                                    </Button>

                                                    <Button size="sm" variant="outline-danger" onClick={() => setConfirmingDeleteId(reservation.id)}>
                                                        Delete
                                                    </Button>
                                                </div>
                                            )}
                                    </div>

                                    {!isEditing && (
                                        <ul className="list-unstyled mt-2 mb-0">
                                            {reservation.equipment.length === 0 ? (
                                                <li className="text-muted">
                                                    No equipment associated.
                                                </li>
                                            ) : (
                                                reservation.equipment.map(
                                                    (item) => (
                                                        <li key={item.equipment_type_id} className="d-flex justify-content-between border-bottom py-1" style={{ maxWidth: '400px' }}>
                                                            <span>
                                                                {item.name}
                                                            </span>

                                                            <Badge className="badge-brand">
                                                                {item.quantity}
                                                            </Badge>
                                                        </li>
                                                    )
                                                )
                                            )}
                                        </ul>
                                    )}

                                    {isConfirmingDelete && (
                                        <Alert variant="warning" className="mt-2 mb-0">

                                            <p className="mb-2">
                                                Are you sure you want to delete this reservation? This will reduce your score by 1.
                                            </p>

                                            <div className="d-flex gap-2">
                                                <Button size="sm" variant="danger" disabled={deleteLoading} onClick={() => handleDelete(reservation)}>
                                                    {deleteLoading ? 'Deleting...' : 'Yes, delete'}
                                                </Button>

                                                <Button size="sm" variant="outline-secondary" disabled={deleteLoading} onClick={() => setConfirmingDeleteId(null)}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </Alert>
                                    )}

                                    {isEditing && (
                                        <div className="mt-3">
                                            {isRestrictedByScore && (
                                                <Alert variant="warning" className="py-2">
                                                    Your score is negative: you can only remove equipment and cannot increase any quantity.
                                                </Alert>
                                            )}

                                            {editRequired.map((item) => {

                                                const quantity = editEquipment[item.id] ?? 0;
                                                const currentQuantity = getCurrentQuantity(reservation, item.id);
                                                const effectiveMax = item.available + currentQuantity;

                                                const maxQuantity = isRestrictedByScore ? currentQuantity : effectiveMax;
                                                const isInvalid = quantity < item.min_quantity || quantity > maxQuantity;

                                                return (
                                                    <div key={item.id} className="d-flex justify-content-between align-items-center mb-2" style={{ maxWidth: '400px' }}>
                                                        <div>
                                                            <strong>
                                                                {item.name}
                                                            </strong>

                                                            {item.min_quantity > 0 && (
                                                                <small className="text-muted ms-2">
                                                                    minimum:{' '}
                                                                    {
                                                                        item.min_quantity
                                                                    }
                                                                </small>
                                                            )}

                                                            <small className="text-muted ms-2">
                                                                max:{' '}
                                                                {maxQuantity}
                                                            </small>
                                                        </div>

                                                        <input type="number" min={ item.min_quantity } max={maxQuantity} value={quantity} onChange={(e) => {
                                                                const value = Number(e.target.value);

                                                                setEditEquipment((previous) => ({...previous, [item.id]: value
                                                                    })
                                                                );
                                                            }}
                                                            className={`form-control ${ isInvalid ? 'is-invalid' : ''}`} style={{width: '90px'}}/>
                                                    </div>
                                                );
                                            })}

                                            <div className="mt-3 d-flex gap-2">

                                                <Button size="sm" className="btn-brand" disabled={ editLoading || hasInvalidEditQuantity( reservation )}
                                                    onClick={() => handleSaveEquipment(reservation)}>
                                                    {editLoading ? 'Saving...' : 'Save'}
                                                </Button>

                                                <Button size="sm" variant="outline-secondary" disabled={editLoading} onClick={cancelEditing}>
                                                    Cancel
                                                </Button>
                                            </div>
                                        </div>
                                    )}
                                </ListGroup.Item>
                            );
                        })}

                    </ListGroup>
                )}

            </Card.Body>
        </Card>
    );
}

export default ReservationList;