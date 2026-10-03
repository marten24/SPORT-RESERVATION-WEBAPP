import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Navbar, Button, Alert, Spinner, Badge, Card } from 'react-bootstrap';

import {
    getFacilities,
    getEquipment,
    getFacilityEquipment,
    createReservation
} from '../API/API.js';

import FacilityList from './FacilityList.jsx';

function HomePage({ user, onLogout }) {
    const navigate = useNavigate();
    const isAuthenticated = Boolean(user);
    const [facilities, setFacilities] = useState([]);
    const [equipment, setEquipment] = useState([]);
    const [selectedFacility, setSelectedFacility] = useState(null);
    const [autoAssignType, setAutoAssignType] = useState(null);
    const [autoAssignTypeId, setAutoAssignTypeId] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [requiredEquipment, setRequiredEquipment] = useState([]);
    const [reservationEquipment, updateReservationEquipment] = useState({});
    const [reservationLoading, setReservationLoading] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const [facilitiesData, equipmentData] =
                    await Promise.all([
                        getFacilities(),
                        getEquipment()
                    ]);

                setFacilities(facilitiesData);
                setEquipment(equipmentData);
            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        loadData();
    }, []);

    const refreshAvailability = async () => {
        const [facilitiesData, equipmentData] = await Promise.all([
            getFacilities(),
            getEquipment()
        ]);

        setFacilities(facilitiesData);
        setEquipment(equipmentData);
    };

    const resetSelection = () => {
        setSelectedFacility(null);
        setAutoAssignType(null);
        setAutoAssignTypeId(null);
        setRequiredEquipment([]);
        updateReservationEquipment({});
    };

    //for manual selection
    const handleSelectFacility = async (facility) => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        try {
            setError('');
            setSuccessMessage('');
            resetSelection();
            setSelectedFacility(facility);

            const equipmentData = await getFacilityEquipment(facility.id);
            setRequiredEquipment(equipmentData);

            const initialEquipment = {};

            equipmentData.forEach((item) => {
                initialEquipment[item.id] = item.min_quantity; //chiave valore
            });

            updateReservationEquipment(initialEquipment);
        } catch (err) {
            setError(err.message);
            resetSelection();
        }
    };

    //for automatic selection
    const handleAutoSelect = async (facilityType, representativeFacilityId) => {
        if (!isAuthenticated) {
            navigate('/login');
            return;
        }

        try {
            setError('');
            setSuccessMessage('');
            resetSelection();
            setAutoAssignType(facilityType);

            const equipmentData = await getFacilityEquipment(representativeFacilityId);
            setRequiredEquipment(equipmentData);
            const initialEquipment = {};
            equipmentData.forEach((item) => { initialEquipment[item.id] = item.min_quantity; });
            updateReservationEquipment(initialEquipment);

            const representative = facilities.find((facility) => facility.id === representativeFacilityId);

            setAutoAssignTypeId(representative ? representative.facility_type_id : null);

        } catch (err) {
            setError(err.message);
            resetSelection();
        }
    };

    const isRestrictedByScore = isAuthenticated && user.score < 0;

    const hasInvalidQuantity = requiredEquipment.some((item) => {
        const quantity = reservationEquipment[item.id] ?? 0;
        return quantity < item.min_quantity || quantity > item.available;
    });

    const handleConfirmReservation = async () => {
        try {
            setError('');
            setSuccessMessage('');
            setReservationLoading(true);

            const equipmentPayload = Object.entries(reservationEquipment) //reservationEquipment: key = id value = min_quantity
                .map(([equipmentTypeId, quantity]) => ({ equipment_type_id: Number(equipmentTypeId), quantity: Number(quantity) }))
                .filter((item) => item.quantity > 0);

            const payload = selectedFacility ? { facility_id: selectedFacility.id, equipment: equipmentPayload } : { facility_type_id: autoAssignTypeId, equipment: equipmentPayload };

            await createReservation(payload);

            setSuccessMessage(
                selectedFacility ? `Reservation for ${selectedFacility.code} confirmed successfully.` : `A ${autoAssignType} facility was automatically assigned and reserved successfully.`
            );

            resetSelection();
            await refreshAvailability();

        } catch (err) {
            setError(err.message);
        } finally {
            setReservationLoading(false);
        }
    };

    if (loading) {
        return (
            <Container className="text-center mt-5">
                <Spinner animation="border" style={{ color: '#8a2be2' }} />
            </Container>
        );
    }

    const isReservationPanelOpen = Boolean(selectedFacility || autoAssignType);

    return (
        <>
            <Navbar variant="dark" className="mb-4 px-3 navbar-brand-custom position-relative">
                <Navbar.Brand>Sport Facility Reservation</Navbar.Brand>

                {isAuthenticated && (
                    <span className="text-white d-flex align-items-center gap-2 position-absolute top-50 start-50 translate-middle">
                        <img src="/avatar.png" alt="User avatar" style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }} />

                        {user.username} — Score:{' '}
                        <Badge bg={user.score < 0 ? 'danger' : 'light'} text={user.score < 0 ? undefined : 'dark'}>
                            {user.score}
                        </Badge>
                    </span>
                )}

                <div className="ms-auto d-flex align-items-center gap-3">
                    {isAuthenticated ? (
                        <>
                            <Button variant="outline-light" size="sm" onClick={() => navigate('/reservations')}>
                                My Reservations
                            </Button>

                            <Button variant="outline-light" size="sm" onClick={onLogout}>
                                Logout
                            </Button>
                        </>
                    ) : (
                        <Button variant="outline-light" size="sm" onClick={() => navigate('/login')}>
                            Login
                        </Button>
                    )}
                </div>
            </Navbar>

            <Container>
                {!isAuthenticated && (
                    <Alert variant="info">
                        You are browsing as a guest. Facilities and equipment availability are shown below, login to make a reservation
                    </Alert>
                )}

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

                <Row>
                    <Col md={7}>
                        <FacilityList facilities={facilities} onSelect={handleSelectFacility} onAutoSelect={handleAutoSelect} canReserve={isAuthenticated} />
                        {isAuthenticated && isReservationPanelOpen && (
                            <Card className="mb-4 card-custom">
                                <Card.Header>New Reservation</Card.Header>
                                <Card.Body>
                                    {selectedFacility ? (
                                        <>
                                            <p className="mb-1">
                                                Selected facility:{' '}
                                                <strong>{selectedFacility.code}</strong>
                                            </p>

                                            <p>
                                                Type: {selectedFacility.type}
                                            </p>
                                        </>
                                    ) : (
                                        <p>
                                            The system will automatically assign an available <strong>{autoAssignType}</strong>{' '} facility.
                                        </p>
                                    )}

                                    {isRestrictedByScore && (
                                        <Alert variant="warning" className="py-2">
                                            Your score is negative: you can only book the minimum required equipment.
                                        </Alert>
                                    )}

                                    <hr />

                                    <h6>Equipment</h6>

                                    {requiredEquipment.length === 0 ? (
                                        <p>No equipment required.</p>
                                    ) : (
                                        requiredEquipment.map((item) => {
                                            const quantity = reservationEquipment[item.id] ?? 0;
                                            const isInvalid = quantity < item.min_quantity || quantity > item.available;

                                            return (
                                                <div key={item.id} className="d-flex justify-content-between align-items-center mb-2">
                                                    <div>
                                                        <strong>{item.name}</strong>

                                                        {item.min_quantity > 0 && (
                                                            <small className="text-muted ms-2">
                                                                minimum: {item.min_quantity}
                                                            </small>
                                                        )}

                                                        <small className="text-muted ms-2">
                                                            available: {item.available}
                                                        </small>
                                                    </div>

                                                    <input type="number" min={item.min_quantity} max={item.available} value={quantity} disabled={isRestrictedByScore || reservationLoading}
                                                        onChange={(e) => {
                                                            const value = Number(e.target.value);
                                                            updateReservationEquipment({ ...reservationEquipment, [item.id]: value });
                                                        }}
                                                        className={`form-control ${isInvalid ? 'is-invalid' : ''}`}
                                                        style={{ width: '90px' }}
                                                    />
                                                </div>
                                            );
                                        })
                                    )}

                                    <div className="mt-3 d-flex gap-2">
                                        <Button className="btn-brand" size="sm" disabled={reservationLoading || hasInvalidQuantity} onClick={handleConfirmReservation}>
                                            {reservationLoading ? 'Booking...' : 'Confirm Reservation'}
                                        </Button>

                                        <Button variant="outline-secondary" size="sm" disabled={reservationLoading} onClick={resetSelection}>
                                            Cancel
                                        </Button>
                                    </div>
                                </Card.Body>
                            </Card>
                        )}
                    </Col>

                    <Col md={5}>
                        <Card className="card-custom">
                            <Card.Header>Equipment</Card.Header>
                            <Card.Body>
                                {equipment.length === 0 ? (
                                    <p>No equipment available.</p>
                                ) : (
                                    <ul className="list-unstyled mb-0">
                                        {equipment.map((item) => (
                                            <li
                                                key={item.id}
                                                className="d-flex justify-content-between border-bottom py-1"
                                            >
                                                <span>{item.name}</span>
                                                <Badge className="badge-brand">
                                                    {item.available}
                                                </Badge>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </>
    );
}

export default HomePage;
