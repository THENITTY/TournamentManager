
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy, LogOut, Search, Users, Shield } from 'lucide-react';

type Profile = Database['public']['Tables']['profiles']['Row'];
type League = Database['public']['Tables']['leagues']['Row'];
type LeagueWithRole = League & { role: 'admin' | 'co_admin' | 'user'; status: 'pending' | 'approved' };

export default function DashboardPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [myLeagues, setMyLeagues] = useState<LeagueWithRole[]>([]);
    const [availableLeagues, setAvailableLeagues] = useState<League[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                navigate('/login');
                return;
            }

            // 1. Fetch Profile
            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();
            setProfile(profile);

            // 2. Fetch joined leagues with Role & Status
            const { data: memberships } = await supabase
                .from('league_members')
                .select('league_id, role, status')
                .eq('user_id', user.id);

            const joinedMap = new Map(memberships?.map(m => [m.league_id, { role: m.role, status: m.status }]) || []);
            const joinedIds = Array.from(joinedMap.keys());

            // 3. Fetch all active leagues
            const { data: allLeagues } = await supabase
                .from('leagues')
                .select('*')
                .eq('status', 'ongoing')
                .order('created_at', { ascending: false });

            if (allLeagues) {
                const my: LeagueWithRole[] = allLeagues
                    .filter(l => joinedIds.includes(l.id))
                    .map(l => {
                        const info = joinedMap.get(l.id);
                        return {
                            ...l,
                            role: (info?.role as 'admin' | 'co_admin' | 'user') || 'user',
                            status: (profile?.role === 'super_admin' ? 'approved' : (info?.status as 'pending' | 'approved')) || 'approved'
                        };
                    });

                setMyLeagues(my);
                setAvailableLeagues(allLeagues.filter(l => !joinedIds.includes(l.id) && l.is_public));
            }

            setLoading(false);
        };
        init();
    }, [navigate]);

    const handleJoin = async (e: React.MouseEvent, leagueId: string) => {
        e.preventDefault();

        if (!profile) {
            alert("Error: Profile not loaded. Please refresh.");
            return;
        }

        // Removed confirm for debugging

        try {
            console.log("Attempting to join league:", leagueId, "User:", profile.id);
            const isSuperAdmin = profile.role === 'super_admin';

            const { data, error } = await supabase.from('league_members').insert({
                league_id: leagueId,
                user_id: profile.id,
                role: 'user',
                status: isSuperAdmin ? 'approved' : 'pending'
            }).select(); // Select to verify it actually returned data

            if (error) {
                console.error("Supabase Insert Error:", error);
                alert(`Failed to join league (DB Error): ${error.message} (${error.code})`);
                return;
            }

            console.log("Join Success:", data);

            // Optimistic Update
            const league = availableLeagues.find(l => l.id === leagueId);
            if (league) {
                setAvailableLeagues(prev => prev.filter(l => l.id !== leagueId));
                setMyLeagues(prev => [{ ...league, role: 'user', status: isSuperAdmin ? 'approved' : 'pending' }, ...prev]);
            }
        } catch (err: any) {
            console.error("Unexpected Error in handleJoin:", err);
            alert(`Unexpected Error: ${err.message || 'Unknown error'}`);
        }
    };

    if (loading) return <div className="p-8 text-white min-h-screen bg-background flex items-center justify-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-background p-4 md:p-8">
            <header className="flex justify-between items-center mb-12 max-w-6xl mx-auto">
                <div>
                    <h1 className="text-3xl font-bold text-primary">DuelManager</h1>
                    <p className="text-gray-400">Welcome back, {profile?.first_name}</p>
                </div>

                <div className="flex gap-4">
                    {profile?.role === 'super_admin' && (
                        <Link to="/admin" className="px-4 py-2 border border-primary/50 text-primary rounded-lg hover:bg-primary/10 transition-colors flex items-center gap-2">
                            <Shield size={16} /> Admin Panel
                        </Link>
                    )}
                    <button onClick={() => supabase.auth.signOut()} className="p-2 text-gray-500 hover:text-white" title="Sign Out">
                        <LogOut />
                    </button>
                </div>
            </header>

            <main className="max-w-6xl mx-auto grid md:grid-cols-2 gap-8">

                {/* MY LEAGUES */}
                <section>
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Trophy className="text-yellow-500" /> My Leagues
                    </h2>
                    {myLeagues.length === 0 ? (
                        <div className="bg-surface border border-white/5 rounded-xl p-8 text-center">
                            <p className="text-gray-500">You haven't joined any leagues yet.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {myLeagues.map(l => (
                                <div key={l.id} className="bg-surface border border-white/10 rounded-xl p-6 flex justify-between items-center group hover:border-primary/50 transition-colors">
                                    <div>
                                        <h3 className="text-white font-bold text-lg">{l.name}</h3>
                                        <div className="flex flex-col gap-1 mt-1">
                                            {l.status === 'pending' ? (
                                                <span className="text-sm font-medium text-orange-400 flex items-center gap-1">
                                                    ⏳ Pending Approval
                                                </span>
                                            ) : (
                                                <p className={`text-sm font-medium capitalize flex items-center gap-1 
                                                    ${l.role === 'admin' ? 'text-yellow-500' :
                                                        l.role === 'co_admin' ? 'text-purple-500' :
                                                            'text-green-500'}`}>
                                                    {l.role === 'admin' && <Trophy size={14} />}
                                                    {l.role === 'co_admin' && <Shield size={14} />}
                                                    {l.role === 'co_admin' ? 'Co-Admin' : l.role === 'admin' ? 'League Admin' : 'User'}
                                                </p>
                                            )}
                                        </div>
                                    </div>

                                    {l.status === 'approved' ? (
                                        <Link
                                            to={`/admin/leagues/${l.id}`}
                                            className="px-4 py-2 bg-white/5 rounded-lg text-sm text-gray-300 hover:bg-white/10 transition-colors"
                                        >
                                            Enter Lobby
                                        </Link>
                                    ) : (
                                        <div className="px-4 py-2 bg-white/5 rounded-lg text-sm text-gray-500 italic cursor-not-allowed">
                                            Waiting...
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* AVAILABLE LEAGUES */}
                <section>
                    <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                        <Search className="text-blue-500" /> Open Leagues
                    </h2>
                    {availableLeagues.length === 0 ? (
                        <div className="bg-surface border border-white/5 rounded-xl p-8 text-center">
                            <p className="text-gray-500">No public leagues available to join.</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {availableLeagues.map(l => (
                                <div key={l.id} className="bg-black/40 border border-white/5 rounded-xl p-6 flex justify-between items-center">
                                    <div>
                                        <h3 className="text-gray-200 font-bold">{l.name}</h3>
                                        <p className="text-xs text-blue-400 border border-blue-500/20 bg-blue-500/10 px-2 py-0.5 rounded inline-block mt-1">Public</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => handleJoin(e, l.id)}
                                        className="px-4 py-2 bg-primary text-background font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center gap-2"
                                    >
                                        <Users size={16} /> Join
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

            </main>
        </div>
    );
}
