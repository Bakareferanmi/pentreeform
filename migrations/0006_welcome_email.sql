-- Keep a durable claim after old outbox entries are cleaned up.
ALTER TABLE users ADD COLUMN welcome_email_queued INTEGER NOT NULL DEFAULT 0 CHECK(welcome_email_queued IN (0,1));
-- Enable this for new registrations only. Do not email existing accounts on rollout.
UPDATE users SET welcome_email_queued=1;
