import { Calendar, User, DollarSign, Users, Trophy, Edit, Trash2 } from 'lucide-react';
import type { PostWithDetails } from '../../types/league';
import { supabase } from '../../lib/supabase';
import { showSuccess, showError } from '../../lib/toastUtils';
import { useState } from 'react';
import ParticipantsModal from './ParticipantsModal';
import { formatDateTime } from '../../lib/dateUtils';

interface PostCardProps {
    post: PostWithDetails;
    currentUserId: string | null;
    onUpdate: (newStatus?: 'interested' | 'not_interested' | null) => void; // Trigger refresh or local update
    onEdit?: (post: PostWithDetails) => void;
    canEdit?: boolean;
    canDelete?: boolean;
}

export default function PostCard({ post, currentUserId, onUpdate, onEdit, canEdit = false, canDelete = false }: PostCardProps) {
    const [confirmingDelete, setConfirmingDelete] = useState(false);
    const [loading, setLoading] = useState(false);
    const [showParticipants, setShowParticipants] = useState(false);

    const interestedCount = post.interactions.filter(i => i.status === 'interested').length;
    const isEvent = post.type === 'event';
    const isFull = !!(isEvent && post.max_players && interestedCount >= post.max_players);
    const userStatus = post.current_user_interaction;

    // Cost Calculation
    const getDisplayCost = () => {
        if (!post.cost_value) return 'Free';
        if (post.cost_mode === 'fixed') return `€${post.cost_value}`;
        if (post.cost_mode === 'split') {
            const divisor = Math.max(interestedCount, 1);
            const perPerson = (post.cost_value / divisor).toFixed(2);
            return `€${perPerson} (Total: €${post.cost_value})`;
        }
        return 'Free';
    };

    const handleInteraction = async (status: 'interested' | 'not_interested') => {
        if (!currentUserId) return;
        setLoading(true);

        if (userStatus === status) {
            const { error } = await supabase
                .from('post_interactions')
                .delete()
                .eq('post_id', post.id)
                .eq('user_id', currentUserId);

            if (error) showError("Failed to update status");
            else onUpdate(null);
        } else {
            const { error } = await ((supabase.from('post_interactions') as any)
                .upsert({
                    post_id: post.id,
                    user_id: currentUserId,
                    status: status
                }, { onConflict: 'post_id,user_id' }));

            if (error) showError("Failed to update status");
            else {
                if (status === 'interested') showSuccess("You are now interested!");
                else showSuccess("Updated status.");
                onUpdate(status);
            }
        }
        setLoading(false);
    };

    const handleDelete = async () => {
        // No window.confirm here, checking state is enough or direct call
        const { error } = await supabase.from('league_posts').delete().eq('id', post.id);
        if (error) {
            console.error("Delete Error:", error);
            showError("Failed to delete: " + error.message);
        } else {
            showSuccess("Post deleted");
            onUpdate();
        }
        setConfirmingDelete(false);
    };

    return (
        <div className="bg-surface border border-white/5 rounded-xl p-6 relative group hover:border-white/10 transition-colors">
            {/* Header */}
            <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                    {/* ... (Author info unchanged) ... */}
                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden">
                        {post.author?.avatar_url ? (
                            <img src={post.author.avatar_url} className="w-full h-full object-cover" />
                        ) : (
                            <User className="text-gray-400" />
                        )}
                    </div>
                    <div>
                        {post.league?.name && (
                            <div className="text-xs text-primary font-bold mb-0.5 tracking-wide">
                                {post.league.name}
                            </div>
                        )}
                        <h3 className="font-bold text-white text-lg">{post.title}</h3>
                        <div className="text-xs text-gray-500 flex items-center gap-2">
                            <span>{post.author?.first_name} {post.author?.last_name}</span>
                            <span>•</span>
                            <span>{formatDateTime(post.updated_at)}</span>
                            {isEvent && (
                                <>
                                    <span>•</span>
                                    <span className="text-primary uppercase font-bold text-[10px] border border-primary/30 px-1 rounded">Event</span>
                                </>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    {canEdit && onEdit && !confirmingDelete && (
                        <button
                            onClick={() => onEdit(post)}
                            className="text-gray-500 hover:text-white transition-colors p-1"
                            title="Edit Post"
                        >
                            <Edit size={16} />
                        </button>
                    )}
                    {canDelete && (
                        confirmingDelete ? (
                            <div className="flex items-center gap-1 bg-black/40 rounded-lg p-1 border border-red-500/30 animate-in fade-in zoom-in duration-200">
                                <span className="text-[10px] text-red-400 font-bold uppercase mr-1">Sure?</span>
                                <button
                                    onClick={handleDelete}
                                    className="p-1 px-2 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600 transition-colors"
                                >
                                    Yes
                                </button>
                                <button
                                    onClick={() => setConfirmingDelete(false)}
                                    className="p-1 px-2 bg-white/10 text-gray-300 rounded text-xs font-bold hover:bg-white/20 transition-colors"
                                >
                                    No
                                </button>
                            </div>
                        ) : (
                            <button
                                onClick={() => setConfirmingDelete(true)}
                                className="text-gray-500 hover:text-red-500 transition-colors p-1"
                                title="Delete Post"
                            >
                                <Trash2 size={16} />
                            </button>
                        )
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="text-gray-300 mb-6 whitespace-pre-wrap text-sm leading-relaxed">
                {post.description}
            </div>

            {/* Event Details */}
            {isEvent && (
                <div className="bg-black/20 rounded-lg p-4 mb-6 grid grid-cols-2 sm:grid-cols-4 gap-4">
                    {post.event_date && (
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 flex items-center gap-1"><Calendar size={12} /> Date</span>
                            <span className="text-white text-sm font-medium">
                                {formatDateTime(post.event_date)}
                            </span>
                        </div>
                    )}
                    {post.format && (
                        <div className="flex flex-col gap-1">
                            <span className="text-xs text-gray-500 flex items-center gap-1"><Trophy size={12} /> Format</span>
                            <span className="text-white text-sm font-medium capitalize">{post.format}</span>
                        </div>
                    )}
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><DollarSign size={12} /> Cost</span>
                        <span className="text-green-400 text-sm font-medium">{getDisplayCost()}</span>
                    </div>
                    <div className="flex flex-col gap-1">
                        <span className="text-xs text-gray-500 flex items-center gap-1"><Users size={12} /> Capacity</span>
                        <span className={`text-sm font-medium ${isFull ? 'text-red-500' : 'text-blue-400'}`}>
                            {interestedCount} {post.max_players ? `/ ${post.max_players}` : 'Interested'}
                        </span>
                    </div>
                </div>
            )}

            {/* Actions */}
            <div className="flex items-center gap-3 pt-4 border-t border-white/5">
                <button
                    onClick={() => handleInteraction('interested')}
                    disabled={loading || (isFull && userStatus !== 'interested')}
                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all flex items-center justify-center gap-2
                        ${userStatus === 'interested'
                            ? 'bg-green-500 text-black shadow-[0_0_15px_rgba(34,197,94,0.3)]'
                            : isFull
                                ? 'bg-gray-800 text-gray-500 cursor-not-allowed'
                                : 'bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white'
                        }`}
                >
                    {isFull && userStatus !== 'interested' ? 'Full Capacity' : userStatus === 'interested' ? 'I\'m In!' : 'Interested'}
                </button>

                <button
                    onClick={() => handleInteraction('not_interested')}
                    disabled={loading}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                         ${userStatus === 'not_interested'
                            ? 'bg-red-500/20 text-red-500'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-gray-300'
                        }`}
                >
                    Not Interested
                </button>
            </div>

            {/* Participants Preview (Admin/Debug) */}
            {interestedCount > 0 && (
                <>
                    <div
                        onClick={() => setShowParticipants(true)}
                        className="mt-4 pt-4 border-t border-white/5 cursor-pointer hover:bg-white/5 -mx-6 px-6 pb-2 transition-colors relative z-10"
                        title="View all participants"
                    >
                        <div className="flex -space-x-2 overflow-hidden pointer-events-none">
                            {post.interactions.filter(i => i.status === 'interested').slice(0, 5).map(i => (
                                <div key={i.user_id} className="inline-block h-6 w-6 rounded-full ring-2 ring-surface bg-gray-800 flex items-center justify-center text-[8px] text-white font-bold overflow-hidden" title={`${i.user?.first_name} ${i.user?.last_name}`}>
                                    {i.user?.avatar_url ? <img src={i.user.avatar_url} className="h-full w-full rounded-full object-cover" /> : i.user?.first_name?.[0]}
                                </div>
                            ))}
                            {interestedCount > 5 && (
                                <div className="h-6 w-6 rounded-full ring-2 ring-surface bg-gray-700 flex items-center justify-center text-[8px] text-white">
                                    +{interestedCount - 5}
                                </div>
                            )}
                        </div>
                    </div>

                    <ParticipantsModal
                        isOpen={showParticipants}
                        onClose={() => setShowParticipants(false)}
                        participants={post.interactions.filter(i => i.status === 'interested')}
                    />
                </>
            )}
        </div>
    );
}
