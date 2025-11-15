import React from 'react';
import { Photo, PhotoStack, LayoutMode, GridAspectRatio } from '../types';
import { PhotoCard } from './PhotoCard';
import { Layers } from 'lucide-react';

interface PhotoStackProps {
    stack: PhotoStack;
    onRate: (photoId: number, rating: number) => void;
    onImageClick: (photo: Photo) => void;
    onToggleVisibility: (photoId: number) => void;
    onExpand: () => void;
    displayVotes: boolean;
    layoutMode: LayoutMode;
    gridAspectRatio: GridAspectRatio;
    isTouchDevice: boolean;
    hidingPhotoId: number | null;
}

export const PhotoStackComponent: React.FC<PhotoStackProps> = ({
    stack, onRate, onImageClick, onExpand, displayVotes, layoutMode, gridAspectRatio, hidingPhotoId
}) => {
    
    const coverPhoto = stack.photos.find(p => p.id === stack.selectedPhotoId) || stack.photos[0];

    const handleRateCover = (photoId: number, rating: number) => {
        if (stack.selectedPhotoId === null) {
            onExpand();
        } else {
            onRate(photoId, rating);
        }
    };
    
    if (!coverPhoto) return null;

    return (
        <div id={`photo-stack-wrapper-${stack.groupId}`}>
            <div id={`photo-stack-${coverPhoto.id}`} className="relative group" onClick={onExpand}>
                <div className="relative z-[1] photo-stack-visual">
                    <PhotoCard
                        photo={coverPhoto}
                        onRate={handleRateCover}
                        onImageClick={onExpand}
                        onToggleVisibility={() => {}} // Visibility is handled per-photo inside expanded view
                        displayVotes={displayVotes}
                        layoutMode={layoutMode}
                        gridAspectRatio={gridAspectRatio}
                        isHiding={hidingPhotoId === coverPhoto.id}
                        showVisibilityToggle={false} // Hide on collapsed stack
                    />
                </div>
                <div className="absolute top-2 right-2 z-[3] bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-lg font-bold flex items-center gap-2 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                    <Layers size={20} />
                    <span>{stack.photos.length}</span>
                </div>
            </div>
        </div>
    )
};