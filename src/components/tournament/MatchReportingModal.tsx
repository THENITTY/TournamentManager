import type { MatchWithPlayers } from '../../types/tournament';

interface MatchReportingModalProps {
    isOpen: boolean;
    onClose: () => void;
    match: MatchWithPlayers | null;
    onSubmit: (scoreP1: number, scoreP2: number, winnerId: string | null) => void;
}

export default function MatchReportingModal({
    isOpen,
    onClose,
    match,
    onSubmit
}: MatchReportingModalProps) {
    if (!isOpen || !match) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <span className="text-2xl">&times;</span>
                </button>

                <h3 className="text-xl font-bold text-white mb-4">Report Match Result</h3>
                <div className="flex justify-between items-center mb-6 px-4 py-3 bg-black/20 rounded-lg">
                    <span className="font-bold text-white">{match.player1?.user?.first_name}</span>
                    <span className="text-xs text-gray-500 uppercase">VS</span>
                    <span className="font-bold text-white">{match.player2?.user?.first_name}</span>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={() => onSubmit(1, 0, match.player1_id)}
                        className="w-full py-4 bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary text-primary font-bold rounded-lg transition-all"
                    >
                        {match.player1?.user?.first_name} Wins
                    </button>
                    {match.player2_id && (
                        <button
                            onClick={() => onSubmit(0, 1, match.player2_id)}
                            className="w-full py-4 bg-primary/10 hover:bg-primary/20 border border-primary/20 hover:border-primary text-primary font-bold rounded-lg transition-all"
                        >
                            {match.player2?.user?.first_name} Wins
                        </button>
                    )}
                    <button
                        onClick={() => onSubmit(0, 0, null)} // Double Loss
                        className="w-full py-3 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 hover:border-red-500 text-red-500 font-bold rounded-lg transition-all"
                    >
                        Double Loss
                    </button>
                </div>
            </div>
        </div>
    );
}
