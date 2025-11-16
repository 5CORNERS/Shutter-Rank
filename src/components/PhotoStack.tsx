import React from 'react';
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
        <div id={`photo-stack-wrapper-${stack.groupId}`} className="relative group pb-6">
            <div id={`photo-stack-${coverPhoto.id}`} className="relative" onClick={onExpand}>
                <div className="relative z-[1] photo-stack-visual cursor-pointer">
                    <PhotoCard
                        photo={coverPhoto}
                        onRate={handleRateCover}
                        onImageClick={onExpand}
                        onToggleVisibility={() => {}} // Visibility is handled per-photo inside expanded view
                        displayVotes={displayVotes}
                        layoutMode={layoutMode}
                        gridAspectRatio={gridAspectRatio}
                        showVisibilityToggle={false} // Hide on collapsed stack
                    />
                </div>
                <div className="absolute top-2 right-2 z-[3] bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-lg font-bold flex items-center gap-2 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                    <Layers size={20} />
                    <span>{stack.photos.length}</span>
                </div>
            </div>
            <div
                className="absolute bottom-0 left-0 right-0 h-6 bg-gray-800/80 backdrop-blur-sm rounded-b-lg flex items-center justify-center text-xs text-gray-300 cursor-pointer group-hover:bg-gray-700/80 transition-colors"
                onClick={onExpand}
            >
                <span className="truncate px-2">{groupName}</span>
                <ChevronDown className="w-4 h-4 flex-shrink-0 text-indigo-400" />
            </div>
        </div>
    )
};
