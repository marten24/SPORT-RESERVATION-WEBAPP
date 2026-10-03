import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const db = await open({
    filename: './sport.sqlite',
    driver: sqlite3.Database
});

await db.exec('PRAGMA busy_timeout = 5000;');

let transactionQueue = Promise.resolve();

export function runInTransaction(work) {
    const run = transactionQueue.then(async () => {
        await db.run('BEGIN IMMEDIATE');
        try {
            const result = await work();
            await db.run('COMMIT');
            return result;
        } catch (err) {
            try {
                await db.run('ROLLBACK');
            } catch (rollbackErr) {
                console.error('Rollback failed:', rollbackErr);
            }
            throw err;
        }
    });

    transactionQueue = run.catch(() => {});

    return run;
}

/* ---------- USER ---------- */

export const getUserByUsername = async (username) => {
    return await db.get('SELECT * FROM users WHERE username = ?', username);
};

export const getUserById = async (id) => {
    return await db.get('SELECT * FROM users WHERE id = ?', id);
};

export const updateLastTotpStep = async (userId, lastTotpStep) => {
    await db.run(`UPDATE users SET lastTotpStep = ? WHERE id = ?`, lastTotpStep, userId);
};

export const decreaseUserScore = async (userId) => {
    await db.run(`UPDATE users SET score = score - 1 WHERE id = ?`, userId);
};

export const resetUserScore = async (userId) => {
    await db.run(`UPDATE users SET score = 0 WHERE id = ?`, userId);
};

/* ---------- RESERVATIONS ---------- */

export const getReservationsByUserId = async (userId) => {
    return await db.all(`
        SELECT
            r.id,
            r.created_at,
            r.released_at,
            f.id AS facility_id,
            f.code AS facility_code,
            ft.name AS facility_type
        FROM reservations r
        JOIN facilities f
            ON r.facility_id = f.id
        JOIN facility_types ft
            ON f.facility_type_id = ft.id
        WHERE r.user_id = ? 
        ORDER BY r.id
    `, userId);
};

export const getReservationById = async (reservationId) => {
    return await db.get(`
        SELECT
            r.id,
            r.user_id,
            r.facility_id,
            r.created_at,
            r.released_at,
            f.facility_type_id
        FROM reservations r
        JOIN facilities f
            ON r.facility_id = f.id
        WHERE r.id = ?
    `, reservationId);
};

//equipment associated with a specific reservation
export const getReservationEquipment = async (reservationId) => {
    return await db.all(`
        SELECT
            re.equipment_type_id,
            e.name,
            re.quantity
        FROM reservation_equipment re
        JOIN equipment_types e
            ON re.equipment_type_id = e.id
        WHERE re.reservation_id = ?
        ORDER BY e.id
    `, reservationId);
};

export const getActiveReservationByFacilityId = async (facilityId) => {
    return await db.get(`SELECT * FROM reservations WHERE facility_id = ? AND released_at IS NULL`, facilityId);
};

export const createReservation = async (userId, facilityId) => {
    const result = await db.run(`INSERT INTO reservations (user_id, facility_id) VALUES (?, ?)`, userId, facilityId);
    return result.lastID;
};

export const addReservationEquipment = (reservationId, equipmentTypeId, quantity) =>
    db.run(`INSERT INTO reservation_equipment(reservation_id, equipment_type_id, quantity) VALUES (?, ?, ?)`, reservationId, equipmentTypeId, quantity);

export const releaseReservation = async (reservationId) => {
    return await db.run(`UPDATE reservations SET released_at = datetime('now') WHERE id = ? AND released_at IS NULL`, reservationId);
};

//retrieves the last released reservation for a specific user and facility type, ordered by release date descending
export const getLastReleasedReservationByUserAndFacilityType = async (userId, facilityTypeId) => {
    return await db.get(`
        SELECT
            r.id,
            r.released_at,
            f.id AS facility_id,
            f.facility_type_id
        FROM reservations r
        JOIN facilities f
            ON r.facility_id = f.id
        WHERE r.user_id = ?
          AND f.facility_type_id = ?
          AND r.released_at IS NOT NULL
        ORDER BY r.released_at DESC
        LIMIT 1
    `, userId, facilityTypeId);
};

