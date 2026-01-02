import type { Database } from '../../types/database.types';
import DeckImage from '../decks/DeckImage';

// Use the row type from Supabase
type Archetype = Database['public']['Tables']['archetypes']['Row'];

interface DeckSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    archetypes: Archetype[];
    onSelectDeck: (archetypeId: string) => void;
}

export default function DeckSelectionModal({
    isOpen,
    onClose,
    archetypes,
    onSelectDeck
}: DeckSelectionModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-xl w-full max-w-2xl p-6 relative max-h-[80vh] flex flex-col">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-white"
                >
                    <span className="text-2xl">&times;</span>
                </button>

                <h3 className="text-xl font-bold text-white mb-4">Select Deck for Tournament</h3>

                <div className="flex-1 overflow-y-auto grid grid-cols-2 gap-4 p-2">
                    {archetypes.map(arch => (
                        <div
                            key={arch.id}
                            onClick={() => onSelectDeck(arch.id)}
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
    );
}
