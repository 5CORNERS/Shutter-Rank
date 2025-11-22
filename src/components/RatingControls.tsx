import React, { useState } from 'react';
import { Photo } from '../types';
import { Star, XCircle } from 'lucide-react';

interface RatingControlsProps {
  photo: Photo;
  onRate: (photoId: number, rating: number) => void;
  size?: 'small' | 'large';
  disabled?: boolean;
  resetButtonMode?: 'always' | 'on-hover-desktop';
  variant?: 'default' | 'gray'; // New prop for styling
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
    variant = 'default'
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

  // Colors based on variant
  const filledColor = variant === 'default' ? 'text-yellow-400' : 'text-gray-400';
  const hoverColor = variant === 'default' ? 'text-yellow-400' : 'text-gray-500';
  const lockedColor = 'text-red-500';

  return (
    <div className="flex items-center flex-shrink-0" onMouseLeave={() => !isTouchDevice && setHoverRating(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = (photo.userRating || 0) >= star;
        const isHighlighted = !isTouchDevice && hoverRating >= star;
        const maxRating = photo.maxRating ?? 3;
        const isLocked = star > maxRating;

        let starColor = 'text-gray-500';
        
        if (isFilled) {
            starColor = filledColor;
        } else if (isHighlighted) {
            starColor = isLocked ? lockedColor : hoverColor;
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
              fill={isFilled && variant === 'default' ? 'currentColor' : 'none'} // Don't fill in gray mode usually, or fill with gray
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