import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { PostWithDetails } from '../../types/league';
import UnseenPostsModal from './UnseenPostsModal';

export default function UnseenPostsManager() {
    const [userId, setUserId] = useState<string | null>(null);
    const [unseenPosts, setUnseenPosts] = useState<PostWithDetails[]>([]);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                checkUnseenPosts(user.id);
            }
        };
        init();
    }, []);

    const checkUnseenPosts = async (currentUserId: string) => {
        try {
            // 1. Get recent posts (last 14 days) from USER'S leagues only
            const twoWeeksAgo = new Date();
            twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

            // Fetch User Leagues
            const { data: memberships } = await supabase
                .from('league_members')
                .select('league_id')
                .eq('user_id', currentUserId)
                .eq('status', 'approved');

            const myLeagueIds = (memberships as any[])?.map(m => m.league_id) || [];

            if (myLeagueIds.length === 0) return;

            // Fetch posts
            const { data: postsData, error: postsError } = await supabase
                .from('league_posts')
                .select(`
                    *,
                    league:leagues(name),
                    author:profiles!league_posts_user_id_fkey(*),
                    interactions:post_interactions(
                        *,
                        user:profiles(*)
                    )
                `)
                .in('league_id', myLeagueIds)
                .gte('created_at', twoWeeksAgo.toISOString())
                .order('created_at', { ascending: false });

            if (postsError || !postsData) return;

            // Fetch views for this user
            const { data: views, error: viewsError } = await (supabase
                .from('post_views') as any)
                .select('post_id')
                .eq('user_id', currentUserId);

            if (viewsError || !views) return;

            const viewedIds = new Set((views as any[]).map(v => v.post_id));

            // Determine unseen
            const unseen = (postsData as any[])
                .filter(p => !viewedIds.has(p.id))
                // Transform to PostWithDetails
                .map(p => ({
                    ...p,
                    interactions: p.interactions || [],
                    current_user_interaction: p.interactions?.find((i: any) => i.user_id === currentUserId)?.status
                }));

            if (unseen.length > 0) {
                setUnseenPosts(unseen);
                setIsOpen(true);
            }
        } catch (err) {
            console.error("Error checking unseen posts:", err);
        }
    };

    const handlePostUpdate = async (postId: string, newStatus: 'interested' | 'not_interested' | null) => {
        if (!userId) return;

        setUnseenPosts(prev => prev.map(post => {
            if (post.id !== postId) return post;

            // 1. Update current user interaction
            const updatedPost = { ...post, current_user_interaction: newStatus };

            // 2. Update interactions array for counts/avatars
            let newInteractions = [...post.interactions];

            // Remove existing interaction from this user if any
            newInteractions = newInteractions.filter(i => i.user_id !== userId);

            // Add new interaction if it's 'interested' (or 'not_interested' if we want to track that, but usually we filter for interested)
            // The DB stores both, so let's store both to be consistent.
            if (newStatus) {
                // We need the user profile for the avatar. Since we are the user, we can assume we might need to fetch it or just use a placeholder?
                // UnseenPostsManager doesn't have the full user profile object in state, only userId.
                // However, we used supabase.auth.getUser().
                // Optimally we'd have the profile. Let's try to mock it or leave user null if it's just for count.
                // PostCard avatar logic: `i.user?.avatar_url`.
                // If we don't have the user object, the avatar won't show in the "Participants" list until refresh.
                // That's acceptable for now? Or we can fetch profile once in init.
                // Let's perform a lightweight update:
                newInteractions.push({
                    id: 'optimistic-' + Date.now(),
                    post_id: postId,
                    user_id: userId,
                    status: newStatus,
                    created_at: new Date().toISOString(),
                    user: null // This means the avatar won't show up instantly in the "small bubbles" list, but the COUNT will update correctly because of filter.
                });
            }

            updatedPost.interactions = newInteractions;
            return updatedPost;
        }));
    };

    return (
        <UnseenPostsModal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            posts={unseenPosts}
            currentUserId={userId || ''}
            onPostUpdate={handlePostUpdate}
        />
    );
}
