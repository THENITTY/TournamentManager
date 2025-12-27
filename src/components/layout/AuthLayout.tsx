import { Outlet } from 'react-router-dom';
import { Shield } from 'lucide-react';

export default function AuthLayout() {
    return (
        <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
            <div className="w-full max-w-md space-y-8">
                <div className="flex flex-col items-center">
                    <div className="h-16 w-16 bg-surface rounded-2xl flex items-center justify-center mb-4 border border-secondary/20">
                        <Shield className="h-8 w-8 text-primary" />
                    </div>
                    <h1 className="text-3xl font-bold tracking-tight text-white mb-2">DuelManager</h1>
                    <p className="text-gray-400">Tournament Management System</p>
                </div>

                <div className="bg-surface p-8 rounded-xl border border-white/5 shadow-xl">
                    <Outlet />
                </div>
            </div>
        </div>
    );
}
