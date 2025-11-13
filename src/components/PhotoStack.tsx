import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Photo, PhotoStack, LayoutMode, GridAspectRatio } from '../types';
import { PhotoCard } from './PhotoCard';
import { RatingControls } from './RatingControls';
import { Layers, Check, X } from 'lucide-react';

interface PhotoStackProps {
    stack: PhotoStack;
    groupName: string;
    onRate: (photoId: number, rating: number) => void;
    onImageClick: (photo: Photo, fromGroupId?: string) => void;
    onToggleFlag: (photoId: number) => void;
    isExpanded: boolean;
    onExpand: () => void;
    onClose: () => void;
    onSelectionChange: (groupId: string, photoId: number | null) => void;
    displayVotes: boolean;
    layoutMode: LayoutMode;
    gridAspectRatio: GridAspectRatio;
    showToast: (message: string) => void;
    filterFlags: boolean;
    isTouchDevice: boolean;
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

export const PhotoStackComponent: React.FC<PhotoStackProps> = ({
                                                                   stack, groupName, onRate, onImageClick, onToggleFlag, isExpanded, onExpand, onClose, onSelectionChange, displayVotes, layoutMode, gridAspectRatio, showToast, filterFlags, isTouchDevice
                                                               }) => {
    const [isExiting, setIsExiting] = useState(false);

    const coverPhoto = stack.photos.find(p => p.id === stack.selectedPhotoId) || stack.photos[0];
    const selectedPhoto = stack.photos.find(p => p.id === stack.selectedPhotoId);

    const handleSelectPhoto = (e: React.MouseEvent, photoId: number) => {
        e.stopPropagation();
        const newSelectedId = stack.selectedPhotoId === photoId ? null : photoId;
        onSelectionChange(stack.groupId, newSelectedId);
    };

    const handleRateCover = (photoId: number, rating: number) => {
        if (stack.selectedPhotoId === null) {
            onExpand();
            showToast("Сначала выберите одну фотографию из группы");
        } else {
            onRate(photoId, rating);
        }
    };

    const handleRateFromHeader = (rating: number) => {
        if (stack.selectedPhotoId) {
            onRate(stack.selectedPhotoId, rating);
        }
    };

    const handleClose = () => {
        setIsExiting(true);
        setTimeout(() => {
            onClose();
            setIsExiting(false);
        }, 200); // match animation duration
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                handleClose();
            }
        };

        if (isExpanded) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [isExpanded]);


    const CollapsedView = () => {
        if (!coverPhoto) return null;
        return (
            <div id={`photo-stack-${coverPhoto.id}`} className="relative group" onClick={onExpand}>
                <div className="relative z-[1] photo-stack-visual">
                    <PhotoCard
                        photo={coverPhoto}
                        onRate={handleRateCover}
                        onImageClick={onExpand}
                        onToggleFlag={onToggleFlag}
                        displayVotes={displayVotes}
                        layoutMode={layoutMode}
                        gridAspectRatio={gridAspectRatio}
                    />
                </div>
                <div className="absolute top-2 right-2 z-[3] bg-black/60 backdrop-blur-sm text-white px-3 py-1.5 rounded-full text-lg font-bold flex items-center gap-2 pointer-events-none opacity-80 group-hover:opacity-100 transition-opacity">
                    <Layers size={20} />
                    <span>{stack.photos.length}</span>
                </div>
            </div>
        );
    }

    const ExpandedViewModal = () => {
        const photosToShow = filterFlags ? stack.photos.filter(p => p.isFlagged !== false) : stack.photos;

        const gridColsMap: { [key: number]: string } = {
            1: 'grid-cols-1',
            2: 'grid-cols-2',
            3: 'grid-cols-2 sm:grid-cols-3',
            4: 'grid-cols-2 md:grid-cols-4',
        };
        const gridColsClass = gridColsMap[photosToShow.length] || 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

        const adaptiveMaxWidth = photosToShow.length <= 4 ? `max-w-screen-${['sm','md','lg','xl'][photosToShow.length - 1]}` : 'max-w-[105rem]';

        return ReactDOM.createPortal(
            <div
                className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm group-modal-overlay ${isExiting ? 'exiting' : ''}`}
                onClick={handleClose}
            >
                <div
                    className={`relative w-full ${adaptiveMaxWidth} max-h-[90vh] bg-[#111827] border border-gray-700/50 rounded-xl shadow-2xl flex flex-col group-modal-container ${isExiting ? 'exiting' : ''}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <header className="flex-shrink-0 flex flex-wrap justify-between items-center gap-2 p-4 border-b border-gray-700/50">
                        <div className="flex-grow">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-200">Выберите фото в группе «{groupName}»</h3>
                            {selectedPhoto && displayVotes && (
                                <div className="text-sm text-gray-400">Общий рейтинг: <span className="font-bold text-green-400">{selectedPhoto.votes}</span></div>
                            )}
                        </div>
                        {selectedPhoto ? (
                            <div className="animate-fadeIn flex-shrink-0">
                                <RatingControls photo={selectedPhoto} onRate={(id, rating) => handleRateFromHeader(rating)} size="small" />
                            </div>
                        ) : <div className="h-[38px] flex-shrink-0"></div>}
                        <button onClick={handleClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Свернуть группу">
                            <X size={24} />
                        </button>
                    </header>
                    <div className="flex-grow p-4 overflow-y-auto">
                        <div className={`grid ${gridColsClass} gap-4`}>
                            {photosToShow.map(photo => {
                                const isSelected = stack.selectedPhotoId === photo.id;
                                const isDimmed = stack.selectedPhotoId !== null && !isSelected;
                                return (
                                    <div key={photo.id} className="relative cursor-pointer" onClick={(e) => { e.stopPropagation(); onImageClick(photo, stack.groupId); }}>
                                        <PhotoCard
                                            photo={photo}
                                            onRate={onRate}
                                            onImageClick={() => onImageClick(photo, stack.groupId)}
                                            onToggleFlag={onToggleFlag}
                                            displayVotes={false}
                                            layoutMode={isTouchDevice ? 'grid' : layoutMode}
                                            gridAspectRatio={isTouchDevice ? '1/1' : gridAspectRatio}
                                            showRatingControls={false}
                                            isDimmed={isDimmed}
                                        />
                                        <div onClick={(e) => handleSelectPhoto(e, photo.id)}>
                                            <SelectionControl isSelected={isSelected} />
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>
                </div>
            </div>,
            document.body
        )
    }

    return (
        <div id={`photo-stack-wrapper-${stack.groupId}`}>
            <CollapsedView />
            {isExpanded && <ExpandedViewModal />}
        </div>
    )
};