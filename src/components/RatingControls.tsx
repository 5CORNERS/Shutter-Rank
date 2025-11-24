import React, { useState } from 'react';
import { Photo } from '../types';
import { Star, XCircle } from 'lucide-react';

interface RatingControlsProps {
    photo: Photo;
    onRate: (photoId: number, rating: number) => void;
    size?: 'small' | 'large';
    disabled?: boolean;
    resetButtonMode?: 'always' | 'on-hover-desktop';
    variant?: 'default' | 'gray';
    // New props for limit checking
    starsUsed?: number;
    totalStarsLimit?: number;
    ratedPhotosCount?: number;
    ratedPhotoLimit?: number;
}

const getStarNounAccusative = (count: number): string => {
    if (count === 1) {
        return 'звезду';
    }
    if (count >= 2 && count <= 4) {
        return 'звезды';
    }
    return 'звёзд';
};

const getStarNounGenitive = (count: number): string => {
    if (count >= 2 && count <= 4) {
        return 'звезды';
    }
    return 'звёзд';
}


export const RatingControls: React.FC<RatingControlsProps> = ({
                                                                  photo,
                                                                  onRate,
                                                                  size = 'large',
                                                                  disabled = false,
                                                                  resetButtonMode = 'on-hover-desktop',
                                                                  variant = 'default',
                                                                  starsUsed = 0,
                                                                  totalStarsLimit = 1000,
                                                                  ratedPhotosCount = 0,
                                                                  ratedPhotoLimit = 1000
                                                              }) => {
    const [hoverRating, setHoverRating] = useState(0);
    const isTouchDevice = 'ontouchstart' in window;

    const handleRate = (rating: number) => {
        onRate(photo.id, rating);
    };

    const starSizeClass = size === 'large' ? 'w-7 h-7' : 'w-6 h-6';
    const xCircleSizeClass = size === 'large' ? 'w-6 h-6' : 'w-5 h-5';
    const buttonPadding = size === 'large' ? 'p-2' : 'p-1.5';
    const hasRating = (photo.userRating || 0) > 0;

    const resetButtonVisibilityClass = resetButtonMode === 'on-hover-desktop'
        ? 'sm:opacity-0 sm:group-hover:opacity-100'
        : '';

    // CORE LOGIC FIX:
    const isCredit = !!photo.isCredit;
    const currentPhotoRating = photo.userRating || 0;

    // If the photo is VALID (not credit) and has a rating, its stars are currently counted in 'starsUsed'.
    // We need to subtract them to find the "baseline" available budget before this photo was rated.
    // BUT if the photo is CREDIT, its stars are NOT in 'starsUsed' (valid stats). So we shouldn't subtract anything.
    const shouldRefund = !isCredit && currentPhotoRating > 0;

    const baseStarsUsed = starsUsed - (shouldRefund ? currentPhotoRating : 0);
    const basePhotosCount = ratedPhotosCount - (shouldRefund ? 1 : 0);

    return (
        <div className="flex items-center flex-shrink-0" onMouseLeave={() => !isTouchDevice && setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (photo.userRating || 0) >= star;
                const isHighlighted = !isTouchDevice && hoverRating >= star;
                const maxRating = photo.maxRating ?? 3;
                const isLocked = star > maxRating;

                // --- Logic for Credit Color (Blue) ---
                let isCreditStar = false;

                // Only calculate color if we are actually displaying a "filled" or "highlighted" state for this star
                if (isFilled || isHighlighted) {
                    // 1. Photo Count Check
                    // Does adding this photo (if it wasn't already a VALID rated photo) exceed the count limit?
                    // If it was already valid (shouldRefund=true), adding it back doesn't increase count from baseline.
                    // If it was new or credit, adding it increases count by 1.
                    const projectedCount = basePhotosCount + 1;
                    const countExceeded = projectedCount > ratedPhotoLimit;

                    if (countExceeded) {
                        // If we are out of photo slots, ALL stars for this photo are credit
                        isCreditStar = true;
                    } else {
                        // 2. Star Limit Check
                        // We check if the CUMULATIVE stars up to THIS star fit in the budget.
                        // e.g. Base 23. Star 1 (24) fits. Star 2 (25) fits. Star 3 (26) -> Credit.
                        const projectedTotalStarsAtThisLevel = baseStarsUsed + star;

                        if (projectedTotalStarsAtThisLevel > totalStarsLimit) {
                            isCreditStar = true;
                        }
                    }
                }

                let starColor = 'text-gray-500';

                if (isFilled) {
                    starColor = isCreditStar ? 'text-cyan-400' : (variant === 'default' ? 'text-yellow-400' : 'text-gray-400');
                } else if (isHighlighted) {
                    if (isLocked) {
                        starColor = 'text-red-500';
                    } else {
                        starColor = isCreditStar ? 'text-cyan-400' : (variant === 'default' ? 'text-yellow-400' : 'text-gray-500');
                    }
                }

                const titleText = isLocked
                    ? `Эта фотография еще не заслужила ${star} ${getStarNounGenitive(star)}`
                    : `Оценить в ${star} ${getStarNounAccusative(star)}`;

                return (
                    <button
                        key={star}
                        onClick={(e) => { e.stopPropagation(); !disabled && handleRate(star); }}
                        onMouseEnter={() => !isTouchDevice && setHoverRating(star)}
                        disabled={disabled}
                        className={`${buttonPadding} rounded-full transition-all transform hover:scale-125 disabled:cursor-not-allowed disabled:transform-none`}
                        aria-label={`Оценить в ${star} ${getStarNounAccusative(star)}`}
                        title={titleText}
                    >
                        <Star
                            className={`${starSizeClass} transition-colors ${starColor} ${isLocked && !isFilled && !isHighlighted ? 'opacity-30' : ''} ${disabled ? 'opacity-50' : ''}`}
                            fill={isFilled && (variant === 'default' || isCreditStar) ? 'currentColor' : 'none'}
                            strokeWidth={isHighlighted && !isFilled ? 2 : 1.5}
                        />
                    </button>
                );
            })}
            <div className={`flex items-center justify-center`} style={{ width: size === 'large' ? '44px': '38px', height: size === 'large' ? '44px' : '38px' }}>
                {hasRating && (
                    <button
                        onClick={(e) => { e.stopPropagation(); !disabled && onRate(photo.id, 0); }}
                        disabled={disabled}
                        className={`${buttonPadding} rounded-full text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-all transform hover:scale-125 disabled:cursor-not-allowed disabled:transform-none ${resetButtonVisibilityClass}`}
                        aria-label="Сбросить оценку"
                    >
                        <XCircle className={`${xCircleSizeClass} ${disabled ? 'opacity-50' : ''}`} />
                    </button>
                )}
            </div>
        </div>
    );
};