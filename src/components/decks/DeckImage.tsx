import type { Database } from '../../types/database.types';

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

interface DeckImageProps {
    archetype: Archetype;
    className?: string;
}

// Helper for clipped images
const ClippedImage = ({ src, clipPath, zIndex }: { src: string, clipPath: string, zIndex: number }) => (
    <div className="absolute inset-0 w-full h-full" style={{ clipPath, zIndex }}>
        <img
            src={src}
            className="w-full h-full object-cover object-[center_20%] scale-[1.8]"
            alt=""
        />
    </div>
);

/**
 * Renders a split view for hybrid decks with multiple component images
 */
const renderSplitView = (images: string[]) => {
    if (images.length === 0) return <div className="w-full h-full bg-gray-800" />;

    // 2 Components: Vertical Diagonal Split
    if (images.length === 2) {
        return (
            <div className="w-full h-full relative overflow-hidden">
                <ClippedImage
                    src={images[0]}
                    clipPath="polygon(0 0, 65% 0, 35% 100%, 0 100%)"
                    zIndex={1}
                />
                <div className="absolute inset-0 bg-black/50" style={{ clipPath: 'polygon(64% 0, 66% 0, 36% 100%, 34% 100%)', zIndex: 2 }} /> {/* Divider Line */}
                <ClippedImage
                    src={images[1]}
                    clipPath="polygon(65% 0, 100% 0, 100% 100%, 35% 100%)"
                    zIndex={1}
                />
            </div>
        );
    }

    // 3+ Components: Fan Split
    return (
        <div className="w-full h-full relative overflow-hidden">
            {/* Primary Left */}
            <ClippedImage
                src={images[0]}
                clipPath="polygon(0 0, 70% 0, 30% 100%, 0 100%)"
                zIndex={2}
            />

            {/* Top Right */}
            <ClippedImage
                src={images[1] || images[0]}
                clipPath="polygon(70% 0, 100% 0, 100% 50%, 50% 50%)"
                zIndex={1}
            />

            {/* Bottom Right */}
            <ClippedImage
                src={images[2] || images[0]}
                clipPath="polygon(50% 50%, 100% 50%, 100% 100%, 30% 100%)"
                zIndex={1}
            />

            {/* Dividers */}
            <div className="absolute inset-0 bg-black/50" style={{ clipPath: 'polygon(69% 0, 71% 0, 51% 50%, 49% 50%)', zIndex: 3 }} />
            <div className="absolute inset-0 bg-black/50" style={{ clipPath: 'polygon(49% 50%, 51% 50%, 31% 100%, 29% 100%)', zIndex: 3 }} />
            <div className="absolute inset-0 bg-black/50" style={{ clipPath: 'polygon(50% 49%, 100% 49%, 100% 51%, 50% 51%)', zIndex: 3 }} />
        </div>
    );
};

/**
 * DeckImage Component
 * Renders deck images consistently across the app, handling both pure and hybrid decks
 */
export default function DeckImage({ archetype, className = '' }: DeckImageProps) {
    if (!archetype.is_hybrid) {
        // Pure deck: show single cover image with zoom
        return (
            <img
                src={archetype.cover_image_url}
                alt={archetype.name}
                className={className || "w-full h-full object-cover object-[center_20%] scale-150"}
            />
        );
    }

    // Hybrid deck: get component cards and render split view
    const comps = archetype.archetype_compositions?.map(ac => ac.card) || [];
    const images = comps.map(c => c.image_url).filter(Boolean);

    return <div className={className || "w-full h-full"}>{renderSplitView(images)}</div>;
}
