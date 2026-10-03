import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Container, Spinner } from 'react-bootstrap';

import {
    getCurrentUser,
    logout
} from './API/API.js';

//components
import LoginForm from './components/LoginForm.jsx';
import TotpForm from './components/TotpForm.jsx';
import HomePage from './components/HomePage.jsx';
import ReservationsPage from './components/ReservationsPage.jsx';

function App() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const [twoFactorRequired, setTwoFactorRequired] = useState(false);

    useEffect(() => {
        const checkSession = async () => {
            try {
                const currentUser = await getCurrentUser();
                setUser(currentUser);
            } catch {
                setUser(null);
            } finally {
                setLoading(false);
            }
        };

        checkSession();
    }, []);

    //used by LoginForm
    const handleLoginSuccess = (result) => {
        if (result.requires2FA) {
            setTwoFactorRequired(true);
            return;
        }
        setUser(result);
    };
 
    //used by TotpForm
    const handle2FASuccess = (result) => {
        setTwoFactorRequired(false);
        setUser(result);
    };

    //used by HomePage and ReservationsPage
    const handleLogout = async () => {
        try {
            await logout();
        } finally {
            setUser(null);
            setTwoFactorRequired(false);
        }
    };

    //used by ReservationsPage
    const refreshUser = async () => {
        try {
            const currentUser = await getCurrentUser();
            setUser(currentUser);
        } catch {
            setUser(null);
        }
    };

    if (loading) {
        return (
            <Container className="text-center mt-5">
                <Spinner animation="border" style={{ color: '#8a2be2' }}/>
            </Container>
        );
    }

    return (
        <BrowserRouter>
            <Routes>
                <Route path="/" element={
                        <HomePage user={user} onLogout={handleLogout}/>
                    }
                />

                <Route path="/login" element={
                        user ? (
                            <Navigate to="/" replace />
                        ) : twoFactorRequired ? (
                            <TotpForm
                                onSuccess={handle2FASuccess}
                                onCancel={() => setTwoFactorRequired(false)}
                            />
                        ) : (
                            <LoginForm onSuccess={handleLoginSuccess} />
                        )
                    }
                />

                <Route
                    path="/reservations" element={
                        user ? (
                            <ReservationsPage user={user} onLogout={handleLogout} onUserChange={refreshUser}/>
                        ) : (
                            <Navigate to="/login" replace />
                        )
                    }
                />

                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </BrowserRouter>
    );
}

export default App;
