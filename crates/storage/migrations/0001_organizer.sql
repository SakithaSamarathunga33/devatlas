-- What the user added to a link. Links live in browser bookmarks and saved-links.json, so
-- resource ids here have no foreign key: a removed link keeps its notes if it comes back.
CREATE TABLE resource_annotations (
    resource_id TEXT PRIMARY KEY NOT NULL,
    category TEXT,
    note TEXT
);

CREATE TABLE resource_tags (
    resource_id TEXT NOT NULL,
    tag TEXT NOT NULL,
    position INTEGER NOT NULL,
    PRIMARY KEY (resource_id, tag)
);

-- Collections and projects: named groups of links.
CREATE TABLE link_groups (
    id TEXT PRIMARY KEY NOT NULL,
    kind TEXT NOT NULL CHECK (kind IN ('collection', 'project')),
    name TEXT NOT NULL,
    description TEXT,
    created_at INTEGER NOT NULL
);

CREATE TABLE group_resources (
    group_id TEXT NOT NULL REFERENCES link_groups (id) ON DELETE CASCADE,
    resource_id TEXT NOT NULL,
    PRIMARY KEY (group_id, resource_id)
);

CREATE INDEX group_resources_by_resource ON group_resources (resource_id);
