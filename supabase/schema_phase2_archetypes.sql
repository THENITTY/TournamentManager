-- Create Archetypes table for the "Deck Library"
create table public.archetypes (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  cover_card_id text references public.cards(id), -- Optional link to specific card
  cover_image_url text not null, -- The visual representation
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS: Public read, Admin write
alter table public.archetypes enable row level security;

create policy "Archetypes are viewable by everyone" 
  on public.archetypes for select 
  using (true);

create policy "Archetypes are insertable by super_admin only" 
  on public.archetypes for insert 
  with check (public.is_super_admin());

create policy "Archetypes are deletable by super_admin only" 
  on public.archetypes for delete 
  using (public.is_super_admin());

-- Modify Decks to link to Archetypes instead of just being freeform
-- We will make decks.name optional if we rely on archetype link, or just keep it as a cache.
-- Actually, the 'decks' table currently links user + league. It should now ALSO link to an archetype.
alter table public.decks 
  add column archetype_id uuid references public.archetypes(id);
