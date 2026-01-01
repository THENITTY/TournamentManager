
import { Link, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { LogOut, Shield, Trophy } from 'lucide-react';
import { useEffect, useState } from 'react';

export default function Navbar() {
    const navigate = useNavigate();
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [userName, setUserName] = useState<string | null>(null);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await (supabase.from('profiles') as any).select('first_name, role').eq('id', user.id).single();
                if (data) {
                    const profile = data as { first_name: string; role: string };
                    setIsSuperAdmin(profile.role === 'super_admin');
                    setUserName(profile.first_name);
                }
            }
        };
        checkUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    return (
        <nav className="bg-surface border-b border-white/5 px-6 py-4 flex justify-between items-center bg-black/50 backdrop-blur-md sticky top-0 z-50">
            <Link to="/" className="flex items-center gap-2 text-white font-bold text-xl hover:opacity-80 transition-opacity">
                <Trophy className="text-primary" />
                <span>DuelManager</span>
            </Link>

            <div className="flex items-center gap-6">
                {userName && <span className="text-gray-400 hidden sm:inline">Welcome, {userName}</span>}

                <div className="flex items-center gap-3">
                    {isSuperAdmin && (
                        <Link
                            to="/admin"
                            className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
                        >
                            <Shield size={16} /> <span className="hidden sm:inline">Admin</span>
                        </Link>
                    )}

                    <div className="h-4 w-px bg-white/10 mx-1"></div>

                    <button
                        onClick={handleLogout}
                        className="text-gray-400 hover:text-white flex items-center gap-2 transition-colors"
                        title="Sign Out"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </nav>
    );
}
