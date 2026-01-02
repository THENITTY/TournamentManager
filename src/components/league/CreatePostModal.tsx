import { useState, useEffect } from 'react';
import { X, Calendar, DollarSign, Users, AlignLeft, Trophy } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { showSuccess, showError } from '../../lib/toastUtils';
import type { PostWithDetails } from '../../types/league';

interface CreatePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    leagueId: string;
    onCreated: () => void;
    userId: string;
    initialData?: PostWithDetails | null;
}

export default function CreatePostModal({ isOpen, onClose, leagueId, onCreated, userId, initialData }: CreatePostModalProps) {
    const [loading, setLoading] = useState(false);

    // Form State
    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [type, setType] = useState<'announcement' | 'event'>('announcement');

    // Event Fields
    const [eventDate, setEventDate] = useState('');
    const [format, setFormat] = useState('Advanced');
    const [costMode, setCostMode] = useState<'fixed' | 'split'>('fixed');
    const [costValue, setCostValue] = useState<string>('0');
    const [maxPlayers, setMaxPlayers] = useState<string>('');

    useEffect(() => {
        if (isOpen) {
            if (initialData) {
                // Edit Mode
                setTitle(initialData.title);
                setDescription(initialData.description || '');
                setType(initialData.type);
                if (initialData.type === 'event') {
                    // Format date to datetime-local string (YYYY-MM-DDTHH:mm)
                    const d = initialData.event_date ? new Date(initialData.event_date) : null;
                    const dateStr = d ? new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : '';
                    setEventDate(dateStr);
                    setFormat(initialData.format || 'Advanced');
                    setCostMode(initialData.cost_mode || 'fixed');
                    setCostValue(String(initialData.cost_value || 0));
                    setMaxPlayers(initialData.max_players ? String(initialData.max_players) : '');
                }
            } else {
                // Create Mode - Reset
                resetForm();
            }
        }
    }, [isOpen, initialData]);

    const resetForm = () => {
        setTitle('');
        setDescription('');
        setType('announcement');
        setEventDate('');
        setFormat('Advanced');
        setCostMode('fixed');
        setCostValue('0');
        setMaxPlayers('');
    };

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title.trim()) return showError("Title is required");

        setLoading(true);

        const payload: any = {
            league_id: leagueId,
            user_id: userId,
            type,
            title,
            description: description || null,
        };

        if (type === 'event') {
            if (!eventDate) {
                setLoading(false);
                return showError("Event date is required");
            }
            payload.event_date = new Date(eventDate).toISOString();
            payload.format = format;
            payload.cost_mode = costMode;
            payload.cost_value = parseFloat(costValue) || 0;
            payload.max_players = maxPlayers ? parseInt(maxPlayers) : null;
        } else {
            // Nullify event fields if switching types
            payload.event_date = null;
            payload.max_players = null;
        }

        let error;
        if (initialData) {
            // Update
            const updatePayload = { ...payload, updated_at: new Date().toISOString() };
            delete updatePayload.user_id; // Preserve original author

            const { error: updateError } = await (supabase
                .from('league_posts') as any)
                .update(updatePayload)
                .eq('id', initialData.id);
            error = updateError;
        } else {
            // Insert
            const { error: insertError } = await (supabase.from('league_posts') as any).insert(payload);
            error = insertError;
        }

        setLoading(false);

        if (error) {
            console.error(error);
            showError("Failed to save post");
        } else {
            showSuccess(initialData ? "Post updated!" : "Post created successfully!");
            onCreated();
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-xl w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <X size={24} />
                </button>

                <h2 className="text-2xl font-bold text-white mb-6">
                    {initialData ? 'Edit Post' : 'Create New Post'}
                </h2>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* TYPE SELECTION */}
                    <div className="grid grid-cols-2 gap-4 mb-6">
                        <button
                            type="button"
                            onClick={() => setType('announcement')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === 'announcement' ? 'bg-primary/20 border-primary text-primary' : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'}`}
                        >
                            <AlignLeft size={24} />
                            <span className="font-bold text-sm">Announcement</span>
                        </button>
                        <button
                            type="button"
                            onClick={() => setType('event')}
                            className={`p-3 rounded-xl border flex flex-col items-center gap-2 transition-all ${type === 'event' ? 'bg-blue-500/20 border-blue-500 text-blue-500' : 'bg-black/20 border-white/5 text-gray-400 hover:bg-white/5'}`}
                        >
                            <Calendar size={24} />
                            <span className="font-bold text-sm">Event</span>
                        </button>
                    </div>

                    {/* BASIC INFO */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Title</label>
                            <input
                                type="text"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none"
                                placeholder="e.g., Weekly Tournament / Important Update"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Description</label>
                            <textarea
                                value={description}
                                onChange={e => setDescription(e.target.value)}
                                className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none h-24 resize-none"
                                placeholder="Write your content here..."
                            />
                        </div>
                    </div>

                    {/* EVENT SPECIFIC FIELDS */}
                    {type === 'event' && (
                        <div className="border-t border-white/10 pt-4 space-y-4 animate-in fade-in slide-in-from-top-2">
                            <h3 className="text-sm font-bold text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <Calendar size={14} /> Event Details
                            </h3>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                                    <input
                                        type="datetime-local"
                                        value={eventDate}
                                        onChange={e => setEventDate(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 text-white focus:border-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Format</label>
                                    <div className="relative">
                                        <Trophy className="absolute left-3 top-3 text-gray-500" size={16} />
                                        <select
                                            value={format}
                                            onChange={e => setFormat(e.target.value)}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 pl-10 text-white focus:border-blue-500 outline-none appearance-none"
                                        >
                                            <option value="Advanced">Advanced</option>
                                            <option value="Time Wizard">Time Wizard</option>
                                            <option value="Goat">Goat</option>
                                            <option value="Edison">Edison</option>
                                            <option value="Custom">Custom</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Cost Mode</label>
                                    <div className="flex bg-black/30 rounded-lg p-1 border border-white/10">
                                        <button
                                            type="button"
                                            onClick={() => setCostMode('fixed')}
                                            className={`flex-1 py-1 text-xs font-bold rounded ${costMode === 'fixed' ? 'bg-blue-500 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            Fixed (Per Person)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setCostMode('split')}
                                            className={`flex-1 py-1 text-xs font-bold rounded ${costMode === 'split' ? 'bg-purple-500 text-white shadow' : 'text-gray-400 hover:text-white'}`}
                                        >
                                            Split (Total / Participants)
                                        </button>
                                    </div>
                                </div>
                                <div className="col-span-2 sm:col-span-1">
                                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                        {costMode === 'fixed' ? 'Cost per Person (€)' : 'Total Event Cost (€)'}
                                    </label>
                                    <div className="relative">
                                        <DollarSign className="absolute left-3 top-3.5 text-gray-500" size={14} />
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.50"
                                            value={costValue}
                                            onChange={e => setCostValue(e.target.value)}
                                            className="w-full bg-black/30 border border-white/10 rounded-lg p-3 pl-9 text-white focus:border-blue-500 outline-none"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Max Participants (Optional)</label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-3.5 text-gray-500" size={14} />
                                    <input
                                        type="number"
                                        min="1"
                                        value={maxPlayers}
                                        onChange={e => setMaxPlayers(e.target.value)}
                                        className="w-full bg-black/30 border border-white/10 rounded-lg p-3 pl-9 text-white focus:border-blue-500 outline-none"
                                        placeholder="Unlimited"
                                    />
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="pt-6 border-t border-white/10 flex justify-end gap-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="px-4 py-2 text-gray-400 hover:text-white font-medium disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-2 bg-primary text-background font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 min-w-[120px] flex justify-center"
                        >
                            {loading ? <span className="animate-spin h-5 w-5 border-2 border-white/20 border-t-black rounded-full" /> : (initialData ? 'Update Post' : 'Create Post')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
