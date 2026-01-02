import { useState, useCallback, useEffect } from 'react';
import { supabase } from '../lib/supabase';

import type { Database } from '../types/database.types';
import type { MatchWithPlayers, ParticipantWithUser, AvailableMember } from '../types/tournament';
import { generateRound1Pairings, calculateStandings, generateNextRoundPairings, type ParticipantStats } from '../lib/tournament/pairingUtils';

type Tournament = Database['public']['Tables']['tournaments']['Row'];
type Archetype = Database['public']['Tables']['archetypes']['Row'];

export function useTournament(tournamentId: string | undefined) {
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [loading, setLoading] = useState(true);

    // Core Data State
    const [matches, setMatches] = useState<MatchWithPlayers[]>([]);
    const [participants, setParticipants] = useState<ParticipantWithUser[]>([]);
    const [standings, setStandings] = useState<ParticipantStats[]>([]);
    const [viewRound, setViewRound] = useState<number>(1);
    const [totalRounds, setTotalRounds] = useState<number>(3);

    // Archetype Data
    const [archetypes, setArchetypes] = useState<Archetype[]>([]);

    // Permissions
    const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
    const [currentUserId, setCurrentUserId] = useState<string | null>(null);
    const [isGlobalSuperAdmin, setIsGlobalSuperAdmin] = useState(false);

    // Fetch Functions
    const fetchMatches = useCallback(async () => {
        if (!tournamentId) return;
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
            .eq('tournament_id', tournamentId)
            .order('created_at', { ascending: true })
            .order('id', { ascending: true });

        if (data) setMatches(data as unknown as MatchWithPlayers[]);
    }, [tournamentId]);

    const fetchArchetypes = useCallback(async (leagueId: string) => {
        const { data } = await supabase
            .from('archetypes')
            .select('*, archetype_compositions(card:cards(id, name, image_url, small_image_url))')
            .eq('league_id', leagueId)
            .order('name', { ascending: true });

        if (data) setArchetypes(data);
    }, []);

    const fetchTournament = useCallback(async () => {
        if (!tournamentId) return;
        const { data } = await supabase
            .from('tournaments')
            .select('*')
            .eq('id', tournamentId)
            .single();

        if (data) {
            const tournamentData = data as Tournament;
            setTournament(tournamentData);
            if (tournamentData.current_round) setViewRound(tournamentData.current_round);
            fetchArchetypes(tournamentData.league_id);
        }
        setLoading(false);
    }, [tournamentId, fetchArchetypes]);

    const fetchParticipants = useCallback(async () => {
        if (!tournamentId) return;
        const { data } = await supabase
            .from('tournament_participants')
            .select(`
                *,
                user:profiles(id, first_name, last_name, avatar_url),
                deck:decks(id, archetypes(name, cover_image_url, is_hybrid, archetype_compositions(card:cards(id, name, image_url, small_image_url))))
            `)
            .eq('tournament_id', tournamentId)
            .order('joined_at', { ascending: true });

        if (data) {
            setParticipants(data as unknown as ParticipantWithUser[]);
        }
    }, [tournamentId]);

    // Initial Load
    useEffect(() => {
        if (tournamentId) {
            // Prevent stale data
            setMatches([]);
            setParticipants([]);
            setStandings([]);
            fetchTournament();
            fetchParticipants();
            fetchMatches();
        }
    }, [tournamentId, fetchTournament, fetchParticipants, fetchMatches]);

    // Permissions Load
    useEffect(() => {
        const fetchPermissions = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setCurrentUserId(user.id);
            }
            if (user && tournament) {
                const { data: profile } = (await (supabase.from('profiles') as any).select('role').eq('id', user.id).single());
                if (profile) setIsGlobalSuperAdmin((profile as any).role === 'super_admin');

                const { data: member } = (await (supabase.from('league_members') as any)
                    .select('role')
                    .eq('league_id', tournament.league_id)
                    .eq('user_id', user.id)
                    .single());
                if (member) {
                    setCurrentUserRole((member as any).role);
                }
            }
        };
        fetchPermissions();
    }, [tournament]);

    // Rounds Calculation
    const calculateRecommendedRounds = (numPlayers: number, format: string = 'Swiss') => {
        if (numPlayers < 2) return 1;
        if (format === 'SingleElimination') return Math.ceil(Math.log2(numPlayers));
        if (numPlayers <= 8) return 3;
        if (numPlayers <= 16) return 4;
        if (numPlayers <= 32) return 5;
        if (numPlayers <= 64) return 6;
        return Math.ceil(Math.log2(numPlayers));
    };

    useEffect(() => {
        if (tournament?.total_rounds) {
            setTotalRounds(tournament.total_rounds);
        } else if (participants.length > 0) {
            const recommended = calculateRecommendedRounds(participants.length, tournament?.format);
            setTotalRounds(recommended);
        }
    }, [tournament, participants.length]);

    // Standings - Load from DB (Stable / On Next Round)
    useEffect(() => {
        if (participants.length > 0) {
            // Map DB participants to ParticipantStats format for display
            // We rely on the persisted 'score', 'rank', 'omw' calculated at the end of the previous round
            const mappedStats: ParticipantStats[] = participants.map(p => ({
                ...p,
                points: p.score ?? 0,
                realWins: p.real_wins ?? 0,
                omw: p.omw ?? 0,
                matchWinPercentage: 0, // Not stored, irrelevant for static display
                opponents: [], // Not stored, irrelevant for static display
                hasBye: false // Not stored
            }));

            // Sort by Rank
            mappedStats.sort((a, b) => (a.rank || 999) - (b.rank || 999));
            setStandings(mappedStats);
        }
    }, [participants]);

    // Actions
    const getAvailableMembers = async (): Promise<AvailableMember[]> => {
        if (!tournament) return [];
        const { data: members } = await supabase
            .from('league_members')
            .select('user_id, profiles!inner(id, first_name, last_name, avatar_url, deleted_at)')
            .eq('league_id', tournament.league_id)
            .is('profiles.deleted_at', null);

        if (members) {
            const participantIds = new Set(participants.map(p => p.user_id));
            const validMembers: AvailableMember[] = [];
            const membersList = members as unknown as { user_id: string, profiles: AvailableMember }[];

            for (const m of membersList) {
                const profile = m.profiles;
                if (profile && !participantIds.has(profile.id)) {
                    validMembers.push({
                        id: profile.id,
                        first_name: profile.first_name,
                        last_name: profile.last_name,
                        avatar_url: profile.avatar_url
                    });
                }
            }
            return validMembers;
        }
        return [];
    };

    const addPlayer = async (userId: string) => {
        if (!tournamentId) return;
        const { error } = await ((supabase.from('tournament_participants') as any)
            .insert({ tournament_id: tournamentId, user_id: userId }));

        if (error) throw error;
        await fetchParticipants();
    };

    const addPlayers = async (userIds: string[]) => {
        if (!tournamentId || userIds.length === 0) return;

        const updates = userIds.map(userId => ({
            tournament_id: tournamentId,
            user_id: userId
        }));

        const { error } = await ((supabase.from('tournament_participants') as any)
            .insert(updates));

        if (error) throw error;
        await fetchParticipants();
    };

    const removePlayer = async (participantId: string) => {
        const { error } = await supabase
            .from('tournament_participants')
            .delete()
            .eq('id', participantId);

        if (error) throw error;
        await fetchParticipants();
    };

    const assignDeck = async (participantId: string, archetypeId: string) => {
        if (!tournament) return;

        const participant = participants.find(p => p.id === participantId);
        if (!participant || !participant.user_id) return;

        let deckId: string | null = null;
        const { data: existingDeck } = await (supabase.from('decks').select('id')
            .eq('user_id', participant.user_id)
            .eq('archetype_id', archetypeId)
            .eq('league_id', tournament.league_id)
            .maybeSingle() as any);

        if (existingDeck) {
            deckId = existingDeck.id;
        } else {
            const selectedArchetype = archetypes.find(a => a.id === archetypeId);
            const { data: newDeck, error: createError } = await (supabase.from('decks').insert({
                user_id: participant.user_id,
                archetype_id: archetypeId,
                league_id: tournament.league_id,
                name: selectedArchetype?.name || 'New Deck',
                format: tournament.format
            } as any).select().single() as any);

            if (createError || !newDeck) throw new Error(createError?.message || "Failed to create deck");
            deckId = newDeck.id;
        }

        // Optimistic update
        const selectedArchetype = archetypes.find(a => a.id === archetypeId);
        setParticipants(prev => prev.map(p => {
            if (p.id === participantId) {
                return {
                    ...p,
                    deck_id: deckId,
                    deck: selectedArchetype ? {
                        id: deckId!,
                        archetypes: { name: selectedArchetype.name, cover_image_url: selectedArchetype.cover_image_url }
                    } : null
                };
            }
            return p;
        }));

        const { error } = await ((supabase.from('tournament_participants') as any)
            .update({ deck_id: deckId } as any)
            .eq('id', participantId));

        if (error) {
            fetchParticipants(); // Revert
            throw error;
        }
        fetchParticipants();
    };

    const startTournament = async () => {
        if (!tournament) return;
        const finalRounds = totalRounds || calculateRecommendedRounds(participants.length, tournament.format);
        const simpleParticipants = participants.map(p => ({ ...p, user_id: p.user_id }));
        const pairings = generateRound1Pairings(tournament.id, simpleParticipants);

        const { error: matchError } = await ((supabase.from('matches') as any).insert(pairings as any));
        if (matchError) throw matchError;

        const { error } = await ((supabase.from('tournaments') as any).update({
            status: 'active',
            current_round: 1,
            total_rounds: finalRounds
        } as any).eq('id', tournament.id));

        if (error) throw error;

        setTournament(prev => prev ? { ...prev, status: 'active', current_round: 1, total_rounds: finalRounds } : null);
        await fetchMatches();
    };

    const nextRound = async () => {
        if (!tournament) return;

        if (!tournament) return;

        const currentStats = calculateStandings(participants, matches as any, tournament.current_round ?? 1);

        const updates = currentStats.map((p, index) => ({
            id: p.id, tournament_id: tournament.id, user_id: p.user_id,
            score: p.points, real_wins: p.realWins, omw: p.omw, rank: index + 1
        }));
        await ((supabase.from('tournament_participants') as any).upsert(updates as any));

        const nextRoundNum = (tournament.current_round ?? 0) + 1;
        const newPairings = generateNextRoundPairings(tournament.id, nextRoundNum, currentStats, matches as any);

        const { error: pairError } = await ((supabase.from('matches') as any).insert(newPairings as any));
        if (pairError) throw pairError;

        const { error: roundError } = await ((supabase.from('tournaments') as any)
            .update({ current_round: nextRoundNum } as any).eq('id', tournament.id));

        if (roundError) throw roundError;

        await Promise.all([
            fetchTournament(),
            fetchMatches(),
            fetchParticipants() // Critical: Fetch new scores/ranks
        ]);

        return nextRoundNum;
    };

    const submitMatch = async (matchId: string, p1Score: number, p2Score: number, winnerId: string | null) => {
        // Optimistic update for immediate UI feedback
        setMatches(prev => prev.map(m =>
            m.id === matchId
                ? { ...m, score_p1: p1Score, score_p2: p2Score, winner_id: winnerId }
                : m
        ));

        const { error } = await ((supabase.from('matches') as any).update({
            score_p1: p1Score, score_p2: p2Score, winner_id: winnerId
        } as any).eq('id', matchId));

        if (error) {
            await fetchMatches(); // Revert on error
            throw error;
        }
        await fetchMatches(); // Sync with server
    };

    const finishTournament = async () => {
        if (!tournament) return;

        const { data: freshMatches } = await supabase.from('matches').select('*').eq('tournament_id', tournament.id);
        const { data: freshParticipants } = await supabase.from('tournament_participants')
            .select('*, user:profiles(id, first_name, last_name, avatar_url)').eq('tournament_id', tournament.id);

        if (!freshMatches || !freshParticipants) throw new Error("Failed to fetch fresh data.");

        const finalStats = calculateStandings(
            freshParticipants as unknown as ParticipantWithUser[],
            freshMatches as any,
            tournament.total_rounds ?? tournament.current_round ?? 1
        );

        const updates = finalStats.map((p, index) => ({
            id: p.id, tournament_id: tournament.id, user_id: p.user_id,
            score: p.points, real_wins: p.realWins, omw: p.omw, rank: index + 1
        }));
        await ((supabase.from('tournament_participants') as any).upsert(updates as any));

        const { error: finishError } = await ((supabase.from('tournaments') as any)
            .update({ status: 'completed' } as any).eq('id', tournament.id));

        if (finishError) throw finishError;

        // Update local state immediately to reflect final standings
        setStandings(finalStats);

        // Refresh all data to ensure consistency
        await Promise.all([
            fetchTournament(),
            fetchParticipants(),
            fetchMatches()
        ]);
    };

    return {
        tournament,
        loading,
        matches,
        participants,
        standings,
        archetypes,
        viewRound,
        totalRounds,
        permissions: { currentUserRole, currentUserId, isGlobalSuperAdmin },
        actions: {
            startTournament,
            nextRound,
            finishTournament,
            submitMatch,
            getAvailableMembers,
            addPlayer,
            addPlayers,
            removePlayer,
            assignDeck,
            setViewRound,
            setTotalRounds,
            refreshTournament: fetchTournament // exposed for corner cases
        }
    };
}
