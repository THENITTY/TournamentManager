import LeagueManager from '../../components/admin/LeagueManager';

// ... (existing imports)

export default function AdminDashboard() {
    // ... (existing code)

    return (
        <div className="min-h-screen bg-background p-8">
            <div className="max-w-4xl mx-auto space-y-8">
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
                                            {user.first_name[0]}{user.last_name[0]}
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
                                            onClick={() => handleReject(user.id)}
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
