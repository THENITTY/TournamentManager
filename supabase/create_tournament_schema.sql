-- ==============================================================================
-- PHASE 4: TOURNAMENT ENGINE SCHEMA (STRICT SWISS)
-- ==============================================================================

-- 1. TOURNAMENTS TABLE
CREATE TABLE public.tournaments (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    league_id uuid REFERENCES public.leagues(id) ON DELETE CASCADE NOT NULL,
    name text NOT NULL,
    date date NOT NULL,
    format text NOT NULL CHECK (format IN ('Swiss', 'SingleElimination', 'RoundRobin')),
    status text NOT NULL DEFAULT 'setup' CHECK (status IN ('setup', 'active', 'completed')),
    current_round int DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- RLS: Public Read, Admin Write
ALTER TABLE public.tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all authenticated users"
ON public.tournaments FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage tournaments"
ON public.tournaments FOR ALL TO authenticated
USING (
    public.is_league_admin(league_id) OR public.is_super_admin()
);


-- 2. TOURNAMENT PARTICIPANTS
CREATE TABLE public.tournament_participants (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    user_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
    deck_name text, -- Optional deck name (since Phase 3 was skipped)
    
    -- SCORING FIELDS (Strict Swiss)
    score int DEFAULT 0,              -- Total Points (Win=3, Tie=1, Bye=3)
    real_wins int DEFAULT 0,          -- Tiebreaker 2: Actual wins excluding Byes
    omw decimal(5,4) DEFAULT 0.0,     -- Tiebreaker 3: Opponent Match Win %
    internal_rating int DEFAULT 1000, -- Hidden Rating for Pairings (Dynamic)
    rank int DEFAULT 0,               -- Calculated Rank
    
    joined_at timestamptz DEFAULT now(),
    
    -- Constraint: One entry per user per tournament
    UNIQUE(tournament_id, user_id)
);

-- RLS: Public Read, Admin Write, User Join
ALTER TABLE public.tournament_participants ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all participants"
ON public.tournament_participants FOR SELECT TO authenticated
USING (true);

-- Admins can do everything
CREATE POLICY "Admins can manage participants"
ON public.tournament_participants FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tournaments t
        WHERE t.id = tournament_id
        AND (public.is_league_admin(t.league_id) OR public.is_super_admin())
    )
);

-- Users can join (Insert themselves) if tournament is in setup
CREATE POLICY "Users can join tournaments"
ON public.tournament_participants FOR INSERT TO authenticated
WITH CHECK (
    auth.uid() = user_id AND
    EXISTS (
        SELECT 1 FROM public.tournaments t
        WHERE t.id = tournament_id
        AND t.status = 'setup'
    )
);


-- 3. MATCHES
CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tournament_id uuid REFERENCES public.tournaments(id) ON DELETE CASCADE NOT NULL,
    round_number int NOT NULL,
    
    player1_id uuid REFERENCES public.tournament_participants(id) ON DELETE CASCADE NOT NULL,
    player2_id uuid REFERENCES public.tournament_participants(id) ON DELETE CASCADE, -- NULL if Bye
    
    score_p1 int DEFAULT 0,
    score_p2 int DEFAULT 0,
    
    winner_id uuid REFERENCES public.tournament_participants(id) ON DELETE SET NULL, -- NULL if Double Loss or Pending
    is_bye boolean DEFAULT false,
    
    created_at timestamptz DEFAULT now()
);

-- RLS: Public Read, Admin Write
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Enable read access for all matches"
ON public.matches FOR SELECT TO authenticated
USING (true);

CREATE POLICY "Admins can manage matches"
ON public.matches FOR ALL TO authenticated
USING (
    EXISTS (
        SELECT 1 FROM public.tournaments t
        WHERE t.id = tournament_id
        AND (public.is_league_admin(t.league_id) OR public.is_super_admin())
    )
);

-- Indexes for performance
CREATE INDEX idx_tournaments_league ON public.tournaments(league_id);
CREATE INDEX idx_participants_tourney ON public.tournament_participants(tournament_id);
CREATE INDEX idx_matches_tourney_round ON public.matches(tournament_id, round_number);
