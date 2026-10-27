-- One-time eligibility snapshot for accounts excluded from the initial rollout.
ALTER TABLE users ADD COLUMN welcome_email_backfill INTEGER NOT NULL DEFAULT 0 CHECK(welcome_email_backfill IN (0,1));
UPDATE users SET welcome_email_backfill=1
WHERE welcome_email_queued=1
  AND NOT EXISTS (SELECT 1 FROM outbox WHERE outbox.user_id=users.id AND outbox.kind='welcome');
