
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../types/database.types';
import { ArrowLeft, Users, Calendar, Library, Globe, Lock, MoreHorizontal, Trophy, Shield, User, Trash2, Edit, Check, X } from 'lucide-react';
import AdminNavbar from '../../../components/admin/AdminNavbar';

type League = Database['public']['Tables']['leagues']['Row'];
type LeagueRole = 'admin' | 'co_admin' | 'user';
type Tournament = Database['public']['Tables']['tournaments']['Row'];

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
    const [tournaments, setTournaments] = useState<Tournament[]>([]);
    const [members, setMembers] = useState<MemberDisplay[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Permissions
    const [isGlobalSuperAdmin, setIsGlobalSuperAdmin] = useState(false);
    const [currentLeagueRole, setCurrentLeagueRole] = useState<LeagueRole | null>(null);

    // Name Editing
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');

    useEffect(() => {
        if (id) fetchAllData(id);
    }, [id]);

    useEffect(() => {
        if (league) {
            setEditedName(league.name);
        }
    }, [league]);

    const fetchAllData = async (leagueId: string) => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (user) {
            setCurrentUserId(user.id);
            // Check Global Role
            const { data: profile } = await supabase
                .from('profiles')
                .select('role')
                .eq('id', user.id)
                .single();

            if (profile) {
                setIsGlobalSuperAdmin(profile.role === 'super_admin');
            }

            // Check League Role
            const { data: member } = await supabase
                .from('league_members')
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

        // Fetch Tournaments
        const { data: tournamentData } = await supabase
            .from('tournaments')
            .select('*')
            .eq('league_id', leagueId)
            .order('date', { ascending: false });
        if (tournamentData) setTournaments(tournamentData);

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

    const handleDeleteLeague = async () => {
        if (!league) return;
        if (!window.confirm(`Are you sure you want to delete "${league.name}"? This cannot be undone.`)) return;

        const { error } = await supabase
            .from('leagues')
            .delete()
            .eq('id', league.id);

        if (error) {
            alert("Failed to delete league: " + error.message);
        } else {
            // Redirect to User Dashboard
            window.location.href = '/';
        }
    };

    const handleUpdateName = async () => {
        if (!league || !editedName.trim()) return;

        const previousName = league.name;
        // Optimistic update
        setLeague({ ...league, name: editedName });
        setIsEditingName(false);

        const { data, error } = await supabase
            .from('leagues')
            .update({ name: editedName })
            .eq('id', league.id)
            .select();

        if (error) {
            alert("Failed to update league name: " + error.message);
            setLeague({ ...league, name: previousName });
            setEditedName(previousName);
        } else if (!data || data.length === 0) {
            // No rows updated (likely RLS)
            alert("Permission denied or League not found");
            setLeague({ ...league, name: previousName });
            setEditedName(previousName);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: LeagueRole) => {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));

        const { error } = await supabase
            .from('league_members')
            .update({ role: newRole })
            .eq('id', memberId);

        if (error) {
            alert(`Failed to update role: ${error.message}`);
            fetchAllData(league!.id);
        }
    };

    const handleApprove = async (memberId: string) => {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'approved' } : m));

        const { error } = await supabase
            .from('league_members')
            .update({ status: 'approved' })
            .eq('id', memberId);

        if (error) {
            alert("Failed to approve user.");
            fetchAllData(league!.id);
        }
    };

    const handleReject = async (memberId: string) => {
        setMembers(prev => prev.filter(m => m.id !== memberId));

        const { error } = await supabase
            .from('league_members')
            .delete()
            .eq('id', memberId);

        if (error) {
            alert("Failed to reject user.");
            fetchAllData(league!.id);
        }
    };

    const handleKick = async (memberId: string) => {
        setMembers(prev => prev.filter(m => m.id !== memberId));

        const { error } = await supabase
            .from('league_members')
            .delete()
            .eq('id', memberId);

        if (error) {
            alert(`Failed to kick member: ${error.message}`);
            fetchAllData(league!.id);
        }
    };

    // Permission Check Helper
    const canEditRole = (targetRole: LeagueRole) => {
        if (isGlobalSuperAdmin) return true;
        if (currentLeagueRole === 'admin') {
            return targetRole !== 'admin';
        }
        return false;
    };

    const activeMembers = members.filter(m => m.status === 'approved' || m.status === undefined);
    const pendingMembers = members.filter(m => m.status === 'pending');
    const canManageRequests = isGlobalSuperAdmin || currentLeagueRole === 'admin' || currentLeagueRole === 'co_admin';
    const canManageTournaments = isGlobalSuperAdmin || currentLeagueRole === 'admin';
    // Use type assertion for created_by until type is updated in codebase
    const canDeleteLeague = isGlobalSuperAdmin || (currentUserId && (league as any)?.created_by === currentUserId);

    const [tournamentTab, setTournamentTab] = useState<'active' | 'archive'>('active');

    const filteredTournaments = tournaments.filter(t => {
        if (tournamentTab === 'active') return t.status !== 'completed';
        return t.status === 'completed';
    });

    const handleDeleteTournament = async (tournamentId: string) => {
        setTournaments(prev => prev.filter(t => t.id !== tournamentId));

        const { error } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', tournamentId);

        if (error) {
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
                <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-2 mb-6">
                    <ArrowLeft size={20} /> Back to Dashboard
                </Link>

                <header className="mb-8 p-6 bg-surface border border-white/5 rounded-xl">
                    <div className="flex justify-between items-start">
                        <div>
                            {(isGlobalSuperAdmin || currentLeagueRole === 'admin') && (
                                <>
                                    {isEditingName ? (
                                        <div className="flex items-center gap-2 mb-2">
                                            <input
                                                type="text"
                                                value={editedName}
                                                onChange={(e) => setEditedName(e.target.value)}
                                                className="text-4xl font-bold text-white bg-black/40 border border-white/10 rounded px-2 py-1 outline-none focus:border-primary w-full max-w-md"
                                                autoFocus
                                            />
                                            <button
                                                onClick={handleUpdateName}
                                                className="p-2 bg-primary text-background rounded-lg hover:bg-primary/90 transition-colors"
                                                title="Save Name"
                                            >
                                                <Check size={24} />
                                            </button>
                                            <button
                                                onClick={() => {
                                                    setIsEditingName(false);
                                                    setEditedName(league.name);
                                                }}
                                                className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                                title="Cancel"
                                            >
                                                <X size={24} />
                                            </button>
                                        </div>
                                    ) : (
                                        <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3 group">
                                            {league.name}
                                            <button
                                                onClick={() => setIsEditingName(true)}
                                                className="text-gray-500 hover:text-white transition-colors p-1"
                                                title="Edit Name"
                                            >
                                                <Edit size={24} />
                                            </button>
                                        </h1>
                                    )}
                                </>
                            )}
                            {!(isGlobalSuperAdmin || currentLeagueRole === 'admin') && (
                                <h1 className="text-4xl font-bold text-white mb-2">{league.name}</h1>
                            )}

                            <div className="flex items-center gap-4 text-gray-400">
                                <span className="flex items-center gap-1"><Calendar size={16} /> {new Date(league.created_at).toLocaleDateString()}</span>
                                <span className={`px-2 py-0.5 rounded text-sm capitalize ${league.status === 'ongoing' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20'}`}>
                                    {league.status}
                                </span>
                            </div>
                        </div>

                        <div className="flex items-center gap-2">
                            {canManageRequests && (
                                <Link
                                    to={`/admin/leagues/${league.id}/library`}
                                    className="flex items-center gap-2 px-4 py-2 bg-white/5 text-gray-300 rounded-lg font-medium hover:bg-white/10 hover:text-white transition-colors border border-white/5"
                                >
                                    <Library size={18} /> Deck Library
                                </Link>
                            )}

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

                            {canDeleteLeague && (
                                <button
                                    onClick={handleDeleteLeague}
                                    className="px-3 py-2 bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20 rounded-lg transition-colors"
                                    title="Delete League"
                                >
                                    <Trash2 size={18} />
                                </button>
                            )}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN */}
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

                            {/* TABS */}
                            <div className="flex border-b border-white/10 mb-4">
                                <button
                                    onClick={() => setTournamentTab('active')}
                                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${tournamentTab === 'active' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'}`}
                                >
                                    Active
                                </button>
                                <button
                                    onClick={() => setTournamentTab('archive')}
                                    className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${tournamentTab === 'archive' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'}`}
                                >
                                    Archive
                                </button>
                            </div>

                            {filteredTournaments.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 border border-dashed border-white/5 rounded-xl">
                                    <p>{tournamentTab === 'active' ? 'No active tournaments.' : 'No archived tournaments.'}</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {filteredTournaments.map(t => (
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
                                                        <span className={`px-2 py-0.5 rounded capitalize ${t.status === 'setup' ? 'bg-yellow-500/10 text-yellow-500' :
                                                            t.status === 'active' ? 'bg-blue-500/10 text-blue-500' :
                                                                'bg-green-500/10 text-green-500'
                                                            }`}>
                                                            {t.status === 'setup' ? 'Pending' : t.status === 'active' ? 'Running' : 'Completed'}
                                                        </span>
                                                    </div>
                                                </div>
                                            </Link>

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
                    </div>

                    {/* RIGHT COLUMN: MEMBERS */}
                    <div className="lg:col-span-1">
                        <section className="bg-surface border border-white/5 rounded-xl p-6 sticky top-6">
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
            </div >
        </div >
    );
}
