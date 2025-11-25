import React, { useEffect, useRef, useState, useCallback, useMemo, useLayoutEffect } from 'react';
import { Photo } from '../types';
import { ChevronLeft, ChevronRight, X, Star, Eye, EyeOff, Layers, Check, BarChart2, Users, XCircle } from 'lucide-react';

const SelectionControl: React.FC<{isSelected: boolean; onSelect: (e: React.MouseEvent) => void;}> = ({isSelected, onSelect}) => {
    return (
        <div
            className="absolute top-4 right-4 z-10 pointer-events-auto"
            onClick={onSelect}
        >
            <div className={`selection-control-bg w-8 h-8 rounded-full flex items-center justify-center ring-1 ring-inset ring-white/20 transition-all duration-300 border-2 shadow-lg cursor-pointer ${isSelected ? 'bg-green-500 border-white selected' : 'bg-gray-800/60 backdrop-blur-sm border-white/80'}`}>
                <Check className="w-5 h-5 text-white selection-control-check" />
            </div>
        </div>
    )
}

interface ImmersiveViewProps {
    allPhotos: Photo[];
    photoId: number;
    allPhotosInGroup: Photo[];
    onClose: (lastViewedPhotoId: number) => void;
    onNext: () => void;
    onPrev: () => void;
    onRate: (photoId: number, rating: number) => void;
    onToggleVisibility: (photoId: number) => void;
    displayVotes: boolean;
    ratedPhotosCount: number;
    starsUsed: number;
    ratedPhotoLimit: number;
    totalStarsLimit: number;
    groupInfo: { id: string; name: string; caption?: string; photos: Photo[] } | null;
    groupSelections: Record<string, number | null>;
    onGroupSelectionChange: (groupId: string, photoId: number | null) => void;
    onOpenGroup: (groupId: string) => void;
    hasCreditVotes?: boolean;
}

type UIMode = 'full' | 'minimal';
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

const ImageWrapper: React.FC<{
    photo?: Photo;
    isVisible: boolean;
    groupInfo: { id: string; name: string; photos: Photo[] } | null;
    groupSelections: Record<string, number | null>;
    allPhotosInGroup: Photo[];
    onGroupSelectionChange: (groupId: string, photoId: number | null) => void;
    onToggleVisibility: (photoId: number) => void;
}> = React.memo(({ photo, isVisible, groupInfo, groupSelections, allPhotosInGroup, onGroupSelectionChange, onToggleVisibility }) => {
    const imgRef = useRef<HTMLImageElement>(null);
    const [controlsContainerStyle, setControlsContainerStyle] = useState<React.CSSProperties>({});

    const currentGroupSelection = photo && groupInfo ? groupSelections[groupInfo.id] : undefined;
    const isPhotoInGroupSelected = currentGroupSelection === photo?.id;
    // Fix: Check strictly if a selection exists (is a number) to avoid 'undefined !== null' evaluating to true
    const isAnotherPhotoInGroupSelected = photo && groupInfo ? (currentGroupSelection != null && currentGroupSelection !== photo.id) : false;

    const photoIndexInGroup = photo && groupInfo ? allPhotosInGroup.findIndex(p => p.id === photo.id) + 1 : 0;
    const hasUserRating = photo?.userRating && photo.userRating > 0;

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


    const handleSelect = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (groupInfo && photo) {
            const newSelectedId = isPhotoInGroupSelected ? null : photo.id;
            onGroupSelectionChange(groupInfo.id, newSelectedId);
        }
    };

    const handleToggleVisibilityClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (photo) onToggleVisibility(photo.id);
    }

    return (
        <div
            className="w-screen h-full flex-shrink-0 flex items-center justify-center relative"
            style={{ marginRight: `${PHOTO_GAP}px` }}
        >
            {photo && (
                <div className="relative w-full h-full flex items-center justify-center">
                    <img
                        ref={imgRef}
                        onLoad={calculateControlsPosition}
                        src={photo.url}
                        alt={photo.caption}
                        className="object-contain max-w-full max-h-full"
                        draggable="false"
                        loading={isVisible ? 'eager' : 'lazy'}
                    />
                    { isVisible && (
                        <div style={controlsContainerStyle} className="pointer-events-none z-40">
                            {groupInfo && <div className={`smart-frame ${isPhotoInGroupSelected ? 'selected' : 'in-group'}`} />}
                            {isAnotherPhotoInGroupSelected && <div className="vignette-overlay"/>}

                            {!photo.isOutOfCompetition && (
                                <button
                                    onClick={handleToggleVisibilityClick}
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
                    )}
                </div>
            )}
        </div>
    )
});

