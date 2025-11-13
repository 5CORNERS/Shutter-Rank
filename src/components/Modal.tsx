import React, { useEffect } from 'react';
import { Photo, Config } from '../types';
import { X, ChevronLeft, ChevronRight, Maximize, Star, Flag, Layers, Check } from 'lucide-react';
import { RatingControls } from './RatingControls';

const SelectionControl: React.FC<{isSelected: boolean; onSelect: () => void;}> = ({isSelected, onSelect}) => {
    return (
        <div className="absolute top-4 left-4 z-10 pointer-events-auto" onClick={onSelect} >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-1 ring-inset ring-black/20 transition-all duration-200 cursor-pointer ${isSelected ? 'bg-green-500 border-2 border-white shadow-lg' : 'bg-gray-800/60 backdrop-blur-sm border-2 border-gray-400/80'}`}>
                {isSelected && <Check className="w-5 h-5 text-white" />}
            </div>
        </div>
    )
}

interface ModalProps {
    photo: Photo;
    onClose: () => void;
    displayVotes: boolean;
    onNext: () => void;
    onPrev: () => void;
    onEnterImmersive: () => void;
    onRate: (photoId: number, rating: number) => void;
    onToggleFlag: (photoId: number) => void;
    hasNext: boolean;
    hasPrev: boolean;
    config: Config | null;
    ratedPhotosCount: number;
    starsUsed: number;
    groupInfo: { id: string; name: string } | null;
    onGroupSelectionChange: (groupId: string, photoId: number | null) => void;
    isPhotoInGroupSelected: boolean;
}

export const Modal: React.FC<ModalProps> = ({
                                                photo, onClose, displayVotes, onNext, onPrev, onEnterImmersive,
                                                onRate, onToggleFlag, hasNext, hasPrev, config, ratedPhotosCount,
                                                starsUsed, groupInfo, onGroupSelectionChange, isPhotoInGroupSelected
                                            }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            else if (event.key === 'ArrowRight') onNext();
            else if (event.key === 'ArrowLeft') onPrev();
            else if (event.key.toLowerCase() === 'f' || (event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown'))) {
                event.preventDefault();
                if (!photo.isOutOfCompetition) onToggleFlag(photo.id);
            } else if (!event.ctrlKey && !event.metaKey && /^[0-5]$/.test(event.key)) {
                event.preventDefault();
                if (!photo.isOutOfCompetition) onRate(photo.id, parseInt(event.key, 10));
            }
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = 'auto';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, onNext, onPrev, photo, onRate, onToggleFlag]);

    const getScoreColor = (score: number) => {
        if (score > 0) return 'text-green-400';
        if (score < 0) return 'text-red-400';
        return 'text-gray-400';
    };

    const handleSelect = () => {
        if (groupInfo) {
            const newSelectedId = isPhotoInGroupSelected ? null : photo.id;
            onGroupSelectionChange(groupInfo.id, newSelectedId);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in" onClick={onClose} role="dialog">
            <div className="absolute top-4 right-4 z-[51] flex items-center gap-4">
                {displayVotes && (
                    <div className={`text-lg font-bold ${getScoreColor(photo.votes)} bg-black/50 px-3 py-1 rounded-md`}>
                        Рейтинг: {photo.votes}
                    </div>
                )}
                <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Закрыть"><X className="w-6 h-6" /></button>
            </div>

            {hasPrev && <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 z-[51] p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="w-8 h-8" /></button>}
            {hasNext && <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-4 top-1/2 -translate-y-1/2 z-[51] p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="w-8 h-8" /></button>}

            <div className="relative max-w-5xl w-full max-h-[90vh] bg-gray-900 rounded-lg shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex-grow p-4 overflow-hidden flex items-center justify-center relative group cursor-zoom-in" onClick={onEnterImmersive}>
                    <img src={photo.url} alt={`Фото ${photo.id}`} className="object-contain w-full h-full max-h-[calc(90vh-140px)]" />
                    {groupInfo && <SelectionControl isSelected={isPhotoInGroupSelected} onSelect={handleSelect} />}
                </div>

                <div className="group/controls bg-gradient-to-t from-gray-900 via-gray-800/80 to-gray-800/60 hover:from-black hover:to-gray-900/80 transition-colors duration-300 rounded-b-lg">
                    {groupInfo && (
                        <div className="flex items-center gap-3 text-sm text-gray-400 border-t border-gray-700/50 px-4 py-2" onClick={e => e.stopPropagation()}>
                            <Layers className="w-5 h-5 flex-shrink-0 text-indigo-400" />
                            <span className="truncate">Группа: «{groupInfo.name}»</span>
                        </div>
                    )}
                    <div className={`p-3 text-center text-gray-300 ${groupInfo ? '' : 'border-t border-gray-700/50'}`}>
                        <p>{photo.caption}</p>
                    </div>

                    <div className="p-3 flex flex-wrap justify-between items-center gap-4">
                        <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                            {!photo.isOutOfCompetition && (
                                <button
                                    onClick={() => onToggleFlag(photo.id)}
                                    className="p-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                                    title="Отметить (F)"
                                >
                                    <Flag className="w-6 h-6" fill={photo.isFlagged !== false ? 'currentColor' : 'none'} />
                                </button>
                            )}
                            <RatingControls photo={photo} onRate={onRate} size="large" disabled={!!photo.isOutOfCompetition} />
                        </div>
                        <div className="text-xs sm:text-sm text-gray-300 font-mono flex items-center gap-x-2 sm:gap-x-3 flex-shrink-0">
                            <span className="text-gray-400">Фото №{photo.id}</span>
                            <div className="w-px h-4 bg-gray-600"></div>
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