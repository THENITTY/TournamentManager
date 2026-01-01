import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { ArrowLeft, Calendar, Users, Trophy, Swords, Trash2, Pencil } from 'lucide-react';
import AdminNavbar from '../../../components/admin/AdminNavbar';
import type { Database } from '../../../types/database.types';
import { showSuccess, showError } from '../../../lib/toastUtils';
import DeckImage from '../../../components/decks/DeckImage';

import { generateRound1Pairings, calculateStandings, generateNextRoundPairings, type ParticipantStats } from '../../../lib/tournament/pairingUtils';

type Tournament = Database['public']['Tables']['tournaments']['Row'];

type MatchWithPlayers = Omit<Database['public']['Tables']['matches']['Row'], 'score_p1' | 'score_p2' | 'winner_id'> & {
    score_p1: number | null;
    score_p2: number | null;
    winner_id: string | null;
    player1: { user: { first_name: string; last_name: string } | null } | null;
    player2: { user: { first_name: string; last_name: string } | null } | null;
};

type ParticipantWithUser = Database['public']['Tables']['tournament_participants']['Row'] & {
    user: { id: string; first_name: string; last_name: string; avatar_url: string | null } | null;
    deck?: {
        id: string;
        archetypes: { name: string; cover_image_url: string } | null
    } | null;
};

interface AvailableMember {
    id: string;
    first_name: string;
    last_name: string;
    avatar_url: string | null;
}

