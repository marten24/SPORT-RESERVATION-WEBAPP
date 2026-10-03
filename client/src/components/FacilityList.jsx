import { useState } from 'react';
import { ListGroup, Badge, Button, Card, Form, Row, Col } from 'react-bootstrap';

function FacilityList({ facilities, onSelect, onAutoSelect, canReserve }) {
    const [selectedType, setSelectedType] = useState('');

    const facilityTypes = [
        ...new Set(facilities.map((facility) => facility.type))
    ];

    const handleAutoReserve = () => {
        if (!selectedType) {
            return;
        }

        const representativeFacility = facilities.find(
            (facility) => facility.type === selectedType
        );

        if (representativeFacility) {
            onAutoSelect(selectedType, representativeFacility.id);
        }
    };

    return (
        <>
            <Card className="mb-4 card-custom">
                <Card.Header>Facilities</Card.Header>
                <Card.Body>
                    {facilities.length === 0 ? (
                        <p>No facilities available.</p>
                    ) : (
                        <ListGroup variant="flush">
                            {facilities.map((facility) => (
                                <ListGroup.Item key={facility.id} className="d-flex justify-content-between align-items-center">
                                    <div>
                                        <strong>{facility.code}</strong>
                                        {' — '}
                                        {facility.type}
                                        {' '}
                                        <Badge bg={Boolean(facility.available) ? undefined : 'secondary'} className={Boolean(facility.available) ? 'badge-brand' : ''}>
                                            {Boolean(facility.available) ? 'Available' : 'Occupied'}
                                        </Badge>
                                    </div>

                                    {Boolean(facility.available) && canReserve && (
                                        <Button size="sm" className="btn-brand" onClick={() => onSelect(facility)}>
                                            Reserve
                                        </Button>
                                    )}
                                </ListGroup.Item>
                            ))}
                        </ListGroup>
                    )}
                </Card.Body>
            </Card>

            {canReserve && (
                <Card className="mb-4 card-custom">
                    <Card.Header>Automatic Assignment</Card.Header>
                    <Card.Body>
                        <p className="text-muted">
                            Let the system pick an available facility of the
                            chosen type for you.
                        </p>

                        <Row className="align-items-end g-2">
                            <Col xs={8}>
                                <Form.Select value={selectedType} onChange={(e) => setSelectedType(e.target.value)}>
                                    <option value="">Choose a facility type...</option>
                                    {facilityTypes.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </Form.Select>
                            </Col>

                            <Col xs={4}>
                                <Button className="btn-brand w-100" disabled={!selectedType} onClick={handleAutoReserve}>
                                    Auto Reserve
                                </Button>
                            </Col>
                        </Row>
                    </Card.Body>
                </Card>
            )}
        </>
    );
}

export default FacilityList;
