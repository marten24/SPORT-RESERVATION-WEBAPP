import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Container, Row, Col, Card, Form, Button, Alert, Navbar } from 'react-bootstrap';
import { login } from '../API/API.js';

function LoginForm({ onSuccess }) {
    const navigate = useNavigate();

    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [use2fa, setUse2fa] = useState(false);
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();

        setError('');
        setLoading(true);

        try {
            const result = await login(username, password, use2fa);
            onSuccess(result);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <Navbar variant="dark" className="mb-4 px-3 navbar-brand-custom">
                <Navbar.Brand>Sport Facility Reservation</Navbar.Brand>
            </Navbar>

            <Container>
                <Row className="justify-content-center">
                    <Col md={6} lg={4}>
                        <Card className="card-custom">
                            <Card.Header>Login</Card.Header>
                            <Card.Body>
                                {error && (
                                    <Alert variant="danger" dismissible onClose={() => setError('')}>
                                        {error}
                                    </Alert>
                                )}

                                <Form onSubmit={handleSubmit}>
                                    <Form.Group className="mb-3">
                                        <Form.Label>Username</Form.Label>
                                        <Form.Control type="text" value={username} onChange={(event) => setUsername(event.target.value)}required/>
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Label>Password</Form.Label>
                                        <Form.Control type="password" value={password} onChange={(event) => setPassword(event.target.value)} required/>
                                    </Form.Group>

                                    <Form.Group className="mb-3">
                                        <Form.Check type="checkbox" label="Use 2FA" checked={use2fa} onChange={(event) => setUse2fa(event.target.checked)}/>
                                    </Form.Group>

                                    <div className="d-flex">
                                        <Button type="submit" className="btn-brand flex-grow-1" disabled={loading}>
                                            {loading ? 'Logging in...' : 'Login'}
                                        </Button>

                                        <Button type="button" variant="outline-secondary" className="ms-2" disabled={loading} onClick={() => navigate('/')}>
                                            Back
                                        </Button>
                                    </div>
                                </Form>
                            </Card.Body>
                        </Card>
                    </Col>
                </Row>
            </Container>
        </>
    );
}

export default LoginForm;