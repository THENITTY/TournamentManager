import { Users, Check } from 'lucide-react';
import type { AvailableMember } from '../../types/tournament';
import { useState } from 'react';

interface AddPlayerModalProps {
    isOpen: boolean;
    onClose: () => void;
    availableMembers: AvailableMember[];
    onAddPlayers: (userIds: string[]) => void;
    isAdding: boolean;
}

export default function AddPlayerModal({
    isOpen,
    onClose,
    availableMembers,
    onAddPlayers,
    isAdding
}: AddPlayerModalProps) {
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    if (!isOpen) return null;

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedIds(newSet);
    };

    const handleConfirm = () => {
        onAddPlayers(Array.from(selectedIds));
        setSelectedIds(new Set()); // Reset selection
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md p-6 relative max-h-[80vh] flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <span className="text-2xl">&times;</span>
                </button>
                <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    <Users className="text-primary" /> Add Players
                </h3>

                <div className="flex-1 overflow-y-auto space-y-2 pr-2 mb-4">
                    {availableMembers.length === 0 ? (
                        <p className="text-gray-500 text-center py-4">No available members found.</p>
                    ) : (
                        availableMembers.map(m => {
                            const isSelected = selectedIds.has(m.id);
                            return (
                                <div
                                    key={m.id}
                                    onClick={() => toggleSelection(m.id)}
                                    className={`flex justify-between items-center p-3 rounded-lg cursor-pointer transition-colors border ${isSelected ? 'bg-primary/10 border-primary/50' : 'bg-black/20 border-transparent hover:bg-black/30'}`}
                                >
                                    <div className="flex items-center gap-3">
                                        <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isSelected ? 'bg-primary border-primary' : 'border-gray-500'}`}>
                                            {isSelected && <Check size={14} className="text-black" />}
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center text-primary text-xs font-bold">
                                                {m.first_name?.[0]}{m.last_name?.[0]}
                                            </div>
                                            <span className={isSelected ? 'text-white font-bold' : 'text-gray-300'}>
                                                {m.first_name} {m.last_name}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                <div className="flex justify-end pt-4 border-t border-white/10">
                    <button
                        onClick={handleConfirm}
                        disabled={isAdding || selectedIds.size === 0}
                        className="px-6 py-2 bg-primary text-background font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                    >
                        {isAdding ? 'Adding...' : `Add ${selectedIds.size} Players`}
                    </button>
                </div>
            </div>
        </div>
    );
}
