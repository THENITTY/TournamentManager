-- Phase 2: Data Backbone Schema

-- 1. Cards Table (Public Read, Admin Write)
-- We use Text ID because Konami IDs are fixed strings/numbers (e.g. "89631139")
CREATE TABLE public.cards (
    id text PRIMARY KEY, 
    name text NOT NULL,
    type text,
    frame_type text,
    description text,
    atk int,
    def int,
    level int,
    race text,
    attribute text,
    image_url text,
    small_image_url text,
    created_at timestamptz DEFAULT now()
);

-- Enable RLS for Cards
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;

-- Policy: Everyone can view cards
CREATE POLICY "Public Read Cards"
ON public.cards FOR SELECT
USING (true);

-- Policy: Only Admins can insert/update cards (for seeding)
CREATE POLICY "Admins can manage cards"
ON public.cards FOR ALL
USING (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
);


-- 2. Decks Table (User Owned)
CREATE TABLE public.decks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    format text DEFAULT 'advanced', -- 'advanced', 'speed', 'rush'
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Enable RLS for Decks
ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view/edit their OWN decks
CREATE POLICY "Users can manage own decks"
ON public.decks FOR ALL
USING (auth.uid() = user_id);

-- Policy: Admins can view all decks (optional, but good for moderation)
CREATE POLICY "Admins can view all decks"
ON public.decks FOR SELECT
USING (
  exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'super_admin'
  )
);


-- 3. Deck Cards Junction Table
CREATE TABLE public.deck_cards (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    deck_id uuid REFERENCES public.decks(id) ON DELETE CASCADE NOT NULL,
    card_id text REFERENCES public.cards(id) ON DELETE CASCADE NOT NULL,
    count int NOT NULL DEFAULT 1 CHECK (count > 0 AND count <= 3),
    zone text NOT NULL DEFAULT 'main' CHECK (zone IN ('main', 'side', 'extra'))
);

-- Enable RLS for Deck Cards
ALTER TABLE public.deck_cards ENABLE ROW LEVEL SECURITY;

-- Policy: Users can manage cards in their own decks
-- We check deck ownership via the deck_id
CREATE POLICY "Users can manage their deck cards"
ON public.deck_cards FOR ALL
USING (
    exists (
        select 1 from public.decks
        where id = public.deck_cards.deck_id
        and user_id = auth.uid()
    )
);

-- Policy: Admins can view deck cards
CREATE POLICY "Admins can view all deck cards"
ON public.deck_cards FOR SELECT
USING (
    exists (
        select 1 from public.profiles
        where id = auth.uid() and role = 'super_admin'
    )
);
