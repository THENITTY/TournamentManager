import { Trash2 } from 'lucide-react';

interface DeletePlayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    onConfirm: () => void;
}

export default function DeletePlayerModal({
    isOpen,
    onClose,
    onConfirm
}: DeletePlayerModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-xl w-full max-w-sm p-6 relative text-center">
                <Trash2 size={48} className="mx-auto mb-4 text-red-500 opacity-80" />
                <h3 className="text-xl font-bold text-white mb-2">Remove Player?</h3>
                <p className="text-gray-400 text-sm mb-6">
                    Are you sure you want to remove this player? This might affect pairings if the tournament started.
                </p>
                <div className="flex gap-3">
                    <button
                        onClick={onClose}
                        className="flex-1 py-2 text-gray-400 hover:text-white font-medium hover:bg-white/5 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="flex-1 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-600 transition-colors"
                    >
                        Remove
                    </button>
                </div>
            </div>
        </div>
    );
}
