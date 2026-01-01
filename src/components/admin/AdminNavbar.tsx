
import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { LogOut, Shield, Home, LayoutDashboard, User } from 'lucide-react';
import type { Database } from '../../types/database.types';
import ProfileModal from '../dashboard/ProfileModal';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function AdminNavbar() {
    const navigate = useNavigate();
    const location = useLocation();
    const [profile, setProfile] = useState<Profile | null>(null);
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (data) setProfile(data);
            }
        };
        checkUser();
    }, []);

    const handleLogout = async () => {
        await supabase.auth.signOut();
        navigate('/login');
    };

    const handleProfileUpdate = (updates: Partial<Profile>) => {
        if (!profile) return;
        setProfile({ ...profile, ...updates });
    };

    const isActive = (path: string) => location.pathname === path;

    return (
        <>
            <nav className="bg-surface border-b border-white/5 px-4 sm:px-6 py-3 flex justify-between items-center bg-black/50 backdrop-blur-md sticky top-0 z-50">
                <div className="flex items-center gap-3 sm:gap-6 min-w-0">
                    <div className="flex items-center gap-2 text-white font-bold text-base sm:text-lg shrink-0">
                        <Shield className="text-primary" size={18} />
                        <span className="flex items-center gap-1">
                            <span className="hidden xs:inline">DuelManager</span>
                            <span className="text-[10px] font-normal text-gray-400 bg-white/10 px-1 py-0.5 rounded ml-0.5">ADMIN</span>
                        </span>
                    </div>

                    <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                        {profile?.role === 'super_admin' && (
                            <Link
                                to="/admin"
                                className={`px-2 sm:px-3 py-1.5 rounded-lg text-xs sm:text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap ${isActive('/admin') ? 'bg-primary/10 text-primary' : 'text-gray-400 hover:text-white hover:bg-white/5'}`}
                            >
                                <LayoutDashboard size={14} className="sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Dashboard</span>
                            </Link>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-3 sm:gap-4 shrink-0">
                    <Link
                        to="/"
                        className="text-xs sm:text-sm text-gray-400 hover:text-white flex items-center gap-1.5"
                        title="Go to User View"
                    >
                        <Home size={14} className="sm:w-4 sm:h-4" /> <span className="hidden sm:inline">User View</span>
                    </Link>

                    <div className="h-4 w-px bg-white/10"></div>

                    <button
                        onClick={() => setIsProfileModalOpen(true)}
                        className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-white/10 flex items-center justify-center overflow-hidden border border-white/10 hover:border-primary/50 transition-colors"
                        title="Edit Profile"
                    >
                        {profile?.avatar_url ? (
                            <img src={profile.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                            <User className="text-gray-400" size={14} />
                        )}
                    </button>

                    <button
                        onClick={handleLogout}
                        className="text-xs sm:text-sm text-red-500 hover:text-red-400 flex items-center gap-1.5 font-medium"
                    >
                        <LogOut size={14} className="sm:w-4 sm:h-4" /> <span className="hidden xs:inline">Logout</span>
                    </button>
                </div>
            </nav>

            <ProfileModal
                isOpen={isProfileModalOpen}
                onClose={() => setIsProfileModalOpen(false)}
                currentProfile={profile}
                onUpdate={handleProfileUpdate}
            />
        </>
    );
}
