import { useState, useRef, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { X, Camera, Eye, EyeOff, Save, Loader2, Upload } from 'lucide-react';
import type { Database } from '../../types/database.types';
import { showSuccess, showError } from '../../lib/toastUtils';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentProfile: Profile | null;
    onUpdate: (updatedProfile: Partial<Profile>) => void;
}

export default function ProfileModal({ isOpen, onClose, currentProfile, onUpdate }: ProfileModalProps) {
    const [firstName, setFirstName] = useState('');
    const [lastName, setLastName] = useState('');
    const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
    const [avatarFile, setAvatarFile] = useState<File | null>(null);

    // Password State
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (isOpen && currentProfile) {
            setFirstName(currentProfile.first_name || '');
            setLastName(currentProfile.last_name || '');
            setAvatarUrl(currentProfile.avatar_url);
            setPassword('');
            setConfirmPassword('');
            setAvatarFile(null);
            setError(null);
        }
    }, [isOpen, currentProfile]);

    if (!isOpen || !currentProfile) return null;

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const file = e.target.files[0];
            setAvatarFile(file);
            setAvatarUrl(URL.createObjectURL(file));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            // 1. Password Validation
            if (password) {
                if (password.length < 6) throw new Error("Password must be at least 6 characters");
                if (password !== confirmPassword) throw new Error("Passwords do not match");
            }

            let newAvatarUrl = currentProfile.avatar_url;

            // 2. Avatar Upload
            if (avatarFile) {
                const fileExt = avatarFile.name.split('.').pop();
                const fileName = `${currentProfile.id}/${Date.now()}.${fileExt}`;

                // Upload to Supabase Storage 'avatars' bucket
                const { error: uploadError } = await supabase.storage
                    .from('avatars')
                    .upload(fileName, avatarFile, { upsert: true });

                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage
                    .from('avatars')
                    .getPublicUrl(fileName);

                newAvatarUrl = publicUrl;
            }

            // 3. Update Profile Data
            const updates: any = {
                first_name: firstName,
                last_name: lastName,
                avatar_url: newAvatarUrl,
            };

            const { error: profileError } = await (supabase
                .from('profiles') as any)
                .update(updates)
                .eq('id', currentProfile.id);

            if (profileError) throw profileError;

            // 4. Update Password (if provided)
            if (password) {
                const { error: authError } = await supabase.auth.updateUser({ password: password });
                if (authError) throw authError;
            }

            // Success
            onUpdate(updates);
            showSuccess('Profile updated successfully!');
            onClose();

        } catch (err: any) {
            const errorMsg = err.message || "Failed to update profile";
            setError(errorMsg);
            showError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-surface border border-white/10 rounded-xl w-full max-w-md shadow-2xl flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5 rounded-t-xl">
                    <h2 className="text-xl font-bold text-white">Edit Profile</h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                        <X size={24} />
                    </button>
                </div>

                <form onSubmit={handleSave} className="p-6 overflow-y-auto space-y-6">
                    {/* AVATAR UPLOAD */}
                    <div className="flex flex-col items-center gap-4">
                        <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                            <div className="w-24 h-24 rounded-full overflow-hidden border-2 border-primary/50 group-hover:border-primary transition-colors bg-black/20 flex items-center justify-center">
                                {avatarUrl ? (
                                    <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                                ) : (
                                    <span className="text-2xl font-bold text-gray-500">
                                        {firstName?.[0]}{lastName?.[0]}
                                    </span>
                                )}
                                <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Camera className="text-white" size={24} />
                                </div>
                            </div>
                            <div className="absolute bottom-0 right-0 p-1.5 bg-primary rounded-full border-2 border-surface text-white shadow-lg">
                                <Upload size={12} />
                            </div>
                        </div>
                        <p className="text-xs text-gray-400">Click to change avatar</p>
                        <input
                            type="file"
                            ref={fileInputRef}
                            onChange={handleFileChange}
                            accept="image/*"
                            className="hidden"
                        />
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-500 text-sm rounded-lg text-center">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">First Name</label>
                            <input
                                type="text"
                                value={firstName}
                                onChange={e => setFirstName(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary outline-none"
                                placeholder="First Name"
                                required
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-xs font-bold text-gray-400 uppercase">Last Name</label>
                            <input
                                type="text"
                                value={lastName}
                                onChange={e => setLastName(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-white focus:border-primary outline-none"
                                placeholder="Last Name"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t border-white/10">
                        <h3 className="text-sm font-semibold text-white">Change Password</h3>
                        <p className="text-xs text-gray-500">Leave blank to keep current password</p>

                        <div className="relative">
                            <input
                                type={showPassword ? "text" : "password"}
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                className="w-full bg-black/20 border border-white/10 rounded-lg pl-3 pr-10 py-2 text-white focus:border-primary outline-none placeholder:text-gray-600"
                                placeholder="New Password"
                                minLength={6}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                            >
                                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                            </button>
                        </div>

                        {password && (
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={e => setConfirmPassword(e.target.value)}
                                className={`w-full bg-black/20 border rounded-lg px-3 py-2 text-white outline-none transition-colors
                                    ${confirmPassword && password !== confirmPassword ? 'border-red-500/50 focus:border-red-500' : 'border-white/10 focus:border-primary'}
                                `}
                                placeholder="Confirm New Password"
                            />
                        )}
                    </div>

                </form>

                <div className="p-6 border-t border-white/5 bg-black/20 rounded-b-xl flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        className="px-4 py-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-primary text-background font-bold rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={loading}
                    >
                        {loading ? <Loader2 size={18} className="animate-spin" /> : <Save size={18} />}
                        Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
}
