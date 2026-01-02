import type { Database } from './database.types';

type PostRow = Database['public']['Tables']['league_posts']['Row'];
type InteractionRow = Database['public']['Tables']['post_interactions']['Row'];

export interface InteractionWithUser extends InteractionRow {
    user: {
        first_name: string;
        last_name: string;
        avatar_url: string | null;
    } | null;
}

export interface PostWithDetails extends PostRow {
    author: {
        first_name: string;
        last_name: string;
        avatar_url: string | null;
    } | null;
    league?: {
        name: string;
    } | null;
    interactions: InteractionWithUser[];
    current_user_interaction?: 'interested' | 'not_interested' | null;
}
