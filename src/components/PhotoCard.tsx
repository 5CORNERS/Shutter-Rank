import React, { useState, useEffect } from 'react';
import { Photo, LayoutMode, GridAspectRatio } from '../types';
import { Info, Flag } from 'lucide-react';
import { RatingControls } from './RatingControls';

interface PhotoCardProps {
  photo: Photo;
  onRate: (photoId: number, rating: number) => void;
  onImageClick: (photo: Photo) => void;
  onToggleFlag: (photoId: number) => void;
  displayVotes: boolean;
  layoutMode: LayoutMode;
  gridAspectRatio: GridAspectRatio;
}

export const PhotoCard: React.FC<PhotoCardProps> = ({ photo, onRate, onImageClick, onToggleFlag, displayVotes, layoutMode, gridAspectRatio }) => {
  const [isCaptionVisible, setIsCaptionVisible] = useState(false);

  useEffect(() => {
    if (!isCaptionVisible) return;
    const handleClickOutside = () => setIsCaptionVisible(false);
    const timerId = setTimeout(() => { window.addEventListener('click', handleClickOutside); }, 0);
    return () => {
        clearTimeout(timerId);
        window.removeEventListener('click', handleClickOutside);
    };
  }, [isCaptionVisible]);

  const getScoreColor = (score: number) => {
    if (score > 0) return 'text-green-400';
    if (score < 0) return 'text-red-400';
    return 'text-gray-400';
  };

  const isFlagged = photo.isFlagged !== false;
  const isOutOfComp = !!photo.isOutOfCompetition;
  const hasUserRating = photo.userRating && photo.userRating > 0;

  const voteRingClass = hasUserRating
    ? 'ring-2 ring-offset-2 ring-offset-gray-900 ring-yellow-400/80'
    : '';
  
  const competitionClass = isOutOfComp ? 'saturate-[.8] border-dashed border-gray-600' : 'border-gray-700/50 hover:border-indigo-500/50';

  const aspectRatioMap: Record<GridAspectRatio, string> = {
    '1/1': 'aspect-square',
    '4/3': 'aspect-[4/3]',
    '3/2': 'aspect-[3/2]',
  };
  const aspectRatioClass = aspectRatioMap[gridAspectRatio];

  const containerClasses = `group relative overflow-hidden rounded-lg shadow-lg bg-gray-800 border transition-all duration-300 hover:shadow-indigo-500/30 ${competitionClass} ${voteRingClass} ${layoutMode === 'original' ? 'break-inside-avoid' : ''}`;

  const controlsVisibilityClass = hasUserRating 
      ? 'opacity-100' 
      : 'opacity-100 sm:opacity-0 sm:group-hover:opacity-100';


  return (
    <div id={`photo-card-${photo.id}`} className={containerClasses}>
      <img
        src={photo.url}
        alt={`Фото ${photo.id}`}
        className={`w-full h-auto object-cover transition-transform duration-300 group-hover:scale-105 cursor-pointer ${layoutMode === 'grid' ? aspectRatioClass : ''}`}
        loading="lazy"
        onClick={() => onImageClick(photo)}
      />

      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none" />
      
      <div className="absolute top-2 right-2 z-30 opacity-70 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <button onClick={(e) => { e.stopPropagation(); setIsCaptionVisible(p => !p); }} className="p-1.5 rounded-full bg-black/50 text-white/80 hover:bg-black/70 hover:text-white"><Info className="w-5 h-5" /></button>
        {isCaptionVisible && (
            <div className="absolute top-full right-0 mt-2 w-64 bg-gray-800 border border-gray-600 p-3 rounded-lg shadow-xl animate-fade-in" onClick={(e) => e.stopPropagation()}>
              <p className="text-sm text-gray-200">{photo.caption}</p>
            </div>
        )}
      </div>

      <div className="absolute bottom-0 left-0 right-0 p-2 flex justify-between items-center">
        <div className={`${controlsVisibilityClass} transition-opacity duration-300`} onClick={e => e.stopPropagation()}>
           <RatingControls photo={photo} onRate={onRate} size="small" disabled={isOutOfComp} />
        </div>
        {displayVotes && (
            <div className={`text-lg font-bold ${getScoreColor(photo.votes)} bg-black/50 backdrop-blur-sm px-3 py-1 rounded-md animate-fade-in`}>
              {photo.votes}
            </div>
        )}
      </div>

       <div className="absolute top-2 left-2 z-30 flex items-center gap-1.5 opacity-70 md:opacity-0 group-hover:opacity-100 transition-opacity duration-300">
        <div className="bg-black/50 text-white text-xs font-mono px-2 py-1 rounded pointer-events-none">
          {photo.id}
        </div>
        {!isOutOfComp && (
          <button
            onClick={(e) => { e.stopPropagation(); onToggleFlag(photo.id); }}
            className="p-1 rounded-full bg-black/50 text-white/80 hover:bg-black/70 hover:text-white"
            title={isFlagged ? "Снять отметку" : "Отметить"}
            aria-label="Отметить фото"
          >
            <Flag className="w-4 h-4" fill={isFlagged ? 'currentColor' : 'none'} />
          </button>
        )}
      </div>
    </div>
  );
};