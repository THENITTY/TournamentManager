import { useState } from 'react';
import type { PostWithDetails } from '../../types/league';
import { X, ChevronRight, ChevronLeft } from 'lucide-react';
import PostCard from './PostCard';
import { useEffect } from 'react';
import { supabase } from '../../lib/supabase';

interface UnseenPostsModalProps {
    isOpen: boolean;
    onClose: () => void;
    posts: PostWithDetails[];
    currentUserId: string;
    onPostUpdate?: (postId: string, newStatus: 'interested' | 'not_interested' | null) => void;
}

export default function UnseenPostsModal({ isOpen, onClose, posts, currentUserId, onPostUpdate }: UnseenPostsModalProps) {
    const [currentIndex, setCurrentIndex] = useState(0);
    const [viewedIndices, setViewedIndices] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (isOpen && posts.length > 0) {
            markAsViewed(0);
        }
    }, [isOpen, posts]);

    const markAsViewed = async (index: number) => {
        if (viewedIndices.has(index)) return;

        const post = posts[index];
        if (!post) return;

        // Optimistic update
        const newSet = new Set(viewedIndices);
        newSet.add(index);
        setViewedIndices(newSet);

        // Fire and forget insert
        await ((supabase.from('post_views') as any).upsert(
            { user_id: currentUserId, post_id: post.id },
            { onConflict: 'user_id,post_id' }
        ));
    };

    const handleNext = () => {
        if (currentIndex < posts.length - 1) {
            const nextIndex = currentIndex + 1;
            setCurrentIndex(nextIndex);
            markAsViewed(nextIndex);
        } else {
            onClose();
        }
    };

    const handlePrev = () => {
        if (currentIndex > 0) {
            setCurrentIndex(currentIndex - 1);
        }
    };

    if (!isOpen || posts.length === 0) return null;

    const currentPost = posts[currentIndex];

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <div className="w-full max-w-lg relative animate-in fade-in zoom-in-95 duration-200">
                {/* Header / Counter */}
                <div className="absolute -top-12 left-0 right-0 flex justify-between items-center text-white">
                    <span className="font-bold text-lg drop-shadow-md">
                        Unseen Updates ({currentIndex + 1}/{posts.length})
                    </span>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-white transition-colors"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Card Container */}
                <div className="relative">
                    <PostCard
                        post={currentPost}
                        currentUserId={currentUserId}
                        onUpdate={(newStatus) => onPostUpdate?.(currentPost.id, newStatus ?? null)}
                        canEdit={false}
                        canDelete={false}
                    />

                    {/* Navigation Overlays */}
                    <div className="absolute inset-x-0 bottom-[-60px] flex items-center justify-between">
                        <button
                            onClick={handlePrev}
                            disabled={currentIndex === 0}
                            className={`p-3 rounded-full bg-surface border border-white/10 text-white transition-all ${currentIndex === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-white/10 hover:scale-110'}`}
                        >
                            <ChevronLeft size={24} />
                        </button>

                        <div className="flex gap-1">
                            {posts.map((_, idx) => (
                                <div
                                    key={idx}
                                    className={`h-1.5 rounded-full transition-all duration-300 ${idx === currentIndex ? 'w-6 bg-primary' : 'w-1.5 bg-gray-600'}`}
                                />
                            ))}
                        </div>

                        <button
                            onClick={handleNext}
                            className="px-6 py-2 bg-primary text-background font-bold rounded-full hover:bg-primary/90 transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(34,197,94,0.3)] hover:scale-105"
                        >
                            {currentIndex === posts.length - 1 ? 'Finish' : 'Next'}
                            <ChevronRight size={20} />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
