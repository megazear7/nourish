-- Competitions are shared. The food log stays private.
-- A member sees day labels, points, and who is still in. Not calories or meals.
-- start_day and month_end are calendar dates in the host timezone, stored as text
-- so a date does not shift when the database session is UTC.

CREATE TABLE IF NOT EXISTS competitions (
  id UUID PRIMARY KEY,
  host_user_id TEXT NOT NULL REFERENCES nourish_users (user_id),
  kind TEXT NOT NULL CHECK (kind IN ('last_one_standing', 'best_of_month')),
  host_timezone TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  started_at TIMESTAMPTZ,
  start_day TEXT,
  month_end TEXT
);

CREATE TABLE IF NOT EXISTS competition_members (
  competition_id UUID NOT NULL REFERENCES competitions (id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  user_id TEXT,
  role TEXT NOT NULL CHECK (role IN ('host', 'player')),
  status TEXT NOT NULL CHECK (status IN ('accepted', 'pending')),
  timezone TEXT,
  PRIMARY KEY (competition_id, email)
);

CREATE INDEX IF NOT EXISTS competition_members_email_idx
  ON competition_members (email);

CREATE INDEX IF NOT EXISTS competition_members_user_idx
  ON competition_members (user_id);

-- Emails a host has typed in before. Removing or declining a seat does not forget them.
CREATE TABLE IF NOT EXISTS competition_suggestions (
  host_user_id TEXT NOT NULL REFERENCES nourish_users (user_id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  PRIMARY KEY (host_user_id, email)
);
