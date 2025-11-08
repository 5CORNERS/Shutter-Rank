import React, { useState } from 'react';
import { Photo } from '../types';
import { Star, XCircle } from 'lucide-react';

interface RatingControlsProps {
  photo: Photo;
  onRate: (photoId: number, rating: number) => void;
  size?: 'small' | 'large';
  disabled?: boolean;
}

export const RatingControls: React.FC<RatingControlsProps> = ({ photo, onRate, size = 'large', disabled = false }) => {
  const [hoverRating, setHoverRating] = useState(0);
  const isTouchDevice = 'ontouchstart' in window;

  if (disabled) {
    return null;
  }

  const handleRate = (rating: number) => {
    const newRating = photo.userRating === rating ? 0 : rating;
    onRate(photo.id, newRating);
  };
  
  const starSizeClass = size === 'large' ? 'w-7 h-7' : 'w-6 h-6';
  const xCircleSizeClass = size === 'large' ? 'w-6 h-6' : 'w-5 h-5';
  const buttonPadding = size === 'large' ? 'p-2' : 'p-1.5';

  return (
    <div className="flex items-center flex-shrink-0" onMouseLeave={() => !isTouchDevice && setHoverRating(0)}>
      {[1, 2, 3, 4, 5].map((star) => {
        const isFilled = (photo.userRating || 0) >= star;
        const isHighlighted = !isTouchDevice && hoverRating >= star;
        return (
          <button
            key={star}
            onClick={() => handleRate(star)}
            onMouseEnter={() => !isTouchDevice && setHoverRating(star)}
            className={`${buttonPadding} rounded-full transition-all transform hover:scale-125`}
            aria-label={`Оценить в ${star} звезд`}
          >
            <Star
              className={`${starSizeClass} transition-colors ${isHighlighted || isFilled ? 'text-yellow-400' : 'text-gray-500'}`}
              fill={isFilled ? 'currentColor' : 'none'}
              strokeWidth={isHighlighted && !isFilled ? 2 : 1.5}
            />
          </button>
        );
      })}
       {(photo.userRating || 0) > 0 && (
         <div className='flex items-center justify-center transition-opacity' style={{ width: size === 'large' ? '44px': '38px', height: size === 'large' ? '44px' : '38px' }}>
            <button
            onClick={() => onRate(photo.id, 0)}
            className={`${buttonPadding} rounded-full text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-all transform hover:scale-125`}
            aria-label="Сбросить оценку"
            >
            <XCircle className={xCircleSizeClass} />
            </button>
        </div>
       )}
    </div>
  );
};