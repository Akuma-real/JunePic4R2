CREATE TABLE IF NOT EXISTS upload_tokens (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT NOT NULL,
    token_hash TEXT NOT NULL UNIQUE,
    created_at INTEGER NOT NULL DEFAULT (unixepoch()),
    last_used_at INTEGER,
    revoked INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_upload_tokens_user ON upload_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_upload_tokens_token_hash ON upload_tokens(token_hash);
