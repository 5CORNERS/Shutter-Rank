
import React, { useState } from 'react';
import { Photo, LayoutMode, GridAspectRatio } from '../types';
import { Info, Eye, EyeOff, Check, Star, BarChart2, Users } from 'lucide-react';
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
        if (isReadOnly && !displayVotes) return;
        // Allow click in readOnly if it's results view (displayVotes=true) so we can open modal

        if (isCaptionVisible) {
            e.stopPropagation();
            setIsCaptionVisible(false);
            return;
        }
        onImageClick(photo);
    };

    const isVisible = photo.isVisible !== false;
    const isOutOfComp = !!photo.isOutOfCompetition;
    const hasUserRating = photo.userRating && photo.userRating > 0;

    const voteRingClass = hasUserRating && !isReadOnly && !displayVotes
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

    // Adjust shadow intensity based on whether there is a ring (hasUserRating) to ensure glow is visible
    // Increased intensity to /60 and spread to xl when rated to punch through the ring visual noise
    const shadowClass = !isReadOnly
        ? (hasUserRating ? 'hover:shadow-indigo-500/60 hover:shadow-xl' : 'hover:shadow-indigo-500/30')
        : '';

    // Note: opacity logic moved from here to allow external control or specific stacking context
    const containerClasses = `group relative overflow-hidden rounded-lg shadow-lg bg-gray-800 transition-all duration-300 ${shadowClass} ${competitionClass} ${voteRingClass} ${layoutMode === 'original' ? 'break-inside-avoid' : ''} ${isHiding ? 'animate-hide' : ''}`;

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
            <div onClick={handleCardClick} className={`${!isReadOnly || displayVotes ? 'cursor-pointer' : ''} relative z-[1]`}>
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
                <div className="flex items-center gap-2 w-full">
                    {showRatingControls && !isReadOnly && !displayVotes && (
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

                    {/* RESULTS VIEW MODE */}
                    {displayVotes && (
                        <div className="flex flex-col w-full bg-black/60 backdrop-blur-sm rounded-md p-1.5 gap-1">
                            <div className="flex justify-between items-center text-xs text-gray-400 border-b border-gray-600/50 pb-1 mb-1">
                                <span>Результаты</span>
                                <span className="font-mono opacity-50">#{photo.id}</span>
                            </div>
                            <div className="flex justify-between items-center gap-2">
                                <div className="flex flex-col items-center flex-1">
                                    <span className="text-[10px] text-gray-400 uppercase">Звезды</span>
                                    <div className="flex items-center gap-1 text-yellow-400 font-bold">
                                        <Star size={12} fill="currentColor"/>
                                        <span>{photo.votes}</span>
                                    </div>
                                </div>
                                <div className="w-px h-6 bg-gray-600/50"></div>
                                <div className="flex flex-col items-center flex-1">
                                    <span className="text-[10px] text-gray-400 uppercase">Баллы</span>
                                    <div className="flex items-center gap-1 text-green-400 font-bold">
                                        <BarChart2 size={12}/>
                                        <span>{(photo.normalizedScore || 0).toFixed(2)}</span>
                                    </div>
                                </div>
                                <div className="w-px h-6 bg-gray-600/50"></div>
                                <div className="flex flex-col items-center flex-1">
                                    <span className="text-[10px] text-gray-400 uppercase">Голоса</span>
                                    <div className="flex items-center gap-1 text-blue-400 font-bold">
                                        <Users size={12}/>
                                        <span>{photo.voteCount || 0}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                <div className="relative">
                    {!isReadOnly && !isGrayscale && !displayVotes && (
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
