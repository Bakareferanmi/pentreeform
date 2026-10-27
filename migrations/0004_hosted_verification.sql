-- Unverified messages are encrypted and expire after ten minutes. They do not
-- enter the inbox, consume the submission allowance, or create notification jobs.
CREATE TABLE pending_submissions (
  ticket_hash TEXT PRIMARY KEY,
  form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE,
  encrypted_fields TEXT NOT NULL,
  customer_origin TEXT NOT NULL,
  request_key TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  submission_id TEXT
);
CREATE INDEX pending_submissions_expiry ON pending_submissions(expires_at);
