import { useNavigate } from 'react-router-dom';
import { Container, Navbar, Button, Badge } from 'react-bootstrap';

import ReservationList from './ReservationList.jsx';

function ReservationsPage({ user, onLogout, onUserChange }) { //from App.jsx, user = currentUser, onLogout = handleLogout, onUserChange = refreshUser
    const navigate = useNavigate();

    return (
        <>
            <Navbar variant="dark" className="mb-4 px-3 navbar-brand-custom">
                <Navbar.Brand>My Reservations</Navbar.Brand>

                <div className="ms-auto d-flex align-items-center gap-3">
                    <span className="text-white">
                        {user.username} — Score:{' '}
                        <Badge bg={user.score < 0 ? 'danger' : 'light'} text={user.score < 0 ? undefined : 'dark'}>
                            {user.score}
                        </Badge>
                    </span>

                    <Button variant="outline-light" size="sm" onClick={() => navigate('/')}>
                        Back to Home
                    </Button>

                    <Button variant="outline-light" size="sm" onClick={onLogout}>
                        Logout
                    </Button>
                </div>
            </Navbar>

            <Container>
                <ReservationList user={user} onChanged={onUserChange}/>
            </Container>
        </>
    );
}

export default ReservationsPage;