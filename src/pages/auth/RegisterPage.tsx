import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { Loader2, Upload } from 'lucide-react';

export default function RegisterPage() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        password: '',
    });

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // 1. Sign Up with Metadata (Trigger will create profile)
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email: formData.email,
            password: formData.password,
            options: {
                data: {
                    first_name: formData.firstName,
                    last_name: formData.lastName,
                }
            }
        });

        if (authError || !authData.user) {
            setError(authError?.message || 'Registration failed');
            setLoading(false);
            return;
        }

        // 2. Redirect to Pending
        navigate('/pending-approval');
    };

    return (
        <div className="space-y-6">
            <div>
                <h2 className="text-xl font-semibold text-white">Create Account</h2>
                <p className="text-sm text-gray-400 mt-1">Join the league as a new Duelist</p>
            </div>

            {error && (
                <div className="bg-error/10 border border-error/20 text-error text-sm p-3 rounded-lg">
                    {error}
                </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">First Name</label>
                        <input
                            type="text"
                            value={formData.firstName}
                            onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                            className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                            placeholder="Seto"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Last Name</label>
                        <input
                            type="text"
                            value={formData.lastName}
                            onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                            className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                            placeholder="Kaiba"
                            required
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Email</label>
                    <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        placeholder="kaiba@corp.com"
                        required
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">Password</label>
                    <input
                        type="password"
                        value={formData.password}
                        onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                        className="w-full bg-background border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-all"
                        placeholder="••••••••"
                        minLength={6}
                        required
                    />
                </div>

                <div className="pt-2">
                    <label className="block text-sm font-medium text-gray-300 mb-2">Profile Photo (Optional)</label>
                    <div className="border-2 border-dashed border-white/10 rounded-lg p-4 flex flex-col items-center justify-center text-gray-500 hover:border-primary/50 hover:bg-white/5 transition-all cursor-not-allowed opacity-60">
                        <Upload className="h-6 w-6 mb-2" />
                        <span className="text-xs">Photo Upload (Coming Phase 2)</span>
                    </div>
                </div>

                <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-primary hover:bg-primary/90 text-background font-semibold py-2 px-4 rounded-lg transition-colors flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : 'Register'}
                </button>
            </form>

            <div className="text-center text-sm text-gray-400">
                Already have an account?{' '}
                <Link to="/login" className="text-primary hover:text-primary/80 font-medium">
                    Sign in
                </Link>
            </div>
        </div>
    );
}
