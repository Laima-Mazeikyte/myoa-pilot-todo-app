-- Run this in Supabase Dashboard → SQL Editor for the project that matches your .env
-- (VITE_SUPABASE_URL). This adds user_id and RLS, and the migrate_anonymous_todos function.

-- 1. Add user_id if missing (safe if column already exists)
ALTER TABLE todos
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id);

-- Set default for new rows (existing rows may stay NULL until you backfill if needed)
ALTER TABLE todos
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- 2. Drop old policy if it exists
DROP POLICY IF EXISTS "Allow all access for now" ON todos;

-- 3. RLS policies (drop first so this script is re-runnable)
DROP POLICY IF EXISTS "Users can read own todos" ON todos;
DROP POLICY IF EXISTS "Users can create own todos" ON todos;
DROP POLICY IF EXISTS "Users can update own todos" ON todos;
DROP POLICY IF EXISTS "Users can delete own todos" ON todos;

CREATE POLICY "Users can read own todos"
  ON todos FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create own todos"
  ON todos FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own todos"
  ON todos FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own todos"
  ON todos FOR DELETE
  USING (auth.uid() = user_id);

-- 4. Function to migrate anonymous todos to signed-in user
CREATE OR REPLACE FUNCTION migrate_anonymous_todos(from_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  UPDATE todos
  SET user_id = auth.uid()
  WHERE user_id = from_user_id;
END;
$$;

GRANT EXECUTE ON FUNCTION migrate_anonymous_todos(uuid) TO authenticated;
