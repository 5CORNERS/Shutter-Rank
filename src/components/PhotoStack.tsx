import React, { useMemo } from 'react';
import { Photo, PhotoStack, LayoutMode, GridAspectRatio } from '../types';
import { PhotoCard } from './PhotoCard';
import { Layers, ChevronDown } from 'lucide-react';

interface PhotoStackProps {
    stack: PhotoStack;
    groupName: string;
    onRate: (photoId: number, rating: number) => void;
    onImageClick: (photo: Photo) => void;
    onExpand: () => void;
    displayVotes: boolean;
    layoutMode: LayoutMode;
    gridAspectRatio: GridAspectRatio;
    isTouchDevice: boolean;
    onShowToast?: (msg: string) => void;
}

export const PhotoStackComponent: React.FC<PhotoStackProps> = ({
                                                                   stack, groupName, onRate, onImageClick, onExpand, displayVotes, layoutMode, gridAspectRatio, onShowToast
                                                               }) => {

    // Determine which photos to show in the stack layers
    const { topPhoto, middlePhoto, bottomPhoto } = useMemo(() => {
        const selected = stack.photos.find(p => p.id === stack.selectedPhotoId);
        // If a photo is selected, it MUST be on top.
        // If not, show the first photo on top (grayed out).
        const top = selected || stack.photos[0];

        // Find distinct photos for the layers beneath
        // Prefer photos that are NOT the top photo
        const others = stack.photos.filter(p => p.id !== top.id);

        let middle = others[0];
        let bottom = others[1];

        // If not enough photos, recycle top or middle to maintain stack look
        if (!middle) middle = top;
        if (!bottom) bottom = middle;

        return { topPhoto: top, middlePhoto: middle, bottomPhoto: bottom };
    }, [stack.photos, stack.selectedPhotoId]);

    const isSelected = stack.selectedPhotoId !== null;
    const isExpanded = stack.isExpanded;

    const handleRateCover = (photoId: number, rating: number) => {
        // If no photo is selected, clicking stars on the "gray" cover should prompt to select
        if (stack.selectedPhotoId === null) {
            if (onShowToast) {
                onShowToast("Выберите фотографию в группе, которую хотите оценить");
            }
            // Also expand to show options
            if (!isExpanded) {
                onExpand();
            }
        } else {
            onRate(photoId, rating);
        }
    };

    if (!topPhoto) return null;

    return (
        <div id={`photo-stack-wrapper-${stack.groupId}`} className={`relative group pb-8 ${isExpanded ? 'dimmed-stack' : ''}`}>
            <div id={`photo-stack-${topPhoto.id}`} className="relative cursor-pointer h-full" onClick={onExpand}>

                {/*
                   Stack Construction (Z-Index Order):
                   Z-0:  Bottom Card (Background)
                   Z-10: Middle Card (Background)
                   Z-20: Tab (Name) - Must be above background cards but below top card
                   Z-30: Top Card (Cover)
                */}

                {/* Bottom Layer (Rotated Right + Shifted) - Z: 0 */}
                <div className="absolute inset-0 transform translate-x-2 translate-y-1 rotate-4 z-0 opacity-90 transition-transform duration-300 group-hover:rotate-6 group-hover:translate-x-3 group-hover:translate-y-2">
                    <div className="w-full h-full rounded-lg overflow-hidden shadow-md bg-gray-800 border border-gray-500 ring-1 ring-black/50 brightness-75 contrast-125">
                        <PhotoCard
                            photo={bottomPhoto}
                            onRate={()=>{}}
                            onImageClick={()=>{}}
                            onToggleVisibility={()=>{}}
                            displayVotes={false}
                            layoutMode={layoutMode}
                            gridAspectRatio={gridAspectRatio}
                            isReadOnly={true}
                            showRatingControls={false}
                            showVisibilityToggle={false}
                        />
                    </div>
                </div>

                {/* Middle Layer (Rotated Left + Shifted) - Z: 10 */}
                <div className="absolute inset-0 transform -translate-x-1 translate-y-0 -rotate-2 z-10 opacity-95 transition-transform duration-300 group-hover:-rotate-3 group-hover:-translate-x-2 group-hover:translate-y-1">
                    <div className="w-full h-full rounded-lg overflow-hidden shadow-md bg-gray-800 border border-gray-500 ring-1 ring-black/50 brightness-75 contrast-110">
                        <PhotoCard
                            photo={middlePhoto}
                            onRate={()=>{}}
                            onImageClick={()=>{}}
                            onToggleVisibility={()=>{}}
                            displayVotes={false}
                            layoutMode={layoutMode}
                            gridAspectRatio={gridAspectRatio}
                            isReadOnly={true}
                            showRatingControls={false}
                            showVisibilityToggle={false}
                        />
                    </div>
                </div>

                {/* Tab / Label - Z: 20 (Between Middle and Top) */}
                {/* Set exactly to -2.25rem (-bottom-9 equivalent) as requested */}
                <div
                    className="absolute left-1/2 -translate-x-1/2 h-9 bg-gray-800 border border-t-0 border-gray-600 rounded-b-lg flex items-center justify-center gap-2 text-xs text-gray-300 cursor-pointer group-hover:bg-gray-700 group-hover:text-white transition-all px-4 shadow-lg z-20"
                    onClick={(e) => { e.stopPropagation(); onExpand(); }}
                    style={{ bottom: '-2.25rem', maxWidth: '90%', minWidth: '120px' }}
                >
                    <span className="truncate font-medium">Группа «{groupName}»</span>
                    <ChevronDown className="w-3 h-3 flex-shrink-0 text-indigo-400" />
                </div>

                {/* Top Layer (Main Card) - Z: 30 (Highest) */}
                <div className="relative z-30 transition-transform duration-300 group-hover:-translate-y-1">
                    <PhotoCard
                        photo={topPhoto}
                        onRate={handleRateCover}
                        onImageClick={onExpand}
                        onToggleVisibility={() => {}}
                        displayVotes={displayVotes}
                        layoutMode={layoutMode}
                        gridAspectRatio={gridAspectRatio}
                        showVisibilityToggle={false} // Hide toggle on stack cover
                        isGrayscale={!isSelected} // Gray if nothing selected (but color on hover via CSS)
                    />

                    {/* Count Badge */}
                    <div className="absolute top-2 right-2 z-40 bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 pointer-events-none shadow-lg border border-white/10">
                        <Layers size={16} className="text-indigo-400" />
                        <span>{stack.photos.length}</span>
                    </div>
                </div>
            </div>
        </div>
    )
};