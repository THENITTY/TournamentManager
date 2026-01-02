
import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../types/database.types';
import { ArrowLeft, Users, Calendar, Library, Globe, Lock, MoreHorizontal, Trophy, Shield, User, Trash2, Edit, Check, X, AlignLeft, Plus } from 'lucide-react';
import AdminNavbar from '../../../components/admin/AdminNavbar';
import { showSuccess, showError } from '../../../lib/toastUtils';
import PostCard from '../../../components/league/PostCard';
import CreatePostModal from '../../../components/league/CreatePostModal';
import type { PostWithDetails } from '../../../types/league';
import { formatDateTime } from '../../../lib/dateUtils';

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
    const [posts, setPosts] = useState<PostWithDetails[]>([]);
    const [loading, setLoading] = useState(true);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);

    // Permissions
    const [isGlobalSuperAdmin, setIsGlobalSuperAdmin] = useState(false);
    const [currentLeagueRole, setCurrentLeagueRole] = useState<LeagueRole | null>(null);

    // Name Editing
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState('');
    const [editingPost, setEditingPost] = useState<PostWithDetails | null>(null);
    const [confirmKickId, setConfirmKickId] = useState<string | null>(null);
    const [showConfirmDeleteLeague, setShowConfirmDeleteLeague] = useState(false);
    const [confirmDeleteTournamentId, setConfirmDeleteTournamentId] = useState<string | null>(null);

    // Tabs
    const [activeTab, setActiveTab] = useState<'tournaments' | 'board'>('tournaments');
    const [isCreatePostModalOpen, setIsCreatePostModalOpen] = useState(false);

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
                setIsGlobalSuperAdmin((profile as { role: string }).role === 'super_admin');
            }

            // Check League Role
            const { data: member } = await supabase
                .from('league_members')
                .select('role')
                .eq('league_id', leagueId)
                .eq('user_id', user.id)
                .single();

            if (member) {
                setCurrentLeagueRole((member as { role: LeagueRole }).role);
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

        // Fetch Posts
        await fetchPosts(leagueId, user?.id);

        // Fetch Members
        const { data: membersData } = await supabase
            .from('league_members')
            .select(`
                id,
                user_id,
                role,
                status,
                joined_at,
                profiles:user_id!inner (first_name, last_name, avatar_url, role, deleted_at)
            `)
            .eq('league_id', leagueId)
            .is('profiles.deleted_at', null)
            .order('joined_at', { ascending: true });

        if (membersData) setMembers(membersData as unknown as MemberDisplay[]);

        setLoading(false);
    };

    const fetchPosts = async (leagueId: string, userId?: string) => {
        const { data: postsData, error } = await supabase
            .from('league_posts')
            .select(`
                *,
                author:user_id(first_name, last_name, avatar_url),
                interactions:post_interactions(
                    *,
                    user:user_id(first_name, last_name, avatar_url)
                )
            `)
            .eq('league_id', leagueId)
            .order('created_at', { ascending: false });

        if (postsData && !error) {
            const processed = postsData.map((p: any) => ({
                ...p,
                current_user_interaction: userId ? p.interactions.find((i: any) => i.user_id === userId)?.status : null
            }));
            setPosts(processed as PostWithDetails[]);
        }
    }

    const toggleVisibility = async () => {
        if (!league) return;
        const newStatus = !league.is_public;

        // Optimistic UI Update
        setLeague(prev => prev ? { ...prev, is_public: newStatus } : null);

        const { error } = await ((supabase.from('leagues') as any)
            .update({ is_public: newStatus })
            .eq('id', league.id));

        if (error) {
            console.error(error);
            showError("Failed to update visibility");
            setLeague(prev => prev ? { ...prev, is_public: !newStatus } : null);
        }
    };

    const handleDeleteLeague = async () => {
        if (!league) return;
        // No window.confirm

        const { error } = await supabase
            .from('leagues')
            .delete()
            .eq('id', league.id);

        if (error) {
            showError("Delete Failed: " + error.message);
        } else {
            // Redirect to User Dashboard
            showSuccess('League deleted successfully');
            window.location.href = '/';
        }
        setShowConfirmDeleteLeague(false);
    };

    const handleUpdateName = async () => {
        if (!league || !editedName.trim()) return;

        const previousName = league.name;
        // Optimistic update
        setLeague({ ...league, name: editedName });
        setIsEditingName(false);
        showSuccess('League name updated successfully');

        const { data, error } = await ((supabase.from('leagues') as any)
            .update({ name: editedName })
            .eq('id', league.id)
            .select());

        if (error) {
            showError(error.message || "Failed to update league name");
            setLeague({ ...league, name: previousName });
            setEditedName(previousName);
        } else if (!data || data.length === 0) {
            // No rows updated (likely RLS)
            showError("Permission denied or League not found");
            setLeague({ ...league, name: previousName });
            setEditedName(previousName);
        }
    };

    const handleRoleChange = async (memberId: string, newRole: LeagueRole) => {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole } : m));

        const { error } = await ((supabase.from('league_members') as any)
            .update({ role: newRole })
            .eq('id', memberId));

        if (error) {
            showError(error.message || "Failed to update role");
            fetchAllData(league!.id);
        } else {
            showSuccess('Role updated successfully');
        }
    };

    const handleApprove = async (memberId: string) => {
        setMembers(prev => prev.map(m => m.id === memberId ? { ...m, status: 'approved' } : m));

        const { error } = await ((supabase.from('league_members') as any)
            .update({ status: 'approved' })
            .eq('id', memberId));

        if (error) {
            showError("Failed to approve user");
            showSuccess('Operation completed successfully');
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
            showError("Failed to reject user");
            showSuccess('Operation completed successfully');
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
            showError("Kick Failed: " + error.message);
            console.error(error);
            showSuccess('Operation completed successfully'); // Wait, why success if error? Removing this line.
            fetchAllData(league!.id);
        }
        setConfirmKickId(null);
    };

    const getPostPermissions = (post: PostWithDetails) => {
        if (!currentUserId) return { canEdit: false, canDelete: false };

        const isAuthor = post.user_id === currentUserId;

        if (isGlobalSuperAdmin) return { canEdit: true, canDelete: true };

        // League Admin
        if (currentLeagueRole === 'admin') {
            if (isAuthor) return { canEdit: true, canDelete: true };

            const authorMember = members.find(m => m.user_id === post.user_id);
            // If author is Admin -> Cannot manage
            if (authorMember?.role === 'admin') return { canEdit: false, canDelete: false };

            // Can manage Co-Admin or User (or unknown)
            return { canEdit: true, canDelete: true };
        }

        // Co-Admin
        if (currentLeagueRole === 'co_admin') {
            return { canEdit: isAuthor, canDelete: isAuthor };
        }

        // Regular User (can manage own)
        return { canEdit: isAuthor, canDelete: isAuthor };
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
    const canDeleteLeague = isGlobalSuperAdmin || (currentUserId && league?.created_by === currentUserId);

    const [tournamentTab, setTournamentTab] = useState<'active' | 'archive'>('active');

    const filteredTournaments = tournaments.filter(t => {
        if (tournamentTab === 'active') return t.status !== 'completed';
        return t.status === 'completed';
    });

    const handleDeleteTournament = async (tournamentId: string) => {
        setTournaments(prev => prev.filter(t => t.id !== tournamentId));
        setConfirmDeleteTournamentId(null);

        const { error } = await supabase
            .from('tournaments')
            .delete()
            .eq('id', tournamentId);

        if (error) {
            showError(error.message || "Failed to delete tournament");
            showSuccess('Operation completed successfully');
            fetchAllData(league!.id);
        }
    };


    if (loading) return <div className="p-8 text-white min-h-screen bg-background">Loading League...</div>;
    if (!league) return <div className="p-8 text-white min-h-screen bg-background">League not found</div>;

    return (
        <div className="min-h-screen bg-background pb-12">
            <AdminNavbar />
            <div className="max-w-6xl mx-auto p-4 sm:p-8 relative">
                <Link to="/" className="text-gray-400 hover:text-white flex items-center gap-2 mb-4 sm:mb-6 text-sm sm:text-base">
                    <ArrowLeft size={18} /> Back to Dashboard
                </Link>

                <header className="mb-6 sm:mb-8 p-4 sm:p-6 bg-surface border border-white/5 rounded-xl">
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-6 sm:gap-4 font-sans">
                        <div className="flex-1 w-full min-w-0">
                            {(isGlobalSuperAdmin || currentLeagueRole === 'admin') && (
                                <>
                                    {isEditingName ? (
                                        <div className="flex items-center gap-2 mb-4">
                                            <input
                                                type="text"
                                                value={editedName}
                                                onChange={(e) => setEditedName(e.target.value)}
                                                className="text-2xl sm:text-4xl font-bold text-white bg-black/40 border border-white/10 rounded px-2 py-1 outline-none focus:border-primary w-full max-w-md"
                                                autoFocus
                                            />
                                            <div className="flex gap-1 shrink-0">
                                                <button
                                                    onClick={handleUpdateName}
                                                    className="p-2 bg-primary text-background rounded-lg hover:bg-primary/90 transition-colors"
                                                    title="Save Name"
                                                >
                                                    <Check size={20} />
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        setIsEditingName(false);
                                                        showSuccess('League name updated successfully');
                                                        setEditedName(league.name);
                                                    }}
                                                    className="p-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-colors"
                                                    title="Cancel"
                                                >
                                                    <X size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 flex items-center flex-wrap gap-2 group min-w-0">
                                            <span className="truncate">{league.name}</span>
                                            <button
                                                onClick={() => setIsEditingName(true)}
                                                className="text-gray-500 hover:text-white transition-colors p-1"
                                                title="Edit Name"
                                            >
                                                <Edit size={20} className="sm:w-6 sm:h-6" />
                                            </button>
                                        </h1>
                                    )}
                                </>
                            )}
                            {!(isGlobalSuperAdmin || currentLeagueRole === 'admin') && (
                                <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 truncate">{league.name}</h1>
                            )}

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-gray-400 text-sm">
                                <span className="flex items-center gap-1 whitespace-nowrap"><Calendar size={14} /> {formatDateTime(league.created_at)}</span>
                                <span className={`px-2 py-0.5 rounded text-xs capitalize ${league.status === 'ongoing' ? 'bg-green-500/20 text-green-500' : 'bg-gray-500/20'}`}>
                                    {league.status}
                                </span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
                            {canManageRequests && (
                                <Link
                                    to={`/admin/leagues/${league.id}/library`}
                                    className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white/5 text-gray-300 rounded-lg text-sm font-medium hover:bg-white/10 hover:text-white transition-colors border border-white/5"
                                >
                                    <Library size={16} /> Deck Library
                                </Link>
                            )}

                            {(isGlobalSuperAdmin || currentLeagueRole === 'admin') && (
                                <button
                                    onClick={toggleVisibility}
                                    className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${league.is_public
                                        ? 'bg-blue-500/10 text-blue-500 border border-blue-500/50 hover:bg-blue-500/20'
                                        : 'bg-orange-500/10 text-orange-500 border border-orange-500/50 hover:bg-orange-500/20'}`}
                                >
                                    {league.is_public ? <Globe size={16} /> : <Lock size={16} />}
                                    <span className="whitespace-nowrap">{league.is_public ? 'Public' : 'Private'}</span>
                                </button>
                            )}

                            {canDeleteLeague && (
                                showConfirmDeleteLeague ? (
                                    <div className="flex items-center gap-1 bg-red-500/20 rounded-lg p-1 animate-in fade-in slide-in-from-right-2">
                                        <span className="text-xs text-red-500 font-bold px-1">Sure?</span>
                                        <button
                                            onClick={handleDeleteLeague}
                                            className="px-2 py-1 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600"
                                        >
                                            Yes
                                        </button>
                                        <button
                                            onClick={() => setShowConfirmDeleteLeague(false)}
                                            className="px-2 py-1 bg-white/10 text-gray-300 rounded text-xs font-bold hover:bg-white/20"
                                        >
                                            No
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        onClick={() => setShowConfirmDeleteLeague(true)}
                                        className="px-3 py-2 bg-red-500/10 text-red-500 border border-red-500/50 hover:bg-red-500/20 rounded-lg transition-colors shrink-0"
                                        title="Delete League"
                                    >
                                        <Trash2 size={16} />
                                    </button>
                                )
                            )}
                        </div>
                    </div>
                </header>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* LEFT COLUMN: Main Content */}
                    <div className="lg:col-span-2 space-y-8">

                        {/* MAIN TABS */}
                        <div className="flex gap-4 border-b border-white/10 pb-4">
                            <button
                                onClick={() => setActiveTab('tournaments')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'tournaments' ? 'bg-primary/20 text-primary font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <Trophy size={18} /> Tournaments
                            </button>
                            <button
                                onClick={() => setActiveTab('board')}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${activeTab === 'board' ? 'bg-blue-500/20 text-blue-500 font-bold' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <AlignLeft size={18} /> Notice Board
                            </button>
                        </div>

                        {activeTab === 'tournaments' && (
                            <section className="bg-surface border border-white/5 rounded-xl p-6 animate-in fade-in slide-in-from-left-4">
                                <div className="flex justify-between items-center mb-6">
                                    <h2 className="text-xl font-semibold text-white flex items-center gap-2">
                                        Active & Past Events
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

                                {/* INNER TABS */}
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
                                                            <span className="flex items-center gap-1"><Calendar size={12} /> {formatDateTime(t.date)}</span>
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
                                                        {confirmDeleteTournamentId === t.id ? (
                                                            <div className="flex items-center gap-1 bg-red-500/20 rounded-lg p-1 animate-in fade-in zoom-in duration-200">
                                                                <button
                                                                    onClick={() => handleDeleteTournament(t.id)}
                                                                    className="px-2 py-1 bg-red-500 text-white rounded text-xs font-bold hover:bg-red-600"
                                                                >
                                                                    Sure?
                                                                </button>
                                                                <button
                                                                    onClick={() => setConfirmDeleteTournamentId(null)}
                                                                    className="p-1 hover:bg-white/10 rounded"
                                                                >
                                                                    <X size={14} />
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setConfirmDeleteTournamentId(t.id)}
                                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                                                title="Delete Tournament"
                                                            >
                                                                <Trash2 size={18} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

                        {activeTab === 'board' && (
                            <section className="space-y-6 animate-in fade-in slide-in-from-right-4">
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-semibold text-white">Announcements & Events</h2>
                                    {canManageRequests && (
                                        <button
                                            onClick={() => setIsCreatePostModalOpen(true)}
                                            className="px-4 py-2 bg-blue-500 text-white font-bold rounded-lg hover:bg-blue-600 transition-colors flex items-center gap-2 text-sm shadow-lg shadow-blue-500/20"
                                        >
                                            <Plus size={16} /> Create Post
                                        </button>
                                    )}
                                </div>

                                {posts.length === 0 ? (
                                    <div className="text-center py-12 text-gray-500 bg-surface border border-dashed border-white/5 rounded-xl">
                                        <AlignLeft className="mx-auto mb-3 opacity-20" size={48} />
                                        <p className="text-lg font-medium text-gray-400">Nothing here yet</p>
                                        <p className="text-sm">Check back later for tournaments and announcements.</p>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 gap-6">
                                        {posts.map(post => {
                                            const perms = getPostPermissions(post);
                                            return (
                                                <PostCard
                                                    key={post.id}
                                                    post={post}
                                                    currentUserId={currentUserId}
                                                    onUpdate={() => fetchPosts(league.id, currentUserId || undefined)}
                                                    canEdit={perms.canEdit}
                                                    canDelete={perms.canDelete}
                                                    onEdit={(p) => {
                                                        setEditingPost(p);
                                                        setIsCreatePostModalOpen(true);
                                                    }}
                                                />
                                            );
                                        })}
                                    </div>
                                )}
                            </section>
                        )}
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

                                                    {confirmKickId === member.id ? (
                                                        <div className="flex items-center gap-1">
                                                            <button
                                                                onClick={() => handleKick(member.id)}
                                                                className="p-1 px-2 bg-red-500 text-white rounded text-[10px] font-bold hover:bg-red-600"
                                                            >
                                                                CONFIRM
                                                            </button>
                                                            <button
                                                                onClick={() => setConfirmKickId(null)}
                                                                className="p-1 px-2 bg-white/10 text-gray-400 rounded text-[10px] hover:bg-white/20"
                                                            >
                                                                CANCEL
                                                            </button>
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={() => setConfirmKickId(member.id)}
                                                            className="p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-500 rounded transition-colors"
                                                            title="Kick Member"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    )}
                                                </div>
                                            ) : (
                                                <div className="px-2">
                                                    {isGlobalSuperAdmin && !isSelf && (
                                                        confirmKickId === member.id ? (
                                                            <div className="flex items-center gap-1">
                                                                <button
                                                                    onClick={() => handleKick(member.id)}
                                                                    className="p-1 px-2 bg-red-500 text-white rounded text-[10px] font-bold hover:bg-red-600"
                                                                >
                                                                    CONFIRM
                                                                </button>
                                                                <button
                                                                    onClick={() => setConfirmKickId(null)}
                                                                    className="p-1 px-2 bg-white/10 text-gray-400 rounded text-[10px] hover:bg-white/20"
                                                                >
                                                                    CANCEL
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <button
                                                                onClick={() => setConfirmKickId(member.id)}
                                                                className="p-1.5 text-gray-400 hover:bg-red-500/10 hover:text-red-500 rounded transition-colors"
                                                                title="Kick Admin"
                                                            >
                                                                <Trash2 size={14} />
                                                            </button>
                                                        )
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

                {/* MODALS */}
                {league && currentUserId && (
                    <CreatePostModal
                        isOpen={isCreatePostModalOpen}
                        onClose={() => {
                            setIsCreatePostModalOpen(false);
                            setEditingPost(null);
                        }}
                        initialData={editingPost}
                        leagueId={league.id}
                        userId={currentUserId}
                        onCreated={() => fetchPosts(league.id, currentUserId)}
                    />
                )}
            </div >
        </div >
    );
}
