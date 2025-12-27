
-- 1. Drop the old constraint first (if it exists) so we can update values freely
alter table public.league_members drop constraint if exists league_members_role_check;

-- 2. Migrate the data to the new valid values
update public.league_members set role = 'user' where role = 'duelist';
update public.league_members set role = 'user' where role = 'judge';
update public.league_members set role = 'admin' where role = 'organizer';

-- 3. Now that all data is clean, add the strict constraint
alter table public.league_members 
add constraint league_members_role_check 
check (role in ('admin', 'co_admin', 'user'));
