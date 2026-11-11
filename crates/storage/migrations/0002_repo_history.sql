-- The last release check per repository. A NULL tag means the repository had no release.
CREATE TABLE repo_release_checks (
    full_name TEXT PRIMARY KEY NOT NULL,
    checked_at INTEGER NOT NULL,
    tag TEXT,
    name TEXT,
    url TEXT,
    published_at TEXT
);

-- One star count per repository per day (days since the Unix epoch).
CREATE TABLE repo_star_snapshots (
    full_name TEXT NOT NULL,
    day INTEGER NOT NULL,
    stars INTEGER NOT NULL,
    PRIMARY KEY (full_name, day)
);
