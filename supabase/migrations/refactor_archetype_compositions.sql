-- Drop existing table to rebuild structure
drop table if exists archetype_compositions;

-- Recreate with card_id instead of component_archetype_id
create table archetype_compositions (
  id uuid default gen_random_uuid() primary key,
  hybrid_archetype_id uuid references archetypes(id) on delete cascade,
  card_id text references cards(id) on delete cascade,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  unique(hybrid_archetype_id, card_id)
);

-- RLS Policies
alter table archetype_compositions enable row level security;

create policy "Everyone can view compositions"
on archetype_compositions for select
to authenticated
using ( true );

create policy "Admins can manage compositions"
on archetype_compositions for all
to authenticated
using (
    exists (
        select 1 from archetypes a
        join league_members lm on a.league_id = lm.league_id
        where a.id = archetype_compositions.hybrid_archetype_id
        and lm.user_id = auth.uid()
        and lm.role in ('admin', 'co_admin')
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
        select 1 from archetypes a
        join league_members lm on a.league_id = lm.league_id
        where a.id = archetype_compositions.hybrid_archetype_id
        and lm.user_id = auth.uid()
        and lm.role in ('admin', 'co_admin')
    )
    or
    exists (
        select 1 from profiles
        where profiles.id = auth.uid()
        and profiles.role = 'super_admin'
    )
);
