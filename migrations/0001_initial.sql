PRAGMA foreign_keys = ON;
CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE, name TEXT NOT NULL, workspace TEXT NOT NULL, password_hash TEXT NOT NULL, verified INTEGER NOT NULL DEFAULT 0, plan TEXT NOT NULL DEFAULT 'Free' CHECK(plan IN ('Free','Starter','Pro','Agency')), paid_until INTEGER NOT NULL DEFAULT 0, customer_code TEXT, created_at INTEGER NOT NULL);
CREATE TABLE sessions (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, expires_at INTEGER NOT NULL);
CREATE INDEX sessions_user ON sessions(user_id);
CREATE TABLE auth_tokens (token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, kind TEXT NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE forms (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, domain TEXT NOT NULL, redirect TEXT NOT NULL DEFAULT '', active INTEGER NOT NULL DEFAULT 1, created_at INTEGER NOT NULL);
CREATE INDEX forms_user ON forms(user_id);
CREATE TABLE submissions (id TEXT PRIMARY KEY, form_id TEXT NOT NULL REFERENCES forms(id) ON DELETE CASCADE, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, name TEXT NOT NULL, email TEXT NOT NULL, subject TEXT NOT NULL, message TEXT NOT NULL, fields TEXT NOT NULL, created_at INTEGER NOT NULL, month TEXT NOT NULL, is_read INTEGER NOT NULL DEFAULT 0, spam INTEGER NOT NULL DEFAULT 0, request_key TEXT, UNIQUE(form_id,request_key));
CREATE INDEX submissions_user_date ON submissions(user_id,created_at DESC);
CREATE TABLE monthly_usage (user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, month TEXT NOT NULL, count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(user_id,month));
CREATE TABLE rate_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at INTEGER NOT NULL);
CREATE TABLE outbox (id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, submission_id TEXT REFERENCES submissions(id) ON DELETE CASCADE, recipient TEXT NOT NULL, payload TEXT NOT NULL, kind TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, available_at INTEGER NOT NULL, lease_until INTEGER NOT NULL DEFAULT 0, provider_id TEXT, error TEXT NOT NULL DEFAULT '', created_at INTEGER NOT NULL);
CREATE INDEX outbox_due ON outbox(state,available_at,lease_until);
CREATE UNIQUE INDEX outbox_submission ON outbox(submission_id) WHERE submission_id IS NOT NULL;
CREATE UNIQUE INDEX outbox_provider ON outbox(provider_id) WHERE provider_id IS NOT NULL;
CREATE TABLE email_events (id TEXT PRIMARY KEY, provider_id TEXT NOT NULL, type TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE INDEX events_provider ON email_events(provider_id,created_at);
CREATE TABLE suppressions (email TEXT PRIMARY KEY COLLATE NOCASE, reason TEXT NOT NULL, created_at INTEGER NOT NULL);
CREATE TABLE checkouts (reference TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, plan TEXT NOT NULL, plan_code TEXT NOT NULL, amount INTEGER NOT NULL, currency TEXT NOT NULL, customer_code TEXT, paid INTEGER NOT NULL DEFAULT 0, state TEXT NOT NULL DEFAULT 'pending', created_at INTEGER NOT NULL);
CREATE UNIQUE INDEX one_pending_checkout ON checkouts(user_id) WHERE state='pending';
CREATE TABLE subscriptions (code TEXT PRIMARY KEY, user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE, customer_code TEXT NOT NULL, plan_code TEXT NOT NULL, plan TEXT NOT NULL, status TEXT NOT NULL, last_payment_at INTEGER NOT NULL DEFAULT 0);
CREATE TABLE billing_events (reference TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE, created_at INTEGER NOT NULL);
CREATE TRIGGER form_limit BEFORE INSERT ON forms WHEN NEW.active=1 BEGIN
 SELECT CASE WHEN (SELECT COUNT(*) FROM forms WHERE user_id=NEW.user_id AND active=1) >= (SELECT CASE WHEN paid_until <= unixepoch() THEN 2 WHEN plan='Starter' THEN 5 WHEN plan='Pro' THEN 20 WHEN plan='Agency' THEN 50 ELSE 2 END FROM users WHERE id=NEW.user_id) THEN RAISE(ABORT,'FORM_LIMIT') END;
END;
CREATE TRIGGER submission_limit BEFORE INSERT ON submissions WHEN NEW.spam=0 BEGIN
 SELECT CASE WHEN COALESCE((SELECT count FROM monthly_usage WHERE user_id=NEW.user_id AND month=NEW.month),0) >= (SELECT CASE WHEN paid_until <= unixepoch() THEN 100 WHEN plan='Starter' THEN 1000 WHEN plan='Pro' THEN 5000 WHEN plan='Agency' THEN 15000 ELSE 100 END FROM users WHERE id=NEW.user_id) THEN RAISE(ABORT,'SUBMISSION_LIMIT') END;
END;
CREATE TRIGGER submission_usage AFTER INSERT ON submissions WHEN NEW.spam=0 BEGIN
 INSERT INTO monthly_usage(user_id,month,count) VALUES(NEW.user_id,NEW.month,1) ON CONFLICT(user_id,month) DO UPDATE SET count=count+1;
END;
