import React, { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { Photo } from '../types';
import { ChevronLeft, ChevronRight, X, Star, XCircle, Flag, Layers, Check } from 'lucide-react';

// FIX: Updated the 'onSelect' prop to accept a MouseEvent to resolve the type error.
const SelectionControl: React.FC<{isSelected: boolean; onSelect: (e: React.MouseEvent) => void;}> = ({isSelected, onSelect}) => {
    return (
        <div
            className="absolute top-4 left-4 z-20 pointer-events-auto"
            onClick={onSelect}
            // onTouchStart={(e) => { e.stopPropagation(); onSelect(); }}
        >
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ring-1 ring-inset ring-black/20 transition-all duration-200 cursor-pointer ${isSelected ? 'bg-green-500 border-2 border-white shadow-lg' : 'bg-gray-800/60 backdrop-blur-sm border-2 border-gray-400/80'}`}>
                {isSelected && <Check className="w-5 h-5 text-white" />}
            </div>
        </div>
    )
}


interface ImmersiveViewProps {
    allPhotos: Photo[];
    photoId: number;
    onClose: (lastViewedPhotoId: number) => void;
    onNext: () => void;
    onPrev: () => void;
    onRate: (photoId: number, rating: number) => void;
    onToggleFlag: (photoId: number) => void;
    displayVotes: boolean;
    ratedPhotosCount: number;
    starsUsed: number;
    ratedPhotoLimit: number;
    totalStarsLimit: number;
    groupInfo: { id: string; name: string } | null;
    onGroupSelectionChange: (groupId: string, photoId: number | null) => void;
    isPhotoInGroupSelected: boolean;
    onSelectOtherFromGroup: (groupId: string) => void;
}

type AnimationState = 'idle' | 'dragging' | 'animating';
type DragAxis = 'H' | 'V' | null;

const HINT_STORAGE_KEY = 'immersiveHintShown';
const SWIPE_THRESHOLD_X = 50;
const SWIPE_THRESHOLD_Y = 80;
const TAP_THRESHOLD = 10;
const TRANSITION_DURATION = 250;
const PHOTO_GAP = 10;

// Add vendor prefixes to the standard Element interface
interface VendorFullscreenElement extends HTMLDivElement {
    webkitRequestFullscreen?(): Promise<void>;
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


const ImageWrapper: React.FC<{ photo?: Photo; isVisible: boolean }> = React.memo(({ photo, isVisible }) => (
    <div
        className="w-screen h-full flex-shrink-0 flex items-center justify-center"
        style={{ marginRight: `${PHOTO_GAP}px` }}
    >
        {photo && (
            <img
                src={photo.url}
                alt={photo.caption}
                className="object-contain max-w-full max-h-full"
                draggable="false"
                loading={isVisible ? 'eager' : 'lazy'}
            />
        )}
    </div>
));

export const ImmersiveView: React.FC<ImmersiveViewProps> = ({
                                                                allPhotos,
                                                                photoId,
                                                                onClose,
                                                                onNext,
                                                                onPrev,
                                                                onRate,
                                                                onToggleFlag,
                                                                displayVotes,
                                                                ratedPhotosCount,
                                                                starsUsed,
                                                                ratedPhotoLimit,
                                                                totalStarsLimit,
                                                                groupInfo,
                                                                onGroupSelectionChange,
                                                                isPhotoInGroupSelected,
                                                                onSelectOtherFromGroup
                                                            }) => {
    const currentIndex = useMemo(() => allPhotos.findIndex(p => p.id === photoId), [allPhotos, photoId]);
    const photo = allPhotos[currentIndex];

    const prevPhoto = allPhotos[(currentIndex - 1 + allPhotos.length) % allPhotos.length];
    const nextPhoto = allPhotos[(currentIndex + 1) % allPhotos.length];

    const containerRef = useRef<VendorFullscreenElement>(null);
    const filmStripRef = useRef<HTMLDivElement>(null);
    const currentPhotoIdRef = useRef(photoId);
    const touchOriginIsControl = useRef(false);
    const activityTimer = useRef<number | null>(null);

    const [controlsVisible, setControlsVisible] = useState(true);
    const [arrowsVisible, setArrowsVisible] = useState(true);
    const [hoverRating, setHoverRating] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [animationState, setAnimationState] = useState<AnimationState>('idle');
    const [dragState, setDragState] = useState({ startX: 0, startY: 0, currentX: 0, currentY: 0, axis: null as DragAxis, isTap: true });
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);

    const isTouchDevice = useMemo(() => 'ontouchstart' in window, []);

    const showArrows = useCallback(() => {
        if (isTouchDevice) return;
        setArrowsVisible(true);
        if (activityTimer.current) clearTimeout(activityTimer.current);
        activityTimer.current = window.setTimeout(() => setArrowsVisible(false), 2000);
    }, [isTouchDevice]);

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        currentPhotoIdRef.current = photoId;
        setHoverRating(0);
        showArrows();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photoId]);

    useLayoutEffect(() => {
        const filmstrip = filmStripRef.current;
        if (filmstrip && animationState === 'idle') {
            filmstrip.style.transition = 'none';
            const baseOffset = -screenWidth - PHOTO_GAP;
            filmstrip.style.transform = `translateX(${baseOffset}px)`;
        }
    }, [photoId, animationState, screenWidth]);

    useEffect(() => {
        const hintShown = localStorage.getItem(HINT_STORAGE_KEY);
        if (!hintShown) {
            setShowHint(true);
        }
    }, []);

    const handleClose = useCallback(() => {
        onClose(currentPhotoIdRef.current);
    }, [onClose]);

    useEffect(() => {
        const element = containerRef.current;
        if (!element) return;

        const enterFullscreen = async () => {
            try {
                if (element.requestFullscreen) {
                    await element.requestFullscreen();
                } else if (element.webkitRequestFullscreen) {
                    await element.webkitRequestFullscreen();
                }
            } catch (err) {
                console.warn('Не удалось войти в полноэкранный режим:', err);
            }
        };

        if (document.fullscreenElement === null) {
            void enterFullscreen();
        }

        const handleFullscreenChange = () => {
            if (document.fullscreenElement === null) {
                handleClose();
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
    }, [handleClose]);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                handleClose();
            } else if (e.key === 'ArrowRight') {
                onNext();
            } else if (e.key === 'ArrowLeft') {
                onPrev();
            } else if (e.key === ' ' && !isTouchDevice) {
                e.preventDefault();
                setControlsVisible(v => !v);
            } else if (e.key.toLowerCase() === 'f' || (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown'))) {
                e.preventDefault();
                if (!photo.isOutOfCompetition) onToggleFlag(photo.id);
            } else if (!e.ctrlKey && !e.metaKey && /^[0-5]$/.test(e.key)) {
                e.preventDefault();
                if (!photo.isOutOfCompetition) onRate(photo.id, parseInt(e.key, 10));
            }
        }
        document.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('keydown', handleKeyDown);
            if (activityTimer.current) clearTimeout(activityTimer.current);
        }
    }, [handleClose, onNext, onPrev, isTouchDevice, photo, onRate, onToggleFlag]);

    useEffect(() => {
        if (showHint) {
            const timer = setTimeout(() => {
                setShowHint(false);
                try {
                    localStorage.setItem(HINT_STORAGE_KEY, 'true');
                } catch (e) {
                    console.warn("Could not save hint status to localStorage", e);
                }
            }, 4000);
            return () => clearTimeout(timer);
        }
    }, [showHint]);

    const handleRate = (rating: number) => {
        onRate(photo.id, rating);
    };

    const getScoreColor = (score: number) => {
        if (score > 0) return 'text-green-400';
        if (score < 0) return 'text-red-400';
        return 'text-gray-400';
    };

    const handleTouchStart = (e: React.TouchEvent) => {
        if (e.touches.length > 1 || animationState !== 'idle') return;
        const { clientX, clientY } = e.touches[0];
        setDragState({ startX: clientX, startY: clientY, currentX: clientX, currentY: clientY, axis: null, isTap: true });

        const filmstrip = filmStripRef.current;
        if (filmstrip) filmstrip.style.transition = 'none';
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (animationState === 'animating' || e.touches.length > 1) return;

        const { clientX, clientY } = e.touches[0];
        let { startX, startY, axis, isTap } = dragState;

        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        if (isTap && (Math.abs(deltaX) > TAP_THRESHOLD || Math.abs(deltaY) > TAP_THRESHOLD)) {
            isTap = false;
        }

        if (!axis && !isTap) {
            axis = Math.abs(deltaX) * 1.5 > Math.abs(deltaY) ? 'H' : 'V';
        }

        if (animationState === 'idle' && axis) {
            setAnimationState('dragging');
        }

        if (animationState === 'dragging') {
            const filmstrip = filmStripRef.current;
            if (filmstrip) {
                const baseOffset = -screenWidth - PHOTO_GAP;
                let transform = '';
                if (axis === 'H') {
                    let dragX = deltaX;
                    if ((dragX > 0 && !prevPhoto) || (dragX < 0 && !nextPhoto)) {
                        dragX /= 3; // Resistance at edges
                    }
                    transform = `translateX(${baseOffset + dragX}px)`;
                } else {
                    transform = `translateX(${baseOffset}px) translateY(${deltaY}px)`;
                }
                filmstrip.style.transform = transform;
            }
        }

        setDragState(prev => ({ ...prev, currentX: clientX, currentY: clientY, axis, isTap }));
    };

    const handleTouchEnd = () => {
        if (animationState === 'animating') return;

        if (dragState.isTap) {
            if (!touchOriginIsControl.current) {
                setControlsVisible(v => !v);
            }
            touchOriginIsControl.current = false;
            setAnimationState('idle');
            return;
        }

        if (animationState !== 'dragging') {
            setAnimationState('idle');
            return;
        }

        setAnimationState('animating');

        const filmstrip = filmStripRef.current;
        if (!filmstrip) return;

        filmstrip.style.transition = `transform ${TRANSITION_DURATION}ms ease-out`;

        const deltaX = dragState.currentX - dragState.startX;
        const deltaY = dragState.currentY - dragState.startY;

        const baseOffset = -screenWidth - PHOTO_GAP;
        let targetTransform = `translateX(${baseOffset}px)`;
        let onAnimationEndCallback: (() => void) | null = null;

        // Prioritize vertical swipe for closing, but it must be a clear vertical gesture.
        if (dragState.axis === 'V' && Math.abs(deltaY) > SWIPE_THRESHOLD_Y) {
            handleClose();
            return;
        }

        // Handle horizontal swipe for navigation.
        if (dragState.axis === 'H') {
            if (deltaX > SWIPE_THRESHOLD_X && prevPhoto) {
                targetTransform = `translateX(0px)`;
                onAnimationEndCallback = onPrev;
            } else if (deltaX < -SWIPE_THRESHOLD_X && nextPhoto) {
                const screenWidthWithGap = screenWidth + PHOTO_GAP;
                targetTransform = `translateX(${-screenWidthWithGap * 2}px)`;
                onAnimationEndCallback = onNext;
            }
        }

        filmstrip.style.transform = targetTransform;

        const handleTransitionEnd = () => {
            filmstrip.removeEventListener('transitionend', handleTransitionEnd);
            if (onAnimationEndCallback) {
                onAnimationEndCallback();
            }
            setAnimationState('idle');
        };
        filmstrip.addEventListener('transitionend', handleTransitionEnd);
    };


    if (!photo) return null;

    const handleBackgroundClick = () => {
        if (!isTouchDevice) {
            setControlsVisible(v => !v);
        }
    };

    const handleControlInteraction = (e: React.SyntheticEvent) => {
        e.stopPropagation();
    };

    const handleControlTouchStart = (e: React.TouchEvent) => {
        e.stopPropagation();
        touchOriginIsControl.current = true;
    };

    const handleSelect = (e: React.SyntheticEvent) => {
        e.stopPropagation();
        if (groupInfo) {
            const newSelectedId = isPhotoInGroupSelected ? null : photo.id;
            onGroupSelectionChange(groupInfo.id, newSelectedId);
        }
    };

    const isOutOfComp = !!photo.isOutOfCompetition;
    const maxRating = photo.maxRating ?? 3;

    const hasMultiplePhotos = allPhotos.length > 1;

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[200] bg-black flex items-center justify-start select-none overflow-hidden"
            onTouchStart={isTouchDevice ? handleTouchStart : undefined}
            onTouchMove={isTouchDevice ? handleTouchMove : undefined}
            onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
            onClick={handleBackgroundClick}
            onMouseMove={showArrows}
            style={{ touchAction: 'none' }}
        >
            <div
                ref={filmStripRef}
                className="h-full flex relative z-[1]"
                style={{
                    width: `calc(300vw + ${PHOTO_GAP * 2}px)`,
                }}
            >
                <ImageWrapper photo={hasMultiplePhotos ? prevPhoto : undefined} isVisible={currentIndex > 0} />
                <ImageWrapper photo={photo} isVisible={true} />
                <ImageWrapper photo={hasMultiplePhotos ? nextPhoto : undefined} isVisible={currentIndex < allPhotos.length - 1} />
            </div>

            {groupInfo && <SelectionControl isSelected={isPhotoInGroupSelected} onSelect={handleSelect} />}

            {/* Navigation Arrows */}
            {hasMultiplePhotos && !isTouchDevice && (
                <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-300 ${arrowsVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Предыдущее фото">
                        <ChevronLeft className="w-10 h-10" />
                    </button>
                </div>
            )}
            {hasMultiplePhotos && !isTouchDevice && (
                <div className={`absolute right-4 top-1/2 -translate-y-1/2 z-10 transition-opacity duration-300 ${arrowsVisible ? 'opacity-100' : 'opacity-0'}`}>
                    <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Следующее фото">
                        <ChevronRight className="w-10 h-10" />
                    </button>
                </div>
            )}

            {/* Controls Container (visibility toggles) */}
            <div
                className={`absolute inset-0 transition-opacity duration-300 ${controlsVisible ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            >
                <div
                    className="absolute top-0 left-0 right-0 bg-gradient-to-b from-black/60 to-transparent p-4 flex justify-between items-start gap-4"
                    onClick={handleControlInteraction}
                    onTouchStart={handleControlTouchStart}
                >
                    <div className="absolute top-4 left-4 flex items-center gap-2 pl-10">
                        <div className="bg-black/50 text-white text-sm font-mono px-2 py-1 rounded">
                            {photo.id}
                        </div>
                        {isTouchDevice && !isOutOfComp && (
                            <button
                                onClick={(e) => { e.stopPropagation(); onToggleFlag(photo.id); }}
                                className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                                aria-label="Отметить фото"
                            >
                                <Flag className="w-6 h-6" fill={photo.isFlagged !== false ? 'currentColor' : 'none'} />
                            </button>
                        )}
                    </div>
                    <div className="flex-grow"></div>
                    <div className="flex items-center gap-4">
                        {displayVotes && (
                            <div className={`text-lg font-bold ${getScoreColor(photo.votes)} bg-black/50 px-3 py-1 rounded-md`}>
                                Рейтинг: {photo.votes}
                            </div>
                        )}
                        <button onClick={handleClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Закрыть">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent pt-12 group/controls"
                     onMouseEnter={() => !isTouchDevice && setControlsVisible(true)}>
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent opacity-0 group-hover/controls:opacity-100 transition-opacity pointer-events-none" />
                    {groupInfo && (
                        <div
                            className="px-4 pt-2 pb-1 flex items-center justify-between gap-3 text-sm text-gray-200"
                            onClick={handleControlInteraction}
                            onTouchStart={handleControlTouchStart}
                        >
                            <div className="flex items-center gap-3 truncate">
                                <Layers className="w-5 h-5 flex-shrink-0 text-indigo-400" />
                                <span className="truncate">Группа: «{groupInfo.name}»</span>
                            </div>
                            <button
                                onClick={(e) => { e.stopPropagation(); onSelectOtherFromGroup(groupInfo.id); }}
                                className="flex-shrink-0 text-xs font-semibold text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-900/50 hover:bg-indigo-900/80 px-3 py-1 rounded-full"
                            >
                                Изменить выбор
                            </button>
                        </div>
                    )}
                    <div className="px-4 pb-2 text-left text-gray-200 relative">
                        <p>{photo.caption}</p>
                    </div>
                    <div
                        className="p-4 flex flex-nowrap justify-between items-center gap-4 relative"
                        onClick={handleControlInteraction}
                        onTouchStart={handleControlTouchStart}
                        onMouseLeave={() => !isTouchDevice && setHoverRating(0)}
                    >
                        <div className="flex items-center flex-shrink-0">
                            {!isTouchDevice && !isOutOfComp && (
                                <button
                                    onClick={() => onToggleFlag(photo.id)}
                                    className="p-2 mr-2 rounded-full bg-gray-700 hover:bg-gray-600 text-white transition-colors"
                                    title="Отметить (F)"
                                >
                                    <Flag className="w-7 h-7" fill={photo.isFlagged !== false ? 'currentColor' : 'none'} />
                                </button>
                            )}
                            {!isOutOfComp && (
                                <>
                                    {[1, 2, 3, 4, 5].map((star) => {
                                        const isFilled = (photo.userRating || 0) >= star;
                                        const isHighlighted = !isTouchDevice && (hoverRating || 0) >= star;
                                        const isLocked = star > maxRating;

                                        let starColor = 'text-gray-500';
                                        if (isFilled) {
                                            starColor = 'text-yellow-400';
                                        } else if (isHighlighted) {
                                            starColor = isLocked ? 'text-red-500' : 'text-yellow-400';
                                        }

                                        const titleText = isLocked
                                            ? `Эта фотография еще не заслужила ${star} ${getStarNounGenitive(star)}`
                                            : `Оценить в ${star} ${getStarNounAccusative(star)}`;

                                        return (
                                            <button
                                                key={star}
                                                onClick={() => handleRate(star)}
                                                onMouseEnter={() => !isTouchDevice && setHoverRating(star)}
                                                className={`p-2 rounded-full transition-all transform hover:scale-125`}
                                                aria-label={titleText}
                                                title={titleText}
                                            >
                                                <Star className={`w-7 h-7 transition-colors ${starColor} ${isLocked && !isFilled && !isHighlighted ? 'opacity-30' : ''}`} fill={isFilled ? 'currentColor' : 'none'} strokeWidth={isHighlighted && !isFilled ? 2 : 1.5} />
                                            </button>
                                        )
                                    })}
                                    <div className='w-[44px] h-[44px] flex items-center justify-center transition-opacity' style={{opacity: photo.userRating && photo.userRating > 0 ? 1 : 0}}>
                                        <button onClick={() => handleRate(0)} className={`p-2 rounded-full text-red-500/70 hover:text-red-500 hover:bg-red-500/10 transition-all transform hover:scale-125`} aria-label="Сбросить оценку">
                                            <XCircle className="w-6 h-6" />
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                        <div className="text-xs sm:text-sm text-gray-300 font-mono flex items-center gap-x-2 sm:gap-x-3 flex-shrink-0">
                            <div className="flex items-center gap-x-1" title="Оценено фотографий">
                                <span className="font-semibold text-green-400">{ratedPhotosCount}</span>
                                <span className="text-gray-500">/{ratedPhotoLimit}</span>
                            </div>
                            <div className="w-px h-4 bg-gray-600"></div>
                            <div className="flex items-center gap-x-1" title="Израсходовано звёзд">
                                <span className="font-semibold text-yellow-400">{starsUsed}</span>
                                <span className="text-gray-500">/{totalStarsLimit}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {showHint && isTouchDevice && (
                <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/50 px-3 py-1 rounded-full pointer-events-none animate-fade-in">
                    Смахните вверх или вниз, чтобы закрыть
                </div>
            )}
        </div>
    );
};
