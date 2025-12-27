-- Allow authenticated users to join leagues (Insert their own row)
CREATE POLICY "Users can join leagues"
ON league_members
FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Ensure users can view members (if not already set)
CREATE POLICY "Users can view league members"
ON league_members
FOR SELECT
TO authenticated
USING (true);

-- Allow users to see their own pending status (already covered by above, but ensuring)
