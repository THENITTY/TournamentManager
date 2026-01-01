import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2 } from 'lucide-react';

export default function LoginPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password,
        });

        if (error) {
            setError(error.message);
            setLoading(false);
            return;
        }

        // Check if user is soft-deleted
        const { data: profile } = await ((supabase
            .from('profiles') as any)
            .select('deleted_at')
            .eq('id', data.user.id)
            .single() as any);

        if (profile?.deleted_at) {
            await supabase.auth.signOut();
            setError('Your account has been deactivated. Please contact support or re-register.');
            setLoading(false);
            return;
        }

        navigate('/');
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-white">Welcome back</h2>
                <p className="text-sm text-gray-400 mt-1">Sign in to your account to continue</p>
            </div>

            {error && (
                <div className="bg-error/10 border border-error/20 text-error text-sm p-3 rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        placeholder="duelist@example.com"
                        required
                    />
                </div>

                <div>
                    <div className="flex items-center justify-between mb-1">
                        <label className="block text-sm font-medium text-gray-300">Password</label>
                        <a href="#" className="text-xs text-primary hover:text-primary/80">Forgot password?</a>
                    </div>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        placeholder="••••••••"
                        required
                    />
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-background font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Sign In'}
                </button>
            </form>

            <div className="text-center text-sm text-gray-400">
                Don't have an account?{' '}
                <Link to="/register" className="text-primary hover:text-primary/80 font-medium">
                    Sign up
                </Link>
            </div>
        </div>
    );
}
