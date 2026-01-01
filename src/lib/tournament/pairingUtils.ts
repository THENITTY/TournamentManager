import type { Database } from '../../types/database.types';

type Participant = Database['public']['Tables']['tournament_participants']['Row'] & {
    user?: { first_name: string | null; last_name: string | null } | null;
};
type MatchInsert = Database['public']['Tables']['matches']['Insert'];
type MatchRow = Database['public']['Tables']['matches']['Row'];

export interface ParticipantStats extends Participant {
    points: number;
    realWins: number; // Excluding Byes
    matchWinPercentage: number;
    opponents: string[]; // List of opponent participant_ids
    omw: number;
    hasBye: boolean;
}

/**
 * Generates pairings for Round 1 (Random).
 */
export const generateRound1Pairings = (
    tournamentId: string,
    participants: Participant[]
): MatchInsert[] => {
    // Shuffle participants randomly
    const shuffled = [...participants].sort(() => Math.random() - 0.5);

    const pairings: MatchInsert[] = [];
    const count = shuffled.length;

    let byePlayer: Participant | null = null;
    let playing = shuffled;

    // Handle Bye
    if (count % 2 !== 0) {
        byePlayer = playing[count - 1];
        playing = playing.slice(0, count - 1);
    }

    // Create Matches
    for (let i = 0; i < playing.length; i += 2) {
        pairings.push({
            tournament_id: tournamentId,
            round_number: 1,
            player1_id: playing[i].id,
            player2_id: playing[i + 1].id,
            is_bye: false
        });
    }

    // Assign Bye Match
    if (byePlayer) {
        pairings.push({
            tournament_id: tournamentId,
            round_number: 1,
            player1_id: byePlayer.id,
            player2_id: null,
            winner_id: byePlayer.id,
            is_bye: true,
            score_p1: 2, // 2-0 win representation? Or just points.
            score_p2: 0
        });
    }

    return pairings;
};

/**
 * Calculates Standings based on Match History.
 * Tiebreakers: Score -> Real Wins -> OMW% -> Internal Rating (Random for now).
 */
export const calculateStandings = (
    participants: Participant[],
    matches: MatchRow[],
    totalRoundsSoFar: number
): ParticipantStats[] => {
    // Initialize Stats
    const statsMap = new Map<string, ParticipantStats>();
    participants.forEach(p => {
        statsMap.set(p.id, {
            ...p,
            points: 0,
            realWins: 0,
            matchWinPercentage: 0,
            opponents: [],
            omw: 0,
            hasBye: false
        });
    });

    // 1. Calculate Raw Points and Opponents
    matches.forEach(m => {
        if (m.is_bye && m.player1_id) {
            const p = statsMap.get(m.player1_id);
            if (p) {
                p.points += 3;
                p.hasBye = true;
            }
        } else if (m.player1_id && m.player2_id) {
            const p1 = statsMap.get(m.player1_id);
            const p2 = statsMap.get(m.player2_id);

            if (p1 && p2) {
                // Record Opponents
                p1.opponents.push(p2.id);
                p2.opponents.push(p1.id);

                // Scoring
                if (m.winner_id === p1.id) {
                    p1.points += 3;
                    p1.realWins += 1;
                } else if (m.winner_id === p2.id) {
                    p2.points += 3;
                    p2.realWins += 1;
                }
            }
        }
    });

    // 2. Calculate Match Win % (MW%)
    // MW% = Points / (3 * rounds). Floor at 0.33.
    const rounds = Math.max(1, totalRoundsSoFar);
    statsMap.forEach(p => {
        const rawMW = p.points / (3 * rounds);
        p.matchWinPercentage = Math.max(rawMW, 0.33);
    });

    // 3. Calculate OMW% 
    statsMap.forEach(p => {
        if (p.opponents.length === 0) {
            p.omw = 0.33; // Default
        } else {
            let sumOMW = 0;
            p.opponents.forEach(opId => {
                const op = statsMap.get(opId);
                if (op) {
                    sumOMW += op.matchWinPercentage;
                }
            });
            p.omw = sumOMW / p.opponents.length;
        }
    });

    // 4. Sort
    return Array.from(statsMap.values()).sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.realWins !== a.realWins) return b.realWins - a.realWins;
        if (b.omw !== a.omw) return b.omw - a.omw;
        return a.id.localeCompare(b.id);
    });
};

/**
 * Generates pairings for Round 2+ (Swiss).
 */
export const generateNextRoundPairings = (
    tournamentId: string,
    currentRound: number,
    standings: ParticipantStats[], // Must be sorted!
    matches: MatchRow[]
): MatchInsert[] => {
    // Helper to check if played
    const hasPlayed = (p1Id: string, p2Id: string) => {
        return matches.some(m =>
            (m.player1_id === p1Id && m.player2_id === p2Id) ||
            (m.player1_id === p2Id && m.player2_id === p1Id)
        );
    };

    // Helper to check if had bye
    const hasHadBye = (pId: string) => {
        return matches.some(m => m.player1_id === pId && m.is_bye);
    };

    const pairings: MatchInsert[] = [];
    let players = [...standings]; // Work with copy

    // 1. Handle Bye (if needed)
    if (players.length % 2 !== 0) {
        let byeIndex = -1;
        // Search from bottom up
        for (let i = players.length - 1; i >= 0; i--) {
            if (!hasHadBye(players[i].id)) {
                byeIndex = i;
                break;
            }
        }
        if (byeIndex === -1) byeIndex = players.length - 1;

        const byePlayer = players[byeIndex];
        pairings.push({
            tournament_id: tournamentId,
            round_number: currentRound,
            player1_id: byePlayer.id,
            player2_id: null,
            winner_id: byePlayer.id,
            is_bye: true,
            score_p1: 2,
            score_p2: 0
        });

        players.splice(byeIndex, 1);
    }

    // 2. Pair Remaining Players (Backtracking)
    const solvePairings = (pool: ParticipantStats[]): MatchInsert[] | null => {
        if (pool.length === 0) return [];

        const p1 = pool[0];

        for (let i = 1; i < pool.length; i++) {
            const p2 = pool[i];

            if (!hasPlayed(p1.id, p2.id)) {
                const match: MatchInsert = {
                    tournament_id: tournamentId,
                    round_number: currentRound,
                    player1_id: p1.id,
                    player2_id: p2.id,
                    is_bye: false
                };

                const remaining = [...pool];
                remaining.splice(i, 1);
                remaining.splice(0, 1);

                const restPairings = solvePairings(remaining);
                if (restPairings) {
                    return [match, ...restPairings];
                }
            }
        }
        return null;
    };

    let result = solvePairings(players);

    // Partial Fallback if strict pairing fails (Relax Rematches)
    if (!result) {
        console.warn("Strict pairing failed, relaxing rematch constraint.");
        const relaxedPairings: MatchInsert[] = [];
        for (let i = 0; i < players.length; i += 2) {
            relaxedPairings.push({
                tournament_id: tournamentId,
                round_number: currentRound,
                player1_id: players[i].id,
                player2_id: players[i + 1].id,
                is_bye: false
            });
        }
        result = relaxedPairings;
    }

    return [...pairings, ...result!];
};
