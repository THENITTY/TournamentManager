
import { useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { ArrowLeft, Calendar, Trophy, Users } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminNavbar from '../../../components/admin/AdminNavbar';
import { showError } from '../../../lib/toastUtils';

export default function CreateTournamentPage() {
    const { leagueId } = useParams();
    const navigate = useNavigate();

    const [name, setName] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [format, setFormat] = useState('Swiss');
    const [creating, setCreating] = useState(false);

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        setCreating(true);

        console.log("DEBUG: Creating tournament for league:", leagueId);
        console.log("DEBUG: Payload:", { name, date, format });

        const { data, error } = await ((supabase
            .from('tournaments') as any)
            .insert({
                league_id: leagueId!,
                name,
                date,
                format: format as 'Swiss' | 'RoundRobin' | 'SingleElimination',
                status: 'setup'
            })
            .select() // Select ID
            .single());

        if (error) {
            showError(error.message || 'Failed to create tournament');
            setCreating(false);
        } else if (data) {
            // Redirect to the new tournament page
            navigate(`/admin/tournaments/${data.id}`);
        }
    };

    return (
        <div className="min-h-screen bg-background">
            <AdminNavbar />
            <div className="max-w-2xl mx-auto p-8 relative">
                <Link to={`/admin/leagues/${leagueId}`} className="text-gray-400 hover:text-white flex items-center gap-2 mb-6">
                    <ArrowLeft size={20} /> Back to League
                </Link>

                <div className="bg-surface border border-white/5 rounded-xl p-8">
                    <h1 className="text-3xl font-bold text-white mb-6 flex items-center gap-3">
                        <Trophy className="text-yellow-500" /> Create Tournament
                    </h1>

                    <form onSubmit={handleCreate} className="space-y-6">
                        <div>
                            <label className="block text-gray-400 text-sm mb-2 font-medium">Tournament Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                placeholder="e.g. Winter Championship"
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-400 text-sm mb-2 font-medium">Format</label>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <button
                                    type="button"
                                    onClick={() => setFormat('Swiss')}
                                    className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all ${format === 'Swiss'
                                        ? 'bg-primary/20 border-primary text-primary'
                                        : 'bg-black/20 border-white/10 text-gray-400 hover:bg-white/5'
                                        }`}
                                >
                                    <Users size={24} />
                                    <span className="font-bold">Swiss System</span>
                                    <span className="text-xs opacity-70">Points & Tiebreakers</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFormat('SingleElimination')}
                                    className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all opacity-50 cursor-not-allowed ${format === 'SingleElimination'
                                        ? 'bg-primary/20 border-primary text-primary'
                                        : 'bg-black/20 border-white/10 text-gray-400'
                                        }`}
                                    disabled
                                    title="Coming soon"
                                >
                                    <Trophy size={24} />
                                    <span className="font-bold">Knockout</span>
                                    <span className="text-xs opacity-70">Single Elimination (Soon)</span>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setFormat('RoundRobin')}
                                    className={`p-4 rounded-lg border flex flex-col items-center gap-2 transition-all int-0 cursor-not-allowed opacity-50 ${format === 'RoundRobin'
                                        ? 'bg-primary/20 border-primary text-primary'
                                        : 'bg-black/20 border-white/10 text-gray-400'
                                        }`}
                                    disabled
                                    title="Coming soon"
                                >
                                    <Calendar size={24} />
                                    <span className="font-bold">Round Robin</span>
                                    <span className="text-xs opacity-70">All vs All (Soon)</span>
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-sm mb-2 font-medium">Date</label>
                            <input
                                type="date"
                                value={date}
                                onChange={e => setDate(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none"
                                required
                            />
                        </div>

                        <div className="pt-4">
                            <button
                                type="submit"
                                disabled={creating}
                                className="w-full py-4 bg-primary text-background font-bold text-lg rounded-xl hover:bg-primary/90 transition-transform active:scale-[0.98] disabled:opacity-50"
                            >
                                {creating ? 'Creating...' : 'Create Tournament'}
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
