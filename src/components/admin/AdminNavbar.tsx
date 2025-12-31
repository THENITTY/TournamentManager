
import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LogOut, Shield, Home, LayoutDashboard } from 'lucide-react';

export default function AdminNavbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);

    useEffect(() => {
        const checkRole = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
                setIsSuperAdmin(data?.role === 'super_admin');
            }
        };
        checkRole();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <nav className="bg-surface border-b border-white/5 px-6 py-3 flex justify-between items-center bg-black/50 backdrop-blur-md sticky top-0 z-50">
            <div className="flex items-center gap-6">
                <div className="flex items-center gap-2 text-white font-bold text-lg">
                    <Shield className="text-primary" />
                    <span>DuelManager <span className="text-xs font-normal text-gray-400 bg-white/10 px-1.5 py-0.5 rounded ml-1">ADMIN</span></span>
                </div>

                <div className="flex items-center gap-1">
                    {isSuperAdmin && (
                        <Link
                            to="/admin"
                            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 ${isActive('/admin') ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                        >
                            <LayoutDashboard size={16} /> Dashboard
                        </Link>
                    )}
                    {/* Add more global links here if needed */}
                </div>
            </div>

            <div className="flex items-center gap-4">
                <Link
                    to="/"
                    className="text-sm text-gray-400 hover:text-white flex items-center gap-2"
                    title="Go to User View"
                >
                    <Home size={16} /> <span className="hidden sm:inline">User View</span>
                </Link>
                <div className="h-4 w-px bg-white/10"></div>
                <button
                    onClick={handleLogout}
                    className="text-sm text-red-500 hover:text-red-400 flex items-center gap-2 font-medium"
                >
                    <LogOut size={16} /> Logout
                </button>
            </div>
        </nav>
    );
}
