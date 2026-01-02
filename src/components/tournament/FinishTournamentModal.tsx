import { Trophy } from 'lucide-react';

interface FinishTournamentModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
    isFinishing: boolean;
}

export default function FinishTournamentModal({
    isOpen,
    onClose,
    onConfirm,
    isFinishing
}: FinishTournamentModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md p-6 relative">
                <button
                    onClick={onClose}
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
                        onClick={onClose}
                        className="flex-1 py-3 text-gray-400 hover:text-white font-medium hover:bg-white/5 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        disabled={isFinishing}
                        className="flex-1 py-3 bg-primary text-black font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
                    >
                        {isFinishing ? "Finalizing..." : "Confirm Finish"}
                    </button>
                </div>
            </div>
        </div>
    );
}
