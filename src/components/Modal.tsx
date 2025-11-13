import React, { useEffect } from 'react';
import { Photo, Config } from '../types';
import { X, ChevronLeft, ChevronRight, Star, Flag, Layers, Check } from 'lucide-react';
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
    onClose: (openedFromGroupId?: string | null) => void;
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
    openedFromGroupId: string | null;
}

export const Modal: React.FC<ModalProps> = ({
                                                photo, onClose, displayVotes, onNext, onPrev, onEnterImmersive,
                                                onRate, onToggleFlag, hasNext, hasPrev, config, ratedPhotosCount,
                                                starsUsed, groupInfo, onGroupSelectionChange, isPhotoInGroupSelected, openedFromGroupId
                                            }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose(openedFromGroupId);
            else if (event.key === 'ArrowRight') onNext();
            else if (event.key === 'ArrowLeft') onPrev();
            else if (event.key.toLowerCase() === 'f' || (event.ctrlKey && (event.key === 'ArrowUp' || event.key === 'ArrowDown'))) {
                event.preventDefault();
                if (!photo.isOutOfCompetition) onToggleFlag(photo.id);
            } else if (!groupInfo && !event.ctrlKey && !event.metaKey && /^[0-5]$/.test(event.key)) {
                event.preventDefault();
                if (!photo.isOutOfCompetition) onRate(photo.id, parseInt(event.key, 10));
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, onNext, onPrev, photo, onRate, onToggleFlag, openedFromGroupId, groupInfo]);

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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-50 p-4 animate-fade-in" onClick={() => onClose(openedFromGroupId)} role="dialog">
            <div className="absolute top-10 right-10 z-[51] flex items-center gap-4">
                {displayVotes && (
                    <div className={`text-lg font-bold ${getScoreColor(photo.votes)} bg-black/50 px-3 py-1 rounded-md`}>
                        Рейтинг: {photo.votes}
                    </div>
                )}
                <button onClick={() => onClose(openedFromGroupId)} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Закрыть"><X className="w-6 h-6" /></button>
            </div>

            {hasPrev && <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="absolute left-4 top-1/2 -translate-y-1/2 z-[51] p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronLeft className="w-8 h-8" /></button>}
            {hasNext && <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="absolute right-4 top-1/2 -translate-y-1/2 z-[51] p-2 rounded-full bg-white/10 text-white hover:bg-white/20"><ChevronRight className="w-8 h-8" /></button>}

            <div className="relative max-w-5xl w-full max-h-[90vh] bg-gray-900 rounded-lg shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
                <div className="flex-grow p-4 overflow-hidden flex items-center justify-center relative group cursor-pointer" onClick={onEnterImmersive}>
                    <img src={photo.url} alt={`Фото ${photo.id}`} className="object-contain w-full h-full max-h-[calc(90vh-140px)]" />
                    {!photo.isOutOfCompetition && (
                        <button
                            onClick={(e) => { e.stopPropagation(); onToggleFlag(photo.id); }}
                            className="absolute top-4 left-4 z-10 p-2 rounded-full bg-gray-800/60 backdrop-blur-sm text-white hover:bg-gray-700 transition-colors"
                            title="Отметить (F)"
                        >
                            <Flag className="w-6 h-6" fill={photo.isFlagged !== false ? 'currentColor' : 'none'} />
                        </button>
                    )}
                    {groupInfo && <SelectionControl isSelected={isPhotoInGroupSelected} onSelect={handleSelect} />}
                </div>

                <div className="group/controls bg-gradient-to-t from-gray-900 via-gray-800/80 to-gray-800/60 hover:from-black hover:to-gray-900/80 transition-colors duration-300 rounded-b-lg">
                    {groupInfo && (
                        <div className="flex items-center justify-center gap-3 text-sm text-gray-400 border-t border-gray-700/50 px-4 py-2" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center gap-3 truncate">
                                <Layers className="w-5 h-5 flex-shrink-0 text-indigo-400" />
                                <span className="truncate">Фото из группы: «{groupInfo.name}»</span>
                            </div>
                        </div>
                    )}
                    <div className={`p-3 text-center text-gray-300 ${groupInfo ? '' : 'border-t border-gray-700/50'}`}>
                        <p>{photo.caption}</p>
                    </div>

                    { !groupInfo && (
                        <div className="p-3 flex flex-wrap justify-between items-center gap-4">
                            <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
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
                    )}
                </div>
            </div>
        </div>
    );
};