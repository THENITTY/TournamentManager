-- Enable RLS (Should already be enabled)
ALTER TABLE league_members ENABLE ROW LEVEL SECURITY;

-- 1. SUPER ADMIN POLICY (Update & Delete)
-- Allows Super Admins to do anything
CREATE POLICY "Super Admins can update any league member"
ON league_members
FOR UPDATE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);

CREATE POLICY "Super Admins can delete any league member"
ON league_members
FOR DELETE
TO authenticated
USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'super_admin'
);

-- 2. LEAGUE ADMIN POLICY (Update & Delete)
-- Allows League Admins to update/delete members OF THEIR OWN LEAGUE, BUT ONLY "BELOW" THEM.
-- They CANNOT update/delete other 'admin' users.

CREATE POLICY "League Admins can update valid members"
ON league_members
FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM league_members as my_membership
    WHERE my_membership.league_id = league_members.league_id
    AND my_membership.user_id = auth.uid()
    AND my_membership.role = 'admin'
  )
  AND league_members.role != 'admin' -- Cannot target other Admins
);

CREATE POLICY "League Admins can delete valid members"
ON league_members
FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM league_members as my_membership
    WHERE my_membership.league_id = league_members.league_id
    AND my_membership.user_id = auth.uid()
    AND my_membership.role = 'admin'
  )
  AND league_members.role != 'admin' -- Cannot target other Admins
);
