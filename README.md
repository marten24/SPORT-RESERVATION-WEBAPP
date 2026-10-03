# Sport Reservation Webapp

Full-stack web app for booking sports facilities and equipment. React + Express + SQLite, session-based authentication with Passport.js and TOTP 2FA, and concurrency handling via serialized transactions.

## Tech Stack

- **Frontend**: React 19, Vite, React Router, React-Bootstrap
- **Backend**: Node.js, Express 5, Passport.js (local strategy + session auth)
- **Database**: SQLite
- **Security**: scrypt password hashing, TOTP (RFC 6238) two-factor authentication

## Getting Started

```bash
# clone the repository
git clone https://github.com/<your-username>/sport-reservation-webapp.git
cd sport-reservation-webapp

# backend
cd server
npm ci
node seed.mjs      # creates and populates sport.sqlite
npm run dev         # starts the API on http://localhost:3001 (nodemon)

# frontend (in another terminal)
cd client
npm ci
npm run dev          # starts the client on http://localhost:5173
```

## React Client Application Routes

- Route `/`: home page. Shows the list of all facilities (with availability) and all equipment (with available quantity). Visible to anyone, even without logging in. If the user is authenticated, it also allows reserving a facility (either by selecting one directly or by choosing a facility type for automatic assignment) together with the required and optional equipment.
- Route `/login`: login page. Allows a user to authenticate with username and password, optionally enabling 2FA (TOTP). If 2FA is required, the same route renders the TOTP verification form instead of the login form.
- Route `/reservations`: shows the list of the current user's active reservations, with the associated equipment. From here the user can edit the equipment of an existing reservation (adding/removing non-mandatory equipment, or only removing equipment if their score is negative) or delete a reservation. Accessible only to authenticated users.

## API Server

- POST `/api/sessions`
  - request parameters: none
  - request body: `{ username, password, use2fa }`
  - response body: if `use2fa` is `true`, `{ requires2FA: true }` and the login is left pending until 2FA is verified; otherwise `{ id, username, score }` of the authenticated user
- POST `/api/sessions/2fa`
  - request parameters: none
  - request body: `{ token }` (6-digit TOTP code)
  - response body: `{ id, username, score }` of the now fully authenticated user (score is reset to 0 if it was negative)
- GET `/api/sessions/current`
  - request parameters: none
  - response body: `{ id, username, score }` of the currently authenticated user, or `401` if not authenticated
- DELETE `/api/sessions/current`
  - request parameters: none
  - response body: none (`204 No Content`), logs out the current user and destroys the session
- DELETE `/api/sessions/2fa`
  - request parameters: none
  - response body: none (`204 No Content`), cancels a pending 2FA verification and returns to the login step

- GET `/api/facilities`
  - request parameters: none
  - response body: array of all facilities, each with `id`, `code`, `facility_type_id`, `type`, `available` (1/0). Accessible to anyone.
- GET `/api/equipment`
  - request parameters: none
  - response body: array of all equipment types, each with `id`, `name`, `total_quantity`, `available` (currently available quantity). Accessible to anyone.
- GET `/api/facilities/:id/equipment`
  - request parameters: `id` (facility id, in the URL)
  - response body: array of the equipment types associated with that facility's type, each with `id`, `name`, `min_quantity`, `available`. Accessible to anyone.

- GET `/api/reservations`
  - request parameters: none (relies on the session cookie)
  - response body: array of the current user's reservations (active and released), each with `id`, `created_at`, `released_at`, `facility_id`, `facility_code`, `facility_type`, and an `equipment` array (`equipment_type_id`, `name`, `quantity`). Requires authentication.
- POST `/api/reservations`
  - request parameters: none
  - request body: `{ facility_id, equipment }` for direct selection, or `{ facility_type_id, equipment }` for automatic assignment, where `equipment` is an array of `{ equipment_type_id, quantity }`
  - response body: `{ id }` of the newly created reservation, or an error message describing why the reservation could not be created (facility not available, not enough equipment, minimum quantity not met, too early to reserve again, negative-score restriction, etc.). Requires authentication.
- PUT `/api/reservations/:id/equipment`
  - request parameters: `id` (reservation id, in the URL)
  - request body: `{ equipment }`, an array of `{ equipment_type_id, quantity }` representing the full new equipment configuration for the reservation
  - response body: success message, or an error message (`400`/`403`/`404`/`409`) describing why the update was rejected. Requires authentication and ownership of the reservation.
- DELETE `/api/reservations/:id`
  - request parameters: `id` (reservation id, in the URL)
  - response body: none (`204 No Content`) — releases the reservation, restores facility/equipment availability, and decreases the user's score by 1. Requires authentication and ownership of the reservation.

## Database Tables

- Table `users` - contains the registered users: `id`, `username`, `password_hash`, `salt`, `totp_secret` (per-user TOTP secret), `lastTotpStep` (anti-replay for TOTP), `score` (integer, always ≤ 0)
- Table `facility_types` - contains the types of facility (Tennis, Basketball, Volleyball, Soccer, Table Tennis, Cycling): `id`, `name`
- Table `facilities` - contains the individual bookable facilities: `id`, `code`, `facility_type_id`
- Table `equipment_types` - contains the types of rentable equipment: `id`, `name`, `total_quantity`
- Table `facility_type_equipment` - associates each facility type with the equipment types it requires: `facility_type_id`, `equipment_type_id`, `min_quantity` (0 means optional)
- Table `reservations` - contains the reservations: `id`, `user_id`, `facility_id`, `created_at`, `released_at` (`NULL` while the reservation is active)
- Table `reservation_equipment` - contains the equipment rented for each reservation: `reservation_id`, `equipment_type_id`, `quantity`

## Main React Components

- `App` (in `App.jsx`): top-level component; manages the authentication state (current user, pending 2FA), routing, and session bootstrap.
- `LoginForm` (in `LoginForm.jsx`): username/password login form, with an option to require 2FA.
- `TotpForm` (in `TotpForm.jsx`): 6-digit TOTP code verification form shown after a successful username/password check when 2FA was requested.
- `HomePage` (in `HomePage.jsx`): shows facilities and equipment availability; lets authenticated users create a new reservation (direct selection or automatic assignment) choosing the equipment quantities.
- `FacilityList` (in `FacilityList.jsx`): renders the list of facilities with their availability, plus the automatic-assignment control (choose a facility type, let the server pick a free facility).
- `ReservationsPage` (in `ReservationsPage.jsx`): page wrapper for the authenticated user's reservations, with navigation and score display.
- `ReservationList` (in `ReservationList.jsx`): lists the current user's active reservations; allows editing equipment (respecting negative-score restrictions) or deleting a reservation with inline confirmation.

## Test Users

| Username | Password  | Score | Reservations |
|----------|-----------|-------|---------------|
| `alice`  | `alice123`| 0     | none |
| `bob`    | `bob123`  | -1    | T1 - Tennis (minimum equipment only) |
| `carol`  | `carol123`| -2    | B1 - Basketball (minimum equipment only) |
| `dave`   | `dave123` | 0     | V1 - Volleyball (extra optional equipment), TT1 - Table Tennis (extra equipment beyond the minimum) |

> 2FA is available for all test users via TOTP (standard RFC 6238, SHA1, 6 digits, 30s period).

## Author

- Marco Tenace
