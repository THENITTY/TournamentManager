import { X, User } from 'lucide-react';
import type { InteractionWithUser } from '../../types/league';
import { formatDateTime } from '../../lib/dateUtils';

interface ParticipantsModalProps {
    isOpen: boolean;
    onClose: () => void;
    participants: InteractionWithUser[];
}

export default function ParticipantsModal({ isOpen, onClose, participants }: ParticipantsModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-white/10 flex justify-between items-center bg-white/5">
                    <h3 className="font-bold text-white text-lg">Interested Users ({participants.length})</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={20} />
                    </button>
                </div>

                <div className="max-h-[60vh] overflow-y-auto p-2">
                    {participants.length === 0 ? (
                        <div className="p-4 text-center text-gray-500">No participants yet.</div>
                    ) : (
                        <div className="space-y-1">
                            {participants.map((p) => (
                                <div key={p.user_id} className="flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors">
                                    <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center overflow-hidden shrink-0">
                                        {p.user?.avatar_url ? (
                                            <img src={p.user.avatar_url} alt="Avatar" className="w-full h-full object-cover" />
                                        ) : (
                                            <span className="text-lg font-bold text-gray-400">{p.user?.first_name?.[0] || <User size={20} />}</span>
                                        )}
                                    </div>
                                    <div className="min-w-0">
                                        <div className="text-white font-medium truncate">
                                            {p.user ? `${p.user.first_name} ${p.user.last_name}` : 'Unknown User'}
                                        </div>
                                        <div className="text-xs text-gray-500">
                                            {formatDateTime(p.created_at)}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
