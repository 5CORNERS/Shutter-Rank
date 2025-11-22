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
}

export const PhotoStackComponent: React.FC<PhotoStackProps> = ({
    stack, groupName, onRate, onImageClick, onExpand, displayVotes, layoutMode, gridAspectRatio
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

        // If not enough photos, recycle top or middle
        if (!middle) middle = top;
        if (!bottom) bottom = top;

        return { topPhoto: top, middlePhoto: middle, bottomPhoto: bottom };
    }, [stack.photos, stack.selectedPhotoId]);

    const isSelected = stack.selectedPhotoId !== null;
    const isExpanded = stack.isExpanded;

    const handleRateCover = (photoId: number, rating: number) => {
        // If no photo is selected, clicking stars on the "gray" cover should just prompt to open/select
        if (stack.selectedPhotoId === null) {
            // We pass a specific signal or just expand. 
            // The App.tsx will handle the "Please select a photo" toast if we pass a specialized callback,
            // but for now, let's just expand to make it intuitive.
            onExpand();
        } else {
            onRate(photoId, rating);
        }
    };
    
    if (!topPhoto) return null;

    return (
        <div id={`photo-stack-wrapper-${stack.groupId}`} className={`relative group pb-6 ${isExpanded ? 'dimmed-stack' : ''}`}>
            <div id={`photo-stack-${topPhoto.id}`} className="relative cursor-pointer" onClick={onExpand}>
                
                {/* Bottom Layer (Rotated Right) */}
                <div className="absolute inset-0 transform rotate-3 scale-95 z-0 opacity-90 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-100">
                    <div className="w-full h-full rounded-lg overflow-hidden shadow-md bg-gray-800 border border-gray-600 brightness-50 contrast-125">
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

                {/* Middle Layer (Rotated Left) */}
                <div className="absolute inset-0 transform -rotate-2 scale-95 z-[1] opacity-95 transition-transform duration-300 group-hover:-rotate-4 group-hover:scale-100">
                     <div className="w-full h-full rounded-lg overflow-hidden shadow-md bg-gray-800 border border-gray-600 brightness-75 contrast-110">
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

                {/* Top Layer (Main Card) */}
                <div className="relative z-[10] transition-transform duration-300 group-hover:translate-y-[-4px]">
                    <PhotoCard
                        photo={topPhoto}
                        onRate={handleRateCover}
                        onImageClick={onExpand}
                        onToggleVisibility={() => {}} 
                        displayVotes={displayVotes}
                        layoutMode={layoutMode}
                        gridAspectRatio={gridAspectRatio}
                        showVisibilityToggle={false} // Hide toggle on stack cover
                        isGrayscale={!isSelected} // Gray if nothing selected
                    />
                    
                    {/* Count Badge */}
                    <div className="absolute top-2 right-2 z-[20] bg-black/70 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-sm font-bold flex items-center gap-1.5 pointer-events-none shadow-lg border border-white/10">
                        <Layers size={16} className="text-indigo-400" />
                        <span>{stack.photos.length}</span>
                    </div>
                </div>
            </div>

            {/* Tab / Label */}
            <div 
                className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-0 h-7 bg-gray-800 border border-t-0 border-gray-600 rounded-b-lg flex items-center justify-center gap-2 text-xs text-gray-300 cursor-pointer group-hover:bg-gray-700 group-hover:text-white transition-all px-4 shadow-lg z-[5]"
                onClick={onExpand}
                style={{ maxWidth: '90%' }}
            >
                <span className="truncate font-medium">Группа «{groupName}»</span>
                <ChevronDown className="w-3 h-3 flex-shrink-0 text-indigo-400" />
            </div>
        </div>
    )
};