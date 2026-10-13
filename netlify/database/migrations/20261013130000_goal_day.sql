-- A day-scoped goal applies to one local date. Null means the goal still
-- runs forward from set_at.
ALTER TABLE goals ADD COLUMN IF NOT EXISTS day TEXT;
