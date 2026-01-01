
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { Database } from '../../types/database.types';
import { Check, X, ShieldAlert, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import LeagueManager from '../../components/admin/LeagueManager';
import AdminNavbar from '../../components/admin/AdminNavbar';
import { showSuccess, showError } from '../../lib/toastUtils';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function AdminDashboard() {
    const [profiles, setProfiles] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Fetch all profiles (RLS allows Super Admin to see all)
    const fetchProfiles = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();

        if (!user) {
            navigate('/login');
            return;
        }

        // Verify Super Admin
        const { data: profile } = await (supabase.from('profiles').select('role').eq('id', user.id).single() as any);
        if ((profile as any)?.role !== 'super_admin') {
            navigate('/'); // Redirect unauthorized users
            return;
        }

        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('created_at', { ascending: false });

        if (!error && data) {
            setProfiles(data);
        } else if (error) {
            showError('Failed to load profiles');
        }
        setLoading(false);
    };

    useEffect(() => {
        fetchProfiles();
    }, []);

    const handleApprove = async (id: string) => {
        const { error } = await ((supabase
            .from('profiles') as any)
            .update({ status: 'active' })
            .eq('id', id));

        if (!error) {
            setProfiles(profiles.map(p => p.id === id ? { ...p, status: 'active' } : p));
            showSuccess('User approved successfully');
        } else {
            showError('Failed to approve user');
        }
    };

    const handleReject = async (userId: string, userName: string) => {
        // Confirmation dialog
        if (!window.confirm(`Reject ${userName}? This will permanently delete their account and allow them to re-register.`)) {
            return;
        }

        // Delete profile (cascades to league memberships, tournament participants, etc.)
        // Note: We don't delete the auth user as it requires Service Role Key (backend only).
        // The user can still re-register because the profile is deleted.
        const { error: profileError } = await supabase
            .from('profiles')
            .delete()
            .eq('id', userId);

        if (profileError) {
            showError('Failed to reject user: ' + profileError.message);
            return;
        }

        // Success - profile deleted, user can re-register
        showSuccess('User rejected successfully. They can re-register with the same email.');

        // Update UI
        setProfiles(profiles.filter(p => p.id !== userId));
    };

    if (loading) return <div className="p-8"><Loader2 className="animate-spin" /></div>;

    const pendingUsers = profiles.filter(p => p.status === 'pending');
    const activeUsers = profiles.filter(p => p.status === 'active');

    return (
        <div className="min-h-screen bg-background pb-12">
            <AdminNavbar />
            <div className="max-w-6xl mx-auto p-8 space-y-8">
                <header>
                    <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                        <ShieldAlert className="text-primary" /> Super Admin
                    </h1>
                    <p className="text-gray-400">Manage League Access & Tournaments</p>
                </header>

                <LeagueManager />

                {/* Pending Approvals Section */}
                <section className="bg-surface border border-white/5 rounded-xl p-6">
                    <h2 className="text-xl font-semibold text-white mb-4">Pending Approvals ({pendingUsers.length})</h2>

                    {pendingUsers.length === 0 ? (
                        <p className="text-gray-500 italic">No pending requests.</p>
                    ) : (
                        <div className="space-y-4">
                            {pendingUsers.map(user => (
                                <div key={user.id} className="flex items-center justify-between bg-black/20 p-4 rounded-lg border border-white/5">
                                    <div className="flex items-center gap-4">
                                        <div className="h-10 w-10 bg-primary/20 rounded-full flex items-center justify-center text-primary font-bold">
                                            {(user as any).first_name[0]}{(user as any).last_name[0]}
                                        </div>
                                        <div>
                                            <h3 className="text-white font-medium">{user.first_name} {user.last_name}</h3>
                                            <p className="text-sm text-gray-500">Joined: {new Date(user.created_at).toLocaleDateString()}</p>
                                        </div>
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={() => handleApprove(user.id)}
                                            className="p-2 hover:bg-green-500/20 text-green-500 rounded-lg transition-colors" title="Approve">
                                            <Check />
                                        </button>
                                        <button
                                            onClick={() => handleReject(user.id, `${user.first_name} ${user.last_name}`)}
                                            className="p-2 hover:bg-red-500/20 text-red-500 rounded-lg transition-colors" title="Reject">
                                            <X />
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                {/* Active Users Section */}
                <section className="bg-surface border border-white/5 rounded-xl p-6 opacity-60">
                    <h2 className="text-xl font-semibold text-white mb-4">Active Duelists ({activeUsers.length})</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeUsers.map(user => (
                            <div key={user.id} className="p-3 bg-black/20 rounded border border-white/5 flex justify-between">
                                <span className="text-gray-300">{user.first_name} {user.last_name}</span>
                                <span className="text-xs px-2 py-1 rounded bg-primary/10 text-primary capitalize">{user.role}</span>
                            </div>
                        ))}
                    </div>
                </section>

            </div>
        </div>
    );
}
