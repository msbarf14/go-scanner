CREATE TABLE users (
    id char(26) PRIMARY KEY,
    name text,
    username text UNIQUE,
    email text NOT NULL UNIQUE,
    password text NOT NULL,
    created_at timestamp NULL,
    updated_at timestamp NULL
);

CREATE TABLE roles (
    id char(26) PRIMARY KEY,
    name text NOT NULL,
    guard_name text NOT NULL,
    created_at timestamp NULL,
    updated_at timestamp NULL,
    UNIQUE (name, guard_name)
);

CREATE TABLE permissions (
    id char(26) PRIMARY KEY,
    name text NOT NULL,
    guard_name text NOT NULL,
    created_at timestamp NULL,
    updated_at timestamp NULL,
    UNIQUE (name, guard_name)
);

CREATE TABLE model_has_roles (
    role_id char(26) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    model_type text NOT NULL,
    model_id char(26) NOT NULL,
    PRIMARY KEY (role_id, model_id, model_type)
);

CREATE INDEX model_has_roles_model_id_model_type_index
    ON model_has_roles (model_id, model_type);

CREATE TABLE model_has_permissions (
    permission_id char(26) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    model_type text NOT NULL,
    model_id char(26) NOT NULL,
    PRIMARY KEY (permission_id, model_id, model_type)
);

CREATE INDEX model_has_permissions_model_id_model_type_index
    ON model_has_permissions (model_id, model_type);

CREATE TABLE role_has_permissions (
    permission_id char(26) NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
    role_id char(26) NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (permission_id, role_id)
);

CREATE TABLE tickets (
    id char(26) PRIMARY KEY,
    parent_id char(26) NULL REFERENCES tickets(id) ON DELETE CASCADE,
    name text NULL,
    created_at timestamp NULL,
    updated_at timestamp NULL,
    deleted_at timestamp NULL
);

CREATE INDEX tickets_parent_id_index ON tickets (parent_id);

CREATE TABLE orders (
    id char(26) PRIMARY KEY,
    user_id char(26) NULL REFERENCES users(id),
    ticket_id char(26) NULL REFERENCES tickets(id),
    number varchar(100) NULL,
    status varchar(50) NULL,
    race_pack_picked_up_at timestamp NULL,
    race_pack_picked_up_by char(26) NULL REFERENCES users(id) ON DELETE SET NULL,
    created_at timestamp NULL,
    updated_at timestamp NULL,
    deleted_at timestamp NULL
);

CREATE INDEX orders_number_index ON orders (number);
CREATE INDEX orders_status_index ON orders (status);

CREATE TABLE participants (
    id char(26) PRIMARY KEY,
    order_id char(26) NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
    name text NULL,
    bib_name text NULL,
    bib_number text NULL,
    identity varchar(20) NULL,
    identity_file text NULL,
    tanggal_lahir date NULL,
    ukuran_jersey varchar(5) NULL,
    phone varchar(20) NULL,
    email text NULL,
    name_emergency text NULL,
    phone_emergency varchar(20) NULL,
    created_at timestamp NULL,
    updated_at timestamp NULL
);

CREATE INDEX participants_order_id_index ON participants (order_id);

CREATE TABLE external_participants (
    id char(26) PRIMARY KEY,
    category_ticket_id char(26) NOT NULL REFERENCES tickets(id) ON DELETE RESTRICT,
    name varchar(255) NOT NULL,
    bib_name varchar(255) NULL,
    bib_number varchar(255) NOT NULL,
    bib_number_normalized varchar(255) NOT NULL,
    race_pack_picked_up_at timestamp NULL,
    race_pack_picked_up_by char(26) NULL REFERENCES users(id) ON DELETE SET NULL,
    import_file_name varchar(255) NULL,
    import_file_hash char(64) NULL,
    import_row_number integer NULL CHECK (import_row_number >= 0),
    imported_by char(26) NULL REFERENCES users(id) ON DELETE SET NULL,
    imported_at timestamp NULL,
    created_at timestamp NULL,
    updated_at timestamp NULL,
    deleted_at timestamp NULL,
    UNIQUE (category_ticket_id, bib_number_normalized)
);

CREATE INDEX external_participants_bib_normalized_idx ON external_participants (bib_number_normalized);
CREATE INDEX external_participants_picked_up_at_idx ON external_participants (race_pack_picked_up_at);
CREATE INDEX external_participants_picked_up_by_idx ON external_participants (race_pack_picked_up_by);
CREATE INDEX external_participants_imported_at_idx ON external_participants (imported_at);
CREATE INDEX external_participants_import_file_hash_idx ON external_participants (import_file_hash);

CREATE TABLE race_pack_scan_logs (
    id char(26) PRIMARY KEY,
    order_id char(26) NULL REFERENCES orders(id) ON DELETE CASCADE,
    external_participant_id char(26) NULL REFERENCES external_participants(id) ON DELETE CASCADE,
    scanned_by char(26) NULL REFERENCES users(id) ON DELETE SET NULL,
    result varchar(32) NOT NULL CHECK (result IN ('handed_over', 'duplicate_rejected', 'cancelled')),
    station integer NOT NULL CHECK (station >= 0),
    created_at timestamp NULL,
    updated_at timestamp NULL,
    CONSTRAINT race_pack_scan_logs_exactly_one_target CHECK (
        (order_id IS NOT NULL AND external_participant_id IS NULL)
        OR (order_id IS NULL AND external_participant_id IS NOT NULL)
    )
);

CREATE INDEX race_pack_scan_logs_order_idx ON race_pack_scan_logs (order_id);
CREATE INDEX race_pack_scan_logs_external_participant_idx ON race_pack_scan_logs (external_participant_id);
CREATE INDEX race_pack_scan_logs_created_at_idx ON race_pack_scan_logs (created_at);
CREATE INDEX race_pack_scan_logs_result_created_at_idx ON race_pack_scan_logs (result, created_at);
CREATE INDEX race_pack_scan_logs_station_created_at_idx ON race_pack_scan_logs (station, created_at);
CREATE INDEX race_pack_scan_logs_scanned_by_created_at_idx ON race_pack_scan_logs (scanned_by, created_at);
