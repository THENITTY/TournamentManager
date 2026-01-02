import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useTournament } from '../../../hooks/useTournament';
import { ArrowLeft, Calendar, Users, Trophy, Swords, Trash2, Pencil } from 'lucide-react';
import AdminNavbar from '../../../components/admin/AdminNavbar';
import { showSuccess, showError } from '../../../lib/toastUtils';
import StandingsTable from '../../../components/tournament/StandingsTable';
import MatchReportingModal from '../../../components/tournament/MatchReportingModal';
import DeckSelectionModal from '../../../components/tournament/DeckSelectionModal';
import AddPlayerModal from '../../../components/tournament/AddPlayerModal';
import DeletePlayerModal from '../../../components/tournament/DeletePlayerModal';
import FinishTournamentModal from '../../../components/tournament/FinishTournamentModal';
import type { MatchWithPlayers, AvailableMember } from '../../../types/tournament';

export default function TournamentDashboardPage() {
    const { id } = useParams();
    const {
        tournament,
        loading,
        matches,
        participants,
        standings,
        archetypes,
        viewRound,
        totalRounds,
        permissions: { currentUserRole, isGlobalSuperAdmin, currentUserId },
        actions
    } = useTournament(id);

    // UI State
    const [activeTab, setActiveTab] = useState<'overview' | 'standings' | 'pairings'>('overview');
    const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
    const [selectedParticipantIdForDeck, setSelectedParticipantIdForDeck] = useState<string | null>(null);
    const [reportingMatch, setReportingMatch] = useState<MatchWithPlayers | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([]);
    const [addingPlayer, setAddingPlayer] = useState(false); // UI loading state for adding player
    const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [finishing, setFinishing] = useState(false); // UI loading state for finishing

    // Handler Wrappers
    const openAddModal = async () => {
        try {
            const members = await actions.getAvailableMembers();
            setAvailableMembers(members);
            setIsAddModalOpen(true);
        } catch (error) {
            console.error(error);
            showError("Failed to load available members");
        }
    };



    const openDeckSelection = (participantId: string) => {
        setSelectedParticipantIdForDeck(participantId);
        setIsDeckModalOpen(true);
    };

    const handleAssignDeck = async (archetypeId: string) => {
        if (!selectedParticipantIdForDeck) return;
        try {
            await actions.assignDeck(selectedParticipantIdForDeck, archetypeId);
            setIsDeckModalOpen(false);
        } catch (error: any) {
            showError(error.message || "Failed to assign deck");
        }
    };

    const handleStartTournament = async () => {
        try {
            await actions.startTournament();
            showSuccess("Tournament started!");
            setActiveTab('pairings');
        } catch (error: any) {
            showError(error.message || "Failed to start tournament");
        }
    };

    const handleNextRound = async () => {
        try {
            if (tournament?.current_round && tournament.total_rounds && tournament.current_round >= tournament.total_rounds) {
                setShowFinishModal(true);
                return;
            }
            const nextRoundNum = await actions.nextRound();
            if (nextRoundNum) {
                showSuccess('Round ' + nextRoundNum + ' started successfully!');
                setActiveTab('pairings');
                actions.setViewRound(nextRoundNum);
            }
        } catch (error: any) {
            showError(error.message || "Failed to start next round");
        }
    };

    const submitMatchResult = async (p1Score: number, p2Score: number, winnerId: string | null) => {
        if (!reportingMatch) return;
        try {
            await actions.submitMatch(reportingMatch.id, p1Score, p2Score, winnerId);
            setReportingMatch(null);
        } catch (error: any) {
            showError(error.message || "Error reporting result");
        }
    };

    const openDeleteModal = (participantId: string) => {
        setPlayerToDelete(participantId);
    };

    const confirmRemovePlayer = async () => {
        if (!playerToDelete) return;
        try {
            await actions.removePlayer(playerToDelete);
            setPlayerToDelete(null);
        } catch (error: any) {
            showError(error.message || "Failed to remove player");
        }
    };

    const handleFinishTournament = async () => {
        setFinishing(true);
        try {
            await actions.finishTournament();
            setShowFinishModal(false);
            setActiveTab('standings');
        } catch (error: any) {
            showError(error.message || "Error finishing tournament");
        } finally {
            setFinishing(false);
        }
    };

    const canManageTournament = isGlobalSuperAdmin || currentUserRole === 'admin' || currentUserRole === 'co_admin';

    const getStatusLabel = (s: string) => {
        switch (s) {
            case 'setup': return 'Pending';
            case 'active': return 'Running';
            case 'completed': return 'Completed';
            default: return s;
        }
    };

    if (loading) return <div className="p-8 text-white">Loading Tournament...</div>;
    if (!tournament) return <div className="p-8 text-white">Tournament not found</div>;

    return (
        <div className="min-h-screen bg-background pb-12 relative">
            <AdminNavbar />
            <div className="max-w-6xl mx-auto p-4 sm:p-8">
                <Link to={`/admin/leagues/${tournament.league_id}`} className="text-gray-400 hover:text-white flex items-center gap-2 mb-4 sm:mb-6 text-sm sm:text-base">
                    <ArrowLeft size={18} /> Back to League
                </Link>

                {/* HEADER */}
                <header className="bg-surface border border-white/5 rounded-xl p-4 sm:p-8 mb-6 sm:mb-8 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex flex-col sm:flex-row justify-between items-start gap-4 sm:gap-2 mb-4">
                            <div className="min-w-0 flex-1">
                                <h1 className="text-2xl sm:text-4xl font-bold text-white mb-2 truncate">{tournament.name}</h1>
                                <div className="flex flex-wrap items-center gap-4 sm:gap-6 text-xs sm:text-sm text-gray-400">
                                    <span className="flex items-center gap-2"><Calendar size={14} className="sm:w-4 sm:h-4" /> {new Date(tournament.date).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-2"><Swords size={14} className="sm:w-4 sm:h-4" /> {tournament.format} System</span>
                                </div>
                            </div>
                            <div className={`px-3 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold uppercase tracking-wider text-[10px] sm:text-sm shrink-0
                                ${tournament.status === 'setup' ? 'bg-yellow-500/20 text-yellow-500' :
                                    tournament.status === 'active' ? 'bg-blue-500/20 text-blue-500' : 'bg-green-500/20 text-green-500'}
                            `}>
                                {getStatusLabel(tournament.status)}
                            </div>
                        </div>
                    </div>
                </header>

                <div className="flex border-b border-white/10 mb-6 sm:mb-8 overflow-x-auto no-scrollbar scroll-smooth">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Overview
                    </button>
                    <button
                        onClick={() => setActiveTab('pairings')}
                        className={`px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'pairings' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Pairings
                    </button>
                    <button
                        onClick={() => setActiveTab('standings')}
                        className={`px-4 sm:px-6 py-3 sm:py-4 font-medium text-xs sm:text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'standings' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Standings
                    </button>
                </div>

                {/* CONTENT AREA */}
                <div className="min-h-[400px]">
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                            {/* Left: Stats & Actions */}
                            <div className="space-y-6">
                                <div className="bg-surface border border-white/5 rounded-xl p-6">
                                    <h3 className="text-lg font-bold text-white mb-4">Tournament Status</h3>

                                    <div className="space-y-4">
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Format</span>
                                            <span className="text-white font-mono">{tournament.format}</span>
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Round</span>
                                            <span className="text-white font-mono">{tournament.current_round} / {totalRounds}</span>
                                        </div>
                                        <div className="flex justify-between text-sm items-center">
                                            <span className="text-gray-400">Total Rounds</span>
                                            {tournament.status === 'setup' && canManageTournament ? (
                                                tournament.format === 'Swiss' ? (
                                                    <select
                                                        value={totalRounds}
                                                        onChange={(e) => actions.setTotalRounds(Number(e.target.value))}
                                                        className="bg-black/40 border border-white/10 rounded px-2 py-1 text-sm text-white font-mono focus:border-primary outline-none"
                                                    >
                                                        {[...Array(10)].map((_, i) => (
                                                            <option key={i} value={i + 1}>{i + 1}</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <span className="text-white font-mono">{totalRounds} (Fixed)</span>
                                                )
                                            ) : (
                                                <span className="text-white font-mono">{tournament.total_rounds ?? totalRounds}</span>
                                            )}
                                        </div>
                                        <div className="flex justify-between text-sm">
                                            <span className="text-gray-400">Players</span>
                                            <span className={`font-mono ${tournament.format === 'SingleElimination' && Math.log2(participants.length) % 1 !== 0
                                                ? "text-red-500"
                                                : "text-white"
                                                }`}>
                                                {participants.length}
                                            </span>
                                        </div>

                                        {/* Warning for Single Elim */}
                                        {tournament.format === 'SingleElimination' && Math.log2(participants.length) % 1 !== 0 && participants.length > 0 && (
                                            <div className="text-xs text-red-400 mt-2 bg-red-400/10 p-2 rounded border border-red-400/20">
                                                Single Elimination requires a player count of 2, 4, 8, 16, 32, etc. Please add or remove players.
                                            </div>
                                        )}
                                    </div>

                                    {tournament.status === 'setup' && canManageTournament && (
                                        <div className="mt-8 pt-6 border-t border-white/5">
                                            <button
                                                className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                                onClick={handleStartTournament}
                                                disabled={
                                                    participants.length < 2 || // Absolute min
                                                    (tournament.format === 'SingleElimination' && Math.log2(participants.length) % 1 !== 0) ||
                                                    (tournament.format === 'Swiss' && participants.length < 4) // Swiss min
                                                }
                                            >
                                                <Swords size={20} /> Start Tournament
                                            </button>
                                            <p className="text-xs text-center text-gray-500 mt-2">
                                                {participants.length < 2 ? "Need at least 2 players" :
                                                    tournament.format === 'SingleElimination' && Math.log2(participants.length) % 1 !== 0 ? "Player count must be a power of 2" :
                                                        tournament.format === 'Swiss' && participants.length < 4 ? `Need ${4 - participants.length} more players to start` :
                                                            "Ready to start!"}
                                            </p>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Right: Participants List */}
                            <div className="md:col-span-2">
                                <div className="bg-surface border border-white/5 rounded-xl p-6">
                                    <div className="flex justify-between items-center mb-6">
                                        <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                            <Users className="text-primary" /> Registered Players
                                        </h3>
                                        {tournament.status === 'setup' && canManageTournament && (
                                            <button
                                                onClick={openAddModal}
                                                className="px-3 py-1.5 bg-white/10 hover:bg-white/20 text-white text-sm rounded-lg transition-colors"
                                            >
                                                + Add Player
                                            </button>
                                        )}
                                    </div>

                                    {participants.length === 0 ? (
                                        <div className="text-center py-12 text-gray-500 border border-dashed border-white/5 rounded-xl bg-black/20">
                                            <Users size={32} className="mx-auto mb-2 opacity-50" />
                                            <p>No players registered yet.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {participants.map((p, i) => (
                                                <div key={p.id} className="flex items-center justify-between p-3 bg-black/20 rounded-lg border border-white/5">
                                                    <div className="flex items-center gap-3">
                                                        <span className="text-gray-500 font-mono w-6">{i + 1}.</span>
                                                        {/* Avatar if exists, else placeholder */}
                                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                                            {p.user?.first_name?.charAt(0).toUpperCase() || "?"}{p.user?.last_name?.charAt(0).toUpperCase() || "?"}
                                                        </div>
                                                        <span className="text-white font-medium">{p.user ? `${p.user.first_name} ${p.user.last_name}` : "Unknown User"}</span>
                                                    </div>
                                                    {tournament.status === 'setup' && canManageTournament && (
                                                        <button
                                                            onClick={() => openDeleteModal(p.id)}
                                                            className="text-gray-500 hover:text-red-500 p-2"
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {activeTab === 'pairings' && (
                        <div className="space-y-6">
                            {/* Round Selector */}
                            {matches.length > 0 && (
                                <div className="flex items-center gap-2 mb-4 bg-surface border border-white/5 p-2 rounded-lg w-fit">
                                    <span className="text-gray-400 text-sm ml-2">View Round:</span>
                                    <div className="flex gap-1">
                                        {[...Array(tournament.current_round || 0)].map((_, i) => {
                                            const r = i + 1;
                                            return (
                                                <button
                                                    key={r}
                                                    onClick={() => actions.setViewRound(r)}
                                                    className={`px-3 py-1 rounded text-sm font-bold transition-colors ${viewRound === r ? 'bg-primary text-background' : 'bg-black/40 text-gray-400 hover:text-white'}`}
                                                >
                                                    {r}
                                                </button>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {matches.length === 0 ? (
                                <div className="text-center text-gray-500 py-12 border border-dashed border-white/5 rounded-xl">
                                    <Swords size={48} className="mx-auto mb-4 opacity-50" />
                                    <h3 className="text-xl font-bold text-white mb-2">No Matches Yet</h3>
                                    <p>Start the tournament to generate pairings.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {matches
                                        .filter(m => m.round_number === viewRound)
                                        .map((match) => (
                                            <div key={match.id} className="bg-surface border border-white/10 rounded-xl p-4 flex flex-col gap-4">
                                                {/* Header */}
                                                <div className="flex justify-between items-center text-xs text-gray-500 uppercase font-bold tracking-wider">
                                                    <span>Match {match.id.substring(0, 4)}</span>
                                                    <span>{match.is_bye ? "BYE" : "VS"}</span>
                                                </div>

                                                {/* Players */}
                                                <div className="flex flex-col gap-2">
                                                    {/* Player 1 */}
                                                    <div className={`flex items-center justify-between p-3 rounded-lg ${match.score_p1 !== null && match.winner_id === match.player1_id ? 'bg-green-500/20 border border-green-500/30' : 'bg-black/20 border border-white/5'
                                                        }`}>
                                                        <span className="font-bold text-white">
                                                            {match.player1?.user?.first_name} {match.player1?.user?.last_name}
                                                        </span>
                                                        {match.is_bye && <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">Auto Win</span>}
                                                    </div>

                                                    {/* Player 2 */}
                                                    {!match.is_bye && (
                                                        <div className={`flex items-center justify-between p-3 rounded-lg ${match.score_p2 !== null && match.winner_id === match.player2_id ? 'bg-green-500/20 border border-green-500/30' : 'bg-black/20 border border-white/5'
                                                            }`}>
                                                            <span className="font-bold text-white">
                                                                {match.player2?.user?.first_name} {match.player2?.user?.last_name}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>


                                                {/* REPORT BUTTON */}
                                                {!match.is_bye && !match.winner_id && canManageTournament && tournament.status !== 'completed' && match.round_number === tournament.current_round && (
                                                    <button
                                                        onClick={() => setReportingMatch(match)}
                                                        className="w-full py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg text-sm transition-colors mt-2"
                                                    >
                                                        Report Result
                                                    </button>
                                                )}

                                                {/* COMPLETED STATUS */}
                                                {!match.is_bye && match.winner_id && (
                                                    <div className="flex items-center justify-center gap-2 mt-2 border-t border-white/5 pt-2">
                                                        <span className="text-xs text-green-400 font-bold uppercase tracking-wider">Completed</span>
                                                        {canManageTournament && tournament.status !== 'completed' && (
                                                            <button
                                                                onClick={() => setReportingMatch(match)}
                                                                className="p-1 text-gray-500 hover:text-white hover:bg-white/10 rounded transition-colors"
                                                                title="Edit Result"
                                                            >
                                                                <Pencil size={12} />
                                                            </button>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            )}

                            {/* NEXT ROUND ACTION */}
                            {matches.length > 0 && matches
                                .filter(m => m.round_number === tournament.current_round)
                                .every(m => m.score_p1 !== null || m.is_bye) && canManageTournament && (
                                    <div className="mt-8 border-t border-white/10 pt-6 text-center">
                                        <div className="mb-4 text-green-400 text-sm font-bold uppercase tracking-wider flex items-center justify-center gap-2">
                                            <Trophy size={16} /> All matches completed
                                        </div>
                                        <button
                                            onClick={handleNextRound}
                                            className="px-8 py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 mx-auto"
                                        >
                                            {tournament.current_round && tournament.total_rounds && tournament.current_round >= tournament.total_rounds
                                                ? "Finish Tournament"
                                                : `Start Round ${(tournament.current_round || 0) + 1}`
                                            } <ArrowLeft className="rotate-180" size={20} />
                                        </button>
                                    </div>
                                )}
                        </div>
                    )}

                    {activeTab === 'standings' && (
                        <StandingsTable
                            standings={standings}
                            participants={participants}
                            isGlobalSuperAdmin={isGlobalSuperAdmin}
                            currentUserRole={currentUserRole}
                            currentUserId={currentUserId}
                            onDeckClick={openDeckSelection}
                        />
                    )}
                </div>
            </div>

            {/* ADD PLAYER MODAL */}
            <AddPlayerModal
                isOpen={isAddModalOpen}
                onClose={() => setIsAddModalOpen(false)}
                availableMembers={availableMembers}
                onAddPlayers={async (userIds) => {
                    setAddingPlayer(true);
                    try {
                        await actions.addPlayers(userIds);
                        showSuccess(`${userIds.length} Players added successfully`);
                        setIsAddModalOpen(false);
                        const members = await actions.getAvailableMembers();
                        setAvailableMembers(members);
                    } catch (err: any) {
                        showError(err.message);
                    } finally {
                        setAddingPlayer(false);
                    }
                }}
                isAdding={addingPlayer}
            />

            {/* DELETE PLAYER MODAL */}
            <DeletePlayerModal
                isOpen={!!playerToDelete}
                onClose={() => setPlayerToDelete(null)}
                onConfirm={confirmRemovePlayer}
            />

            {/* DECK SELECTION MODAL */}
            <DeckSelectionModal
                isOpen={isDeckModalOpen}
                onClose={() => setIsDeckModalOpen(false)}
                archetypes={archetypes}
                onSelectDeck={handleAssignDeck}
            />

            {/* REPORT MATCH MODAL */}
            <MatchReportingModal
                isOpen={!!reportingMatch}
                onClose={() => setReportingMatch(null)}
                match={reportingMatch}
                onSubmit={submitMatchResult}
            />

            {/* FINISH TOURNAMENT CONFIRMATION MODAL */}
            <FinishTournamentModal
                isOpen={showFinishModal}
                onClose={() => setShowFinishModal(false)}
                onConfirm={handleFinishTournament}
                isFinishing={finishing}
            />
        </div>
    );
}
