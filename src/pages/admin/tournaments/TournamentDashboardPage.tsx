import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { ArrowLeft, Calendar, Users, Trophy, Swords, Trash2 } from 'lucide-react';
import AdminNavbar from '../../../components/admin/AdminNavbar';
import type { Database } from '../../../types/database.types';

import { generateRound1Pairings, calculateStandings, generateNextRoundPairings, type ParticipantStats } from '../../../lib/tournament/pairingUtils';

type Tournament = Database['public']['Tables']['tournaments']['Row'];

export default function TournamentDashboardPage() {
    const { id } = useParams();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'standings' | 'pairings'>('overview');

    // Participants State
    const [participants, setParticipants] = useState<any[]>([]);

    // Matches State
    const [matches, setMatches] = useState<any[]>([]);
    const [standings, setStandings] = useState<ParticipantStats[]>([]);

    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [availableMembers, setAvailableMembers] = useState<any[]>([]);
    const [addingPlayer, setAddingPlayer] = useState(false);

    // Reporting State
    const [reportingMatch, setReportingMatch] = useState<any | null>(null);

    useEffect(() => {
        if (id) {
            fetchTournament();
            fetchParticipants();
            fetchMatches();
        }
    }, [id]);

    const fetchMatches = async () => {
        if (!id) return;
        const { data, error } = await supabase
            .from('matches')
            .select(`
                *,
                player1:tournament_participants!player1_id (
                    user:profiles (first_name, last_name)
                ),
                player2:tournament_participants!player2_id (
                    user:profiles (first_name, last_name)
                )
            `)
            .eq('tournament_id', id)
            .order('created_at', { ascending: true });

        if (data) setMatches(data);
    };

    const fetchTournament = async () => {
        const { data, error } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', id!)
            .single();

        if (data) setTournament(data);
        setLoading(false);
    };

    const fetchParticipants = async () => {
        const { data, error } = await supabase
            .from('tournament_participants')
            .select(`
                *,
                user:profiles(id, first_name, last_name, avatar_url)
            `)
            .eq('tournament_id', id!)
            .order('joined_at', { ascending: true });

        if (data) setParticipants(data);
    };

    const fetchAvailableMembers = async () => {
        if (!tournament) return;

        // Fetch all league members
        const { data: members } = await supabase
            .from('league_members')
            .select('user_id, profiles(id, first_name, last_name, avatar_url)')
            .eq('league_id', tournament.league_id);

        if (members) {
            // Filter out those already in the tournament
            const participantIds = new Set(participants.map(p => p.user_id));
            const available = members
                .map(m => m.profiles) // flatten
                .filter(p => p && !participantIds.has(p.id)); // valid profile & not joined

            setAvailableMembers(available);
        }
    };

    const openAddModal = () => {
        fetchAvailableMembers();
        setIsAddModalOpen(true);
    };

    const handleAddPlayer = async (userId: string) => {
        setAddingPlayer(true);
        const { error } = await supabase
            .from('tournament_participants')
            .insert({
                tournament_id: id!,
                user_id: userId
            });

        if (error) {
            alert("Failed to add player: " + error.message);
        } else {
            fetchParticipants(); // Refresh list
            setIsAddModalOpen(false); // Close modale or keep open? Let's close for now or refresh available list
            // Better UX: Remove from available list immediately
            setAvailableMembers(prev => prev.filter(m => m.id !== userId));
        }
        setAddingPlayer(false);
    };

    // Rounds Logic
    const [totalRounds, setTotalRounds] = useState<number>(3);

    useEffect(() => {
        if (tournament?.total_rounds) {
            setTotalRounds(tournament.total_rounds);
        } else if (participants.length > 0) {
            const recommended = calculateRecommendedRounds(participants.length, tournament?.format);
            setTotalRounds(recommended);
        }
    }, [tournament, participants.length]);

    const calculateRecommendedRounds = (numPlayers: number, format: string = 'Swiss') => {
        if (numPlayers < 2) return 1;
        if (format === 'SingleElimination') {
            return Math.ceil(Math.log2(numPlayers));
        }
        // Swiss defaults (Konami-style or standard)
        if (numPlayers <= 8) return 3;
        if (numPlayers <= 16) return 4;
        if (numPlayers <= 32) return 5;
        if (numPlayers <= 64) return 6;
        return Math.ceil(Math.log2(numPlayers));
    };

    // Calculate Standings Effect
    useEffect(() => {
        if (participants.length > 0 && matches.length > 0 && tournament) {
            // Convert participants to the shape expected (if needed) but state should be fine
            // We need to map our enriched matches to raw MatchRow if the utility expects strict MatchRow,
            // but the utility only cares about fields present in MatchRow.
            const stats = calculateStandings(participants, matches, tournament.current_round ?? 1);
            setStandings(stats);
        }
    }, [participants, matches, tournament?.current_round]);

    // Next Round Logic
    const handleNextRound = async () => {
        if (!tournament) return;

        // 1. Calculate latest standings (ensure we have them)
        const currentStats = calculateStandings(participants, matches, tournament.current_round ?? 1);

        // 2. Update Database with these stats
        // We can do a bulk upsert if Supabase supports it well, or Promise.all
        // The `tournament_participants` table has: score, real_wins, omw, rank (we can assign rank by index)
        const updates = currentStats.map((p, index) => ({
            id: p.id,
            tournament_id: tournament.id,
            user_id: p.user_id,
            score: p.points,
            real_wins: p.realWins,
            omw: p.omw,
            rank: index + 1 // 1-based rank
        }));

        const { error: statsError } = await supabase
            .from('tournament_participants')
            .upsert(updates);

        if (statsError) {
            alert("Failed to update standings: " + statsError.message);
            return;
        }

        // 3. Check for Tournament Completion
        if (tournament.current_round && tournament.total_rounds && tournament.current_round >= tournament.total_rounds) {
            // Finish Tournament
            const { error: finishError } = await supabase
                .from('tournaments')
                .update({ status: 'completed' })
                .eq('id', tournament.id);

            if (finishError) {
                alert("Failed to finish tournament: " + finishError.message);
            } else {
                fetchTournament();
                setActiveTab('standings');
                alert("Tournament Completed! Check Standings.");
            }
            return;
        }

        // 4. Generate Next Round Pairings
        const nextRound = (tournament.current_round ?? 0) + 1;
        const newPairings = generateNextRoundPairings(
            tournament.id,
            nextRound,
            currentStats,
            matches
        );

        const { error: pairError } = await supabase
            .from('matches')
            .insert(newPairings);

        if (pairError) {
            alert("Failed to generate pairings: " + pairError.message);
            return;
        }

        // 5. Update Tournament Round
        const { error: roundError } = await supabase
            .from('tournaments')
            .update({ current_round: nextRound })
            .eq('id', tournament.id);

        if (roundError) {
            alert("Failed to update round: " + roundError.message);
        } else {
            fetchTournament();
            fetchMatches(); // Get new matches
            setActiveTab('pairings');
        }
    };

    // Status Mapping Helper
    const getStatusLabel = (s: string) => {
        switch (s) {
            case 'setup': return 'Pending';
            case 'active': return 'Running';
            case 'completed': return 'Completed';
            default: return s;
        }
    };

    // Start Tournament
    const handleStartTournament = async () => {
        if (!tournament) return;

        // Ensure rounds are set
        const finalRounds = totalRounds || calculateRecommendedRounds(participants.length, tournament.format);

        // 1. Generate Round 1 Pairings
        // We need to fetch the full participant objects mostly for logic, but we have them in state.
        // The 'participants' state has the joined user object, but the utils expect the row shape roughly.
        // We can map or just use the IDs we have. 
        // Let's import the helper function.
        // (Assuming import is added at top)

        // Construct compatible objects for the helper
        const simpleParticipants = participants.map(p => ({
            ...p,
            user_id: p.user_id // Ensure this matches
        }));

        const pairings = generateRound1Pairings(tournament.id, simpleParticipants);

        // 2. Insert Matches
        const { error: matchError } = await supabase
            .from('matches')
            .insert(pairings);

        if (matchError) {
            alert("Failed to create pairings: " + matchError.message);
            return;
        }

        // 3. Update Tournament Status
        const { error } = await supabase
            .from('tournaments')
            .update({
                status: 'active',
                current_round: 1,
                total_rounds: finalRounds
            })
            .eq('id', tournament.id);

        if (error) {
            alert("Failed to start: " + error.message);
        } else {
            // Update local state
            setTournament({
                ...tournament,
                status: 'active',
                current_round: 1,
                total_rounds: finalRounds
            });
            // We need to fetch matches now! (Assuming fetchMatches will be implemented later)
            fetchMatches();
            setActiveTab('pairings');
        }
    };

    // Delete Confirmation State
    const [playerToDelete, setPlayerToDelete] = useState<string | null>(null);

    const openDeleteModal = (participantId: string) => {
        setPlayerToDelete(participantId);
    };

    const confirmRemovePlayer = async () => {
        if (!playerToDelete) return;

        const { error } = await supabase
            .from('tournament_participants')
            .delete()
            .eq('id', playerToDelete);

        if (error) {
            alert("Failed to remove: " + error.message);
        } else {
            fetchParticipants();
        }
        setPlayerToDelete(null);
    };



    // Actually, implementation plan says: "Admin selects Winner: 'Player 1', 'Player 2', or 'Double Loss'".
    // And "Winner ID (NULL if Double Loss)".
    // But NULL is also "Not Played".
    // We need a way to distinguish.
    // Maybe `is_completed` flag? Or check `score_p1` / `score_p2`?
    // Let's assume for now we use `winner_id` = UUID for winner.
    // For Double Loss, if we set winner_id = NULL, it looks like pending.
    // The DB schema has `score_p1` and `score_p2` (number).
    // Maybe we use those?
    // Win = 1-0 ?
    // Double Loss = 0-0 but marked as played?
    // Let's use `score_p1` and `score_p2` to track 1 for win? Or usually match points.
    // PLAN: update matches set winner_id = [id], score_p1=1, score_p2=0 if P1 wins.
    // If Double Loss: winner_id = null, score_p1=0, score_p2=0? Still looks like pending.
    // We might need a `status` column on matches or imply it.
    // OR we just use `winner_id` and for double loss we might need a special constant or value?
    // But `winner_id` is a foreign key usually? No, just uuid.
    // Let's check schema. `winner_id` is uuid referencing profiles? Actually `winner_id` in `matches` table definition in SQL might be FK.
    // If it is FK, we can't put a dummy value.
    // We should probably rely on `score_p1` and `score_p2` being NOT NULL to indicate completion?
    // CURRENT SCHEMA: `score_p1` (int), `score_p2` (int). Default null?
    // If we update them to 0-0, 1-0, 0-1, 0-0 (double loss), that signals completion?
    // Yes! `score_p1` is nullable in schema `score_p1?: number`.
    // So if it is NOT NULL, the match is played.

    const submitMatchResult = async (p1Score: number, p2Score: number, winnerId: string | null) => {
        if (!reportingMatch) return;

        const { error } = await supabase
            .from('matches')
            .update({
                score_p1: p1Score,
                score_p2: p2Score,
                winner_id: winnerId
            })
            .eq('id', reportingMatch.id);

        if (error) {
            alert("Error reporting result: " + error.message);
        } else {
            fetchMatches();
            setReportingMatch(null);
        }
    };

    if (loading) return <div className="p-8 text-white">Loading Tournament...</div>;
    if (!tournament) return <div className="p-8 text-white">Tournament not found</div>;

    return (
        <div className="min-h-screen bg-background pb-12 relative">
            <AdminNavbar />
            <div className="max-w-6xl mx-auto p-8">
                <Link to={`/admin/leagues/${tournament.league_id}`} className="text-gray-400 hover:text-white flex items-center gap-2 mb-6">
                    <ArrowLeft size={20} /> Back to League
                </Link>

                {/* HEADER */}
                <header className="bg-surface border border-white/5 rounded-xl p-8 mb-8 relative overflow-hidden">
                    <div className="relative z-10">
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <h1 className="text-4xl font-bold text-white mb-2">{tournament.name}</h1>
                                <div className="flex items-center gap-6 text-gray-400">
                                    <span className="flex items-center gap-2"><Calendar size={18} /> {new Date(tournament.date).toLocaleDateString()}</span>
                                    <span className="flex items-center gap-2"><Swords size={18} /> {tournament.format} System</span>
                                </div>
                            </div>
                            <div className={`px-4 py-2 rounded-lg font-bold uppercase tracking-wider text-sm
                                ${tournament.status === 'setup' ? 'bg-yellow-500/20 text-yellow-500' :
                                    tournament.status === 'active' ? 'bg-blue-500/20 text-blue-500' : 'bg-green-500/20 text-green-500'}
                            `}>
                                {getStatusLabel(tournament.status)}
                            </div>
                        </div>
                    </div>
                </header>

                {/* TABS */}
                <div className="flex border-b border-white/10 mb-8 overflow-x-auto">
                    <button
                        onClick={() => setActiveTab('overview')}
                        className={`px-6 py-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'overview' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Overview & Participants
                    </button>
                    <button
                        onClick={() => setActiveTab('pairings')}
                        className={`px-6 py-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'pairings' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'
                            }`}
                    >
                        Pairings & Matches
                    </button>
                    <button
                        onClick={() => setActiveTab('standings')}
                        className={`px-6 py-4 font-medium text-sm transition-colors border-b-2 whitespace-nowrap ${activeTab === 'standings' ? 'border-primary text-primary' : 'border-transparent text-gray-400 hover:text-white'
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
                                            {tournament.status === 'setup' ? (
                                                tournament.format === 'Swiss' ? (
                                                    <select
                                                        value={totalRounds}
                                                        onChange={(e) => setTotalRounds(Number(e.target.value))}
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

                                    {tournament.status === 'setup' && (
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
                                        {tournament.status === 'setup' && (
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
                                                    {tournament.status === 'setup' && (
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
                            {matches.length === 0 ? (
                                <div className="text-center text-gray-500 py-12 border border-dashed border-white/5 rounded-xl">
                                    <Swords size={48} className="mx-auto mb-4 opacity-50" />
                                    <h3 className="text-xl font-bold text-white mb-2">No Matches Yet</h3>
                                    <p>Start the tournament to generate pairings.</p>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {matches
                                        .filter(m => m.round_number === tournament.current_round)
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
                                                {!match.is_bye && match.score_p1 === null && (
                                                    <button
                                                        onClick={() => setReportingMatch(match)}
                                                        className="w-full py-2 bg-white/10 hover:bg-white/20 text-white font-medium rounded-lg text-sm transition-colors mt-2"
                                                    >
                                                        Report Result
                                                    </button>
                                                )}

                                                {/* COMPLETED STATUS */}
                                                {!match.is_bye && match.score_p1 !== null && (
                                                    <div className="text-center text-xs text-green-400 font-bold uppercase tracking-wider mt-2 border-t border-white/5 pt-2">
                                                        Completed
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                </div>
                            )}

                            {/* NEXT ROUND ACTION */}
                            {matches.length > 0 && matches
                                .filter(m => m.round_number === tournament.current_round)
                                .every(m => m.score_p1 !== null || m.is_bye) && (
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
                        <div className="bg-surface border border-white/5 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-black/20 text-gray-400 text-xs uppercase font-bold tracking-wider">
                                        <tr>
                                            <th className="p-4">Rank</th>
                                            <th className="p-4">Player</th>
                                            <th className="p-4 text-center">Points</th>
                                            <th className="p-4 text-center">Real Wins</th>
                                            <th className="p-4 text-center">OMW%</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {standings.length === 0 ? (
                                            <tr>
                                                <td colSpan={5} className="p-8 text-center text-gray-500">
                                                    No standings data available yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            standings.map((p, i) => (
                                                <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                                    <td className="p-4 font-mono text-gray-500">#{i + 1}</td>
                                                    <td className="p-4 font-bold text-white flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                                            {p.user?.first_name?.charAt(0).toUpperCase() || "?"}{p.user?.last_name?.charAt(0).toUpperCase() || "?"}
                                                        </div>
                                                        {p.user?.first_name} {p.user?.last_name}
                                                    </td>
                                                    <td className="p-4 text-center font-mono font-bold text-primary">{p.points}</td>
                                                    <td className="p-4 text-center font-mono text-gray-300">{p.realWins}</td>
                                                    <td className="p-4 text-center font-mono text-gray-500">{(p.omw * 100).toFixed(1)}%</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* ADD PLAYER MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md p-6 relative">
                        <button
                            onClick={() => setIsAddModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <span className="text-2xl">&times;</span>
                        </button>

                        <h3 className="text-xl font-bold text-white mb-4">Add Participant</h3>
                        <p className="text-gray-400 text-sm mb-6">Select a league member to add to this tournament.</p>

                        <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar">
                            {availableMembers.length === 0 ? (
                                <div className="text-center text-gray-500 py-8">
                                    No eligible members found.
                                </div>
                            ) : (
                                availableMembers.map(member => (
                                    <button
                                        key={member.id}
                                        onClick={() => handleAddPlayer(member.id)}
                                        disabled={addingPlayer}
                                        className="w-full flex items-center gap-3 p-3 bg-black/20 hover:bg-primary/20 hover:border-primary/50 border border-transparent rounded-lg transition-all group text-left"
                                    >
                                        <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-xs font-bold text-white group-hover:bg-primary group-hover:text-black">
                                            {member.first_name?.charAt(0).toUpperCase() || "?"}{member.last_name?.charAt(0).toUpperCase() || "?"}
                                        </div>
                                        <span className="text-white group-hover:text-primary transition-colors">{member.first_name} {member.last_name}</span>
                                    </button>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE CONFIRMATION MODAL */}
            {playerToDelete && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md p-6 relative">
                        <h3 className="text-xl font-bold text-white mb-4">Remove Player?</h3>
                        <p className="text-gray-400 text-sm mb-6">
                            Are you sure you want to remove this player from the tournament? This action cannot be undone if the tournament has started (but it hasn't).
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setPlayerToDelete(null)}
                                className="px-4 py-2 text-gray-400 hover:text-white font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRemovePlayer}
                                className="px-4 py-2 bg-red-600 hover:bg-red-500 text-white font-bold rounded-lg transition-colors"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* REPORT MATCH MODAL */}
            {reportingMatch && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md p-6 relative">
                        <button
                            onClick={() => setReportingMatch(null)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <span className="text-2xl">&times;</span>
                        </button>

                        <h3 className="text-xl font-bold text-white mb-4">Report Match Result</h3>
                        <div className="flex justify-between items-center mb-6 px-4 py-3 bg-black/20 rounded-lg">
                            <span className="font-bold text-white">{reportingMatch.player1?.user?.first_name}</span>
                            <span className="text-xs text-gray-500 uppercase">VS</span>
                            <span className="font-bold text-white">{reportingMatch.player2?.user?.first_name}</span>
                        </div>

                        <div className="space-y-3">
                            <button
                                onClick={() => submitMatchResult(1, 0, reportingMatch.player1_id)}
                                className="w-full py-4 bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary text-primary font-bold rounded-lg transition-all"
                            >
                                {reportingMatch.player1?.user?.first_name} Wins
                            </button>
                            <button
                                onClick={() => submitMatchResult(0, 1, reportingMatch.player2_id)}
                                className="w-full py-4 bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary text-primary font-bold rounded-lg transition-all"
                            >
                                {reportingMatch.player2?.user?.first_name} Wins
                            </button>
                            <button
                                onClick={() => submitMatchResult(0, 0, null)} // Double Loss
                                className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500 text-red-500 font-bold rounded-lg transition-all"
                            >
                                Double Loss
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
