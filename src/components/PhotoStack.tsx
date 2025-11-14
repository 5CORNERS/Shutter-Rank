import React, { useState, useEffect } from 'react';
import ReactDOM from 'react-dom';
import { Photo, PhotoStack, LayoutMode, GridAspectRatio } from '../types';
import { PhotoCard } from './PhotoCard';
import { RatingControls } from './RatingControls';
import { Layers, Check, X, XCircle } from 'lucide-react';

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

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        if (isExpanded) {
            window.addEventListener('keydown', handleKeyDown);
        }

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isExpanded, onClose]);


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
                className={`fixed inset-0 z-[100] flex items-center justify-center p-4 bg-gray-900/80 backdrop-blur-md transition-opacity duration-300 ease-out ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                onClick={onClose}
            >
                <div
                    className={`relative w-full ${adaptiveMaxWidth} max-h-[90vh] bg-gray-900 ring-1 ring-white/10 shadow-2xl shadow-indigo-500/20 rounded-xl flex flex-col transform-gpu transition-all duration-300 ease-out ${isExpanded ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'}`}
                    onClick={(e) => e.stopPropagation()}
                >
                    <header className="flex-shrink-0 flex flex-wrap justify-between items-center gap-2 px-6 py-4 border-b border-gray-700/50">
                        <div className="flex-grow">
                            <h3 className="text-lg sm:text-xl font-bold text-gray-200">Выберите фото в группе «{groupName}»</h3>
                            {selectedPhoto && displayVotes && (
                                <div className="text-sm text-gray-400">Общий рейтинг: <span className="font-bold text-green-400">{selectedPhoto.votes}</span></div>
                            )}
                        </div>
                        <div className={`flex items-center flex-shrink-0 transition-opacity duration-300 ${selectedPhoto ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
                            <RatingControls photo={selectedPhoto || stack.photos[0]} onRate={(id, rating) => handleRateFromHeader(rating)} size="small" disabled={!selectedPhoto} />
                            <div className={`transition-opacity duration-300 ${selectedPhoto?.userRating ? 'opacity-100' : 'opacity-0'}`}>
                                <button onClick={() => handleRateFromHeader(0)} className="p-1.5 ml-1 rounded-full text-red-500/70 hover:text-red-500 hover:bg-red-500/10" aria-label="Сбросить оценку">
                                    <XCircle className="w-5 h-5"/>
                                </button>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-full text-gray-400 hover:bg-gray-700 hover:text-white transition-colors" aria-label="Свернуть группу">
                            <X size={24} />
                        </button>
                    </header>
                    <div className="flex-grow overflow-y-auto p-6">
                        <div className={`grid ${gridColsClass} gap-6`}>
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
            <ExpandedViewModal />
        </div>
    )
};