export const ImmersiveView: React.FC<ImmersiveViewProps> = ({
                                                                allPhotos, photoId, allPhotosInGroup, onClose, onNext, onPrev, onRate, onToggleVisibility, displayVotes, ratedPhotosCount,
                                                                starsUsed, ratedPhotoLimit, totalStarsLimit, groupInfo, groupSelections, onGroupSelectionChange,
                                                                onOpenGroup, hasCreditVotes = false
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

    const [uiMode, setUiMode] = useState<UIMode>('full');
    const [transientControlsVisible, setTransientControlsVisible] = useState(true);
    const [hoverRating, setHoverRating] = useState(0);
    const [showHint, setShowHint] = useState(false);
    const [animationState, setAnimationState] = useState<AnimationState>('idle');
    const [dragState, setDragState] = useState({ startX: 0, startY: 0, currentX: 0, currentY: 0, axis: null as DragAxis, isTap: true });
    const [screenWidth, setScreenWidth] = useState(window.innerWidth);

    const isTouchDevice = useMemo(() => 'ontouchstart' in window, []);

    const showTransientControls = useCallback(() => {
        if (uiMode !== 'minimal') return;
        setTransientControlsVisible(true);
        if (activityTimer.current) clearTimeout(activityTimer.current);
        activityTimer.current = window.setTimeout(() => setTransientControlsVisible(false), 2500);
    }, [uiMode]);

    useEffect(() => {
        const handleResize = () => setScreenWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    useEffect(() => {
        currentPhotoIdRef.current = photoId;
        setHoverRating(0);
        if (uiMode === 'minimal') {
            showTransientControls();
        } else {
            setTransientControlsVisible(true);
            if (activityTimer.current) clearTimeout(activityTimer.current);
        }
    }, [photoId, uiMode, showTransientControls]);

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

    const handleClose = useCallback((e?: React.MouseEvent) => {
        e?.stopPropagation();
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
                onClose(currentPhotoIdRef.current);
            }
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Fullscreen API handles this, which triggers onClose
            } else if (e.key === 'ArrowRight') {
                onNext();
            } else if (e.key === 'ArrowLeft') {
                onPrev();
            } else if (e.key === ' ' && !isTouchDevice) {
                e.preventDefault();
                setUiMode(m => m === 'full' ? 'minimal' : 'full');
            } else if (e.key.toLowerCase() === 'h' || (e.ctrlKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown'))) {
                e.preventDefault();
                if (!photo.isOutOfCompetition) onToggleVisibility(photo.id);
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
    }, [onNext, onPrev, isTouchDevice, photo, onRate, onToggleVisibility, groupInfo]);

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
                setUiMode(m => m === 'full' ? 'minimal' : 'full');
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

        if (dragState.axis === 'V' && Math.abs(deltaY) > SWIPE_THRESHOLD_Y) {
            onClose(currentPhotoIdRef.current);
            return;
        }

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

    const handleBackgroundClick = (e: React.MouseEvent) => {
        if (!isTouchDevice) {
            setUiMode(m => m === 'full' ? 'minimal' : 'full');
        }
    };

    const handleControlInteraction = (e: React.SyntheticEvent) => {
        e.stopPropagation();
    };

    const handleControlTouchStart = (e: React.TouchEvent) => {
        e.stopPropagation();
        touchOriginIsControl.current = true;
    };

    const isOutOfComp = !!photo.isOutOfCompetition;
    const maxRating = photo.maxRating ?? 3;
    const hasMultiplePhotos = allPhotos.length > 1;

    const showTopAndSideControls = uiMode === 'full' || transientControlsVisible;
    const showBottomControls = uiMode === 'full';
    const captionToShow = groupInfo?.caption ? groupInfo.caption : photo.caption;

    // --- STAR COLOR LOGIC (Synced with RatingControls.tsx) ---
    // 1. Mathematical Budget
    const starsUsedByOthers = starsUsed - (photo.validRating || 0);
    const mathematicalBudget = Math.max(0, totalStarsLimit - starsUsedByOthers);

    // 2. Indigo Mode
    const hasValidSlot = (photo.validRating || 0) > 0;
    const isSlotAvailable = ratedPhotosCount < ratedPhotoLimit;
    const isIndigoMode = !hasValidSlot && !isSlotAvailable;

    return (
        <div
            ref={containerRef}
            className="fixed inset-0 z-[200] bg-black flex items-center justify-start select-none overflow-hidden"
            onTouchStart={isTouchDevice ? handleTouchStart : undefined}
            onTouchMove={isTouchDevice ? handleTouchMove : undefined}
            onTouchEnd={isTouchDevice ? handleTouchEnd : undefined}
            onClick={handleBackgroundClick}
            onMouseMove={isTouchDevice ? undefined : showTransientControls}
            style={{ touchAction: 'none' }}
        >
            <div
                ref={filmStripRef}
                className="h-full flex z-0"
                style={{
                    width: `calc(300vw + ${PHOTO_GAP * 2}px)`,
                }}
            >
                <ImageWrapper photo={hasMultiplePhotos ? prevPhoto : undefined} isVisible={false} groupInfo={null} allPhotosInGroup={[]} groupSelections={{}} onGroupSelectionChange={()=>{}} onToggleVisibility={()=>{}} />
                <ImageWrapper photo={photo} isVisible={true} groupInfo={groupInfo} allPhotosInGroup={allPhotosInGroup} groupSelections={groupSelections} onGroupSelectionChange={onGroupSelectionChange} onToggleVisibility={onToggleVisibility} />
                <ImageWrapper photo={hasMultiplePhotos ? nextPhoto : undefined} isVisible={false} groupInfo={null} allPhotosInGroup={[]} groupSelections={{}} onGroupSelectionChange={()=>{}} onToggleVisibility={()=>{}} />
            </div>

            <div className="absolute inset-0 pointer-events-none z-10">
                {hasMultiplePhotos && !isTouchDevice && (
                    <div className={`absolute left-4 top-1/2 -translate-y-1/2 z-20 transition-opacity duration-300 pointer-events-auto ${showTopAndSideControls ? 'opacity-100' : 'opacity-0'}`}>
                        <button onClick={(e) => { e.stopPropagation(); onPrev(); }} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Предыдущее фото">
                            <ChevronLeft className="w-10 h-10" />
                        </button>
                    </div>
                )}
                {hasMultiplePhotos && !isTouchDevice && (
                    <div className={`absolute right-4 top-1/2 -translate-y-1/2 z-20 transition-opacity duration-300 pointer-events-auto ${showTopAndSideControls ? 'opacity-100' : 'opacity-0'}`}>
                        <button onClick={(e) => { e.stopPropagation(); onNext(); }} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white" aria-label="Следующее фото">
                            <ChevronRight className="w-10 h-10" />
                        </button>
                    </div>
                )}

                <div
                    className={`absolute top-4 right-4 flex items-start gap-4 pointer-events-auto transition-opacity duration-300 ${showTopAndSideControls ? 'opacity-100' : 'opacity-0'}`}
                    onClick={handleControlInteraction}
                    onTouchStart={handleControlTouchStart}
                >
                    <div className="flex items-center gap-4">
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
                        <button onClick={handleClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Закрыть">
                            <X className="w-6 h-6" />
                        </button>
                    </div>
                </div>

                <div className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 to-transparent pt-32 pointer-events-auto transition-opacity duration-300 ${showBottomControls ? 'opacity-100' : 'opacity-0'}`}
                     onClick={handleControlInteraction}
                     onTouchStart={handleControlTouchStart}
                     onMouseLeave={() => !isTouchDevice && setHoverRating(0)}
                     onMouseEnter={() => !isTouchDevice && uiMode === 'minimal' && setUiMode('full')}
                >
                    <div className="px-4 pb-2 text-left text-white relative shadow-text">
                        <p>{captionToShow}</p>
                    </div>

                    {groupInfo && (
                        <div className="pb-4 px-4">
                            <button
                                onClick={(e) => { e.stopPropagation(); onOpenGroup(groupInfo.id); }}
                                className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-semibold rounded-lg bg-indigo-600/80 hover:bg-indigo-700/80 text-white transition-colors backdrop-blur-sm"
                                onTouchStart={handleControlTouchStart}
                            >
                                <Layers size={16}/>
                                <span>Перейти в группу «{groupInfo.name}»</span>
                            </button>
                        </div>
                    )}

                    <div
                        className="p-4 pt-0 flex flex-nowrap justify-between items-center gap-4 relative"
                    >
                        <div className="flex items-center flex-shrink-0">
                            {!isOutOfComp && (
                                <>
                                    {[1, 2, 3, 4, 5].map((star) => {
                                        const isFilled = (photo.userRating || 0) >= star;
                                        const isHighlighted = !isTouchDevice && (hoverRating || 0) >= star;
                                        const maxRating = photo.maxRating ?? 3;
                                        const isLocked = star > maxRating;

                                        const isFinanciallyValid = star <= mathematicalBudget;
                                        let starColor = 'text-gray-500';

                                        if (isFilled || isHighlighted) {
                                            if (!isFinanciallyValid) {
                                                starColor = 'text-cyan-400';
                                            } else if (isIndigoMode) {
                                                starColor = 'text-indigo-500';
                                            } else {
                                                starColor = 'text-yellow-400';
                                            }
                                        } else if (isLocked && isHighlighted) {
                                            starColor = 'text-red-500';
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
                                                <Star className={`w-7 h-7 transition-colors ${starColor} ${isLocked && !isFilled && !isHighlighted ? 'opacity-30' : ''}`} fill={isFilled && (starColor !== 'text-gray-500' || !isTouchDevice) ? 'currentColor' : 'none'} strokeWidth={isHighlighted && !isFilled ? 2 : 1.5} />
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

                {showHint && isTouchDevice && (
                    <div className="absolute bottom-5 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/50 px-3 py-1 rounded-full pointer-events-none animate-fade-in">
                        Смахните вверх или вниз, чтобы закрыть
                    </div>
                )}
            </div>
        </div>
    );
};