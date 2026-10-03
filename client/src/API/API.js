const API_URL = 'http://localhost:3001/api';

async function request(url, options = {}) {
    const response = await fetch(`${API_URL}${url}`, {
        credentials: 'include', //include cookies
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        ...options
    });

    if (response.status === 204) { //204 No Content
        return null;
    }

    const data = await response.json();

    if (!response.ok) {
        throw new Error(data.error || 'Request failed');
    }

    return data;
}


// ---------- SESSION ----------

export async function login(username, password, use2fa) {
    return request('/sessions', { //http://localhost:3001/api/sessions
        method: 'POST',
        body: JSON.stringify({
            username,
            password,
            use2fa
        })
    });
}

export async function verify2FA(token) {
    return request('/sessions/2fa', {
        method: 'POST',
        body: JSON.stringify({
            token
        })
    });
}

export async function getCurrentUser() {
    return request('/sessions/current');
}

export async function logout() {
    return request('/sessions/current', {
        method: 'DELETE'
    });
}

export async function cancel2FA() {
    return request('/sessions/2fa', {
        method: 'DELETE'
    });
}


// ---------- FACILITIES ----------

export async function getFacilities() {
    return request('/facilities');
}

export async function getEquipment() {
    return request('/equipment');
}

export async function getFacilityEquipment(facilityId) {
    return request(`/facilities/${facilityId}/equipment`);
}


// ---------- RESERVATIONS ----------

export async function getReservations() {
    return request('/reservations');
}

export async function createReservation(data) {
    return request('/reservations', {
        method: 'POST',
        body: JSON.stringify(data)
    });
}

export async function updateReservationEquipment(id, equipment) {
    return request(`/reservations/${id}/equipment`, {
        method: 'PUT',
        body: JSON.stringify({
            equipment
        })
    });
}

export async function releaseReservation(id) {
    return request(`/reservations/${id}`, {
        method: 'DELETE'
    });
}