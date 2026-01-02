import type { Database } from './database.types';

export interface AvailableMember {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
}

export type MatchWithPlayers = Omit<Database['public']['Tables']['matches']['Row'], 'score_p1' | 'score_p2' | 'winner_id'> & {
    score_p1: number | null;
    score_p2: number | null;
    winner_id: string | null;
    player1: { user: { first_name: string; last_name: string } | null } | null;
    player2: { user: { first_name: string; last_name: string } | null } | null;
    player1_id: string;
    player2_id: string | null;
    is_bye: boolean;
    round_number: number;
    id: string;
};

export type ParticipantWithUser = Database['public']['Tables']['tournament_participants']['Row'] & {
    user: { id: string; first_name: string; last_name: string; avatar_url: string | null } | null;
    deck?: {
        id: string;
        archetypes: { name: string; cover_image_url: string } | null
    } | null;
};
