
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { Link, useNavigate } from 'react-router-dom';
import { Trophy, Search, Users, Plus, Check, X } from 'lucide-react';
import ProfileModal from '../../components/dashboard/ProfileModal';
import Navbar from '../../components/Navbar';

type BaseLeague = Database['public']['Tables']['leagues']['Row'];

type League = Omit<BaseLeague, 'status'> & {
    role?: 'admin' | 'co_admin' | 'user';
    status: BaseLeague['status'] | 'pending' | 'approved';
};

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function DashboardPage() {
    const [profile, setProfile] = useState<Profile | null>(null);
    const [myLeagues, setMyLeagues] = useState<League[]>([]);
    const [availableLeagues, setAvailableLeagues] = useState<League[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Creation State
    const [isCreating, setIsCreating] = useState(false);
    const [newLeagueName, setNewLeagueName] = useState('');
    const [isPublic, setIsPublic] = useState(false);

    // Profile Modal State
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    useEffect(() => {
        const init = async () => {
            setLoading(true);
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                navigate('/login');
                return;
            }

            // 1. Fetch Profile
            const { data: profileData } = await supabase.from('profiles').select('*').eq('id', user.id).single();
            if (profileData) setProfile(profileData);

            // 2. Fetch joined leagues with Role & Status
            const { data: memberships } = await (supabase
                .from('league_members') as any)
                .select('league_id, role, status')
                .eq('user_id', user.id);

            const joinedMap = new Map((memberships as any[])?.map(m => [m.league_id, { role: m.role, status: m.status }]) || []);
            const joinedIds = Array.from(joinedMap.keys());

            // 3. Fetch all active leagues
            const { data: allLeagues } = await (supabase
                .from('leagues') as any)
                .select('*')
                .eq('status', 'ongoing')
                .order('created_at', { ascending: false });

            if (allLeagues) {
                const my: League[] = (allLeagues as any[])
                    .filter((l: any) => joinedIds.includes(l.id))
                    .map((l: any) => {
                        const info = joinedMap.get(l.id);
                        return {
                            ...l,
                            role: (info?.role as 'admin' | 'co_admin' | 'user') || 'user',
                            status: (((profileData as any)?.role === 'super_admin' ? 'approved' : (info?.status as 'pending' | 'approved')) || 'approved') as any
                        };
                    });

                setMyLeagues(my);
                setAvailableLeagues((allLeagues as any[]).filter((l: any) => !joinedIds.includes(l.id) && l.is_public));
            }

            setLoading(false);
        };
        init();
    }, [navigate]);

    const canCreateLeague = profile?.role === 'super_admin' || profile?.role === 'admin';

    const handleCreateLeague = async () => {
        if (!newLeagueName.trim() || !profile || !canCreateLeague) return;

        // 1. Create League
        // Note: created_by is added to schema. TS might complain if type not updated, casting to any/ignore for now.
        const { data: leagueData, error: leagueError } = (await (supabase
            .from('leagues') as any)
            .insert({
                name: newLeagueName,
                status: 'ongoing',
                is_public: isPublic,
                created_by: profile.id
            } as any)
            .select()
            .single()) as any;

        if (leagueError) {
            alert("Error creating league: " + leagueError.message);
            return;
        }

        // 2. Add Creator as Admin
        const { error: memberError } = await ((supabase.from('league_members') as any).insert({
            league_id: (leagueData as any).id,
            user_id: profile.id,
            role: 'admin',
            status: 'approved'
        }));

        if (memberError) {
            alert("League created but failed to join as admin: " + memberError.message);
        } else {
            // Optimistic Update
            setMyLeagues(prev => [{ ...leagueData, role: 'admin', status: 'approved' }, ...prev]);
            setIsCreating(false);
            setNewLeagueName('');
            setIsPublic(false);
        }
    };

    const handleJoin = async (e: React.MouseEvent, leagueId: string) => {
        e.preventDefault();
        if (!profile) return;

        try {
            const isSuperAdmin = profile.role === 'super_admin';

            const { error } = await ((supabase.from('league_members') as any).insert({
                league_id: leagueId,
                user_id: profile.id,
                role: 'user',
                status: isSuperAdmin ? 'approved' : 'pending'
            }));

            if (error) {
                alert(`Failed to join league: ${error.message}`);
                return;
            }

            // Optimistic Update
            const league = availableLeagues.find(l => l.id === leagueId);
            if (league) {
                setAvailableLeagues(prev => prev.filter(l => l.id !== leagueId));
                setMyLeagues(prev => [{ ...league, role: 'user', status: isSuperAdmin ? 'approved' : 'pending' }, ...prev]);
            }
        } catch (err: any) {
            console.error("Error in handleJoin:", err);
            alert("Unexpected error joining league.");
        }
    };

    const handleProfileUpdate = (updates: Partial<Profile>) => {
        if (!profile) return;
        setProfile({ ...profile, ...updates });
    };

    if (loading) return <div className="p-8 text-white min-h-screen bg-background flex items-center justify-center">Loading...</div>;

    return (
        <div className="min-h-screen bg-background">
            <Navbar />
            <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-6 sm:space-y-8 relative">
                <header className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-2">
                    <div>
                        <h1 className="text-2xl sm:text-3xl font-bold text-white flex items-center gap-2">
                            <Trophy className="text-primary" size={24} /> My Duels
                        </h1>
                        <p className="text-gray-400 text-sm">Welcome back, {profile?.first_name || 'Duelist'}</p>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                    {/* LEFT COLUMN: LEAGUES */}
                    <div className="space-y-6 sm:space-y-8">
                        {/* MY LEAGUES */}
                        <section>
                            <div className="flex justify-between items-center mb-4">
                                <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                                    <Trophy className="text-yellow-500" size={20} /> My Leagues
                                </h2>
                                {!isCreating && canCreateLeague && (
                                    <button
                                        onClick={() => setIsCreating(true)}
                                        className="px-3 py-1.5 bg-white/10 text-white rounded-lg text-sm hover:bg-white/20 transition-colors flex items-center gap-1"
                                    >
                                        <Plus size={16} /> Create League
                                    </button>
                                )}
                            </div>

                            {isCreating && (
                                <div className="mb-6 bg-surface border border-white/10 rounded-xl p-4 animate-in fade-in slide-in-from-top-2">
                                    <label className="block text-xs text-gray-500 mb-1">League Name</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={newLeagueName}
                                            onChange={e => setNewLeagueName(e.target.value)}
                                            placeholder="e.g. Winter Cup 2024"
                                            className="flex-1 bg-black/20 border border-white/10 rounded px-3 py-2 text-white focus:border-primary outline-none"
                                            autoFocus
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setIsPublic(!isPublic)}
                                            className={`px-3 py-2 rounded font-bold text-sm border transition-colors ${isPublic ? 'bg-primary/20 border-primary text-primary' : 'bg-black/20 border-white/10 text-gray-500'}`}
                                        >
                                            {isPublic ? 'Public' : 'Private'}
                                        </button>
                                        <button
                                            onClick={handleCreateLeague}
                                            disabled={!newLeagueName.trim()}
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

                            {myLeagues.length === 0 ? (
                                <div className="text-gray-500 italic p-6 bg-surface border border-white/5 rounded-xl text-center">
                                    You haven't joined any leagues yet.
                                </div>
                            ) : (
                                <div className="grid gap-3">
                                    {myLeagues.map(league => (
                                        <Link to={`/admin/leagues/${league.id}`} key={league.id} className="block bg-surface p-4 rounded-xl border border-white/5 hover:border-primary/50 transition-colors group">
                                            <div className="flex justify-between items-center">
                                                <div className="min-w-0 pr-4">
                                                    <h3 className="text-base sm:text-lg font-bold text-white group-hover:text-primary transition-colors truncate">{league.name}</h3>
                                                    <div className="flex flex-wrap items-center gap-2 mt-1">
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize font-bold ${league.role === 'admin' ? 'bg-yellow-500/10 text-yellow-500' : 'bg-blue-500/10 text-blue-500'}`}>
                                                            {league.role}
                                                        </span>
                                                        <span className={`text-[10px] px-1.5 py-0.5 rounded capitalize font-bold ${league.status === 'pending' ? 'bg-orange-500/10 text-orange-500' : 'bg-green-500/10 text-green-500'}`}>
                                                            {league.status}
                                                        </span>
                                                    </div>
                                                </div>
                                                <div className="text-gray-500 group-hover:translate-x-1 transition-transform shrink-0">
                                                    <Search size={16} />
                                                </div>
                                            </div>
                                        </Link>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* RIGHT COLUMN: PROFILE & AVAILABLE LEAGUES */}
                    <div className="space-y-8">


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
                                <div className="grid gap-3">
                                    {availableLeagues.map(l => (
                                        <div key={l.id} className="bg-surface/50 border border-white/5 rounded-xl p-4 flex justify-between items-center gap-4 hover:border-blue-500/30 transition-colors group">
                                            <div className="min-w-0 pr-2">
                                                <h3 className="text-white font-bold truncate group-hover:text-blue-400 transition-colors">{l.name}</h3>
                                                <div className="flex items-center gap-2 mt-1">
                                                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Public</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={(e) => handleJoin(e, l.id)}
                                                className="shrink-0 h-10 w-10 sm:w-auto sm:px-4 bg-primary text-background font-bold rounded-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2"
                                                title="Join League"
                                            >
                                                <Users size={18} />
                                                <span className="hidden sm:inline text-sm">Join</span>
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>

                        {canCreateLeague && (
                            <section className="bg-gradient-to-r from-purple-900/20 to-blue-900/20 p-6 rounded-xl border border-white/10 text-center">
                                <h3 className="text-white font-bold mb-2">Want to start your own?</h3>
                                <p className="text-sm text-gray-400 mb-4">Create a league and invite your friends to duel!</p>
                                <button
                                    onClick={() => setIsCreating(true)}
                                    className="px-6 py-2 bg-primary text-background font-bold rounded-full hover:bg-primary/90 transition-transform hover:scale-105"
                                >
                                    Create League
                                </button>
                            </section>
                        )}
                    </div>
                </div>

                <ProfileModal
                    isOpen={isProfileModalOpen}
                    onClose={() => setIsProfileModalOpen(false)}
                    currentProfile={profile}
                    onUpdate={handleProfileUpdate}
                />
            </div>
        </div>
    );
}
