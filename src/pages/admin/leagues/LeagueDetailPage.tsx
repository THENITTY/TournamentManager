
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../types/database.types';
import { ArrowLeft, Users, Calendar, Library, Globe, Lock, MoreHorizontal, Trophy, Shield, User, Trash2 } from 'lucide-react';
import AdminNavbar from '../../../components/admin/AdminNavbar';

type League = Database['public']['Tables']['leagues']['Row'];
type LeagueRole = 'admin' | 'co_admin' | 'user';
type Tournament = Database['public']['Tables']['tournaments']['Row'];

interface DeckDisplay {
    id: string;
    created_at: string;
    profiles: { first_name: string; last_name: string; } | null;
    archetypes: { name: string; cover_image_url: string; } | null;
    user_id: string;
}

interface MemberDisplay {
    id: string; // league_member id
    user_id: string;
    role: LeagueRole;
    status: 'pending' | 'approved';
    joined_at: string;
    profiles: {
        first_name: string;
        last_name: string;
        avatar_url: string | null;
        role: string; // global role
    } | null;
}

export default function LeagueDetailPage() {
    const { id } = useParams();
    const [league, setLeague] = useState<League | null>(null);
    const [tournaments, setTournaments] = useState<Tournament[]>([]); // New State
    const [decks, setDecks] = useState<DeckDisplay[]>([]);
    const [members, setMembers] = useState<MemberDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Permissions
    const [isGlobalSuperAdmin, setIsGlobalSuperAdmin] = useState(false);
    const [currentLeagueRole, setCurrentLeagueRole] = useState<LeagueRole | null>(null);

    useEffect(() => {
        if (id) fetchAllData(id);
    }, [id]);

    const fetchAllData = async (leagueId: string) => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            setCurrentUserId(user.id);
            // Check Global Role
            const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
            setIsGlobalSuperAdmin(profile?.role === 'super_admin');

            // Check League Role
            const { data: member } = await supabase.from('league_members')
                .select('role')
                .eq('league_id', leagueId)
                .eq('user_id', user.id)
                .single();
            if (member) {
                setCurrentLeagueRole(member.role);
            }
        }

        // Fetch League
        const { data: leagueData } = await supabase.from('leagues').select('*').eq('id', leagueId).single();
        if (leagueData) setLeague(leagueData);

        // Fetch Tournaments (NEW)
        const { data: tournamentData } = await supabase
            .from('tournaments')
            .select('*')
            .eq('league_id', leagueId)
            .order('date', { ascending: false });
        if (tournamentData) setTournaments(tournamentData);

        // Fetch Decks
        const { data: decksData } = await supabase
            .from('decks')
            .select(`
                id,
                created_at,
                user_id,
                profiles:user_id (first_name, last_name),
                archetypes:archetype_id (name, cover_image_url)
            `)
            .eq('league_id', leagueId)
            .order('created_at', { ascending: false });

        if (decksData) setDecks(decksData as unknown as DeckDisplay[]);

        // Fetch Members
        const { data: membersData } = await supabase
            .from('league_members')
            .select(`
                id,
                user_id,
                role,
                status,
                joined_at,
                profiles:user_id (first_name, last_name, avatar_url, role)
            `)
            .eq('league_id', leagueId)
            .order('joined_at', { ascending: true });

        if (membersData) setMembers(membersData as unknown as MemberDisplay[]);

        setLoading(false);
    };

    const toggleVisibility = async () => {
        if (!league) return;
        const newStatus = !league.is_public;

        // Optimistic UI Update
        setLeague(prev => prev ? { ...prev, is_public: newStatus } : null);

        const { error } = await supabase
            .from('leagues')
            .update({ is_public: newStatus })
            .eq('id', league.id);

        if (error) {
            console.error(error);
            alert("Failed to update visibility");
            setLeague(prev => prev ? { ...prev, is_public: !newStatus } : null);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: LeagueRole) => {
        console.log("DEBUG: handleRoleChange called for", memberId, "to", newRole);
        // Removed native confirm to avoid browser blocking issues
        // if (!confirm(...)) return;

        // Optimistic Update
        console.log("DEBUG: Applying optimistic update");
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));

        const response = await supabase
            .from('league_members')
            .update({ role: newRole })
            .eq('id', memberId)
            .select(); // Force return of data to verify RLS visibility

        console.log("DEBUG: Supabase Update Response:", response);
        const { error, data } = response;

        if (error) {
            console.error("DEBUG: Role Update Error details:", JSON.stringify(error, null, 2));
            console.error(error);
            alert(`Failed to update role: ${error.message} (${error.code})`);
            fetchAllData(league!.id);
        } else if (!data || data.length === 0) {
            console.warn("DEBUG: Role Update succeeded but NO rows returned. RLS likely blocked the update.");
            alert("Update appeared to fail (blocked by server permissions). Refreshing...");
            fetchAllData(league!.id);
        }
    };

    const handleApprove = async (memberId: string) => {
        // Optimistic
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'approved' } : m));

        const { error } = await supabase
            .from('league_members')
            .update({ status: 'approved' })
            .eq('id', memberId);

        if (error) {
            console.error("Error approving:", error);
            alert("Failed to approve user.");
            fetchAllData(league!.id);
        }
    };

    const handleReject = async (memberId: string) => {
        // if (!confirm("Reject this user request?")) return;
        // Optimistic
        setMembers(prev => prev.filter(m => m.id !== memberId));

        const { error } = await supabase
            .from('league_members')
            .delete()
            .eq('id', memberId);

        if (error) {
            console.error("Error rejecting:", error);
            alert("Failed to reject user.");
            fetchAllData(league!.id);
        }
    };

    const handleKick = async (memberId: string) => {
        console.log("DEBUG: handleKick called for", memberId);
        // Removed native confirm to avoid browser blocking issues
        // if (!confirm(...)) return;

        // Optimistic
        console.log("DEBUG: Applying optimistic kick");
        setMembers(prev => prev.filter(m => m.id !== memberId));

        const response = await supabase
            .from('league_members')
            .delete()
            .eq('id', memberId)
            .select();

        console.log("DEBUG: Supabase Delete Response:", response);

        const { error, data } = response;

        if (error) {
            console.error("DEBUG: Kick Error details:", JSON.stringify(error, null, 2));
            console.error("Error kicking:", error);
            alert(`Failed to kick member: ${error.message} (${error.code})`);
            fetchAllData(league!.id);
        } else if (!data || data.length === 0) {
            console.warn("DEBUG: Kick succeeded but NO rows returned. RLS likely blocked the delete.");
            alert("Kick appeared to fail (blocked by server permissions). Refreshing...");
            fetchAllData(league!.id);
        }
    };

    // Permission Check Helper
    const canEditRole = (targetRole: LeagueRole) => {
        if (isGlobalSuperAdmin) return true; // Super Admin can edit anyone
        if (currentLeagueRole === 'admin') {
            // League Admin can edit users and co-admins, but NOT other admins
            return targetRole !== 'admin';
        }
        return false;
    };

    const activeMembers = members.filter(m => m.status === 'approved' || m.status === undefined); // Fallback for old data
    const pendingMembers = members.filter(m => m.status === 'pending');
    const canManageRequests = isGlobalSuperAdmin || currentLeagueRole === 'admin' || currentLeagueRole === 'co_admin';
    const canManageTournaments = isGlobalSuperAdmin || currentLeagueRole === 'admin';

    const handleDeleteTournament = async (tournamentId: string) => {
        // if (!confirm("Are you sure you want to delete this tournament? This cannot be undone.")) return;

        // Optimistic UI
        setTournaments(prev => prev.filter(t => t.id !== tournamentId));

        const { error } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', tournamentId);

        if (error) {
            console.error("Error deleting tournament:", error);
            alert(`Failed to delete tournament: ${error.message}`);
            fetchAllData(league!.id);
        }
    };

    if (loading) return <div className="p-8 text-white min-h-screen bg-background">Loading League...</div>;
    if (!league) return <div className="p-8 text-white min-h-screen bg-background">League not found</div>;

    return (
        <div className="min-h-screen bg-background pb-12">
            <AdminNavbar />
            <div className="max-w-6xl mx-auto p-8 relative">
                <Link to="/admin" className="text-gray-400 hover:text-white flex items-center gap-2 mb-6">
                    <ArrowLeft size={20} /> Back to Dashboard
                </Link>

                <header className="mb-8 p-6 bg-surface border border-white/5 rounded-xl">
                    <div className="flex justify-between items-start">
                        <div>
                            <h1 className="text-4xl font-bold text-white mb-2">{league.name}</h1>
                            <div className="flex items-center gap-4 text-gray-400">
                                <span className="flex items-center gap-1"><Calendar size={16} /> {new Date(league.created_at).toLocaleDateString()}</span>
                                <span className={`px-2 py-0.5 rounded text-sm capitalize ${league.status === 'ongoing' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20'}`}>
                                    {league.status}
                                </span>
                            </div>
                        </div>

                        {(isGlobalSuperAdmin || currentLeagueRole === 'admin') && (
                            <button
                                onClick={toggleVisibility}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${league.is_public
                                    ? 'bg-blue-500/10 text-blue-500 border border-blue-500/50 hover:bg-blue-500/20'
                                    : 'bg-orange-500/10 text-orange-500 border border-orange-500/50 hover:bg-orange-500/20'}`}
                            >
                                {league.is_public ? <Globe size={18} /> : <Lock size={18} />}
                                {league.is_public ? 'Public' : 'Private'}
                            </button>
                        )}
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* LEFT COLUMN: TOURNAMENTS & DECKS */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* TOURNAMENTS SECTION */}
                        <section className="bg-surface border border-white/5 rounded-xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <Trophy className="text-yellow-500" /> Tournaments
                                </h2>
                                {canManageRequests && (
                                    <Link
                                        to={`/admin/leagues/${league.id}/tournaments/new`}
                                        className="px-4 py-2 bg-primary text-background font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 text-sm"
                                    >
                                        <Users size={16} /> New Tournament
                                    </Link>
                                )}
                            </div>

                            {tournaments.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 border border-dashed border-white/5 rounded-xl">
                                    <p>No tournaments yet.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {tournaments.map(t => (
                                        <div key={t.id} className="flex items-center gap-2 bg-black/20 p-2 pr-4 rounded-lg border border-white/5 hover:border-primary/50 transition-colors group">
                                            <Link
                                                to={`/admin/tournaments/${t.id}`}
                                                className="flex-1 p-2"
                                            >
                                                <div>
                                                    <h3 className="text-white font-bold group-hover:text-primary transition-colors">{t.name}</h3>
                                                    <div className="flex items-center gap-4 text-xs text-gray-400 mt-1">
                                                        <span className="flex items-center gap-1"><Calendar size={12} /> {new Date(t.date).toLocaleDateString()}</span>
                                                        <span className="bg-white/10 px-2 py-0.5 rounded text-gray-300">{t.format}</span>
                                                    </div>
                                                </div>
                                            </Link>

                                            {/* Action Buttons */}
                                            {canManageTournaments && (
                                                <div className="flex items-center gap-2">
                                                    <Link
                                                        to={`/admin/tournaments/${t.id}/edit`}
                                                        className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                                        title="Edit Tournament"
                                                    >
                                                        <MoreHorizontal size={18} />
                                                    </Link>
                                                    <button
                                                        onClick={() => handleDeleteTournament(t.id)}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                        title="Delete Tournament"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                        <section className="bg-surface border border-white/5 rounded-xl p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                    <Library className="text-primary" /> Registered Decks
                                </h2>
                                {canManageRequests && (
                                    <Link
                                        to={`/admin/leagues/${league.id}/library`}
                                        className="px-4 py-2 bg-white/5 text-gray-300 rounded-lg hover:bg-white/10 hover:text-white transition-colors flex items-center gap-2 text-sm"
                                    >
                                        <Library size={16} /> Manage Library
                                    </Link>
                                )}
                            </div>

                            {decks.length === 0 ? (
                                <div className="text-center py-12 text-gray-500 border-2 border-dashed border-white/5 rounded-xl">
                                    <p>No decks assigned yet.</p>
                                </div>
                            ) : (
                                <div className="grid gap-4">
                                    {decks.map(deck => (
                                        <div key={deck.id} className="bg-black/20 p-4 rounded-lg flex justify-between items-center border border-white/5">
                                            <div className="flex items-center gap-4">
                                                {deck.archetypes?.cover_image_url && (
                                                    <img src={deck.archetypes.cover_image_url} alt="Cover" className="w-12 h-16 object-cover rounded" />
                                                )}
                                                <div>
                                                    <h3 className="text-white font-bold">
                                                        {deck.profiles ? `${deck.profiles.first_name} ${deck.profiles.last_name}` : 'Unknown User'}
                                                    </h3>
                                                    <p className="text-sm text-primary">{deck.archetypes?.name || 'Unknown Archetype'}</p>
                                                </div>
                                            </div>
                                            <span className="text-xs bg-white/10 text-gray-400 px-2 py-1 rounded font-mono">
                                                {new Date(deck.created_at).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </section>
                    </div>

                    {/* RIGHT COLUMN: MEMBERS */}
                    <div className="lg:col-span-1">
                        <section className="bg-surface border border-white/5 rounded-xl p-6 sticky top-6">

                            {/* PENDING REQUESTS */}
                            {canManageRequests && pendingMembers.length > 0 && (
                                <div className="mb-8 p-4 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                    <h3 className="text-sm font-bold text-orange-400 mb-3 uppercase tracking-wider">
                                        Pending Requests ({pendingMembers.length})
                                    </h3>
                                    <div className="space-y-3">
                                        {pendingMembers.map(member => (
                                            <div key={member.id} className="flex items-center justify-between p-2 bg-black/20 rounded-lg">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-primary font-bold overflow-hidden">
                                                        {member.profiles?.avatar_url ? (
                                                            <img src={member.profiles.avatar_url} alt="Avg" className="w-full h-full object-cover" />
                                                        ) : (
                                                            member.profiles?.first_name?.[0] || '?'
                                                        )}
                                                    </div>
                                                    <span className="text-sm text-white font-medium">
                                                        {member.profiles ? `${member.profiles.first_name} ${member.profiles.last_name}` : 'Unknown'}
                                                    </span>
                                                </div>
                                                <div className="flex gap-1">
                                                    <button onClick={() => handleApprove(member.id)} className="p-1 text-green-500 hover:bg-green-500/20 rounded" title="Approve">
                                                        <User className="w-4 h-4" />+
                                                    </button>
                                                    <button onClick={() => handleReject(member.id)} className="p-1 text-red-500 hover:bg-red-500/20 rounded" title="Reject">
                                                        <Lock className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <h2 className="text-xl font-semibold text-white mb-6 flex items-center gap-2">
                                <Users className="text-purple-500" /> Active Members ({activeMembers.length})
                            </h2>

                            <div className="space-y-4">
                                {activeMembers.map(member => {
                                    const isMemberSuperAdmin = member.profiles?.role === 'super_admin';
                                    const isSelf = member.user_id === currentUserId;
                                    const showEdit = !isSelf && !isMemberSuperAdmin && canEditRole(member.role);

                                    return (
                                        <div key={member.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-primary font-bold overflow-hidden">
                                                    {member.profiles?.avatar_url ? (
                                                        <img src={member.profiles.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                                    ) : (
                                                        member.profiles?.first_name?.[0] || 'U'
                                                    )}
                                                </div>
                                                <div>
                                                    <div className="text-white font-medium text-sm">
                                                        {member.profiles ? `${member.profiles.first_name} ${member.profiles.last_name}` : 'Unknown'}
                                                    </div>
                                                    <div className={`text-xs capitalize flex items-center gap-1
                                                    ${isMemberSuperAdmin ? 'text-red-500 font-bold' :
                                                            member.role === 'admin' ? 'text-yellow-500' :
                                                                member.role === 'co_admin' ? 'text-purple-500' :
                                                                    'text-green-500'}`}>
                                                        {isMemberSuperAdmin && <Shield size={10} fill="currentColor" />}
                                                        {!isMemberSuperAdmin && member.role === 'admin' && <Trophy size={10} />}
                                                        {!isMemberSuperAdmin && member.role === 'co_admin' && <Shield size={10} />}

                                                        {isMemberSuperAdmin ? 'Super Admin' :
                                                            member.role === 'admin' ? 'League Admin' :
                                                                member.role === 'co_admin' ? 'Co-Admin' : 'User'}
                                                    </div>
                                                </div>
                                            </div>

                                            {showEdit ? (
                                                <div className="flex items-center gap-2">
                                                    <select
                                                        value={member.role}
                                                        onChange={(e) => handleRoleChange(member.id, e.target.value as LeagueRole)}
                                                        className="bg-black/40 border border-white/10 text-xs text-gray-300 rounded px-2 py-1 outline-none focus:border-primary"
                                                    >
                                                        <option value="user">User</option>
                                                        <option value="co_admin">Co-Admin</option>
                                                        {isGlobalSuperAdmin && <option value="admin">Admin</option>}
                                                    </select>

                                                    <button
                                                        onClick={() => handleKick(member.id)}
                                                        className="p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-500 rounded transition-colors"
                                                        title="Kick Member"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                </div>
                                            ) : (
                                                <div className="px-2">
                                                    {/* If Super Admin, allow kicking other admins even if they can't demote them via this specific UI (or just rely on Global Power) */}
                                                    {/* Actually, showEdit logic covers most cases. Special case: Super Admin kicking another Admin. */}
                                                    {isGlobalSuperAdmin && !isSelf && (
                                                        <button
                                                            onClick={() => handleKick(member.id)}
                                                            className="p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-500 rounded transition-colors"
                                                            title="Kick Admin"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                    );
                                })}

                                {activeMembers.length === 0 && (
                                    <div className="text-center text-gray-500 py-8">No active members.</div>
                                )}
                            </div>
                        </section>
                    </div>

                </div>
            </div>
        </div>
    );
}
