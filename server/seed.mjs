//seed.mjs used to initialize the database
//node seed.mjs

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { promisify } from 'util';
import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

const scrypt = promisify(crypto.scrypt);

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, 'sport.sqlite');
const SCHEMA_PATH = path.join(__dirname, 'init.sql');

//same secret for all users, but stored individually in the DB
//TOTP SECRET = LXBSMDTMSP2I5XFXIYRGFVWSFI

async function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = (await scrypt(password, salt, 32)).toString('hex');
    return { salt, passwordHash };
}

async function main() {
    if (fs.existsSync(DB_PATH)) {
        fs.unlinkSync(DB_PATH);
    }

    const db = await open({ filename: DB_PATH, driver: sqlite3.Database });
    await db.exec('PRAGMA foreign_keys = ON;');
    await db.exec(fs.readFileSync(SCHEMA_PATH, 'utf-8'));

    //code, facility_type_id
    const facilities = [
        ['T1', 1], ['T2', 1], ['T3', 1],
        ['B1', 2], ['B2', 2],
        ['V1', 3], ['V2', 3],
        ['S1', 4],
        ['TT1', 5], ['TT2', 5], ['TT3', 5], ['TT4', 5],
        ['C1', 6], ['C2', 6]
    ];
    for (const [code, facilityTypeId] of facilities) {
        await db.run('INSERT INTO facilities (code, facility_type_id) VALUES (?, ?)', code, facilityTypeId);
    }

    const equipmentTypes = [
        ['Tennis racket', 8],
        ['Tennis balls', 7],
        ['Towels', 4],
        ['Basketball', 2],
        ['Cones', 4],
        ['Volleyball', 2],
        ['Pair of knee pads', 10],
        ['Soccer ball', 2],
        ['Pair of soccer shoes', 12],
        ['Pair of goalkeeper gloves', 2],
        ['Table tennis rackets', 8],
        ['Table tennis balls', 4],
        ['Bicycle', 4],
        ['Helmet', 4],
        ['Repair kit', 1]
    ];
    for (const [name, totalQuantity] of equipmentTypes) {
        await db.run('INSERT INTO equipment_types (name, total_quantity) VALUES (?, ?)', name, totalQuantity);
    }

    //facility_type_id | equipment_type_id | min_quantity
    const requirements = [
        [1, 1, 2], [1, 2, 3], [1, 3, 0], //Tennis
        [2, 4, 1], [2, 5, 0], //Basketball
        [3, 6, 1], [3, 7, 0], //Volleyball
        [4, 8, 1], [4, 9, 10], [4, 10, 0], //Soccer
        [5, 11, 2], [5, 12, 1], //Table Tennis
        [6, 13, 1], [6, 14, 1], [6, 15, 0] //Cycling
    ];
    for (const [facilityTypeId, equipmentTypeId, minQuantity] of requirements) {
        await db.run(
            'INSERT INTO facility_type_equipment (facility_type_id, equipment_type_id, min_quantity) VALUES (?, ?, ?)',
            facilityTypeId, equipmentTypeId, minQuantity
        );
    }

    //1 user without reservations, 2 with one, 1 with two; bob and carol with negative score
    const users = [
        { username: 'alice', password: 'alice123', score: 0 },
        { username: 'bob', password: 'bob123', score: -1 },
        { username: 'carol', password: 'carol123', score: -2 },
        { username: 'dave', password: 'dave123', score: 0 }
    ];

    const userIds = {};

    for (const user of users) {
        const { salt, passwordHash } = await hashPassword(user.password);

        const result = await db.run(
            'INSERT INTO users (username, password_hash, salt, totp_secret, score) VALUES (?, ?, ?, ?, ?)',
            user.username,
            passwordHash,
            salt,
            'LXBSMDTMSP2I5XFXIYRGFVWSFI', //same secret for all users, but stored individually in the DB
            user.score
        );

        userIds[user.username] = result.lastID;
    }

    const getFacilityId = async (code) => {
        const row = await db.get('SELECT id FROM facilities WHERE code = ?', code);
        return row.id;
    };

    const createReservation = async (username, facilityCode, equipmentItems) => {
        const facilityId = await getFacilityId(facilityCode);
        const result = await db.run(
            'INSERT INTO reservations (user_id, facility_id) VALUES (?, ?)',
            userIds[username], facilityId
        );
        for (const [equipmentTypeId, quantity] of equipmentItems) {
            if (quantity > 0) {
                await db.run(
                    'INSERT INTO reservation_equipment (reservation_id, equipment_type_id, quantity) VALUES (?, ?, ?)',
                    result.lastID, equipmentTypeId, quantity
                );
            }
        }
    };

    //bob and carol: only the mandatory minimum (negative score). dave: extra/optional beyond the minimum
    await createReservation('bob', 'T1', [[1, 2], [2, 3]]);
    await createReservation('carol', 'B1', [[4, 1]]);
    await createReservation('dave', 'V1', [[6, 1], [7, 2]]);
    await createReservation('dave', 'TT1', [[11, 3], [12, 2]]);

    console.log('Seed completed.');
    console.table(users.map(({ username, password, score }) => ({ username, password, initialScore: score })));

    await db.close();
}

main().catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
});
