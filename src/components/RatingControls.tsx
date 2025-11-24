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

    // CORE LOGIC: Determine "Base" stats (Valid Stats Only)
    const isCredit = !!photo.isCredit;
    const currentPhotoRating = photo.userRating || 0;

    // If photo is VALID, its rating is already in 'starsUsed'. Remove it to find the "gap".
    // If photo is CREDIT, 'starsUsed' doesn't contain it. Base is just 'starsUsed'.
    const baseStarsUsed = starsUsed - (isCredit ? 0 : currentPhotoRating);

    return (
        <div className="flex items-center flex-shrink-0" onMouseLeave={() => !isTouchDevice && setHoverRating(0)}>
            {[1, 2, 3, 4, 5].map((star) => {
                const isFilled = (photo.userRating || 0) >= star;
                const isHighlighted = !isTouchDevice && hoverRating >= star;
                const maxRating = photo.maxRating ?? 3;
                const isLocked = star > maxRating;

                let colorClass = 'text-gray-500'; // Default inactive color

                if (variant === 'default') {
                    // --- Color Logic ---

                    if (isFilled) {
                        // PERSISTENT STATE
                        // Simple rule: If it's stored as Credit, it's Cyan.
                        // If it's stored as Valid (Firebase), it's Yellow.
                        // But wait! The user wants "Hybrid" look if possible (3 Yellow, 1 Blue).
                        // Since our data model is binary (Whole photo is Credit OR Whole photo is Valid),
                        // we can simulate the hybrid look by checking the limits against the *valid* budget.

                        if (isCredit) {
                            // It is a credit vote. Check if this specific star would fit in the valid budget gap.
                            const projectedTotalStarsAtThisLevel = baseStarsUsed + star;
                            if (projectedTotalStarsAtThisLevel > totalStarsLimit) {
                                colorClass = 'text-cyan-400'; // Truly overflow
                            } else {
                                colorClass = 'text-yellow-400'; // Fits in gap (Simulated valid)
                            }
                        } else {
                            // It is a valid vote. Always Yellow.
                            colorClass = 'text-yellow-400';
                        }

                    } else if (isHighlighted) {
                        // HOVER STATE
                        // Predict what would happen if we clicked here.
                        const projectedTotalStarsAtThisLevel = baseStarsUsed + star;
                        if (projectedTotalStarsAtThisLevel > totalStarsLimit) {
                            colorClass = 'text-cyan-400';
                        } else {
                            colorClass = 'text-yellow-400';
                        }
                    }

                    // Override for Locked state on hover
                    if (isHighlighted && isLocked) {
                        colorClass = 'text-red-500';
                    }
                } else {
                    // --- Gray Variant Logic (e.g. Stack Cover) ---
                    if (isFilled || isHighlighted) {
                        colorClass = 'text-gray-300';
                    }
                }

                const titleText = isLocked
                    ? `Эта фотография еще не заслужила ${star} ${getStarNounGenitive(star)}`
                    : `Оценить в ${star} ${getStarNounAccusative(star)}`;

                // Fill Logic:
                // - If isFilled: fill with currentColor.
                // - If isHighlighted (Hover) but NOT isFilled: fill="none" (Outline only).
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