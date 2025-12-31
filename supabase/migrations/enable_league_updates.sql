-- Drop previous policy if exists to avoid conflicts
drop policy if exists "Enable update for league admins" on "public"."leagues";

-- Enable update for league admins (Corrected)
create policy "Enable update for league admins"
on "public"."leagues"
for update
to authenticated
using (
  auth.uid() in (
    select user_id from league_members
    where league_members.league_id = leagues.id 
    and league_members.role = 'admin'
  )
  or
  is_super_admin()
);
