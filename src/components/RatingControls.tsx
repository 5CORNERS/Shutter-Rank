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
    hasCreditVotes?: boolean; // Flag to indicate if global credit queue exists
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
                                                                  ratedPhotoLimit = 1000,
                                                                  hasCreditVotes = false
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

    // Calculate base stats for this photo to determine individual star colors
    const isCredit = !!photo.isCredit;
    const currentRating = photo.userRating || 0;

    // Base stats = Total Valid Stats - This Photo's Valid Contribution
    // If isCredit is true, it contributes 0 to starsUsed.
    // If isCredit is false, it contributes currentRating to starsUsed.
    const baseStarsUsed = starsUsed - (isCredit ? 0 : currentRating);
    const basePhotosCount = ratedPhotosCount - (isCredit ? 0 : 1);

    return (
        <div className="flex items-center flex-shrink-0" onMouseLeave={() => !isTouchDevice && setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = currentRating >= star;
                const isHighlighted = !isTouchDevice && hoverRating >= star;
                const maxRating = photo.maxRating ?? 3;
                const isLocked = star > maxRating;

                let colorClass = 'text-gray-500'; // Default inactive color

                if (variant === 'default') {
                    // Calculate if THIS specific star fits in the limits
                    const projectedStars = baseStarsUsed + star;

                    // For photo count, we just check if the photo itself fits.
                    // If it's the 1st star, it adds +1 to count. If 2nd+, count doesn't change.
                    const projectedCount = basePhotosCount + 1;

                    const isCountFit = projectedCount <= ratedPhotoLimit;
                    const isStarFit = projectedStars <= totalStarsLimit;

                    // Determine color
                    let isBlue = false;

                    if (!isCountFit || !isStarFit) {
                        isBlue = true;
                    }

                    // Special Case: Frozen Budget (Queue Exists)
                    // If there is a queue (hasCreditVotes), new expansions MUST be blue to indicate they go to queue.
                    // Except if this photo is ALREADY part of the queue (isCredit), then we follow standard fit logic (which will likely be blue anyway).
                    if (hasCreditVotes && !isCredit && !isFilled && isHighlighted) {
                        isBlue = true;
                    }

                    if (isFilled) {
                        colorClass = isBlue ? 'text-cyan-400' : 'text-yellow-400';
                    } else if (isHighlighted) {
                        colorClass = isBlue ? 'text-cyan-400' : 'text-yellow-400';
                    }

                    // Locked override
                    if (isHighlighted && isLocked) {
                        colorClass = 'text-red-500';
                    }
                } else {
                    // Gray variant
                    if (isFilled || isHighlighted) {
                        colorClass = 'text-gray-300';
                    }
                }

                const titleText = isLocked
                    ? `Эта фотография еще не заслужила ${star} ${getStarNounGenitive(star)}`
                    : `Оценить в ${star} ${getStarNounAccusative(star)}`;

                const shouldFill = isFilled;

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
                            className={`${starSizeClass} transition-colors ${colorClass} ${isLocked && !isFilled && !isHighlighted ? 'opacity-30' : ''} ${disabled ? 'opacity-50' : ''}`}
                            fill={shouldFill ? 'currentColor' : 'none'}
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