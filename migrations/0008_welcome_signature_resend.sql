-- Explicit one-time resend requested for existing verified accounts.
-- Keep this snapshot after outbox cleanup so deployments cannot resend it again.
CREATE TABLE welcome_signature_resends (
 user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
 queued INTEGER NOT NULL DEFAULT 0 CHECK(queued IN (0,1))
);
INSERT INTO welcome_signature_resends(user_id) SELECT id FROM users WHERE verified=1;