export const updateReservationEquipment = async (reservationId, equipmentTypeId, quantity) => {
    if (quantity === 0) {
        await db.run(`DELETE FROM reservation_equipment WHERE reservation_id = ? AND equipment_type_id = ?`, reservationId, equipmentTypeId);
        return;
    }

    const existing = await db.get(`SELECT * FROM reservation_equipment WHERE reservation_id = ? AND equipment_type_id = ?`, reservationId, equipmentTypeId);

    if (existing) {
        await db.run(`UPDATE reservation_equipment SET quantity = ? WHERE reservation_id = ? AND equipment_type_id = ?`, quantity, reservationId, equipmentTypeId);
    } else {
        await db.run(`INSERT INTO reservation_equipment(reservation_id, equipment_type_id, quantity) VALUES (?, ?, ?)`, reservationId, equipmentTypeId, quantity);
    }
};

/* ---------- EQUIPMENT ---------- */

export const getEquipment = async () => {
    return await db.all(`
        SELECT
            e.id, --1
            e.name, --tennis racket
            e.total_quantity, --20
            e.total_quantity - COALESCE(SUM(
                CASE
                    WHEN r.released_at IS NULL
                    THEN re.quantity 
                    ELSE 0
                END
            ), 0) AS available
        FROM equipment_types e
        LEFT JOIN reservation_equipment re
            ON re.equipment_type_id = e.id
        LEFT JOIN reservations r
            ON r.id = re.reservation_id
        GROUP BY e.id, e.name, e.total_quantity
        ORDER BY e.id
    `);
};

export const getRequiredEquipmentForFacilityType = async (facilityTypeId) => {
    return await db.all(`
        SELECT
            e.id,
            e.name,
            fte.min_quantity
        FROM facility_type_equipment fte
        JOIN equipment_types e
            ON fte.equipment_type_id = e.id
        WHERE fte.facility_type_id = ?
        ORDER BY e.id
    `, facilityTypeId);
};

export const getEquipmentForFacilityType = async (facilityTypeId) => {
    return await db.all(`
        SELECT
            e.id,
            e.name,
            fte.min_quantity,
            e.total_quantity - COALESCE(SUM(
                CASE
                    WHEN r.released_at IS NULL
                    THEN re.quantity
                    ELSE 0
                END
            ), 0) AS available
        FROM facility_type_equipment fte
        JOIN equipment_types e
            ON fte.equipment_type_id = e.id
        LEFT JOIN reservation_equipment re
            ON re.equipment_type_id = e.id
        LEFT JOIN reservations r
            ON r.id = re.reservation_id
        WHERE fte.facility_type_id = ?
        GROUP BY e.id, e.name, e.total_quantity, fte.min_quantity
        ORDER BY e.id
    `, facilityTypeId);
};

/* ---------- FACILITIES ---------- */ 

export const getFacilities = async () => {
    return await db.all(`
        SELECT
            f.id, --2
            f.code, --T2
            f.facility_type_id, --1
            ft.name AS type, --Tennis
            CASE
                WHEN r.id IS NULL THEN 1
                ELSE 0
            END AS available
        FROM facilities f
        JOIN facility_types ft
            ON f.facility_type_id = ft.id
        LEFT JOIN reservations r
            ON r.facility_id = f.id
            AND r.released_at IS NULL 
        ORDER BY ft.id, f.id
    `);
};

export const getFacilityById = async (facilityId) => {
    return await db.get(`
        SELECT
            f.id, --3
            f.code, --T3
            f.facility_type_id, --1(tennis)
            ft.name AS facility_type
        FROM facilities f
        JOIN facility_types ft
            ON f.facility_type_id = ft.id
        WHERE f.id = ?
    `, facilityId);
};

export const getAvailableFacilityByTypeId = async (facilityTypeId) => {
    return await db.get(`
        SELECT
            f.id, --3
            f.code, --T3
            f.facility_type_id --1(tennis)
        FROM facilities f
        LEFT JOIN reservations r
            ON r.facility_id = f.id
            AND r.released_at IS NULL
        WHERE f.facility_type_id = ?
            AND r.id IS NULL
        ORDER BY f.id
        LIMIT 1
    `, facilityTypeId);
};

export { db };