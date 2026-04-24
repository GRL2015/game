PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tg_user_id TEXT UNIQUE,
  username TEXT,
  avatar TEXT,
  banner TEXT,
  premium INTEGER NOT NULL DEFAULT 0,
  premium_until TEXT,
  soft_currency INTEGER NOT NULL DEFAULT 0,
  hard_currency INTEGER NOT NULL DEFAULT 0,
  best_score INTEGER NOT NULL DEFAULT 0,
  xp INTEGER NOT NULL DEFAULT 0,
  level INTEGER NOT NULL DEFAULT 1,
  streak INTEGER NOT NULL DEFAULT 0,
  last_login TEXT,
  rival_slots INTEGER NOT NULL DEFAULT 3,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS inventories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  qty INTEGER NOT NULL DEFAULT 1,
  equipped INTEGER NOT NULL DEFAULT 0,
  metadata TEXT,
  UNIQUE(user_id, item_type, item_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS matches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  score INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  result TEXT NOT NULL,
  payload TEXT,
  ip_hash TEXT,
  device_fingerprint TEXT,
  suspicious INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS leaderboards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  board_type TEXT NOT NULL,
  score INTEGER NOT NULL,
  season_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, board_type, season_key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS missions_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  mission_id TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  claimed INTEGER NOT NULL DEFAULT 0,
  period_key TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, mission_id, period_key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS events_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  event_id TEXT NOT NULL,
  pass_level INTEGER NOT NULL DEFAULT 1,
  pass_xp INTEGER NOT NULL DEFAULT 0,
  premium_unlocked INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, event_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS purchases (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  provider TEXT NOT NULL,
  provider_txn_id TEXT,
  sku TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  status TEXT NOT NULL,
  payload TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournaments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_key TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL,
  premium_only INTEGER NOT NULL DEFAULT 0,
  entry_fee INTEGER NOT NULL DEFAULT 0,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS tournament_entries (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tournament_id INTEGER NOT NULL,
  user_id INTEGER NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  joined_at TEXT NOT NULL,
  UNIQUE(tournament_id, user_id),
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS analytics_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  event_name TEXT NOT NULL,
  properties TEXT,
  session_id TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS friends (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  friend_user_id INTEGER NOT NULL,
  relationship TEXT NOT NULL DEFAULT 'friend',
  rival_rank INTEGER,
  updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, friend_user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(friend_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rivals (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  rival_user_id INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, rival_user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(rival_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS challenge_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  link_token TEXT UNIQUE NOT NULL,
  from_user_id INTEGER NOT NULL,
  to_user_id INTEGER,
  target_score INTEGER NOT NULL,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY(from_user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(to_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS comeback_claims (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  claim_key TEXT NOT NULL,
  claimed_at TEXT NOT NULL,
  UNIQUE(user_id, claim_key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS shop_rotations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  day_key TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, day_key),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS payment_verifications (
  id TEXT PRIMARY KEY,
  user_id INTEGER,
  provider TEXT NOT NULL,
  order_id TEXT,
  sku TEXT NOT NULL,
  amount_cents INTEGER NOT NULL,
  currency TEXT NOT NULL,
  verified INTEGER NOT NULL DEFAULT 0,
  reason TEXT,
  payload TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS friendships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  friend_user_id INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE(user_id, friend_user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(friend_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS rival_links (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  rival_user_id INTEGER NOT NULL,
  rival_rank INTEGER,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, rival_user_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY(rival_user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS comeback_rewards (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  reward_type TEXT NOT NULL DEFAULT 'bundle',
  reward_value TEXT,
  claimed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  claimed_at TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS starter_funnel (
  id TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  accepted INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS ab_assignments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER,
  test_name TEXT NOT NULL,
  variant TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE(user_id, test_name),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE SET NULL
);
