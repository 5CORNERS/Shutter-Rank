import React, { useEffect } from 'react';
import { Photo, Config } from '../types';
import { X, ChevronLeft, ChevronRight, Maximize, Star } from 'lucide-react';
import { RatingControls } from './RatingControls';

interface ModalProps {
    photo: Photo;
    onClose: () => void;
    displayVotes: boolean;
    onNext: () => void;
    onPrev: () => void;
    onEnterImmersive: () => void;
    onRate: (photoId: number, rating: number) => void;
    hasNext: boolean;
    hasPrev: boolean;
    config: Config | null;
    ratedPhotosCount: number;
    starsUsed: number;
}

export const Modal: React.FC<ModalProps> = ({ photo, onClose, displayVotes, onNext, onPrev, onEnterImmersive, onRate, hasNext, hasPrev, config, ratedPhotosCount, starsUsed }) => {
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === 'Escape') onClose();
            else if (event.key === 'ArrowRight' && hasNext) onNext();
            else if (event.key === 'ArrowLeft' && hasPrev) onPrev();
            else if (event.ctrlKey && event.key === 'ArrowUp') {
                event.preventDefault();
                const currentRating = photo?.userRating || 0;
                if (currentRating < 5) onRate(photo.id, currentRating + 1);
            } else if (event.ctrlKey && event.key === 'ArrowDown') {
                event.preventDefault();
                const currentRating = photo?.userRating || 0;
                if (currentRating > 0) onRate(photo.id, currentRating - 1);
            }
        };

        document.body.style.overflow = 'hidden';
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.body.style.overflow = 'auto';
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [onClose, onNext, onPrev, hasNext, hasPrev, photo, onRate]);

    const getScoreColor = (score: number) => {
        if (score > 0) return 'text-green-400';
        if (score < 0) return 'text-red-400';
        return 'text-gray-400';
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
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                        <Maximize className="w-16 h-16 text-white/80" />
                    </div>
                </div>

                <div className="p-3 text-center text-gray-300 border-t border-gray-700/50">
                    <p>{photo.caption}</p>
                </div>

                <div className="p-3 bg-gray-800/50 rounded-b-lg flex flex-wrap justify-between items-center gap-4">
                    <div onClick={e => e.stopPropagation()}>
                        <RatingControls photo={photo} onRate={onRate} size="large" />
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
    );
};