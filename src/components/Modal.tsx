import React, { useEffect, useState, useRef, useCallback, useLayoutEffect } from 'react';
import { Photo, Config } from '../types';
import { X, ChevronLeft, ChevronRight, Star, Eye, EyeOff, Layers, Check, BarChart2, Users } from 'lucide-react';
import { RatingControls } from './RatingControls';

const SelectionControl: React.FC<{isSelected: boolean; onSelect: () => void;}> = ({isSelected, onSelect}) => {
    return (
        <div className="absolute top-4 right-4 z-10 pointer-events-auto" onClick={(e) => { e.stopPropagation(); onSelect(); }} >
            <div className={`selection-control-bg w-8 h-8 rounded-full flex items-center justify-center ring-1 ring-inset ring-white/20 transition-all duration-300 border-2 shadow-lg cursor-pointer ${isSelected ? 'bg-green-500 border-white selected' : 'bg-gray-800/60 backdrop-blur-sm border-white/80'}`}>
                <Check className="w-5 h-5 text-white selection-control-check" />
            </div>
        </div>
    )
}

interface ModalProps {
  photo: Photo;
  allPhotosInGroup: Photo[];
  onClose: () => void;
  displayVotes: boolean;
  onNext: () => void;
  onPrev: () => void;
  onEnterImmersive: () => void;
  onRate: (photoId: number, rating: number) => void;
  onToggleVisibility: (photoId: number) => void;
  hasNext: boolean;
  hasPrev: boolean;
  config: Config | null;
  ratedPhotosCount: number;
  starsUsed: number;
  groupInfo: { id: string; name: string; caption?: string; photos: Photo[] } | null;
  groupSelections: Record<string, number | null>;
  onGroupSelectionChange: (groupId: string, photoId: number | null) => void;
  onOpenGroup: (groupId: string) => void;
}

