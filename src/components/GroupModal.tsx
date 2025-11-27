import React, { useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Photo, PhotoStack, LayoutMode, GridAspectRatio } from '../types';
import { PhotoCard } from './PhotoCard';
import { RatingControls } from './RatingControls';
import { Check, X, Star, BarChart2, Users } from 'lucide-react';

interface GroupModalProps {
    isOpen: boolean;
    stack: PhotoStack;
    groupName: string;
    groupCaption?: string;
    onClose: () => void;
    onRate: (photoId: number, rating: number) => void;
    onImageClick: (photo: Photo) => void;
    onToggleVisibility: (photoId: number) => void;
    onSelectionChange: (groupId: string, photoId: number | null) => void;
    displayVotes: boolean;
    layoutMode: LayoutMode;
    gridAspectRatio: GridAspectRatio;
    showHiddenPhotos: boolean;
    isTouchDevice: boolean;
    hidingPhotoId: number | null;
    // Limits
    starsUsed: number;
    totalStarsLimit: number;
    ratedPhotosCount: number;
    ratedPhotoLimit: number;
    hasCreditVotes: boolean;
    isVotingDisabled?: boolean;
}

const SelectionControl: React.FC<{isSelected: boolean}> = ({isSelected}) => {
    return (
        <div className="absolute top-2 right-2 z-10 pointer-events-auto" >
             <div className={`selection-control-bg w-7 h-7 rounded-full flex items-center justify-center ring-1 ring-inset ring-white/20 transition-all duration-300 border-2 shadow-lg ${isSelected ? 'bg-green-500 border-white selected' : 'bg-gray-900/40 backdrop-blur-sm border-white/80'}`}>
                <Check className="w-5 h-5 text-white selection-control-check" />
            </div>
        </div>
    )
}

