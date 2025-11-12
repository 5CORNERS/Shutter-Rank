import React from 'react';
import { Photo, PhotoStack, LayoutMode, GridAspectRatio } from '../types';
import { PhotoCard } from './PhotoCard';
import { RatingControls } from './RatingControls';
import { Layers, Check, X, Info } from 'lucide-react';

interface PhotoStackProps {
    stack: PhotoStack;
    groupName: string;
    onRate: (photoId: number, rating: number) => void;
    onImageClick: (photo: Photo) => void;
    onToggleFlag: (photoId: number) => void;
    onStateChange: (groupId: string, changes: Partial<PhotoStack>) => void;
    displayVotes: boolean;
    layoutMode: LayoutMode;
    gridAspectRatio: GridAspectRatio;
    showToast: (message: string) => void;
}

const SelectionControl: React.FC<{isSelected: boolean}> = ({isSelected}) => {
    return (
        <div className="absolute top-2 right-2 z-10 pointer-events-auto" >
            <div className={`w-6 h-6 rounded-full flex items-center justify-center ring-1 ring-inset ring-black/20 transition-all duration-200 ${isSelected ? 'bg-green-500 border-2 border-white shadow-lg' : 'bg-gray-800/60 backdrop-blur-sm border-2 border-gray-400/80'}`}>
                {isSelected && <Check className="w-4 h-4 text-white" />}
            </div>
        </div>
    )
}

export const PhotoStackComponent: React.FC<PhotoStackProps> = ({
                                                                   stack, groupName, onRate, onImageClick, onToggleFlag, onStateChange, displayVotes, layoutMode, gridAspectRatio, showToast
                                                               }) => {
    const coverPhoto = stack.photos.find(p => p.id === stack.selectedPhotoId) || stack.photos[0];
    const selectedPhoto = stack.photos.find(p => p.id === stack.selectedPhotoId);

    const handleExpand = () => {
        onStateChange(stack.groupId, { isExpanded: true });
    };

    const handleCollapse = () => {
        onStateChange(stack.groupId, { isExpanded: false });
    };

    const handleSelectPhoto = (photoId: number) => {
        const newSelectedId = stack.selectedPhotoId === photoId ? null : photoId;
        onStateChange(stack.groupId, { selectedPhotoId: newSelectedId });
    };

    const handleRateCover = (photoId: number, rating: number) => {
        if (stack.selectedPhotoId === null) {
            handleExpand();
            showToast("Сначала выберите одну фотографию из группы");
        } else {
            onRate(photoId, rating);
        }
    };

    const handleRateFromHeader = (photoId: number, rating: number) => {
        if (stack.selectedPhotoId) {
            onRate(stack.selectedPhotoId, rating);
        }
    };

    const CollapsedView = () => {
        if (!coverPhoto) return null;
        return (
            <div id={`photo-stack-${coverPhoto.id}`} className="relative" onClick={handleExpand}>
                <div className="relative z-[1] photo-stack-visual">
                    <PhotoCard
                        photo={coverPhoto}
                        onRate={handleRateCover}
                        onImageClick={handleExpand}
                        onToggleFlag={onToggleFlag}
                        displayVotes={displayVotes}
                        layoutMode={layoutMode}
                        gridAspectRatio={gridAspectRatio}
                    />
                </div>
                <div className="absolute top-2 left-10 z-[3] bg-black/60 backdrop-blur-sm text-white px-2 py-1 rounded-md text-xs font-semibold flex items-center gap-1.5 pointer-events-none opacity-70 group-hover:opacity-100 transition-opacity">
                    <Layers size={14} />
                    <span>{stack.photos.length}</span>
                </div>
            </div>
        );
    }

    const ExpandedView = () => {
        return (
            <div className="bg-gray-800/50 border-2 border-indigo-500/30 rounded-lg p-3 sm:p-4 space-y-4">
                <div className="flex flex-wrap justify-between items-center gap-2">
                    <div className="flex-grow">
                        <h3 className="text-base sm:text-lg font-bold text-gray-200">Выберите лучшее фото в группе «{groupName}»</h3>
                        {selectedPhoto && displayVotes && (
                            <div className="text-sm text-gray-400">Общий рейтинг выбранного фото: <span className="font-bold text-green-400">{selectedPhoto.votes}</span></div>
                        )}
                    </div>
                    {selectedPhoto && (
                        <div className="animate-fadeIn">
                            <RatingControls photo={selectedPhoto} onRate={handleRateFromHeader} size="small" />
                        </div>
                    )}
                    <button onClick={handleCollapse} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Свернуть группу">
                        <X size={20} />
                    </button>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {stack.photos.map(photo => {
                        const isSelected = stack.selectedPhotoId === photo.id;
                        const isDimmed = stack.selectedPhotoId !== null && !isSelected;
                        return (
                            <div key={photo.id} className="relative cursor-pointer" onClick={() => handleSelectPhoto(photo.id)}>
                                <PhotoCard
                                    photo={photo}
                                    onRate={onRate}
                                    onImageClick={onImageClick}
                                    onToggleFlag={onToggleFlag}
                                    displayVotes={false} // Votes are shown in header
                                    layoutMode="grid" // Force grid inside stack
                                    gridAspectRatio="1/1"
                                    showRatingControls={false} // Ratings are in header
                                    isDimmed={isDimmed}
                                />
                                <SelectionControl isSelected={isSelected} />
                            </div>
                        )
                    })}
                </div>
            </div>
        )
    }

    return (
        <div id={`photo-stack-wrapper-${stack.groupId}`}>
            {!stack.isExpanded && <CollapsedView />}
            <div className={`transition-all duration-500 ease-in-out grid overflow-hidden ${stack.isExpanded ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}>
                <div className="overflow-hidden">
                    {stack.isExpanded && <ExpandedView />}
                </div>
            </div>
        </div>
    )
};