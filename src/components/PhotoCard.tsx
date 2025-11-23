import React, { useState } from 'react';
import { Photo, LayoutMode, GridAspectRatio } from '../types';
import { Info, Eye, EyeOff, Check } from 'lucide-react';
import { RatingControls } from './RatingControls';

const SelectionControl: React.FC<{isSelected: boolean; onSelect: () => void;}> = ({isSelected, onSelect}) => {
    return (
        <div className="absolute top-2 right-2 z-10 pointer-events-auto" onClick={(e) => { e.stopPropagation(); onSelect(); }} >
            <div className={`selection-control-bg w-7 h-7 rounded-full flex items-center justify-center ring-1 ring-inset ring-white/20 transition-all duration-300 border-2 shadow-lg cursor-pointer ${isSelected ? 'bg-green-500 border-white selected' : 'bg-gray-900/40 backdrop-blur-sm border-white/80'}`}>
                <Check className="w-5 h-5 text-white selection-control-check" />
            </div>
        </div>
    )
}

interface PhotoCardProps {
    photo: Photo;
    onRate: (photoId: number, rating: number) => void;
    onImageClick: (photo: Photo) => void;
    onToggleVisibility: (photoId: number) => void;
    displayVotes: boolean;
    layoutMode: LayoutMode;
    gridAspectRatio: GridAspectRatio;
    showRatingControls?: boolean;
    isDimmed?: boolean;
    isReadOnly?: boolean;
    isHiding?: boolean;
    showVisibilityToggle?: boolean;
    showSelectionControl?: boolean;
    isSelected?: boolean;
    onSelect?: () => void;
    isFilterActive?: boolean;
    isGrayscale?: boolean; // New prop for "unselected group" state
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
                                                        photo, onRate, onImageClick, onToggleVisibility, displayVotes, layoutMode,
                                                        gridAspectRatio, showRatingControls = true, isDimmed = false, isReadOnly = false, isHiding = false,
                                                        showVisibilityToggle = true, showSelectionControl = false, isSelected = false, onSelect = () => {},
                                                        isFilterActive = false, isGrayscale = false
                                                    }) => {
    const [isCaptionVisible, setIsCaptionVisible] = useState(false);

    const handleCardClick = (e: React.MouseEvent<HTMLDivElement>) => {
        if (isReadOnly) return;
        if (isCaptionVisible) {
            e.stopPropagation();
            setIsCaptionVisible(false);
            return;
        }
        onImageClick(photo);
    };

    const getScoreColor = (score: number) => {
        if (score > 0) return 'text-green-400';
        if (score < 0) return 'text-red-400';
        return 'text-gray-400';
    };

    const isVisible = photo.isVisible !== false;
    const isOutOfComp = !!photo.isOutOfCompetition;
    const hasUserRating = photo.userRating && photo.userRating > 0;

    const voteRingClass = hasUserRating && !isReadOnly
        ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-yellow-400/80'
        : '';

    const competitionClass = isOutOfComp
        ? 'saturate-[.8] border-2 border-dashed border-gray-500'
        : `border border-solid border-gray-700/50 ${!isReadOnly ? 'hover:border-indigo-500/50' : ''}`;

    const aspectRatioMap: Record<GridAspectRatio, string> = {
        '1/1': 'aspect-square',
        '4/3': 'aspect-[4/3]',
        '3/2': 'aspect-[3/2]',
    };
    const aspectRatioClass = aspectRatioMap[gridAspectRatio];

    // Note: opacity logic moved from here to allow external control or specific stacking context
    const containerClasses = `group relative overflow-hidden rounded-lg shadow-lg bg-gray-800 transition-all duration-300 ${!isReadOnly ? 'hover:shadow-indigo-500/30' : ''} ${competitionClass} ${voteRingClass} ${layoutMode === 'original' ? 'break-inside-avoid' : ''} ${isHiding ? 'animate-hide' : ''}`;

    const controlsVisibilityClass = isReadOnly
        ? 'opacity-0'
        : (hasUserRating || isGrayscale ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100');

    const visibilityIconClass = [
        'p-1.5 rounded-full bg-black/50 text-white/80 hover:bg-black/70 hover:text-white transition-all duration-300',
        (isFilterActive && !isVisible) || (hasUserRating) ? 'opacity-70 md:opacity-0 group-hover:opacity-100' : 'opacity-70 md:opacity-0 group-hover:opacity-100',
        hasUserRating ? 'disabled:cursor-not-allowed' : '',
    ].join(' ');


    return (
        <div id={`photo-card-${photo.id}`} className={containerClasses} style={{opacity: isDimmed ? 0.5 : 1}}>
            <div onClick={handleCardClick} className={`${!isReadOnly ? 'cursor-pointer' : ''} relative z-[1]`}>
                <img
                    src={photo.url}
                    alt={`Фото ${photo.id}`}
                    className={`w-full h-auto object-cover transition-all duration-300 ${!isReadOnly ? 'group-hover:scale-105' : ''} ${layoutMode === 'grid' ? aspectRatioClass : ''} ${isGrayscale ? 'grayscale group-hover:grayscale-0' : ''}`}
                    loading="lazy"
                />
            </div>

            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none z-[2]" />

            <div className="absolute top-2 left-2 z-[3] flex items-center gap-1.5">
                {!isOutOfComp && !isReadOnly && showVisibilityToggle && !isGrayscale && (
                    <button
                        onClick={(e) => { e.stopPropagation(); onToggleVisibility(photo.id); }}
                        disabled={hasUserRating}
                        className={visibilityIconClass}
                        title={hasUserRating ? "Оцененные фото нельзя скрыть" : (isVisible ? "Скрыть из ленты" : "Показать в ленте")}
                        aria-label="Переключить видимость"
                    >
                        {isVisible && !isHiding ? <Eye className="w-5 h-5" /> : <EyeOff className="w-5 h-5" />}
                    </button>
                )}
            </div>

            {showSelectionControl && <SelectionControl isSelected={isSelected} onSelect={onSelect} />}

            <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-between items-end z-[3]">
                <div className="flex items-center gap-2">
                    {showRatingControls && !isReadOnly && (
                        <div className={`${controlsVisibilityClass} transition-opacity duration-300`} onClick={e => e.stopPropagation()}>
                            <RatingControls
                                photo={photo}
                                onRate={onRate}
                                size="small"
                                disabled={isOutOfComp}
                                variant={isGrayscale ? 'gray' : 'default'}
                            />
                        </div>
                    )}
                    {displayVotes && (
                        <div className={`text-lg font-bold ${getScoreColor(photo.votes)} bg-black/50 backdrop-blur-sm px-2 py-0.5 rounded-md`}>
                            {photo.votes}
                        </div>
                    )}
                </div>

                <div className="relative">
                    {!isReadOnly && !isGrayscale && (
                        <>
                            <button onClick={(e) => { e.stopPropagation(); setIsCaptionVisible(p => !p); }} className="p-1.5 rounded-full bg-black/50 text-white/80 hover:bg-black/70 hover:text-white opacity-70 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300"><Info className="w-5 h-5" /></button>
                            {isCaptionVisible && (
                                <div className="absolute bottom-full right-0 mb-2 w-64 bg-gray-800 border border-gray-600 p-3 rounded-lg shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
                                    <p className="text-sm text-gray-200">{photo.caption}</p>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};