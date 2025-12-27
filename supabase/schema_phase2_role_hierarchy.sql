
-- Update League Members Role Enum
alter table public.league_members drop constraint league_members_role_check;

alter table public.league_members 
add constraint league_members_role_check 
check (role in ('admin', 'co_admin', 'user'));

-- Migrate data
-- 'duelist' -> 'user' (assuming standard)
update public.league_members set role = 'user' where role = 'duelist';
-- 'judge' -> 'co_admin' (maybe? or user? I'll set to user to be safe)
update public.league_members set role = 'user' where role = 'judge';
-- 'organizer' -> 'admin' (should be done already, but just in case)
update public.league_members set role = 'admin' where role = 'organizer';
