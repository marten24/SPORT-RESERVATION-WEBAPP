PRAGMA foreign_keys = ON;

CREATE TABLE users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    salt TEXT NOT NULL,
    totp_secret TEXT NOT NULL,
    lastTotpStep INTEGER,
    score INTEGER NOT NULL DEFAULT 0 CHECK (score <= 0)
);

CREATE TABLE facility_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE facilities (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code TEXT NOT NULL UNIQUE,
    facility_type_id INTEGER NOT NULL,
    FOREIGN KEY (facility_type_id)
        REFERENCES facility_types(id)
);

CREATE TABLE equipment_types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    total_quantity INTEGER NOT NULL CHECK (total_quantity >= 0)
);

CREATE TABLE facility_type_equipment (
    facility_type_id INTEGER NOT NULL,
    equipment_type_id INTEGER NOT NULL,
    min_quantity INTEGER NOT NULL CHECK (min_quantity >= 0),

    PRIMARY KEY (facility_type_id, equipment_type_id),

    FOREIGN KEY (facility_type_id)
        REFERENCES facility_types(id),

    FOREIGN KEY (equipment_type_id)
        REFERENCES equipment_types(id)
);

CREATE TABLE reservations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    facility_id INTEGER NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    released_at TEXT,

    FOREIGN KEY (user_id)
        REFERENCES users(id),

    FOREIGN KEY (facility_id)
        REFERENCES facilities(id)
);

CREATE TABLE reservation_equipment (
    reservation_id INTEGER NOT NULL,
    equipment_type_id INTEGER NOT NULL,
    quantity INTEGER NOT NULL CHECK (quantity > 0),

    PRIMARY KEY (reservation_id, equipment_type_id),

    FOREIGN KEY (reservation_id)
        REFERENCES reservations(id)
        ON DELETE CASCADE,

    FOREIGN KEY (equipment_type_id)
        REFERENCES equipment_types(id)
);

INSERT INTO facility_types (name) VALUES
    ('Tennis'),
    ('Basketball'),
    ('Volleyball'),
    ('Soccer'),
    ('Table Tennis'),
    ('Cycling');