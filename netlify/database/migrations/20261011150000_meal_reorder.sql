-- Allow meal.reorder on databases created before that op existed.
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
    'goal.create'
  ));
