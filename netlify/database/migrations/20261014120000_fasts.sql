-- A fast mark says a day with no food was a real fast. Rows are append-only
-- at the operation level; the latest set_at per day wins when folded.
ALTER TABLE operations DROP CONSTRAINT IF EXISTS operations_op_type_check;
ALTER TABLE operations ADD CONSTRAINT operations_op_type_check
  CHECK (op_type IN (
    'entry.create',
    'entry.patch',
    'entry.remove',
    'meal.create',
    'meal.update',
    'meal.remove',
    'meal.reorder',
    'goal.create',
    'fast.set'
  ));

CREATE TABLE IF NOT EXISTS fasts (
  id UUID PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES nourish_users (user_id) ON DELETE CASCADE,
  day TEXT NOT NULL,
  fasted BOOLEAN NOT NULL,
  set_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS fasts_user_day_idx ON fasts (user_id, day);