export const Modal: React.FC<ModalProps> = ({
    photo, allPhotosInGroup, onClose, displayVotes, onNext, onPrev, onEnterImmersive,
    onRate, onToggleVisibility, hasNext, hasPrev, config, ratedPhotosCount,
    starsUsed, groupInfo, groupSelections, onGroupSelectionChange, onOpenGroup
}) => {
  const imgRef = useRef<HTMLImageElement>(null);
  const [controlsContainerStyle, setControlsContainerStyle] = useState<React.CSSProperties>({});
  
  const currentGroupSelection = groupInfo ? groupSelections[groupInfo.id] : undefined;
  const isPhotoInGroupSelected = currentGroupSelection === photo.id;
  // Fix: Check strictly if a selection exists (is a number) to avoid 'undefined !== null' evaluating to true
  const isAnotherPhotoInGroupSelected = groupInfo ? (currentGroupSelection != null && currentGroupSelection !== photo.id) : false;
  
  const photoIndexInGroup = groupInfo ? allPhotosInGroup.findIndex(p => p.id === photo.id) + 1 : 0;

  const calculateControlsPosition = useCallback(() => {
    const img = imgRef.current;
    const parent = img?.parentElement;
    if (!img || !parent || !img.complete || img.naturalWidth === 0) return;

    const parentRect = parent.getBoundingClientRect();
    const imgRect = img.getBoundingClientRect();

    const top = imgRect.top - parentRect.top;
    const left = imgRect.left - parentRect.left;
    
    setControlsContainerStyle({
        position: 'absolute',
        top: `${top}px`,
        left: `${left}px`,
        width: `${imgRect.width}px`,
        height: `${imgRect.height}px`,
    });
  }, []);

  useLayoutEffect(() => {
      calculateControlsPosition();
  }, [photo, calculateControlsPosition]);

  useEffect(() => {
      const handleResize = () => calculateControlsPosition();
      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
  }, [calculateControlsPosition]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
      else if (event.key === 'ArrowRight') onNext();
      else if (event.key === 'ArrowLeft') onPrev();
      else if (event.key.toLowerCase() === 'h' || (event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown'))) {
          event.preventDefault();
          if (!photo.isOutOfCompetition) onToggleVisibility(photo.id);
      } else if (!event.ctrlKey && !event.metaKey && /^[0-5]$/.test(event.key)) {
          event.preventDefault();
          if (!photo.isOutOfCompetition) onRate(photo.id, parseInt(event.key, 10));
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose, onNext, onPrev, photo, onRate, onToggleVisibility]);

  const handleSelect = () => {
      if (groupInfo) {
          const newSelectedId = isPhotoInGroupSelected ? null : photo.id;
          onGroupSelectionChange(groupInfo.id, newSelectedId);
      }
  };

  const captionToShow = groupInfo?.caption ? groupInfo.caption : photo.caption;
  const hasUserRating = photo.userRating && photo.userRating > 0;

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in" onClick={() => onClose()} role="dialog">
      <div className="absolute top-12 right-4 z-[51] flex items-center gap-4">
        {displayVotes && (
            <div className="flex gap-4 bg-black/60 backdrop-blur-sm px-4 py-2 rounded-lg border border-gray-700/50">
                <div className="flex items-center gap-2" title="Сумма звезд">
                    <Star className="text-yellow-400 w-4 h-4" fill="currentColor" />
                    <span className="font-bold text-yellow-400">{photo.votes}</span>
                </div>
                <div className="w-px h-5 bg-gray-600/50"></div>
                <div className="flex items-center gap-2" title="Нормированный балл">
                    <BarChart2 className="text-green-400 w-4 h-4" />
                    <span className="font-bold text-green-400">{(photo.normalizedScore || 0).toFixed(2)}</span>
                </div>
                 <div className="w-px h-5 bg-gray-600/50"></div>
                <div className="flex items-center gap-2" title="Количество проголосовавших">
                    <Users className="text-blue-400 w-4 h-4" />
                    <span className="font-bold text-blue-400">{photo.voteCount || 0}</span>
                </div>
            </div>
        )}
        <button onClick={() => onClose()} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Закрыть"><X className="w-6 h-6" /></button>
      </div>
      
      {hasPrev && <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 z-[51] p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="w-8 h-8" /></button>}
      {hasNext && <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-4 top-1/2 -translate-y-1/2 z-[51] p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="w-8 h-8" /></button>}

      <div className="relative max-w-5xl w-full max-h-[90vh] bg-gray-900 rounded-lg shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex-grow p-4 overflow-hidden flex items-center justify-center relative group cursor-pointer" onClick={onEnterImmersive}>
          <img ref={imgRef} src={photo.url} alt={`Фото ${photo.id}`} className="object-contain w-full h-full max-h-[calc(90vh-140px)]" onLoad={calculateControlsPosition}/>
          <div style={controlsContainerStyle} className="absolute pointer-events-none z-20">
            {groupInfo && <div className={`smart-frame ${isPhotoInGroupSelected ? 'selected' : 'in-group'}`} />}
            {isAnotherPhotoInGroupSelected && <div className="vignette-overlay"/>}

            {!photo.isOutOfCompetition && (
                <button
                    onClick={(e) => { e.stopPropagation(); onToggleVisibility(photo.id); }}
                    disabled={hasUserRating}
                    className="absolute top-4 left-4 p-2 rounded-full bg-gray-800/60 backdrop-blur-sm text-white hover:bg-gray-700 transition-colors pointer-events-auto disabled:opacity-50 disabled:cursor-not-allowed"
                    title={hasUserRating ? "Оцененные фото нельзя скрыть" : "Скрыть/показать (H)"}
                >
                    {photo.isVisible !== false ? <Eye className="w-6 h-6" /> : <EyeOff className="w-6 h-6" />}
                </button>
            )}
            {groupInfo && (
                <>
                    <SelectionControl isSelected={isPhotoInGroupSelected} onSelect={handleSelect} />
                    <div className="absolute top-4 left-1/2 -translate-x-1/2 p-2 rounded-full bg-gray-800/60 backdrop-blur-sm text-white pointer-events-auto flex items-center gap-2">
                        <Layers size={20} />
                        <span className="font-bold text-sm pr-1">{photoIndexInGroup}/{groupInfo.photos.length}</span>
                    </div>
                </>
            )}
          </div>
        </div>
        
        <div className="bg-gradient-to-t from-black/90 via-black/80 to-transparent rounded-b-lg">
            {groupInfo && (
                <div className="flex items-center justify-center gap-3 text-sm text-gray-400 border-t border-gray-700/50 px-4 py-2" onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-3 truncate">
                        <Layers className="w-5 h-5 flex-shrink-0 text-indigo-400" />
                        <span className="truncate">Фото из группы: «{groupInfo.name}»</span>
                        <button onClick={() => onOpenGroup(groupInfo.id)} className="ml-2 text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                            Перейти в группу
                        </button>
                    </div>
                </div>
            )}
            <div className={`p-3 text-center text-gray-300 ${groupInfo ? '' : 'border-t border-gray-700/50'}`}>
              <p>{captionToShow}</p>
            </div>
            
            <div className="p-3 flex flex-wrap justify-between items-center gap-4">
                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                    <RatingControls photo={photo} onRate={onRate} size="large" disabled={!!photo.isOutOfCompetition} resetButtonMode="always" />
                </div>
                <div className="text-xs sm:text-sm text-gray-300 font-mono flex items-center gap-x-2 sm:gap-x-3 flex-shrink-0">
                    <div className="flex items-center gap-x-1" title="Оценено фотографий">
                        <span className="font-semibold text-green-400">{ratedPhotosCount}</span>
                        <span className="text-gray-500">/{config?.ratedPhotoLimit}</span>
                    </div>
                    <div className="w-px h-4 bg-gray-600"></div>
                    <div className="flex items-center gap-x-1" title="Израсходовано звёзд">
                        <Star size={14} className="text-yellow-400" />
                        <span className="font-semibold text-yellow-400">{starsUsed}</span>
                        <span className="text-gray-500">/{config?.totalStarsLimit}</span>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};
