
import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import { ArrowLeft, Trophy, Save, Trash2, AlertCircle } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminNavbar from '../../../components/admin/AdminNavbar';
import type { Database } from '../../../types/database.types';

type Tournament = Database['public']['Tables']['tournaments']['Row'];

export default function EditTournamentPage() {
    const { id } = useParams();
    const navigate = useNavigate();

    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [name, setName] = useState('');
    const [date, setDate] = useState('');
    const [status, setStatus] = useState<'setup' | 'active' | 'completed'>('setup');
    const [format, setFormat] = useState('Swiss');

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (id) fetchTournament();
    }, [id]);

    const fetchTournament = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', id!)
            .single();

        if (error) {
            console.error(error);
            alert("Tournament not found");
            navigate('/admin'); // Fallback
        } else if (data) {
            setTournament(data);
            setName(data.name);
            setDate(data.date);
            setStatus(data.status);
            setFormat(data.format);
        }
        setLoading(false);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);

        const { error } = await supabase
            .from('tournaments')
            .update({
                name,
                date,
                format
            })
            .eq('id', id!);

        if (error) {
            console.error("Error updating tournament:", error);
            alert(`Failed to update: ${error.message}`);
            setSaving(false);
        } else {
            // Success
            // alert("Tournament Updated!");
            navigate(-1); // Go back
        }
    };

    const handleDelete = async () => {
        // if (!confirm("CRITICAL WARNING: Deleting this tournament will wipe ALL matches and standings. This cannot be undone. Are you sure?")) return;

        const { error } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', id!);

        if (error) {
            alert(`Failed to delete: ${error.message}`);
        } else {
            navigate(-2); // Potentially tricky, better to go to league page if possible, but -1 might be this page itself? Safe bet is explicit route but we don't have leagueId handy without stored context. 
            // Actually tournament has league_id, we can fetch it.
        }
    };

    if (loading) return <div className="p-8 text-white">Loading...</div>;
    if (!tournament) return null;

    return (
        <div className="min-h-screen bg-background">
            <AdminNavbar />
            <div className="max-w-2xl mx-auto p-8 relative">
                <Link to="#" onClick={() => navigate(-1)} className="text-gray-400 hover:text-white flex items-center gap-2 mb-6">
                    <ArrowLeft size={20} /> Back
                </Link>

                <div className="bg-surface border border-white/5 rounded-xl p-8 mb-8">
                    <div className="flex justify-between items-start mb-6">
                        <h1 className="text-3xl font-bold text-white flex items-center gap-3">
                            <Trophy className="text-yellow-500" /> Edit Tournament
                        </h1>
                        <button
                            type="button"
                            onClick={handleDelete}
                            className="text-red-500 hover:bg-red-500/10 p-2 rounded-lg transition-colors"
                            title="Delete Tournament"
                        >
                            <Trash2 size={20} />
                        </button>
                    </div>

                    <form onSubmit={handleSave} className="space-y-6">
                        <div>
                            <label className="block text-gray-400 text-sm mb-2 font-medium">Tournament Name</label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none"
                                required
                            />
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

                        <div>
                            <label className="block text-gray-400 text-sm mb-2 font-medium">Status</label>
                            <div className="p-4 bg-black/30 rounded-lg border border-white/5 flex justify-between items-center">
                                <span className={`px-3 py-1 rounded text-sm font-bold capitalize
                                    ${status === 'active' ? 'bg-blue-500/20 text-blue-500' :
                                        status === 'completed' ? 'bg-green-500/20 text-green-500' : 'bg-yellow-500/20 text-yellow-500'}
                                `}>
                                    {status === 'setup' ? 'Pending' : status === 'active' ? 'Running' : 'Completed'}
                                </span>
                                <span className="text-xs text-gray-500">Status is managed via the Tournament Dashboard</span>
                            </div>
                        </div>

                        <div>
                            <label className="block text-gray-400 text-sm mb-2 font-medium">Format</label>
                            <select
                                value={format}
                                onChange={e => setFormat(e.target.value)}
                                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-white focus:border-primary outline-none"
                            >
                                <option value="Swiss">Swiss System</option>
                                <option value="SingleElimination">Knockout (Single Elim)</option>
                                <option value="RoundRobin">Round Robin</option>
                            </select>
                            <p className="text-xs text-gray-500 mt-2 flex items-center gap-2">
                                <AlertCircle size={12} />
                                Changing format mid-tournament may cause issues.
                            </p>
                        </div>

                        <div className="pt-4 flex gap-4">
                            <button
                                type="submit"
                                disabled={saving}
                                className="flex-1 py-3 bg-primary text-background font-bold rounded-xl hover:bg-primary/90 transition-transform active:scale-[0.98] disabled:opacity-50 flex justify-center items-center gap-2"
                            >
                                <Save size={18} />Save Changes
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
