
-- Update the check constraint to allow 'admin' instead of 'organizer'
alter table public.league_members drop constraint league_members_role_check;

alter table public.league_members 
add constraint league_members_role_check 
check (role in ('admin', 'duelist', 'judge'));

-- Migrate existing data
update public.league_members 
set role = 'admin' 
where role = 'organizer';
