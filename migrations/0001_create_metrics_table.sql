CREATE TABLE IF NOT EXISTS metrics (
  ip_hash TEXT NOT NULL,
  video_id TEXT NOT NULL,
  last_watch_time INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY (ip_hash, video_id)
);

CREATE TABLE IF NOT EXISTS quiz_metrics (
  ip_hash TEXT NOT NULL,
  quiz_id TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  updated_at INTEGER NOT NULL DEFAULT (strftime('%s','now')),
  PRIMARY KEY (ip_hash, quiz_id)
);