-- Enable RLS on profiles if not already enabled (it should be)
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

-- Drop existing read policy if it exists (to avoid conflicts or duplicates)
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON profiles; -- In case this was the restrictive one

-- Create a new policy that allows ALL authenticated users to view ALL profiles
-- This is necessary so users can see who else is in the league (names, avatars, roles)
CREATE POLICY "Enable read access for all authenticated users"
ON "public"."profiles"
FOR SELECT
TO authenticated
USING (true);
