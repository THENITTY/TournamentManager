export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export interface Database {
    public: {
        Tables: {
            profiles: {
                Row: {
                    id: string
                    first_name: string
                    last_name: string
                    avatar_url: string | null
                    role: 'user' | 'admin' | 'super_admin'
                    status: 'pending' | 'active' | 'suspended'
                    created_at: string
                }
                Insert: {
                    id: string
                    first_name: string
                    last_name: string
                    avatar_url?: string | null
                    role?: 'user' | 'admin' | 'super_admin'
                    status?: 'pending' | 'active' | 'suspended'
                    created_at?: string
                }
                Update: {
                    id?: string
                    first_name?: string
                    last_name?: string
                    avatar_url?: string | null
                    role?: 'user' | 'admin' | 'super_admin'
                    status?: 'pending' | 'active' | 'suspended'
                    created_at?: string
                }
            }
            leagues: {
                Row: {
                    id: string
                    name: string
                    format: string
                    start_date: string
                    end_date: string | null
                    status: 'upcoming' | 'ongoing' | 'completed'
                    is_public: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    name: string
                    format: string
                    start_date: string
                    end_date?: string | null
                    status?: 'upcoming' | 'ongoing' | 'completed'
                    is_public?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    name?: string
                    format?: string
                    start_date?: string
                    end_date?: string | null
                    status?: 'upcoming' | 'ongoing' | 'completed'
                    is_public?: boolean
                    created_at?: string
                }
            }
            league_members: {
                Row: {
                    id: string
                    league_id: string
                    user_id: string
                    role: 'admin' | 'co_admin' | 'user'
                    status: 'pending' | 'approved'
                    joined_at: string
                }
                Insert: {
                    id?: string
                    league_id: string
                    user_id: string
                    role?: 'admin' | 'co_admin' | 'user'
                    status?: 'pending' | 'approved'
                    joined_at?: string
                }
                Update: {
                    id?: string
                    league_id?: string
                    user_id?: string
                    role?: 'admin' | 'co_admin' | 'user'
                    status?: 'pending' | 'approved'
                    joined_at?: string
                }
            }
            cards: {
                Row: {
                    id: string
                    name: string
                    image_url: string
                    small_image_url: string
                    type: string
                    race: string
                    attribute: string | null
                    atk: number | null
                    def: number | null
                    level: number | null
                    desc: string
                }
                Insert: {
                    id: string
                    name: string
                    image_url: string
                    small_image_url: string
                    type: string
                    race: string
                    attribute?: string | null
                    atk?: number | null
                    def?: number | null
                    level?: number | null
                    desc: string
                }
                Update: {
                    id?: string
                    name?: string
                    image_url?: string
                    small_image_url?: string
                    type?: string
                    race?: string
                    attribute?: string | null
                    atk?: number | null
                    def?: number | null
                    level?: number | null
                    desc?: string
                }
            }
            archetypes: {
                Row: {
                    id: string
                    league_id: string | null
                    name: string
                    cover_card_id: string | null
                    cover_image_url: string
                    created_at: string
                    is_hybrid: boolean
                }
                Insert: {
                    id?: string
                    league_id?: string | null
                    name: string
                    cover_card_id?: string | null
                    cover_image_url: string
                    created_at?: string
                    is_hybrid?: boolean
                }
                Update: {
                    id?: string
                    league_id?: string | null
                    name?: string
                    cover_card_id?: string | null
                    cover_image_url?: string
                    created_at?: string
                    is_hybrid?: boolean
                }
            }
            archetype_compositions: {
                Row: {
                    id: string
                    hybrid_archetype_id: string
                    card_id: string
                    created_at: string
                }
                Insert: {
                    id?: string
                    hybrid_archetype_id: string
                    card_id: string
                    created_at?: string
                }
                Update: {
                    id?: string
                    hybrid_archetype_id?: string
                    card_id?: string
                    created_at?: string
                }
            }
            decks: {
                Row: {
                    id: string
                    user_id: string
                    league_id: string | null
                    archetype_id: string | null
                    name: string
                    format: string
                    created_at: string
                    updated_at: string
                }
                Insert: {
                    id?: string
                    user_id: string
                    league_id?: string | null
                    archetype_id?: string | null
                    name: string
                    format?: string
                    created_at?: string
                    updated_at?: string
                }
                Update: {
                    id?: string
                    user_id?: string
                    league_id?: string | null
                    archetype_id?: string | null
                    name?: string
                    format?: string
                    created_at?: string
                    updated_at?: string
                }
            }
            deck_cards: {
                Row: {
                    id: string
                    deck_id: string
                    card_id: string
                    count: number
                    zone: 'main' | 'side' | 'extra'
                }
                Insert: {
                    id?: string
                    deck_id: string
                    card_id: string
                    count?: number
                    zone?: 'main' | 'side' | 'extra'
                }
                Update: {
                    id?: string
                    deck_id?: string
                    card_id?: string
                    count?: number
                    zone?: 'main' | 'side' | 'extra'
                }
            }
            tournaments: {
                Row: {
                    id: string
                    league_id: string
                    name: string
                    date: string
                    format: 'Swiss' | 'SingleElimination' | 'RoundRobin'
                    status: 'setup' | 'active' | 'completed'
                    current_round: number
                    total_rounds: number | null
                    created_at: string
                }
                Insert: {
                    id?: string
                    league_id: string
                    name: string
                    date: string
                    format: 'Swiss' | 'SingleElimination' | 'RoundRobin'
                    status?: 'setup' | 'active' | 'completed'
                    current_round?: number
                    total_rounds?: number | null
                    created_at?: string
                }
                Update: {
                    id?: string
                    league_id?: string
                    name?: string
                    date?: string
                    format?: 'Swiss' | 'SingleElimination' | 'RoundRobin'
                    status?: 'setup' | 'active' | 'completed'
                    current_round?: number
                    total_rounds?: number | null
                    created_at?: string
                }
            }
            tournament_participants: {
                Row: {
                    id: string
                    tournament_id: string
                    user_id: string
                    deck_name: string | null
                    deck_id: string | null
                    score: number
                    real_wins: number
                    omw: number
                    internal_rating: number
                    rank: number
                    joined_at: string
                }
                Insert: {
                    id?: string
                    tournament_id: string
                    user_id: string
                    deck_name?: string | null
                    deck_id?: string | null
                    score?: number
                    real_wins?: number
                    omw?: number
                    internal_rating?: number
                    rank?: number
                    joined_at?: string
                }
                Update: {
                    id?: string
                    tournament_id?: string
                    user_id?: string
                    deck_name?: string | null
                    deck_id?: string | null
                    score?: number
                    real_wins?: number
                    omw?: number
                    internal_rating?: number
                    rank?: number
                    joined_at?: string
                }
            }
            matches: {
                Row: {
                    id: string
                    tournament_id: string
                    round_number: number
                    player1_id: string
                    player2_id: string | null
                    score_p1: number
                    score_p2: number
                    winner_id: string | null
                    is_bye: boolean
                    created_at: string
                }
                Insert: {
                    id?: string
                    tournament_id: string
                    round_number: number
                    player1_id: string
                    player2_id?: string | null
                    score_p1?: number
                    score_p2?: number
                    winner_id?: string | null
                    is_bye?: boolean
                    created_at?: string
                }
                Update: {
                    id?: string
                    tournament_id?: string
                    round_number?: number
                    player1_id?: string
                    player2_id?: string | null
                    score_p1?: number
                    score_p2?: number
                    winner_id?: string | null
                    is_bye?: boolean
                    created_at?: string
                }
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            is_super_admin: {
                Args: Record<PropertyKey, never>
                Returns: boolean
            }
        }
        Enums: {
            [_ in never]: never
        }
    }
}
