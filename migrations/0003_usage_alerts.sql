-- Preserve deduplication after completed email jobs have been cleaned up.
CREATE TABLE usage_alerts (
 user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
 month TEXT NOT NULL,
 quota INTEGER NOT NULL CHECK(quota>0),
 threshold INTEGER NOT NULL CHECK(threshold IN (80,95)),
 outbox_id TEXT NOT NULL UNIQUE,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,month,quota,threshold)
);
CREATE INDEX usage_alerts_month ON usage_alerts(month);
