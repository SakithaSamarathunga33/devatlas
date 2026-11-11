ALTER TABLE resource_annotations ADD COLUMN status TEXT;

-- A project's folder on this computer. Only ever set from a native folder dialog.
ALTER TABLE link_groups ADD COLUMN folder TEXT;

CREATE TABLE snippets (
    id TEXT PRIMARY KEY NOT NULL,
    title TEXT NOT NULL,
    language TEXT,
    code TEXT NOT NULL,
    tags TEXT NOT NULL,
    resource_id TEXT,
    group_id TEXT REFERENCES link_groups (id) ON DELETE SET NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- The last conclusive check per link.
CREATE TABLE link_checks (
    resource_id TEXT PRIMARY KEY NOT NULL,
    health TEXT NOT NULL,
    checked_at INTEGER NOT NULL
);
