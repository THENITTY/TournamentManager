import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../types/database.types';
import { ArrowLeft, Search, Plus, Save, Trash2, Library } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminNavbar from '../../../components/admin/AdminNavbar';

type Archetype = Database['public']['Tables']['archetypes']['Row'];
type Card = Database['public']['Tables']['cards']['Row'];

export default function ArchetypeLibraryPage() {
    const { leagueId } = useParams();
    const navigate = useNavigate();
    const [archetypes, setArchetypes] = useState<Archetype[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [verifying, setVerifying] = useState(true);

    // Creation State
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Card[]>([]);
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const [customName, setCustomName] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        console.log("DEBUG: ArchetypeLibraryPage mounted. LeagueID:", leagueId);
        if (leagueId) {
            checkPermissions().then(allowed => {
                console.log("DEBUG: Permission checked. Allowed:", allowed);
                if (allowed) fetchArchetypes();
            });
        } else {
            console.error("DEBUG: No leagueId found in params!");
            setVerifying(false);
        }
    }, [leagueId]);

    const checkPermissions = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        console.log("DEBUG: User check:", user?.id);

        if (!user) {
            console.log("DEBUG: No user, diverting");
            navigate('/login');
            return false;
        }

        // Check Global
        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        console.log("DEBUG: Profile role:", profile?.role);

        if (profile?.role === 'super_admin') {
            setVerifying(false);
            return true;
        }

        // Check League
        const { data: member } = await supabase.from('league_members')
            .select('role')
            .eq('league_id', leagueId)
            .eq('user_id', user.id)
            .single();

        console.log("DEBUG: League Member role:", member?.role);

        if (member && (member.role === 'admin' || member.role === 'co_admin')) {
            setVerifying(false);
            return true;
        }

        // Deny
        console.warn("DEBUG: Permission denied");
        alert("You do not have permission to manage decks.");
        navigate(`/admin/leagues/${leagueId}`);
        return false;
    };

    const fetchArchetypes = async () => {
        if (!leagueId) return;
        const { data } = await supabase
            .from('archetypes')
            .select('*')
            .eq('league_id', leagueId)
            .order('name', { ascending: true });
        if (data) setArchetypes(data);
    };

    // Card Search Logic
    useEffect(() => {
        if (!isCreating) return;
        const search = async () => {
            if (searchQuery.length < 3) {
                setSearchResults([]);
                return;
            }
            const { data } = await supabase
                .from('cards')
                .select('*')
                .ilike('name', `%${searchQuery}%`)
                .limit(8);
            if (data) setSearchResults(data);
        };
        const timeout = setTimeout(search, 300);
        return () => clearTimeout(timeout);
    }, [searchQuery, isCreating]);

    if (verifying) return <div className="min-h-screen bg-background p-8 text-white">Verifying Access...</div>;

    const handleSelectCard = (card: Card) => {
        setSelectedCard(card);
        setCustomName(card.name.split(' ')[0]);
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleSave = async () => {
        if (!selectedCard || !customName || !leagueId) return;
        setLoading(true);

        const { error } = await supabase.from('archetypes').insert({
            league_id: leagueId,
            name: customName,
            cover_card_id: selectedCard.id,
            cover_image_url: selectedCard.image_url || ''
        });

        if (!error) {
            fetchArchetypes();
            setIsCreating(false);
            setSelectedCard(null);
            setCustomName('');
            setSearchQuery('');
        } else {
            console.error("Failed to create deck type", error);
            alert("Failed to create deck type");
        }
        setLoading(false);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Delete this deck type?")) return;
        const { error } = await supabase.from('archetypes').delete().eq('id', id);
        if (!error) fetchArchetypes();
    };

    return (
        <div className="min-h-screen bg-background pb-12">
            <AdminNavbar />
            <div className="max-w-4xl mx-auto p-8">
                <Link to={`/admin/leagues/${leagueId}`} className="text-gray-400 hover:text-white flex items-center gap-2 mb-6">
                    <ArrowLeft size={20} /> Back to League
                </Link>

                <header className="flex justify-between items-center mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                            <Library className="text-primary" /> Deck Library
                        </h1>
                        <p className="text-gray-400">Manage registered deck types for this league.</p>
                    </div>
                    {!isCreating && (
                        <button
                            onClick={() => setIsCreating(true)}
                            className="bg-primary text-background px-4 py-2 rounded-lg font-bold flex items-center gap-2 hover:bg-primary/90"
                        >
                            <Plus size={20} /> New Deck
                        </button>
                    )}
                </header>

                {isCreating && (
                    <div className="bg-surface border border-white/5 rounded-xl p-6 mb-8 animate-in fade-in slide-in-from-top-4">
                        <div className="flex flex-col md:flex-row gap-8">
                            {/* Input Side */}
                            <div className="flex-1 space-y-4">
                                <h2 className="text-xl font-bold text-white">New Deck Type</h2>

                                <div className="relative">
                                    <label className="block text-xs text-gray-500 mb-1">Cover Card (Search)</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            placeholder="e.g. Blue-Eyes"
                                            className="w-full bg-black/40 pl-10 pr-4 py-3 rounded-lg border border-white/10 text-white focus:border-primary outline-none"
                                            value={searchQuery}
                                            onChange={e => setSearchQuery(e.target.value)}
                                            autoFocus
                                        />
                                    </div>
                                    {searchResults.length > 0 && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-black/90 border border-white/10 rounded-lg shadow-xl z-50 max-h-60 overflow-y-auto">
                                            {searchResults.map(card => (
                                                <div
                                                    key={card.id}
                                                    className="flex items-center gap-3 p-2 hover:bg-primary/20 cursor-pointer transition-colors"
                                                    onClick={() => handleSelectCard(card)}
                                                >
                                                    <img src={card.small_image_url || ''} alt={card.name} className="w-8 h-12 object-cover rounded" />
                                                    <span className="text-white text-sm">{card.name}</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>

                                <div>
                                    <label className="block text-xs text-gray-500 mb-1">Deck Name</label>
                                    <input
                                        type="text"
                                        className="w-full bg-black/40 px-4 py-3 rounded-lg border border-white/10 text-white focus:border-primary outline-none"
                                        placeholder="e.g. Snake-Eye"
                                        value={customName}
                                        onChange={e => setCustomName(e.target.value)}
                                    />
                                </div>

                                <div className="flex gap-4 pt-4">
                                    <button
                                        onClick={() => setIsCreating(false)}
                                        className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={!selectedCard || !customName || loading}
                                        className="px-6 py-2 bg-primary text-background font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Save size={18} /> Save Deck
                                    </button>
                                </div>
                            </div>

                            {/* Preview Side */}
                            <div className="w-full md:w-1/3 flex flex-col items-center justify-center bg-black/20 rounded-lg border border-white/5 p-4">
                                {selectedCard ? (
                                    <>
                                        <div className="w-24 h-24 rounded-full border-2 border-primary overflow-hidden mb-4 relative shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                                            <img
                                                src={selectedCard.image_url || ''}
                                                alt="Art"
                                                className="w-full h-full object-cover object-[center_20%]"
                                            />
                                        </div>
                                        <div className="text-center">
                                            <p className="text-white font-bold text-lg">{customName}</p>
                                            <p className="text-xs text-gray-500">Preview</p>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-gray-500 italic text-sm">Select a card to preview</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* List View of Decks */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {archetypes.map(arch => (
                        <div key={arch.id} className="group flex items-center gap-4 bg-surface border border-white/5 p-3 rounded-xl hover:border-primary/50 transition-all">
                            <div className="shrink-0 w-16 h-16 rounded-lg overflow-hidden border border-white/10 relative">
                                <img
                                    src={arch.cover_image_url}
                                    alt={arch.name}
                                    className="w-full h-full object-cover object-[center_25%] scale-150"
                                />
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-bold text-lg truncate">{arch.name}</h3>
                                <p className="text-xs text-gray-500">Deck Type</p>
                            </div>

                            <button
                                onClick={(e) => handleDelete(arch.id, e)}
                                className="p-2 text-gray-600 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                            >
                                <Trash2 size={18} />
                            </button>
                        </div>
                    ))}

                    {archetypes.length === 0 && !isCreating && (
                        <div className="col-span-full text-center py-12 text-gray-500">
                            No deck types defined for this league yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