export default function TournamentDashboardPage() {
    const { id } = useParams();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'overview' | 'standings' | 'pairings'>('overview');

    // Core Data State
    const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
    const [participants, setParticipants] = useState<ParticipantWithUser[]>([]);
    const [standings, setStandings] = useState<ParticipantStats[]>([]);
    const [viewRound, setViewRound] = useState<number>(1);

    // Archetype Association State
    const [archetypes, setArchetypes] = useState<Database['public']['Tables']['archetypes']['Row'][]>([]);
    const [isDeckModalOpen, setIsDeckModalOpen] = useState(false);
    const [selectedParticipantIdForDeck, setSelectedParticipantIdForDeck] = useState<string | null>(null);

    // UI State
    const [reportingMatch, setReportingMatch] = useState<MatchWithPlayers | null>(null);
    const [isAddModalOpen, setIsAddModalOpen] = useState(false);
    const [availableMembers, setAvailableMembers] = useState<AvailableMember[]>([]);
    const [addingPlayer, setAddingPlayer] = useState(false);

    // Move fetch definitions up or use hoisting (functions are hoisted, but const arrow functions are not)
    // We need to define them before useEffect or use useCallback.

    const fetchMatches = useCallback(async () => {
        if (!id) return;
        const { data } = await supabase
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

        if (data) setMatches(data as any);
    }, [id]);

    const fetchArchetypes = useCallback(async (leagueId: string) => {
        const { data } = await supabase
            .from('archetypes')
            .select('*, archetype_compositions(card:cards(id, name, image_url, small_image_url))')
            .eq('league_id', leagueId)
            .order('name', { ascending: true });

        if (data) setArchetypes(data);
    }, []);

    const fetchTournament = useCallback(async () => {
        const { data } = await (supabase
            .from('tournaments') as any)
            .select('*')
            .eq('id', id!)
            .single();

        if (data) {
            setTournament(data as any);
            if ((data as any).current_round) setViewRound((data as any).current_round);
            fetchArchetypes((data as any).league_id);
        }
        setLoading(false);
    }, [id, fetchArchetypes]);

    const fetchParticipants = useCallback(async () => {
        const { data } = await supabase
            .from('tournament_participants')
            .select(`
                *,
                user:profiles(id, first_name, last_name, avatar_url),
                deck:decks(id, archetypes(name, cover_image_url, is_hybrid, archetype_compositions(card:cards(id, name, image_url, small_image_url))))
            `)
            .eq('tournament_id', id!)
            .order('joined_at', { ascending: true });

        if (data) setParticipants(data as any);
    }, [id]);

    useEffect(() => {
        if (id) {
            fetchTournament();
            fetchParticipants();
            fetchMatches();
        }
    }, [id, fetchTournament, fetchParticipants, fetchMatches]);

    const fetchAvailableMembers = async () => {
        if (!tournament) return;

        // Fetch all league members
        const { data: members } = await (supabase
            .from('league_members') as any)
            .select('user_id, profiles(id, first_name, last_name, avatar_url)')
            .eq('league_id', (tournament as any).league_id);

        if (members) {
            // Filter out those already in the tournament
            const participantIds = new Set(participants.map(p => p.user_id));
            const available = (members as any[])
                .map(m => m.profiles) // flatten
                .filter(p => p && !participantIds.has(p.id)); // valid profile & not joined

            setAvailableMembers(available as unknown as AvailableMember[]);
        }
    };

    const openAddModal = () => {
        fetchAvailableMembers();
        setIsAddModalOpen(true);
    };

    const handleAddPlayer = async (userId: string) => {
        setAddingPlayer(true);
        const { error } = await ((supabase
            .from('tournament_participants') as any)
            .insert({
                tournament_id: id!,
                user_id: userId
            }));

        if (error) {
            showError(error.message || "Failed to add player");
        } else {
            fetchParticipants();
            setIsAddModalOpen(false);
            setAvailableMembers(prev => (prev as any[]).filter(m => m.id !== userId));
        }
        setAddingPlayer(false);
    };

    // Deck Assignment Logic
    const openDeckSelection = (participantId: string) => {
        setSelectedParticipantIdForDeck(participantId);
        setIsDeckModalOpen(true);
    };

    const handleAssignDeck = async (archetypeId: string) => {
        if (!selectedParticipantIdForDeck || !tournament) return;

        // 1. Get Participant User ID
        const participant = participants.find(p => p.id === selectedParticipantIdForDeck);
        if (!participant || !participant.user_id) return;

        // 2. Find Deck for this User + Archetype
        let deckId: string | null = null;

        const { data: existingDeck } = await (supabase
            .from('decks')
            .select('id')
            .eq('user_id', participant.user_id)
            .eq('archetype_id', archetypeId)
            .eq('league_id', tournament.league_id)
            .maybeSingle() as any);

        if (existingDeck) {
            deckId = existingDeck.id;
        } else {
            // 3. Create New Deck if not exists
            const selectedArchetype = archetypes.find(a => a.id === archetypeId);
            const { data: newDeck, error: createError } = await (supabase
                .from('decks')
                .insert({
                    user_id: participant.user_id,
                    archetype_id: archetypeId,
                    league_id: tournament.league_id,
                    name: selectedArchetype?.name || 'New Deck',
                    format: tournament.format
                } as any)
                .select()
                .single() as any);

            if (createError || !newDeck) {
                showError(createError?.message || "Failed to create deck");
                return;
            }
            deckId = newDeck.id;
        }

        // 4. Assign Deck to Participant
        // Optimistic Update
        setParticipants(prev => prev.map(p => {
            if (p.id === selectedParticipantIdForDeck) {
                const selectedArchetype = archetypes.find(a => a.id === archetypeId);
                return {
                    ...p,
                    deck_id: deckId,
                    deck: selectedArchetype ? {
                        id: deckId!,
                        archetypes: {
                            name: selectedArchetype.name,
                            cover_image_url: selectedArchetype.cover_image_url
                        }
                    } : null
                };
            }
            return p;
        }));

        setIsDeckModalOpen(false);

        const { error } = await ((supabase
            .from('tournament_participants') as any)
            .update({ deck_id: deckId } as any)
            .eq('id', selectedParticipantIdForDeck));

        if (error) {
            showError(error.message || "Failed to assign deck");
            fetchParticipants(); // Revert
        }
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
            const stats = calculateStandings(participants, matches as any, (tournament as any).current_round ?? 1);
            setStandings(stats);
        }
    }, [participants, matches, tournament]);

    // Finish Tournament Modal State
    const [showFinishModal, setShowFinishModal] = useState(false);
    const [finishing, setFinishing] = useState(false);

    // Next Round / Finish Logic
    const handleNextRound = async () => {
        if (!tournament) return;

        // Check for Tournament Completion scenario
        if (tournament.current_round && tournament.total_rounds && tournament.current_round >= tournament.total_rounds) {
            setShowFinishModal(true);
            return;
        }

        // Standard Next Round Logic (Generate Pairings)
        // 1. Calculate stats with current state (for pairings this is distinct from final standings persistence)
        const currentStats = calculateStandings(participants, matches as any, (tournament as any).current_round ?? 1);

        // 2. Update Stats in DB (Incremental update for display)
        const updates = currentStats.map((p, index) => ({
            id: p.id,
            tournament_id: tournament.id,
            user_id: p.user_id,
            score: p.points,
            real_wins: p.realWins,
            omw: p.omw,
            rank: index + 1
        }));
        await ((supabase.from('tournament_participants') as any).upsert(updates as any));

        // 3. Generate Next Round Pairings
        const nextRound = (tournament.current_round ?? 0) + 1;
        const newPairings = generateNextRoundPairings(
            (tournament as any).id,
            nextRound,
            currentStats,
            matches as any
        );

        const { error: pairError } = await ((supabase.from('matches') as any).insert(newPairings as any));
        if (pairError) {
            showError(pairError.message || "Failed to generate pairings");
            return;
        }

        // 4. Update Tournament Round
        const { error: roundError } = await ((supabase.from('tournaments') as any)
            .update({ current_round: nextRound } as any)
            .eq('id', (tournament as any).id));

        if (roundError) {
            showError(roundError.message || "Failed to update round");
        } else {
            fetchTournament();
            showSuccess('Round ' + nextRound + ' started successfully!');
            fetchMatches();
            setActiveTab('pairings');
        }
    };

    // Confirmed Finish Logic
    const finishTournament = async () => {
        if (!tournament) return;
        setFinishing(true);

        try {
            // 1. Fetch FRESH data to guarantee accuracy before finalizing
            const { data: freshMatches } = await supabase
                .from('matches')
                .select('*') // We need raw rows for util
                .eq('tournament_id', tournament.id);

            const { data: freshParticipants } = await supabase
                .from('tournament_participants')
                .select('*, user:profiles(id, first_name, last_name, avatar_url)')
                .eq('tournament_id', tournament.id);

            if (!freshMatches || !freshParticipants) throw new Error("Failed to fetch fresh data.");

            // 2. Calculate Final Standings
            const finalStats = calculateStandings(
                freshParticipants as unknown as ParticipantWithUser[],
                freshMatches as any,
                (tournament as any).total_rounds ?? (tournament as any).current_round ?? 1
            );

            // 3. Persist Standings
            const updates = finalStats.map((p, index) => ({
                id: p.id,
                tournament_id: tournament.id,
                user_id: p.user_id,
                score: p.points,
                real_wins: p.realWins,
                omw: p.omw,
                rank: index + 1
            }));

            const { error: statsError } = await ((supabase.from('tournament_participants') as any).upsert(updates as any));
            if (statsError) throw statsError;

            // 4. Mark Tournament Completed
            const { error: finishError } = await ((supabase.from('tournaments') as any)
                .update({ status: 'completed' } as any)
                .eq('id', (tournament as any).id));

            if (finishError) throw finishError;

            // Success
            setShowFinishModal(false);
            fetchTournament(); // Refresh UI
            setActiveTab('standings'); // Redirect to standings
            // We can show a success toast here if we had one, or just let the UI reflect 'Completed'
        } catch (error) {
            const message = error instanceof Error ? error.message : "Unknown error";
            showError(message || "Error finishing tournament");
        } finally {
            setFinishing(false);
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
        const { error: matchError } = await ((supabase
            .from('matches') as any)
            .insert(pairings as any));

        if (matchError) {
            showError(matchError.message || "Failed to create pairings");
            return;
        }

        // 3. Update Tournament Status
        const { error } = await ((supabase.from('tournaments') as any)
            .update({
                status: 'active',
                current_round: 1,
                total_rounds: finalRounds
            } as any)
            .eq('id', (tournament as any).id));

        if (error) {
            showError(error.message || "Failed to start tournament");
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
            showError(error.message || "Failed to remove player");
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

        const { error } = await ((supabase.from('matches') as any)
            .update({
                score_p1: p1Score,
                score_p2: p2Score,
                winner_id: winnerId
            } as any)
            .eq('id', (reportingMatch as any).id));

        if (error) {
            showError(error.message || "Error reporting result");
        } else {
            fetchMatches();
            setReportingMatch(null);
        }
    };

    // Permissions State
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isGlobalSuperAdmin, setIsGlobalSuperAdmin] = useState(false);

    useEffect(() => {
        const fetchPermissions = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
            }
            if (user && tournament) {
                // Check Global Role
                const { data: profile } = (await (supabase.from('profiles') as any).select('role').eq('id', user.id).single());
                if (profile) setIsGlobalSuperAdmin((profile as any).role === 'super_admin');

                // Check League Role
                const { data: member } = (await (supabase.from('league_members') as any)
                    .select('role')
                    .eq('league_id', (tournament as any).league_id)
                    .eq('user_id', user.id)
                    .single());
                if (member) {
                    setCurrentUserRole((member as any).role);
                }
            }
        };
        fetchPermissions();
    }, [tournament]);

    const canManageTournament = isGlobalSuperAdmin || currentUserRole === 'admin' || currentUserRole === 'co_admin';

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
                                                    onClick={() => setViewRound(r)}
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
                        <div className="bg-surface border border-white/5 rounded-xl overflow-hidden">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left">
                                    <thead className="bg-black/20 text-gray-400 text-xs uppercase font-bold tracking-wider">
                                        <tr>
                                            <th className="p-4">Rank</th>
                                            <th className="p-4">Player</th>
                                            <th className="p-4">Deck</th>
                                            <th className="p-4 text-center">Points</th>
                                            <th className="p-4 text-center">Real Wins</th>
                                            <th className="p-4 text-center">OMW%</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5">
                                        {standings.length === 0 ? (
                                            <tr>
                                                <td colSpan={6} className="p-8 text-center text-gray-500">
                                                    No standings data available yet.
                                                </td>
                                            </tr>
                                        ) : (
                                            standings.map((p, i) => {
                                                const pDetails = participants.find(part => part.user_id === p.user_id);
                                                const deck = pDetails?.deck;
                                                const canEditDeck = isGlobalSuperAdmin || currentUserRole === 'admin' || currentUserRole === 'co_admin' || currentUserId === p.user_id;

                                                return (
                                                    <tr key={p.id} className="hover:bg-white/5 transition-colors">
                                                        <td className="p-4 font-mono text-gray-500">#{i + 1}</td>
                                                        <td className="p-4 font-bold text-white flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-primary text-xs font-bold">
                                                                {p.user?.first_name?.charAt(0).toUpperCase() || "?"}{p.user?.last_name?.charAt(0).toUpperCase() || "?"}
                                                            </div>
                                                            {p.user?.first_name} {p.user?.last_name}
                                                        </td>
                                                        <td className="p-4">
                                                            {deck ? (
                                                                <div
                                                                    className={`flex items-center gap-3 ${canEditDeck ? 'cursor-pointer hover:opacity-80' : ''}`}
                                                                    onClick={() => canEditDeck && pDetails && openDeckSelection(pDetails.id)}
                                                                >
                                                                    {deck.archetypes?.cover_image_url ? (
                                                                        <div className="w-12 h-12 rounded-lg overflow-hidden shadow ring-1 ring-white/10 relative">
                                                                            <DeckImage archetype={deck.archetypes as any} />
                                                                        </div>
                                                                    ) : (
                                                                        <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center text-xs text-gray-500 border border-white/10">?</div>
                                                                    )}
                                                                    <div>
                                                                        <div className="text-sm font-bold text-white max-w-[150px] truncate">{deck.archetypes?.name || 'Unknown'}</div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                canEditDeck && pDetails ? (
                                                                    <button
                                                                        onClick={() => openDeckSelection(pDetails.id)}
                                                                        className="w-10 h-14 border border-dashed border-white/20 rounded flex items-center justify-center text-gray-400 hover:text-white hover:border-white/50 transition-colors"
                                                                        title="Add Deck"
                                                                    >
                                                                        +
                                                                    </button>
                                                                ) : (
                                                                    <span className="text-gray-600 text-sm">-</span>
                                                                )
                                                            )}
                                                        </td>
                                                        <td className="p-4 text-center font-mono font-bold text-primary">{p.points}</td>
                                                        <td className="p-4 text-center font-mono text-gray-300">{p.realWins}</td>
                                                        <td className="p-4 text-center font-mono text-gray-500">{(p.omw * 100).toFixed(1)}%</td>
                                                    </tr>
                                                )
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* FINISH TOURNAMENT CONFIRMATION MODAL */}
            {showFinishModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md p-6 relative">
                        <button
                            onClick={() => setShowFinishModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <span className="text-2xl">&times;</span>
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                                <Trophy size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Finish Tournament?</h3>
                            <p className="text-gray-400 text-sm">
                                All rounds have been played. This will finalize the standings and archive the tournament.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowFinishModal(false)}
                                className="flex-1 py-3 text-gray-400 hover:text-white font-medium hover:bg-white/5 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={finishTournament}
                                disabled={finishing}
                                className="flex-1 py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                            >
                                {finishing ? "Finalizing..." : "Confirm Finish"}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ADD PLAYER MODAL */}
            {isAddModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md p-6 relative flex flex-col max-h-[80vh]">
                        <button
                            onClick={() => setIsAddModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <span className="text-2xl">&times;</span>
                        </button>
                        <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                            <Users className="text-primary" /> Add Player
                        </h3>

                        <div className="flex-1 overflow-y-auto space-y-2 pr-2">
                            {availableMembers.length === 0 ? (
                                <p className="text-gray-500 text-center py-4">No available members found.</p>
                            ) : (
                                availableMembers.map(m => (
                                    <div key={m.id} className="flex justify-between items-center p-3 bg-black/20 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-primary text-xs font-bold">
                                                {m.first_name?.[0]}{m.last_name?.[0]}
                                            </div>
                                            <span className="text-white font-medium">{m.first_name} {m.last_name}</span>
                                        </div>
                                        <button
                                            onClick={() => handleAddPlayer(m.id)}
                                            disabled={addingPlayer}
                                            className="px-3 py-1 bg-primary/20 text-primary hover:bg-primary/30 rounded text-sm transition-colors"
                                        >
                                            Add
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* DELETE PLAYER MODAL */}
            {playerToDelete && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-xl w-full max-w-sm p-6 relative text-center">
                        <Trash2 size={48} className="mx-auto mb-4 text-red-500 opacity-80" />
                        <h3 className="text-xl font-bold text-white mb-2">Remove Player?</h3>
                        <p className="text-gray-400 text-sm mb-6">
                            Are you sure you want to remove this player? This might affect pairings if the tournament started.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setPlayerToDelete(null)}
                                className="flex-1 py-2 text-gray-400 hover:text-white font-medium hover:bg-white/5 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmRemovePlayer}
                                className="flex-1 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors"
                            >
                                Remove
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* DECK SELECTION MODAL */}
            {isDeckModalOpen && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-xl w-full max-w-2xl p-6 relative max-h-[80vh] flex flex-col">
                        <button
                            onClick={() => setIsDeckModalOpen(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <span className="text-2xl">&times;</span>
                        </button>

                        <h3 className="text-xl font-bold text-white mb-4">Select Deck for Tournament</h3>

                        <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 p-2">
                            {archetypes.map(arch => (
                                <div
                                    key={arch.id}
                                    onClick={() => handleAssignDeck(arch.id)}
                                    className="bg-black/30 border border-white/5 rounded-lg p-3 cursor-pointer hover:border-primary transition-all flex items-center gap-3"
                                >
                                    {arch.cover_image_url ? (
                                        <div className="w-16 h-16 rounded-xl overflow-hidden shadow relative border border-white/10 shrink-0">
                                            <DeckImage archetype={arch} />
                                        </div>
                                    ) : (
                                        <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center shrink-0">?</div>
                                    )}
                                    <div>
                                        <div className="font-bold text-white text-sm">{arch.name}</div>
                                    </div>
                                </div>
                            ))}
                            {archetypes.length === 0 && (
                                <div className="col-span-2 text-center text-gray-500 py-8">
                                    No deck types available in this league.
                                </div>
                            )}
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
            {/* FINISH TOURNAMENT CONFIRMATION MODAL */}
            {showFinishModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md p-6 relative">
                        <button
                            onClick={() => setShowFinishModal(false)}
                            className="absolute top-4 right-4 text-gray-400 hover:text-white"
                        >
                            <span className="text-2xl">&times;</span>
                        </button>

                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-primary/20 rounded-full flex items-center justify-center mx-auto mb-4 text-primary">
                                <Trophy size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Finish Tournament?</h3>
                            <p className="text-gray-400 text-sm">
                                All rounds have been played. This will finalize the standings and archive the tournament.
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowFinishModal(false)}
                                className="flex-1 py-3 text-gray-400 hover:text-white font-medium hover:bg-white/5 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={finishTournament}
                                disabled={finishing}
                                className="flex-1 py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                            >
                                {finishing ? "Finalizing..." : "Confirm Finish"}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
