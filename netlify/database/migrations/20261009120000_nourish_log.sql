-- Nourish food log. The operations table is append-only.
-- calorie_entries, meals, and goals are the folded read model for one user.
-- Deleting a nourish_users row cascades to that user's log. The identity
-- console does not do that; it only deletes activity blobs.

CREATE TABLE IF NOT EXISTS nourish_users (
  user_id TEXT PRIMARY KEY,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS operations (
  op_id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES nourish_users (user_id) ON DELETE CASCADE,
  device_id UUID,
  entity_id UUID NOT NULL,
  op_type TEXT NOT NULL CHECK (op_type IN (
    'entry.create',
    'entry.patch',
    'entry.remove',
    'meal.create',
    'meal.update',
    'meal.remove',
    'goal.create'
  )),
  occurred_at TIMESTAMPTZ NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  body JSONB NOT NULL
);

CREATE INDEX IF NOT EXISTS operations_user_idx
  ON operations (user_id, occurred_at, op_id);

CREATE TABLE IF NOT EXISTS calorie_entries (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES nourish_users (user_id) ON DELETE CASCADE,
  calories INTEGER NOT NULL CHECK (calories > 0),
  eaten_at TIMESTAMPTZ NOT NULL,
  meal_id UUID,
  meal_title TEXT,
  meal_description TEXT,
  removed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS calorie_entries_user_idx ON calorie_entries (user_id);

CREATE TABLE IF NOT EXISTS meals (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES nourish_users (user_id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  calories INTEGER NOT NULL CHECK (calories >= 0),
  removed BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS meals_user_idx ON meals (user_id);

CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES nourish_users (user_id) ON DELETE CASCADE,
  calories INTEGER NOT NULL CHECK (calories > 0),
  set_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS goals_user_set_idx ON goals (user_id, set_at);
