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
    // Limits
    starsUsed?: number;
    totalStarsLimit?: number;
    ratedPhotosCount?: number;
    ratedPhotoLimit?: number;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({
                                                        photo, onRate, onImageClick, onToggleVisibility, displayVotes, layoutMode,
                                                        gridAspectRatio, showRatingControls = true, isDimmed = false, isReadOnly = false, isHiding = false,
                                                        showVisibilityToggle = true, showSelectionControl = false, isSelected = false, onSelect = () => {},
                                                        isFilterActive = false, isGrayscale = false,
                                                        starsUsed = 0, totalStarsLimit = 1000, ratedPhotosCount = 0, ratedPhotoLimit = 1000
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
    const isCredit = !!photo.isCredit;

    // --- Determine Limit States for styling (Ring & Shadow) ---
    let voteRingClass = '';
    let shadowClass = !isReadOnly ? 'hover:shadow-indigo-500/30' : ''; // Default shadow

    if (hasUserRating && !isReadOnly && !displayVotes) {
        const currentRating = photo.userRating || 0;
        // Calculate "Base" stats (as if this photo wasn't rated yet)
        // If photo is CREDIT, it's not in valid stats, so base = current valid stats.
        // If photo is VALID, we remove it to find base.
        const shouldRefund = !isCredit && currentRating > 0;

        const basePhotosCount = ratedPhotosCount - (shouldRefund ? 1 : 0);
        const baseStarsUsed = starsUsed - (shouldRefund ? currentRating : 0);

        // Check projected usage
        const isCountOverflow = basePhotosCount + 1 > ratedPhotoLimit;
        const isStarOverflow = baseStarsUsed + currentRating > totalStarsLimit;

        if (isCountOverflow && isStarOverflow) {
            // Double Credit -> Bordeaux (Rose-600/700)
            voteRingClass = 'ring-2 ring-offset-2 ring-offset-gray-900 ring-rose-700';
            shadowClass = 'hover:shadow-rose-600/60 hover:shadow-xl';
        } else if (isCountOverflow) {
            // Count Credit Only -> Orange
            voteRingClass = 'ring-2 ring-offset-2 ring-offset-gray-900 ring-orange-500';
            shadowClass = 'hover:shadow-orange-500/60 hover:shadow-xl';
        } else if (isStarOverflow) {
            // Star Credit Only -> Cyan (Blue)
            voteRingClass = 'ring-2 ring-offset-2 ring-offset-gray-900 ring-cyan-400/80';
            shadowClass = 'hover:shadow-cyan-500/60 hover:shadow-xl';
        } else {
            // Normal -> Yellow
            voteRingClass = 'ring-2 ring-offset-2 ring-offset-gray-900 ring-yellow-400/80';
            shadowClass = 'hover:shadow-indigo-500/60 hover:shadow-xl';
        }
    }

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
    const containerClasses = `group relative overflow-hidden rounded-lg shadow-lg bg-gray-800 transition-all duration-300 ${shadowClass} ${competitionClass} ${voteRingClass} ${layoutMode === 'original' ? 'break-inside-avoid' : ''} ${isHiding ? 'animate-hide' : ''}`;

    const controlsVisibilityClass = isReadOnly
        ? 'opacity-0'
        : (hasUserRating || isGrayscale ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100');

    // Distinct visual style for disabled eye (rated photo) vs enabled eye
    const visibilityIconClass = `p-1.5 rounded-full transition-all duration-300 ${
        hasUserRating
            ? 'bg-black/20 text-white/30 cursor-not-allowed' // Disabled state: faint, no hover
            : 'bg-black/50 text-white/80 hover:bg-black/70 hover:text-white cursor-pointer' // Active state
    } ${
        // Visibility logic: Always show if hidden (to unhide), rated (to show locked state), or on stack cover (grayscale)
        (isFilterActive && !isVisible) || hasUserRating || isGrayscale
            ? 'opacity-100'
            : 'opacity-70 md:opacity-0 group-hover:opacity-100'
    }`;


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
                {!isOutOfComp && !isReadOnly && showVisibilityToggle && (
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
                                starsUsed={starsUsed}
                                totalStarsLimit={totalStarsLimit}
                                ratedPhotosCount={ratedPhotosCount}
                                ratedPhotoLimit={ratedPhotoLimit}
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