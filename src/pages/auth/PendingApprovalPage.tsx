import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LogOut, Clock } from 'lucide-react';

export default function PendingApprovalPage() {
    const navigate = useNavigate();

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md bg-surface p-8 rounded-xl border border-white/5 shadow-xl text-center">
                <div className="h-16 w-16 bg-yellow-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Clock className="h-8 w-8 text-yellow-500" />
                </div>

                <h1 className="text-2xl font-bold text-white mb-2">Approval Pending</h1>
                <p className="text-gray-400 mb-8">
                    Your account is under review by the Super Admin. You will receive access once approved.
                </p>

                <button
                    onClick={handleLogout}
                    className="flex items-center justify-center w-full gap-2 text-gray-400 hover:text-white transition-colors"
                >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                </button>
            </div>
        </div>
    );
}
