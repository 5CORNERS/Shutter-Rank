import React from 'react';
import { Photo, PhotoStack, LayoutMode, GridAspectRatio } from '../types';
import { PhotoCard } from './PhotoCard';
import { Layers, CheckSquare, X } from 'lucide-react';

interface PhotoStackProps {
    stack: PhotoStack;
    onRate: (photoId: number, rating: number) => void;
    onImageClick: (photo: Photo) => void;
    onToggleFlag: (photoId: number) => void;
    onStateChange: (groupId: string, changes: Partial<PhotoStack>) => void;
    displayVotes: boolean;
    layoutMode: LayoutMode;
    gridAspectRatio: GridAspectRatio;
    showToast: (message: string) => void;
}

export const PhotoStackComponent: React.FC<PhotoStackProps> = ({
                                                                   stack, onRate, onImageClick, onToggleFlag, onStateChange, displayVotes, layoutMode, gridAspectRatio, showToast
                                                               }) => {
    const coverPhoto = stack.photos.find(p => p.id === stack.selectedPhotoId) || stack.photos[0];

    const handleExpand = () => {
        onStateChange(stack.groupId, { isExpanded: true });
    };

    const handleCollapse = () => {
        onStateChange(stack.groupId, { isExpanded: false });
    };

    const handleSelectPhoto = (photoId: number) => {
        onStateChange(stack.groupId, { selectedPhotoId: photoId });
    };

    const handleRateCover = (photoId: number, rating: number) => {
        if (stack.selectedPhotoId === null) {
            handleExpand();
            showToast("Сначала выберите одну фотографию из группы");
        } else {
            onRate(photoId, rating);
        }
    };

    if (!stack.isExpanded) {
        if (!coverPhoto) return null; // Should not happen if stack has photos
        return (
            <div id={`photo-stack-${coverPhoto.id}`} className="relative photo-stack-visual" onClick={handleExpand}>
        <PhotoCard
            photo={coverPhoto}
        onRate={handleRateCover}
        onImageClick={handleExpand}
        onToggleFlag={onToggleFlag}
        displayVotes={displayVotes}
        layoutMode={layoutMode}
        gridAspectRatio={gridAspectRatio}
        />
        <div className="absolute top-2 right-2 z-30 bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-md text-sm font-semibold flex items-center gap-1.5 pointer-events-none">
        <Layers size={14} />
        <span>{stack.photos.length}</span>
        </div>
        </div>
    );
    }

    return (
        <div id={`photo-stack-expanded-${stack.groupId}`} className="bg-gray-800/50 border-2 border-indigo-500/30 rounded-lg p-4 space-y-4">
    <div className="flex justify-between items-center">
    <h3 className="text-lg font-bold text-gray-200">Выберите лучшее фото в группе</h3>
    <button onClick={handleCollapse} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors">
    <X size={20} />
    </button>
    </div>
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {stack.photos.map(photo => {
                const isSelected = stack.selectedPhotoId === photo.id;
                return (
                    <div key={photo.id} className={`relative transition-opacity duration-300 ${!isSelected && stack.selectedPhotoId !== null ? 'opacity-50 hover:opacity-100' : ''}`} onClick={() => handleSelectPhoto(photo.id)}>
                <PhotoCard
                    photo={photo}
                onRate={onRate}
                onImageClick={onImageClick}
                onToggleFlag={onToggleFlag}
                displayVotes={displayVotes}
                layoutMode="grid" // Force grid inside stack
                gridAspectRatio="1/1"
                showRatingControls={isSelected} // Pass down prop
                />
                {isSelected && (
                    <div className="absolute top-2 left-2 z-30 pointer-events-none">
                    <div className="bg-green-600 text-white rounded-full p-1.5 shadow-lg">
                    <CheckSquare size={16} />
                </div>
                </div>
                )}
                {isSelected && stack.selectedPhotoId !== null && (
                    <div className="absolute bottom-14 right-2 z-30 animate-fade-in">
                    <button onClick={(e) => { e.stopPropagation(); handleCollapse(); }} className="px-3 py-1.5 text-xs font-semibold rounded-full bg-indigo-600 hover:bg-indigo-700 text-white transition-colors shadow-lg">
                    Готово
                    </button>
                    </div>
                )}
                </div>
            )
            })}
        </div>
        </div>
);
};
