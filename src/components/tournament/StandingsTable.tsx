import { Trophy } from 'lucide-react';
import type { Database } from '../../types/database.types';
import DeckImage from '../decks/DeckImage';
import { type ParticipantStats } from '../../lib/tournament/pairingUtils';

// Reusing the type from the parent, ideally moved to a shared type file
type ParticipantWithUser = Database['public']['Tables']['tournament_participants']['Row'] & {
    user: { id: string; first_name: string; last_name: string; avatar_url: string | null } | null;
    deck?: {
        id: string;
        archetypes: { name: string; cover_image_url: string } | null
    } | null;
};

interface StandingsTableProps {
    standings: ParticipantStats[];
    participants: ParticipantWithUser[];
    isGlobalSuperAdmin: boolean;
    currentUserRole: string | null;
    currentUserId: string | null;
    onDeckClick: (participantId: string) => void;
}

export default function StandingsTable({
    standings,
    participants,
    isGlobalSuperAdmin,
    currentUserRole,
    currentUserId,
    onDeckClick
}: StandingsTableProps) {
    return (
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
                                                    onClick={() => canEditDeck && pDetails && onDeckClick(pDetails.id)}
                                                >
                                                    {deck.archetypes?.cover_image_url ? (
                                                        <div className="w-12 h-12 rounded-lg overflow-hidden shadow ring-1 ring-white/10 relative">
                                                            <DeckImage archetype={deck.archetypes as any} />
                                                        </div>
                                                    ) : (
                                                        <div className="w-12 h-12 rounded-lg bg-black/40 flex items-center justify-center border border-white/5">
                                                            <Trophy size={16} className="text-gray-600" />
                                                        </div>
                                                    )}
                                                    <div>
                                                        <div className="font-medium text-white">{deck.archetypes?.name || "Unknown Deck"}</div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div
                                                    className={`text-gray-500 text-sm italic ${canEditDeck ? 'cursor-pointer hover:text-white' : ''}`}
                                                    onClick={() => canEditDeck && pDetails && onDeckClick(pDetails.id)}
                                                >
                                                    Tap to assign deck...
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 text-center font-bold text-white">{p.score}</td>
                                        <td className="p-4 text-center text-gray-400">{p.real_wins}</td>
                                        <td className="p-4 text-center text-gray-400">{p.omw.toFixed(1)}%</td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
