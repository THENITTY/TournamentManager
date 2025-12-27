-- Phase 2 Revised: League-Centric Decks

-- 1. Create Leagues Table
CREATE TABLE public.leagues (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    status text NOT NULL DEFAULT 'ongoing' CHECK (status IN ('ongoing', 'completed')),
    start_date timestamptz DEFAULT now(),
    created_at timestamptz DEFAULT now()
);

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view leagues
CREATE POLICY "Public Read Leagues" 
ON public.leagues FOR SELECT 
USING (true);

-- Policy: Super Admins can manage leagues
CREATE POLICY "Super Admins Manage Leagues" 
ON public.leagues FOR ALL
USING (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
);


-- 2. Modify Decks Table (Add league_id and restrict permissions)
-- Note: If you already ran previous schema, we need to alter table.
-- If fresh, we define it here. Since I am creating a "Phase 2.1" script, I will assume Alter.

-- Add league_id column
ALTER TABLE public.decks 
ADD COLUMN league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE;

-- Enforce Not Null ? Maybe later. For now, let's keep it nullable to avoid breaking existing (though empty) rows.
-- Actually, user wants decks ONLY in leagues. We should enforce it for new ones.
-- But first, let's update permissions.

-- DROP old policies that allowed User Writes
DROP POLICY IF EXISTS "Users can manage own decks" ON public.decks;

-- NEW Policy: Users can VIEW their own decks (Read Only)
CREATE POLICY "Users view own decks"
ON public.decks FOR SELECT
USING (auth.uid() = user_id);

-- NEW Policy: Super Admins Full Access (Create/Edit on behalf of users)
CREATE POLICY "Admins manage all decks"
ON public.decks FOR ALL
USING (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
);

-- Note: We keep "User ID" on the deck, so we know WHO plays it.
-- But only Admin can INSERT it.
