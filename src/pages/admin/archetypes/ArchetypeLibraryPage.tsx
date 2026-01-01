import { useEffect, useState } from 'react';
import { supabase } from '../../../lib/supabase';
import type { Database } from '../../../types/database.types';
import { ArrowLeft, Search, Plus, Save, Trash2, Library, Edit, Layers, X } from 'lucide-react';
import { useNavigate, useParams, Link } from 'react-router-dom';
import AdminNavbar from '../../../components/admin/AdminNavbar';

type Archetype = Database['public']['Tables']['archetypes']['Row'] & {
    archetype_compositions?: {
        card: {
            id: string;
            name: string;
            image_url: string;
            small_image_url: string;
        };
    }[];
};
type Card = Database['public']['Tables']['cards']['Row'];

export default function ArchetypeLibraryPage() {
    const { leagueId } = useParams();
    const navigate = useNavigate();
    const [archetypes, setArchetypes] = useState<Archetype[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [editingArchetype, setEditingArchetype] = useState<Archetype | null>(null);

    const [verifying, setVerifying] = useState(true);

    // Creation State
    const [isHybrid, setIsHybrid] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchResults, setSearchResults] = useState<Card[]>([]);
    const [selectedCard, setSelectedCard] = useState<Card | null>(null);
    const [customName, setCustomName] = useState('');
    const [loading, setLoading] = useState(false);

    // Hybrid State
    const [hybridComponents, setHybridComponents] = useState<Card[]>([]);

    useEffect(() => {
        if (leagueId) {
            checkPermissions(leagueId).then(allowed => {
                if (allowed) fetchArchetypes();
            });
        } else {
            setVerifying(false);
        }
    }, [leagueId]);

    const checkPermissions = async (lid: string) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            navigate('/login');
            return false;
        }

        const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
        if ((profile as any)?.role === 'super_admin') {
            setVerifying(false);
            return true;
        }

        const { data: member } = await supabase.from('league_members')
            .select('role')
            .eq('league_id', lid)
            .eq('user_id', user.id)
            .maybeSingle();

        if (member && ((member as any).role === 'admin' || (member as any).role === 'co_admin')) {
            setVerifying(false);
            return true;
        }

        alert("You do not have permission to manage decks.");
        navigate(`/admin/leagues/${lid}`);
        return false;
    };

    const fetchArchetypes = async () => {
        if (!leagueId) return;
        const { data } = await supabase
            .from('archetypes')
            .select('*, archetype_compositions(card:cards(id, name, image_url, small_image_url))')
            .eq('league_id', leagueId)
            .order('name', { ascending: true });
        if (data) setArchetypes(data as Archetype[]);
    };

    // Card Search Logic
    // Card Search Logic
    useEffect(() => {
        if (!isCreating) return; // Search is needed for both Hybrid and Standard
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
        if (isHybrid) {
            if (hybridComponents.some(c => c.id === card.id)) return;
            setHybridComponents([...hybridComponents, card]);
        } else {
            setSelectedCard(card);
        }
        setSearchQuery('');
        setSearchResults([]);
    };

    const handleRemoveComponent = (id: string) => {
        setHybridComponents(hybridComponents.filter(c => c.id !== id));
    };

    const handleEdit = (arch: Archetype) => {
        setEditingArchetype(arch);
        setCustomName(arch.name);
        setIsCreating(true);
        setIsHybrid(!!arch.is_hybrid);
        setSelectedCard(null);

        if (arch.is_hybrid && arch.archetype_compositions) {
            // Reconstruct components locally from loaded data
            const comps = arch.archetype_compositions.map(ac => ac.card as unknown as Card); // simplified cast
            setHybridComponents(comps);
        } else {
            setHybridComponents([]);
        }
    };

    const handleSave = async () => {
        if (!customName || !leagueId) return;
        if (!isHybrid && !selectedCard && !editingArchetype) return;
        if (isHybrid && hybridComponents.length < 2) {
            alert("A Hybrid Deck must have at least 2 components.");
            return;
        }

        setLoading(true);

        // Prepare Base Data
        const baseData: any = {
            name: customName,
            is_hybrid: isHybrid,
            league_id: leagueId,
        };

        if (!isHybrid) {
            if (selectedCard) {
                baseData.cover_card_id = selectedCard.id;
                baseData.cover_image_url = selectedCard.image_url;
            } else if (editingArchetype) {
                // Keep old image
                baseData.cover_image_url = editingArchetype.cover_image_url;
            }
        } else {
            // For Hybrid, we use the first component's image as "primary" cover for compatibility
            baseData.cover_image_url = hybridComponents[0]?.image_url || '';
            baseData.cover_card_id = null; // No single card
        }

        let savedId = editingArchetype?.id;

        if (editingArchetype) {
            // UPDATE
            const { error } = await (supabase.from('archetypes') as any)
                .update(baseData)
                .eq('id', editingArchetype.id);

            if (error) {
                console.error("Update failed", error);
                alert(`Update failed: ${error.message}`);
                setLoading(false);
                return;
            }
        } else {
            // CREATE
            const { data, error } = await supabase.from('archetypes').insert(baseData).select().single();

            // Cast data safely if needed
            const newDeck = data as unknown as Archetype;

            if (error) {
                console.error("Create failed", error);
                alert(`Create failed: ${error.message}`);
                setLoading(false);
                return;
            }
            savedId = newDeck.id;
        }

        // Handle Compositions if Hybrid
        if (isHybrid && savedId) {
            // Delete old compositions
            await supabase.from('archetype_compositions').delete().eq('hybrid_archetype_id', savedId);

            // Insert new
            const compositionRows = hybridComponents.map(comp => ({
                hybrid_archetype_id: savedId,
                card_id: comp.id
            }));

            // Explicitly cast to 'any' to bypass TS 'never' inference issue if table def is acting up
            const { error: compError } = await supabase.from('archetype_compositions').insert(compositionRows as any);
            if (compError) {
                console.error("Composition update failed", compError);
            }
        }

        fetchArchetypes();
        closeModal();
        setLoading(false);
    };

    const closeModal = () => {
        setIsCreating(false);
        setEditingArchetype(null);
        setSelectedCard(null);
        setCustomName('');
        setSearchQuery('');
        setIsHybrid(false);
        setHybridComponents([]);
    };

    const handleDelete = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation();
        if (!window.confirm("Delete this deck type?")) return;
        const { error } = await supabase.from('archetypes').delete().eq('id', id);
        if (!error) fetchArchetypes();
    };

    // --- Render Logic for Split Images ---
    const renderSplitView = (images: string[]) => {
        if (images.length === 0) return <div className="w-full h-full bg-gray-800" />;

        // 2 Components: Vertical Diagonal Split
        if (images.length === 2) {
            return (
                <div className="w-full h-full relative">
                    <img
                        src={images[0]}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ clipPath: 'polygon(0 0, 65% 0, 35% 100%, 0 100%)', zIndex: 1 }}
                    />
                    <div className="absolute inset-0 bg-black/50" style={{ clipPath: 'polygon(64% 0, 66% 0, 36% 100%, 34% 100%)', zIndex: 2 }} /> {/* Divider Line */}
                    <img
                        src={images[1]}
                        className="absolute inset-0 w-full h-full object-cover"
                        style={{ clipPath: 'polygon(65% 0, 100% 0, 100% 100%, 35% 100%)', zIndex: 1 }}
                    />
                </div>
            );
        }

        // 3+ Components: Fan Split
        return (
            <div className="w-full h-full relative">
                {/* Primary Left */}
                <img
                    src={images[0]}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ clipPath: 'polygon(0 0, 70% 0, 30% 100%, 0 100%)', zIndex: 2 }}
                />

                {/* Top Right */}
                <img
                    src={images[1] || images[0]}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ clipPath: 'polygon(70% 0, 100% 0, 100% 50%, 50% 50%)', zIndex: 1 }}
                />

                {/* Bottom Right */}
                <img
                    src={images[2] || images[0]}
                    className="absolute inset-0 w-full h-full object-cover"
                    style={{ clipPath: 'polygon(50% 50%, 100% 50%, 100% 100%, 30% 100%)', zIndex: 1 }}
                />

                {/* Dividers */}
                <div className="absolute inset-0 bg-black/50" style={{ clipPath: 'polygon(69% 0, 71% 0, 51% 50%, 49% 50%)', zIndex: 3 }} />
                <div className="absolute inset-0 bg-black/50" style={{ clipPath: 'polygon(49% 50%, 51% 50%, 31% 100%, 29% 100%)', zIndex: 3 }} />
                <div className="absolute inset-0 bg-black/50" style={{ clipPath: 'polygon(50% 49%, 100% 49%, 100% 51%, 50% 51%)', zIndex: 3 }} />
            </div>
        );
    };

    const renderDeckImage = (arch: Archetype) => {
        if (!arch.is_hybrid) {
            return (
                <img
                    src={arch.cover_image_url}
                    alt={arch.name}
                    className="w-full h-full object-cover object-[center_20%] scale-150"
                />
            );
        }

        // It is a hybrid: get component cards
        const comps = arch.archetype_compositions?.map(ac => ac.card) || [];
        // Flatten to images
        const images = comps.map(c => c.image_url).filter(Boolean);

        return renderSplitView(images);
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
                                <div className="flex justify-between items-center">
                                    <h2 className="text-xl font-bold text-white">{editingArchetype ? 'Edit Deck Type' : 'New Deck Type'}</h2>
                                    <button
                                        onClick={() => {
                                            if (editingArchetype && !isHybrid) {
                                                if (!confirm("Converting to hybrid will clear the current cover card. Continue?")) return;
                                            }
                                            setIsHybrid(!isHybrid);
                                            setHybridComponents([]);
                                            setCustomName('');
                                        }}
                                        className={`px-3 py-1 rounded-full text-xs font-bold border flex items-center gap-2 transition-colors ${isHybrid ? 'bg-indigo-500 border-indigo-500 text-white' : 'bg-transparent border-gray-600 text-gray-400'}`}
                                    >
                                        <Layers size={12} /> Hybrid Deck
                                    </button>
                                </div>

                                {!isHybrid ? (
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
                                ) : (
                                    <div className="relative">
                                        <label className="block text-xs text-gray-500 mb-1">Add Components (Search Cards)</label>

                                        {/* Selected Components Tags */}
                                        <div className="flex flex-wrap gap-2 mb-2">
                                            {hybridComponents.map(comp => (
                                                <div key={comp.id} className="bg-indigo-500/20 border border-indigo-500/50 text-indigo-300 px-2 py-1 rounded flex items-center gap-2 text-sm">
                                                    {comp.name}
                                                    <button onClick={() => handleRemoveComponent(comp.id)} className="hover:text-white"><X size={14} /></button>
                                                </div>
                                            ))}
                                        </div>

                                        {/* Card Selector for Hybrid */}
                                        <div className="relative">
                                            <Search className="absolute left-3 top-3 text-gray-400" size={18} />
                                            <input
                                                type="text"
                                                placeholder="Search cards to add..."
                                                className="w-full bg-black/40 pl-10 pr-4 py-3 rounded-lg border border-white/10 text-white focus:border-primary outline-none"
                                                value={searchQuery}
                                                onChange={e => setSearchQuery(e.target.value)}
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
                                )}

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
                                        onClick={closeModal}
                                        className="px-6 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleSave}
                                        disabled={(!selectedCard && !editingArchetype && !isHybrid) || !customName || loading}
                                        className="px-6 py-2 bg-primary text-background font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 flex items-center gap-2"
                                    >
                                        <Save size={18} /> {editingArchetype ? 'Update Deck' : 'Save Deck'}
                                    </button>
                                </div>
                            </div>

                            {/* Preview Side */}
                            <div className="w-full md:w-1/3 flex flex-col items-center justify-center bg-black/20 rounded-lg border border-white/5 p-4">
                                {((isHybrid && hybridComponents.length > 0) || (!isHybrid && (selectedCard || editingArchetype?.cover_image_url))) ? (
                                    <>
                                        <div className="w-24 h-24 rounded-full border-2 border-primary overflow-hidden mb-4 relative shadow-[0_0_15px_rgba(234,179,8,0.3)]">
                                            {isHybrid ? (
                                                <div className="w-full h-full relative">
                                                    {hybridComponents.length > 0 ? (
                                                        renderSplitView(hybridComponents.map(c => c.image_url))
                                                    ) : (
                                                        <div className="w-full h-full bg-gray-700 animate-pulse" />
                                                    )}
                                                </div>
                                            ) : (
                                                <img
                                                    src={selectedCard?.image_url || editingArchetype?.cover_image_url || ''}
                                                    alt="Art"
                                                    className="w-full h-full object-cover object-[center_20%]"
                                                />
                                            )}
                                        </div>
                                        <div className="text-center">
                                            <p className="text-white font-bold text-lg">{customName}</p>
                                            <p className="text-xs text-gray-500">Preview</p>
                                        </div>
                                    </>
                                ) : (
                                    <p className="text-gray-500 italic text-sm">Select content to preview</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* List View of Decks */}
                <div className="flex flex-col gap-3">
                    {archetypes.map(arch => (
                        <div key={arch.id} className="group flex items-center gap-4 bg-surface border border-white/5 p-4 rounded-xl hover:border-primary/50 transition-all">
                            <div className="shrink-0 w-12 h-12 rounded-lg overflow-hidden border border-white/10 relative">
                                {renderDeckImage(arch)}
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-bold text-lg flex items-center gap-2">
                                    {arch.name}
                                </h3>
                                <p className="text-xs text-gray-500">{arch.is_hybrid ? 'Hybrid' : 'Pure'}</p>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleEdit(arch)}
                                    className="p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
                                    title="Edit"
                                >
                                    <Edit size={18} />
                                </button>
                                <button
                                    onClick={(e) => handleDelete(arch.id, e)}
                                    className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"
                                    title="Delete"
                                >
                                    <Trash2 size={18} />
                                </button>
                            </div>
                        </div>
                    ))}

                    {archetypes.length === 0 && !isCreating && (
                        <div className="text-center py-12 text-gray-500">
                            No deck types defined for this league yet.
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