export const GroupModal: React.FC<GroupModalProps> = ({
    isOpen, stack, groupName, groupCaption, onClose, onRate, onImageClick, onToggleVisibility, onSelectionChange, displayVotes, layoutMode, gridAspectRatio, showHiddenPhotos, isTouchDevice, hidingPhotoId,
    starsUsed, totalStarsLimit, ratedPhotosCount, ratedPhotoLimit, hasCreditVotes, isVotingDisabled = false
}) => {
    
    const selectedPhoto = stack.photos.find(p => p.id === stack.selectedPhotoId);

    const handleSelectPhoto = (e: React.MouseEvent, photoId: number) => {
        e.stopPropagation();
        const newSelectedId = stack.selectedPhotoId === photoId ? null : photoId;
        onSelectionChange(stack.groupId, newSelectedId);
    };
    
    const handleRateFromHeader = (rating: number) => {
        if (stack.selectedPhotoId && !isVotingDisabled) {
            onRate(stack.selectedPhotoId, rating);
        }
    };
    
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
          if (event.key === 'Escape') {
            onClose();
          }
        };
    
        if (isOpen) {
          window.addEventListener('keydown', handleKeyDown);
        }
    
        return () => {
          window.removeEventListener('keydown', handleKeyDown);
        };
      }, [isOpen, onClose]);


    if (!isOpen) {
        return null;
    }

    const photosToShow = showHiddenPhotos ? stack.photos : stack.photos.filter(p => p.isVisible !== false || p.id === hidingPhotoId);
    
    const gridColsMap: { [key: number]: string } = {
        1: 'grid-cols-1',
        2: 'grid-cols-2',
        3: 'grid-cols-2 sm:grid-cols-3',
        4: 'grid-cols-2 md:grid-cols-4',
    };
    const gridColsClass = gridColsMap[photosToShow.length] || 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
    
    const adaptiveMaxWidth = photosToShow.length <= 4 ? `max-w-screen-${['sm','md','lg','xl'][photosToShow.length - 1]}` : 'max-w-[105rem]';
    const captionToShow = groupCaption || selectedPhoto?.caption;

    return ReactDOM.createPortal(
        <div 
            className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md transition-opacity duration-300 ease-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={onClose}
        >
            <div 
                className={`relative w-full ${adaptiveMaxWidth} max-h-[90vh] bg-gray-900 ring-1 ring-white/10 shadow-2xl shadow-indigo-500/20 rounded-xl flex flex-col transform-gpu transition-all duration-300 ease-out ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
                onClick={(e) => e.stopPropagation()}
            >
                <header className="flex-shrink-0 flex flex-wrap justify-between items-center gap-2 px-6 py-4 border-b border-gray-700/50">
                    <div className="flex-grow">
                        <h3 className="text-lg sm:text-xl font-bold text-gray-200">Группа «{groupName}»</h3>
                        {selectedPhoto && displayVotes && (
                             <div className="flex gap-4 mt-1 text-xs">
                                <div className="flex items-center gap-1" title="Сумма звезд">
                                    <Star className="text-yellow-400 w-3 h-3" fill="currentColor" />
                                    <span className="font-bold text-yellow-400">{selectedPhoto.votes}</span>
                                </div>
                                <div className="w-px h-4 bg-gray-600/50"></div>
                                <div className="flex items-center gap-1" title="Нормированный балл">
                                    <BarChart2 className="text-green-400 w-3 h-3" />
                                    <span className="font-bold text-green-400">{(selectedPhoto.normalizedScore || 0).toFixed(2)}</span>
                                </div>
                                 <div className="w-px h-4 bg-gray-600/50"></div>
                                <div className="flex items-center gap-1" title="Количество проголосовавших">
                                    <Users className="text-blue-400 w-3 h-3" />
                                    <span className="font-bold text-blue-400">{selectedPhoto.voteCount || 0}</span>
                                </div>
                            </div>
                        )}
                    </div>
                    <div className={`flex items-center flex-shrink-0 transition-opacity duration-300 ${selectedPhoto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                        <RatingControls 
                            photo={selectedPhoto || stack.photos[0]} 
                            onRate={(id, rating) => handleRateFromHeader(rating)} 
                            size="small" 
                            disabled={!selectedPhoto || isVotingDisabled} 
                            resetButtonMode="always" 
                            starsUsed={starsUsed}
                            totalStarsLimit={totalStarsLimit}
                            ratedPhotosCount={ratedPhotosCount}
                            ratedPhotoLimit={ratedPhotoLimit}
                            hasCreditVotes={hasCreditVotes}
                        />
                    </div>
                    <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Закрыть группу">
                        <X size={24} />
                    </button>
                </header>
                <div className="flex-grow overflow-y-auto p-6">
                    <div className={`grid ${gridColsClass} gap-6`}>
                        {photosToShow.map(photo => {
                            const isSelected = stack.selectedPhotoId === photo.id;
                            const isDimmed = stack.selectedPhotoId !== null && !isSelected;
                            return (
                                <div key={photo.id} className="relative cursor-pointer" onClick={(e) => { e.stopPropagation(); onImageClick(photo); }}>
                                    <PhotoCard
                                        photo={photo}
                                        onRate={onRate}
                                        onImageClick={() => onImageClick(photo)}
                                        onToggleVisibility={onToggleVisibility}
                                        displayVotes={false}
                                        layoutMode={isTouchDevice ? 'grid' : layoutMode}
                                        gridAspectRatio={isTouchDevice ? '1/1' : gridAspectRatio}
                                        showRatingControls={false}
                                        isDimmed={isDimmed}
                                        isHiding={hidingPhotoId === photo.id}
                                        starsUsed={starsUsed}
                                        totalStarsLimit={totalStarsLimit}
                                        ratedPhotosCount={ratedPhotosCount}
                                        ratedPhotoLimit={ratedPhotoLimit}
                                        hasCreditVotes={hasCreditVotes}
                                        isVotingDisabled={isVotingDisabled}
                                    />
                                    <div onClick={(e) => handleSelectPhoto(e, photo.id)}>
                                        <SelectionControl isSelected={isSelected} />
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
                 {captionToShow && (
                    <footer className="flex-shrink-0 border-t border-gray-700/50 px-6 py-3 text-center text-sm text-gray-400">
                        <p>{captionToShow}</p>
                    </footer>
                 )}
            </div>
        </div>,
        document.body
    )
};