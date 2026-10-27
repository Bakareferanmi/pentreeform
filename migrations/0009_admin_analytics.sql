-- First-party product activity. No IP, user-agent, cookies or message contents.
ALTER TABLE users ADD COLUMN last_seen_at INTEGER;
CREATE TABLE user_activity_days (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 day TEXT NOT NULL,
 PRIMARY KEY(user_id,day)
);
CREATE INDEX user_activity_day ON user_activity_days(day,user_id);
CREATE TABLE analytics_daily (
 day TEXT NOT NULL,
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 submissions INTEGER NOT NULL DEFAULT 0 CHECK(submissions>=0),
 PRIMARY KEY(day,user_id)
);
-- Earlier dates reflect retained messages, not a reconstructed lifetime history.
INSERT INTO analytics_daily(day,user_id,submissions)
 SELECT strftime('%Y-%m-%d',created_at,'unixepoch'),user_id,COUNT(*) FROM submissions GROUP BY 1,2;
CREATE TRIGGER analytics_submission AFTER INSERT ON submissions BEGIN
 INSERT INTO analytics_daily(day,user_id,submissions)
 VALUES(strftime('%Y-%m-%d',NEW.created_at,'unixepoch'),NEW.user_id,1)
 ON CONFLICT(day,user_id) DO UPDATE SET submissions=submissions+1;
END;
CREATE INDEX users_created ON users(created_at DESC,id DESC);
CREATE INDEX outbox_created ON outbox(created_at,user_id,state);
