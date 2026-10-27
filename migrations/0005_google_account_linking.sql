-- Short-lived, browser-bound proof for adding Google to an existing password account.
CREATE TABLE google_link_requests (
 ticket_hash TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 google_subject TEXT NOT NULL,
 email TEXT NOT NULL,
 browser_hash TEXT NOT NULL,
 expires_at INTEGER NOT NULL
);
CREATE INDEX google_link_requests_expiry ON google_link_requests(expires_at);
