
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { Plus, Trophy, Calendar, ChevronRight, X, Check, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { showSuccess, showError } from '../../lib/toastUtils';

type League = Database['public']['Tables']['leagues']['Row'];

export default function LeagueManager() {
    const [leagues, setLeagues] = useState<League[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newLeagueName, setNewLeagueName] = useState('');
    const [isPublic, setIsPublic] = useState(false);
    const [loading, setLoading] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<{ id: string, name: string } | null>(null);

    useEffect(() => {
        fetchLeagues();
    }, []);

    const fetchLeagues = async () => {
        const { data } = await supabase
            .from('leagues')
            .select('*')
            .order('created_at', { ascending: false });
        if (data) setLeagues(data);
    };

    const handleCreateLeague = async () => {
        if (!newLeagueName.trim()) return;

        setLoading(true);
        // Explicitly cast to const to match DB type
        const { data: leagueData, error: leagueError } = await ((supabase
            .from('leagues') as any)
            .insert({
                name: newLeagueName,
                status: 'ongoing' as const,
                is_public: isPublic,
                format: 'Swiss',
                start_date: new Date().toISOString()
            })
            .select()
            .single());

        if (!leagueError && leagueData) {
            // Auto-join the creator to the league
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                await ((supabase.from('league_members') as any).insert({
                    league_id: (leagueData as any).id,
                    user_id: user.id,
                    role: 'admin' as const,
                    status: 'approved' as const
                }));
            }

            setNewLeagueName('');
            setIsPublic(false);
            setIsCreating(false);
            fetchLeagues();
            showSuccess('League created successfully!');
        } else {
            showError(leagueError?.message || 'Failed to create league');
        }
        setLoading(false);
    };

    const handleDeleteClick = (id: string, name: string, e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setDeleteTarget({ id, name });
    };

    const confirmDelete = async () => {
        if (!deleteTarget) return;

        const { error } = await supabase
            .from('leagues')
            .delete()
            .eq('id', deleteTarget.id);

        if (!error) {
            fetchLeagues();
            setDeleteTarget(null);
            showSuccess('League deleted successfully');
        } else {
            showError(error?.message || 'Failed to delete league');
        }
    };

    return (
        <section className="bg-surface border border-white/5 rounded-xl p-6 relative">
            {deleteTarget && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 rounded-xl backdrop-blur-sm p-4 animate-in fade-in duration-200">
                    <div className="bg-surface border border-white/10 p-6 rounded-xl max-w-sm w-full shadow-2xl">
                        <h3 className="text-lg font-bold text-white mb-2">Delete League?</h3>
                        <p className="text-gray-400 mb-6 text-sm">
                            Are you sure you want to delete <span className="text-white font-semibold">"{deleteTarget.name}"</span>?
                            This action cannot be undone.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteTarget(null)}
                                className="px-4 py-2 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-bold transition-all"
                            >
                                Confirm Delete
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                    <Trophy className="text-primary" /> Active Leagues
                </h2>
                {!isCreating && (
                    <button
                        onClick={() => setIsCreating(true)}
                        className="px-3 py-1.5 bg-primary/20 text-primary rounded-lg text-sm font-medium hover:bg-primary/30 transition-colors flex items-center gap-1"
                    >
                        <Plus size={16} /> Create League
                    </button>
                )}
            </div>

            {isCreating && (
                <div className="mb-4 bg-black/40 p-4 rounded-lg border border-white/10 animate-in fade-in slide-in-from-top-2">
                    <label className="block text-xs text-gray-500 mb-1">League Name</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newLeagueName}
                            onChange={e => setNewLeagueName(e.target.value)}
                            placeholder="e.g. Winter Cup 2024"
                            className="flex-1 bg-surface border border-white/10 rounded px-3 py-2 text-white focus:border-primary outline-none"
                            autoFocus
                        />
                        <button
                            type="button"
                            onClick={() => setIsPublic(!isPublic)}
                            className={`px-3 py-2 rounded font-bold text-sm border transition-colors ${isPublic ? 'bg-primary/20 border-primary text-primary' : 'bg-surface border-white/10 text-gray-500'}`}
                        >
                            {isPublic ? 'Public' : 'Private'}
                        </button>
                        <button
                            onClick={handleCreateLeague}
                            disabled={loading || !newLeagueName.trim()}
                            className="bg-primary text-background px-3 rounded font-bold hover:bg-primary/90 disabled:opacity-50"
                        >
                            <Check size={18} />
                        </button>
                        <button
                            onClick={() => setIsCreating(false)}
                            className="bg-white/10 text-white px-3 rounded hover:bg-white/20"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>
            )}

            <div className="space-y-3">
                {leagues.length === 0 && !isCreating ? (
                    <p className="text-gray-500 italic text-sm">No leagues found. Start a new tournament season!</p>
                ) : (
                    leagues.map(league => (
                        <Link
                            key={league.id}
                            to={`/admin/leagues/${league.id}`}
                            className="block bg-black/20 p-4 rounded-lg border border-white/5 hover:border-primary/30 transition-all group"
                        >
                            <div className="flex justify-between items-center">
                                <div>
                                    <h3 className="text-white font-medium">{league.name}</h3>
                                    <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                        <Calendar size={12} /> Started: {new Date(league.created_at).toLocaleDateString()}
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className={`text-xs px-2 py-1 rounded capitalize ${league.status === 'ongoing' ? 'bg-green-500/10 text-green-500' : 'bg-gray-500/10 text-gray-500'}`}>
                                        {league.status}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded capitalize ${league.is_public ? 'bg-blue-500/10 text-blue-500' : 'bg-orange-500/10 text-orange-500'}`}>
                                        {league.is_public ? 'Public' : 'Private'}
                                    </span>
                                    <button
                                        onClick={(e) => handleDeleteClick(league.id, league.name, e)}
                                        className="p-1.5 rounded-md hover:bg-red-500/20 text-gray-600 hover:text-red-500 transition-colors z-10 relative"
                                        title="Delete League"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                    <ChevronRight size={16} className="text-gray-600" />
                                </div>
                            </div>
                        </Link>
                    ))
                )}
            </div>
        </section>
    );
}
