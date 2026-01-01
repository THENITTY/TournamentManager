-- Drop valid policies if they exist
drop policy if exists "League admins can manage archetypes" on archetypes;
drop policy if exists "Everyone can view archetypes" on archetypes;

-- Ensure RLS is enabled
alter table archetypes enable row level security;

-- Viewer Policy (read-only for all authenticated users)
create policy "Everyone can view archetypes"
on archetypes
for select
to authenticated
using ( true );

-- Management Policy (manage for league admins & global super admins)
create policy "League admins can manage archetypes"
on archetypes
for all
to authenticated
using (
  exists (
    select 1 from league_members
    where league_members.league_id = archetypes.league_id
    and league_members.user_id = auth.uid()
    and league_members.role in ('admin', 'co_admin')
  )
  or
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  )
)
with check (
  exists (
    select 1 from league_members
    where league_members.league_id = archetypes.league_id
    and league_members.user_id = auth.uid()
    and league_members.role in ('admin', 'co_admin')
  )
  or
  exists (
    select 1 from profiles
    where profiles.id = auth.uid()
    and profiles.role = 'super_admin'
  )
);
