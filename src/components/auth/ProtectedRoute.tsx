import { Navigate, Outlet } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';
import type { Database } from '../../types/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

export default function ProtectedRoute() {
    const [loading, setLoading] = useState(true);
    const [profile, setProfile] = useState<Profile | null>(null);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();

            if (!user) {
                setProfile(null);
                setLoading(false);
                return;
            }

            const { data: profile } = await supabase
                .from('profiles')
                .select('*')
                .eq('id', user.id)
                .single();

            setProfile(profile);
            setLoading(false);
        };

        checkUser();

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
            if (event === 'SIGNED_OUT') {
                setProfile(null);
            } else if (event === 'SIGNED_IN') {
                checkUser();
            }
        });

        return () => {
            subscription.unsubscribe();
        };
    }, []);

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
        );
    }

    // 1. Not Logged In -> Login
    if (!profile) {
        return <Navigate to="/login" replace />;
    }

    // 2. Pending -> Holding Screen
    // (We'll create a dedicated Holding Screen component, but for now redirecting to a simple placeholder route or inline)
    // Ideally, we redirect to /pending-approval path.
    if (profile.status === 'pending') {
        // If we are already on /pending-approval (handled by router), this check prevents loop?
        // Actually, ProtectedRoute wraps the *App*, so we need to be careful.
        // Better pattern: ProtectedRoute wraps *App routes*. /pending-approval should be outside strict protection?
        // Or we create a specific <PendingGate />.
        return <Navigate to="/pending-approval" replace />;
    }

    // 3. Active -> Show App
    return <Outlet />;
}
