
import * as React from 'react';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { db } from './firebase';
import { ref, get, onValue, runTransaction, DataSnapshot, set, remove, TransactionResult } from 'firebase/database';
import { Photo, FirebasePhotoData, Settings, Config, GalleryItem, PhotoStack, FirebaseDataGroups, SortMode } from './types';
import { PhotoCard } from './components/PhotoCard';
import { Modal } from './components/Modal';
import { ImmersiveView } from './components/ImmersiveView';
import { SettingsModal } from './components/SettingsModal';
import { ArticleModal } from './components/IntroModal';
import { RatingInfoModal } from './components/RatingInfoModal';
import { PhotoStackComponent } from './components/PhotoStack';
import { GroupModal } from './components/GroupModal';
import { Toast } from './components/Toast';
import { ToggleSwitch } from './components/ToggleSwitch';
import { ConfirmationModal } from './components/ConfirmationModal';
import { useDeviceType } from './hooks/useDeviceType';
import { useColumnCount } from './hooks/useColumnCount';
import { Loader, AlertTriangle, Trash2, Settings as SettingsIcon, List, BarChart2, Share2, ChevronUp } from 'lucide-react';

type VotingPhase = 'voting' | 'results';
type AppStatus = 'loading' | 'success' | 'error' | 'selecting_session';
type SessionInfo = { id: string; name: string };
type ConfirmationState = {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
}

const getUserId = (): string => {
    let userId = localStorage.getItem('shutterRankUserId');
    if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('shutterRankUserId', userId);
    }
    return userId;
};

const calculateNormalizedScore = (rating: number): number => {
    if (rating <= 0) return 0;
    // Formula: 1 + (Rating - 1) * 0.25
    return 1 + (rating - 1) * 0.25;
};

// Extracted component to prevent re-mounting on parent state changes
const ExpandedGroupComponent = ({
                                    item,
                                    groupData,
                                    isClosing,
                                    expandedGroupId,
                                    showHiddenPhotos,
                                    hidingPhotoId,
                                    settings,
                                    onCollapse,
                                    onRate,
                                    onImageClick,
                                    onToggleVisibility,
                                    groupSelections,
                                    onSelectionChange,
                                    isTouchDevice
                                }: {
    item: PhotoStack,
    groupData: any,
    isClosing: boolean,
    expandedGroupId: string | null,
    showHiddenPhotos: boolean,
    hidingPhotoId: number | null,
    settings: Settings | null,
    onCollapse: (groupId: string) => void,
    onRate: (photoId: number, rating: number) => void,
    onImageClick: (photo: Photo) => void,
    onToggleVisibility: (photoId: number) => void,
    groupSelections: Record<string, number | null>,
    onSelectionChange: (groupId: string, photoId: number | null) => void,
    isTouchDevice: boolean
}) => {
    const isExpanded = expandedGroupId === item.groupId;
    const photosToShow = showHiddenPhotos ? item.photos : item.photos.filter(p => p.isVisible !== false || p.id === hidingPhotoId);

    // Internal state to trigger the class application AFTER mount
    const [animateOpen, setAnimateOpen] = useState(false);

    useEffect(() => {
        if (isExpanded) {
            // Force a reflow/paint in the collapsed state first
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    setAnimateOpen(true);
                });
            });
        } else if (isClosing) {
            setAnimateOpen(false);
        }
    }, [isExpanded, isClosing]);

    return (
        <div className="col-span-full" key={`expanded-${item.groupId}`}>
            <div id={`expanded-group-wrapper-${item.groupId}`} className={`expanded-group-wrapper ${animateOpen ? 'expanded' : ''}`}>
                <div className="expanded-group-container">
                    <div className="expanded-group-content">
                        <div className="expanded-group-grid-wrapper opacity-0">
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center pt-1 gap-3">
                                <div className="flex items-center gap-4">
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-200 flex items-center gap-3">
                                            Группа «{groupData?.name || ''}»
                                            <button onClick={() => onCollapse(item.groupId)} className="flex items-center gap-1 text-sm px-3 py-1 rounded-full bg-indigo-600/20 text-indigo-300 hover:bg-indigo-600/30 hover:text-indigo-200 font-semibold transition-colors flex-shrink-0 ml-2">
                                                <ChevronUp size={16}/>
                                                Свернуть
                                            </button>
                                        </h3>
                                        {groupData?.caption && <p className="text-sm text-gray-400 mt-1">{groupData.caption}</p>}
                                    </div>
                                </div>
                            </div>
                            <div className={`pt-4 ${settings?.layout === 'grid'
                                ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                                : "sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6"
                            }`}>
                                {photosToShow.map(photo => {
                                    const isSelected = item.selectedPhotoId === photo.id;
                                    const isDimmed = item.selectedPhotoId !== null && !isSelected;
                                    return (
                                        <div key={photo.id} className={settings?.layout === 'original' ? 'break-inside-avoid' : ''}>
                                            <PhotoCard
                                                photo={photo}
                                                onRate={onRate}
                                                onImageClick={onImageClick}
                                                displayVotes={false}
                                                layoutMode={settings?.layout || 'grid'}
                                                gridAspectRatio={settings?.gridAspectRatio || '4/3'}
                                                onToggleVisibility={onToggleVisibility}
                                                isDimmed={isDimmed}
                                                isHiding={hidingPhotoId === photo.id}
                                                showSelectionControl={true}
                                                isSelected={isSelected}
                                                onSelect={() => {
                                                    const currentSelection = groupSelections[item.groupId] || null;
                                                    const newSelectedId = currentSelection === photo.id ? null : photo.id;
                                                    onSelectionChange(item.groupId, newSelectedId);
                                                }}
                                                isFilterActive={showHiddenPhotos}
                                            />
                                        </div>
                                    )
                                })}
                            </div>
                            <div className="flex justify-center pt-6">
                                <button onClick={() => onCollapse(item.groupId)} className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                                    <ChevronUp size={18}/>
                                    Свернуть группу
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

const App: React.FC = () => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [availableSessions, setAvailableSessions] = useState<SessionInfo[]>([]);
    const [userId] = useState<string>(getUserId());

    const [photos, setPhotos] = useState<Photo[]>([]);
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
    const [groups, setGroups] = useState<FirebaseDataGroups>({});
    const [config, setConfig] = useState<Config | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [introArticle, setIntroArticle] = useState<string | null>(null);

    const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
    const [immersivePhotoId, setImmersivePhotoId] = useState<number | null>(null);

    const [sortBy, setSortBy] = useState<SortMode>('id');
    const [votingPhase, setVotingPhase] = useState<VotingPhase>('voting');
    const [status, setStatus] = useState<AppStatus>('loading');
    const [isScrolled, setIsScrolled] = useState(false);
    const [scrollToId, setScrollToId] = useState<number | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
    const [isRatingInfoModalOpen, setIsRatingInfoModalOpen] = useState(false);
    const [showHiddenPhotos, setShowHiddenPhotos] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

    const [expandedGroupId, setExpandedGroupId] = useState<string | null>(null);
    const [closingGroupId, setClosingGroupId] = useState<string | null>(null);
    const [expertViewGroupId, setExpertViewGroupId] = useState<string | null>(null);

    const [groupSelections, setGroupSelections] = useState<Record<string, number | null>>({});
    const [hidingPhotoId, setHidingPhotoId] = useState<number | null>(null);

    const [confirmation, setConfirmation] = useState<ConfirmationState>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    const { isTouchDevice } = useDeviceType();
    const columnsCount = useColumnCount();
    const headerRef = useRef<HTMLDivElement>(null);
    const closingTimeoutRef = useRef<number | null>(null);

    const openConfirmation = (title: string, message: string, onConfirm: () => void, onCancel?: () => void) => {
        setConfirmation({ isOpen: true, title, message, onConfirm, onCancel });
    };

    const closeConfirmation = () => {
        setConfirmation(prev => ({ ...prev, isOpen: false }));
    };

    useEffect(() => {
        const handleHashChange = () => {
            const hash = decodeURIComponent(window.location.hash.slice(1));
            setSessionId(hash || null);
        };

        window.addEventListener('hashchange', handleHashChange);
        handleHashChange(); // Initial load

        return () => window.removeEventListener('hashchange', handleHashChange);
    }, []);

    useEffect(() => {
        let unsubscribeFromVotes: (() => void) | null = null;

        const loadSessionData = async () => {
            if (!sessionId) {
                try {
                    const sessionsRef = ref(db, 'sessions');
                    const snapshot = await get(sessionsRef);
                    if (snapshot.exists()) {
                        const data = snapshot.val();
                        const sessionList: SessionInfo[] = Object.keys(data).map(id => ({
                            id: id,
                            name: data[id]?.config?.name || id
                        }));
                        setAvailableSessions(sessionList);
                    }
                    setStatus('selecting_session');
                } catch (error) {
                    console.error("Ошибка загрузки списка сессий:", error);
                    setStatus('error');
                }
                return;
            }

            setStatus('loading');
            try {
                const sessionRef = ref(db, `sessions/${sessionId}`);
                const snapshot = await get(sessionRef);

                if (!snapshot.exists()) {
                    console.error(`Ошибка: Сессия "${sessionId}" не найдена в Firebase.`);
                    setStatus('error');
                    return;
                }
                const data = snapshot.val();

                const loadedConfig = data.config as Config;
                setConfig(loadedConfig);

                // Safely handle potential missing data structures
                const photosData = (data.photos || { photos: [], introArticleMarkdown: '' }) as FirebasePhotoData;
                const groupsData = (data.groups || {}) as FirebaseDataGroups;
                setGroups(groupsData);

                if (photosData.introArticleMarkdown) {
                    setIntroArticle(photosData.introArticleMarkdown);
                    const hasSeenKey = `introArticleSeen_${sessionId}`;
                    const hasSeenArticle = localStorage.getItem(hasSeenKey);
                    if (!hasSeenArticle) {
                        setIsArticleModalOpen(true);
                        localStorage.setItem(hasSeenKey, 'true');
                    }
                }

                const savedSettingsRaw = localStorage.getItem('userSettings');
                if (savedSettingsRaw) {
                    setSettings(JSON.parse(savedSettingsRaw) as Settings);
                } else {
                    setSettings({
                        layout: !isTouchDevice ? loadedConfig.defaultLayoutDesktop : loadedConfig.defaultLayoutMobile,
                        gridAspectRatio: loadedConfig.defaultGridAspectRatio || '4/3'
                    });
                }

                const groupSelectionsKey = `groupSelections_${sessionId}`;
                const savedSelections = localStorage.getItem(groupSelectionsKey);
                setGroupSelections(savedSelections ? JSON.parse(savedSelections) : {});

                const initialPhotos = photosData.photos || [];
                const initialVotes = data.votes || {};

                const userVotesRef = ref(db, `sessions/${sessionId}/userVotes/${userId}`);
                const userVotesSnapshot = await get(userVotesRef);
                const userRatings: Record<string, number> = userVotesSnapshot.exists() ? userVotesSnapshot.val() : {};

                const visibilityKey = `userVisibility_${sessionId}`;
                const savedVisibilityRaw = localStorage.getItem(visibilityKey);
                const userVisibility: Record<string, boolean> = savedVisibilityRaw ? JSON.parse(savedVisibilityRaw) : {};

                const initialPhotoState: Photo[] = initialPhotos.map(p => {
                    const voteData = initialVotes[String(p.id)];
                    let votes = 0;
                    let voteCount = 0;
                    let normalizedScore = 0;

                    if (typeof voteData === 'number') {
                        votes = voteData;
                    } else if (typeof voteData === 'object' && voteData !== null) {
                        votes = voteData.s || 0;
                        voteCount = voteData.c || 0;
                        normalizedScore = voteData.n || 0;
                    }

                    return {
                        ...p,
                        votes,
                        voteCount,
                        normalizedScore,
                        userRating: userRatings[p.id],
                        isVisible: userVisibility[p.id] === undefined ? true : userVisibility[p.id]
                    };
                }).sort((a,b) => (a.order ?? a.id) - (b.order ?? b.id));

                setPhotos(initialPhotoState);
                setStatus('success');

            } catch (error) {
                console.error("Ошибка загрузки данных сессии из Firebase:", error);
                setStatus('error');
            }
        };

        loadSessionData().then(() => {
            if (sessionId) {
                const votesRef = ref(db, `sessions/${sessionId}/votes`);
                unsubscribeFromVotes = onValue(votesRef, (voteSnapshot: DataSnapshot) => {
                    const votesData = voteSnapshot.val() || {};
                    setPhotos(prevPhotos => {
                        if (prevPhotos.length === 0) return prevPhotos;
                        return prevPhotos.map(p => {
                            const pVoteData = votesData[String(p.id)];
                            let votes = 0;
                            let voteCount = 0;
                            let normalizedScore = 0;

                            if (typeof pVoteData === 'number') {
                                votes = pVoteData;
                            } else if (typeof pVoteData === 'object' && pVoteData !== null) {
                                votes = pVoteData.s || 0;
                                voteCount = pVoteData.c || 0;
                                normalizedScore = pVoteData.n || 0;
                            }

                            return {
                                ...p,
                                votes,
                                voteCount,
                                normalizedScore
                            };
                        });
                    });
                }, (error: Error) => {
                    console.error("Ошибка Firebase listener:", error);
                });
            }
        });

        return () => {
            if (unsubscribeFromVotes) {
                unsubscribeFromVotes();
            }
        };
    }, [sessionId, userId, isTouchDevice]);


    useEffect(() => {
        const headerElement = headerRef.current;
        if (!headerElement || status !== 'success') return;

        const handleScroll = () => {
            const offset = headerElement.offsetHeight;
            if (window.scrollY > offset) {
                setIsScrolled(true);
            } else {
                setIsScrolled(false);
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        handleScroll();

        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [status]);

    useEffect(() => {
        // Save only UI preferences like visibility to localStorage
        if (status !== 'success' || !sessionId) return;
        const userVisibility: { [key: number]: boolean } = {};
        photos.forEach(p => {
            userVisibility[p.id] = p.isVisible !== false;
        });
        localStorage.setItem(`userVisibility_${sessionId}`, JSON.stringify(userVisibility));
    }, [photos, status, sessionId]);

    useEffect(() => {
        const isAnyModalOpen = isSettingsModalOpen || isArticleModalOpen || isRatingInfoModalOpen || !!expertViewGroupId || !!selectedPhotoId || immersivePhotoId !== null || confirmation.isOpen;
        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }, [isSettingsModalOpen, isArticleModalOpen, isRatingInfoModalOpen, expertViewGroupId, selectedPhotoId, immersivePhotoId, confirmation.isOpen]);

    const scrollToPhoto = useCallback((photoId: number | null) => {
        if (photoId !== null) {
            // Delay to allow DOM to update after state change (e.g., stack expansion)
            setTimeout(() => setScrollToId(photoId), 50);
        }
    }, []);

    useEffect(() => {
        if (scrollToId === null) return;

        const element = document.getElementById(`photo-card-${scrollToId}`) || document.getElementById(`photo-stack-wrapper-${scrollToId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setScrollToId(null);
    }, [scrollToId]);

    const photosWithMaxRating = useMemo(() => {
        if (!photos.length || !config) return photos;

        const fourStarThreshold = config.unlockFourStarsThresholdPercent ?? 20;
        const fiveStarThreshold = config.unlockFiveStarsThresholdPercent ?? 50;

        const photosInCompetition = photos.filter(p => !p.isOutOfCompetition);
        if (photosInCompetition.length === 0) {
            return photos.map(p => ({ ...p, maxRating: 3 }));
        }

        const totalVotes = photosInCompetition.reduce((sum, p) => sum + p.votes, 0);

        if (totalVotes === 0) {
            return photos.map(p => ({ ...p, maxRating: 3 }));
        }

        const averageVotes = totalVotes / photosInCompetition.length;

        return photos.map(p => {
            if (p.isOutOfCompetition) return { ...p, maxRating: 3 };

            let maxRating = 3;
            // Use a small epsilon to handle floating point inaccuracies
            if (p.votes >= averageVotes * (1 + fiveStarThreshold / 100) - 0.001) {
                maxRating = 5;
            } else if (p.votes >= averageVotes * (1 + fourStarThreshold / 100) - 0.001) {
                maxRating = 4;
            }
            return { ...p, maxRating };
        });
    }, [photos, config]);

    useEffect(() => {
        const grouped: GalleryItem[] = [];
        const groupsProcessed: { [key: string]: PhotoStack } = {};

        photosWithMaxRating.forEach(photo => {
            if (photo.groupId) {
                if (!groupsProcessed[photo.groupId]) {
                    groupsProcessed[photo.groupId] = {
                        type: 'stack',
                        groupId: photo.groupId,
                        photos: [],
                        isExpanded: expandedGroupId === photo.groupId,
                        selectedPhotoId: groupSelections[photo.groupId] || null,
                    };
                    grouped.push(groupsProcessed[photo.groupId]);
                }
                groupsProcessed[photo.groupId].photos.push(photo);
            } else {
                grouped.push({ ...photo, type: 'photo' });
            }
        });

        // Second pass to check visibility/count within stacks and potential downgrades
        const finalGalleryItems: GalleryItem[] = [];

        grouped.forEach(item => {
            if (item.type === 'stack') {
                const visiblePhotosInGroup = showHiddenPhotos
                    ? item.photos
                    : item.photos.filter(p => p.isVisible !== false || p.id === hidingPhotoId);

                // If a group has only 1 photo (even if filter hides others), render as single photo.
                if (visiblePhotosInGroup.length <= 1) {
                    visiblePhotosInGroup.forEach(p => {
                        finalGalleryItems.push({ ...p, type: 'photo' });
                    });
                } else {
                    // Verify selectedPhotoId validity
                    if (item.selectedPhotoId && !item.photos.some(p => p.id === item.selectedPhotoId)) {
                        item.selectedPhotoId = null;
                    }
                    finalGalleryItems.push(item);
                }
            } else {
                finalGalleryItems.push(item);
            }
        });

        setGalleryItems(finalGalleryItems);
    }, [photosWithMaxRating, groupSelections, expandedGroupId, showHiddenPhotos, hidingPhotoId]);


    const ratedPhotosCount = useMemo(() => photos.filter(p => p.userRating && p.userRating > 0).length, [photos]);
    const starsUsed = useMemo(() => photos.reduce((sum, p) => sum + (p.userRating || 0), 0), [photos]);

    const handleRate = useCallback((photoId: number, rating: number) => {
        if (!config || !sessionId || !userId) return;

        const photoToUpdate = photosWithMaxRating.find(p => p.id === photoId);
        if (!photoToUpdate || photoToUpdate.isOutOfCompetition) return;

        const currentRating = photoToUpdate.userRating || 0;
        let newRating = rating;

        if (newRating > (photoToUpdate.maxRating ?? 3)) {
            setIsRatingInfoModalOpen(true);
            return;
        }

        if (newRating === currentRating) {
            newRating = 0; // Toggle off rating
        }

        const isNewRating = currentRating === 0 && newRating > 0;
        if (isNewRating && ratedPhotosCount >= config.ratedPhotoLimit) {
            setToastMessage(`Можно оценить не более ${config.ratedPhotoLimit} фотографий.`);
            return;
        }

        const starsDifference = newRating - currentRating;
        if (starsUsed + starsDifference > config.totalStarsLimit) {
            setToastMessage(`Общее количество звезд не может превышать ${config.totalStarsLimit}.`);
            return;
        }

        // Optimistic UI update
        setPhotos(prevPhotos =>
            prevPhotos.map(p => {
                if (p.id === photoId) {
                    const updatedPhoto: Photo = { ...p, userRating: newRating === 0 ? undefined : newRating };
                    if (newRating > 0) {
                        updatedPhoto.isVisible = true; // Automatically make visible when rated
                    }
                    return updatedPhoto;
                }
                return p;
            })
        );

        // Save individual vote to Firebase
        const userVoteRef = ref(db, `sessions/${sessionId}/userVotes/${userId}/${photoId}`);
        const userVotePromise: Promise<void> = newRating === 0 ? remove(userVoteRef) : set(userVoteRef, newRating);

        // Update aggregate score TRANSACTION
        const aggregateVoteRef = ref(db, `sessions/${sessionId}/votes/${photoId}`);

        const aggregateVotePromise: Promise<TransactionResult> = runTransaction(aggregateVoteRef, (currentData: any) => {
            // currentData can be:
            // 1. null (no votes yet)
            // 2. number (legacy format: just total stars)
            // 3. object { s: stars, c: count, n: normalized } (new format)

            let stars = 0;
            let count = 0;
            let normalized = 0;

            if (typeof currentData === 'number') {
                stars = currentData;
                // We don't know the count/normalized score for legacy data, so we assume 0.
            } else if (currentData) {
                stars = currentData.s || 0;
                count = currentData.c || 0;
                normalized = currentData.n || 0;
            }

            // Calculate deltas
            const starDelta = newRating - currentRating;

            let countDelta = 0;
            if (currentRating === 0 && newRating > 0) countDelta = 1; // New vote
            else if (currentRating > 0 && newRating === 0) countDelta = -1; // Removed vote

            const oldNorm = calculateNormalizedScore(currentRating);
            const newNorm = calculateNormalizedScore(newRating);
            const normDelta = newNorm - oldNorm;

            // Apply
            const newStars = stars + starDelta;
            const newCount = count + countDelta;
            const newNormalized = normalized + normDelta;

            // Return new object structure
            return {
                s: newStars,
                c: newCount,
                n: newNormalized
            };
        });

        const promises: (Promise<void> | Promise<TransactionResult>)[] = [userVotePromise, aggregateVotePromise];

        Promise.all(promises).catch((error: Error) => {
            console.error("Firebase write failed: ", error);
            setToastMessage('Ошибка: не удалось сохранить вашу оценку.');
            // Revert optimistic UI update on failure
            setPhotos(prevPhotos =>
                prevPhotos.map(p =>
                    p.id === photoId ? { ...p, userRating: currentRating === 0 ? undefined : currentRating, isVisible: photoToUpdate.isVisible } : p
                )
            );
        });

    }, [photosWithMaxRating, config, ratedPhotosCount, starsUsed, sessionId, userId]);

    const handleToggleVisibility = useCallback((photoId: number) => {
        const photo = photos.find(p => p.id === photoId);
        if (!photo || photo.isOutOfCompetition) return;

        const currentVisibility = photo.isVisible !== false;

        if (currentVisibility) {
            if (photo.userRating && photo.userRating > 0) {
                return;
            }

            setHidingPhotoId(photoId); // Trigger icon change and animation
            setTimeout(() => {
                setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, isVisible: false } : p));
                setHidingPhotoId(null);

                // If the hidden photo was viewed in a modal, navigate away
                if (selectedPhotoId === photoId) handleNextPhoto();
                if (immersivePhotoId === photoId) handleNextImmersive();
            }, 400); // Should match animation duration
        } else {
            setPhotos(prev => prev.map(p => p.id === photoId ? { ...p, isVisible: true } : p));
        }
    }, [photos, selectedPhotoId, immersivePhotoId]);

    const handleResetVotes = useCallback(() => {
        if (!sessionId || !userId) return;

        openConfirmation(
            'Сбросить все оценки?',
            'Вы уверены, что хотите сбросить все ваши оценки и отметки для этой сессии? Это действие нельзя отменить.',
            () => {
                closeConfirmation();
                const userVotesRef = ref(db, `sessions/${sessionId}/userVotes/${userId}`);
                remove(userVotesRef)
                    .then(() => {
                        setPhotos(prevPhotos =>
                            prevPhotos.map(p => ({...p, userRating: undefined, isVisible: true }))
                        );
                        localStorage.removeItem(`userVisibility_${sessionId}`);
                        setToastMessage("Ваши оценки были сброшены.");
                    })
                    .catch(err => {
                        console.error("Failed to clear votes in Firebase", err);
                        setToastMessage("Не удалось сбросить оценки. Попробуйте еще раз.");
                    });
            },
            closeConfirmation
        );
    }, [sessionId, userId]);

    // Helper for nested sorting logic
    const comparePhotos = useCallback((a: Photo, b: Photo, mode: SortMode) => {
        if (mode === 'id') return 0;

        const valA_stars = a.votes || 0;
        const valB_stars = b.votes || 0;
        const valA_score = a.normalizedScore || 0;
        const valB_score = b.normalizedScore || 0;
        const valA_count = a.voteCount || 0;
        const valB_count = b.voteCount || 0;

        if (mode === 'stars') {
            // 1. Stars, 2. Score, 3. Count
            if (valB_stars !== valA_stars) return valB_stars - valA_stars;
            if (valB_score !== valA_score) return valB_score - valA_score;
            return valB_count - valA_count;
        }
        if (mode === 'score') {
            // 1. Score, 2. Count, 3. Stars
            if (valB_score !== valA_score) return valB_score - valA_score;
            if (valB_count !== valA_count) return valB_count - valA_count;
            return valB_stars - valA_stars;
        }
        if (mode === 'count') {
            // 1. Count, 2. Score, 3. Stars
            if (valB_count !== valA_count) return valB_count - valA_count;
            if (valB_score !== valA_score) return valB_score - valA_score;
            return valB_stars - valA_stars;
        }
        return 0;
    }, []);

    const sortedGalleryItems = useMemo(() => {
        let itemsCopy = [...galleryItems];

        if (!showHiddenPhotos) {
            itemsCopy = itemsCopy.map(item => {
                if (item.type === 'stack' && expandedGroupId !== item.groupId) {
                    const visiblePhotosInStack = item.photos.filter(p => p.isVisible !== false || p.id === hidingPhotoId);
                    if (visiblePhotosInStack.length === 0) return null;
                } else if (item.type === 'photo' && item.isVisible === false && item.id !== hidingPhotoId) {
                    return null;
                }
                return item;
            }).filter((item): item is GalleryItem => item !== null);
        }

        if (sortBy === 'id') {
            return itemsCopy;
        }

        itemsCopy.sort((a, b) => {
            let photoA: Photo;
            let photoB: Photo;

            if (a.type === 'photo') {
                photoA = a;
            } else {
                if (votingPhase === 'voting') {
                    photoA = a.photos.find(p => p.id === a.selectedPhotoId) || a.photos[0];
                } else {
                    // Find best photo in stack based on current sort criteria
                    photoA = a.photos.reduce((best, current) => {
                        return comparePhotos(current, best, sortBy) < 0 ? current : best;
                    }, a.photos[0]);
                }
            }

            if (b.type === 'photo') {
                photoB = b;
            } else {
                if (votingPhase === 'voting') {
                    photoB = b.photos.find(p => p.id === b.selectedPhotoId) || b.photos[0];
                } else {
                    photoB = b.photos.reduce((best, current) => {
                        return comparePhotos(current, best, sortBy) < 0 ? current : best;
                    }, b.photos[0]);
                }
            }

            if (votingPhase === 'voting') {
                // Simple sort by user rating in voting mode
                const scoreA = photoA.userRating || 0;
                const scoreB = photoB.userRating || 0;
                if (scoreB !== scoreA) return scoreB - scoreA;
            } else {
                // Complex sort in results mode
                const comparison = comparePhotos(photoA, photoB, sortBy);
                if (comparison !== 0) return comparison;
            }

            // Fallback to original order
            const orderA = a.type === 'photo' ? (a.order ?? a.id) : (a.photos[0]?.order ?? a.photos[0]?.id ?? 0);
            const orderB = b.type === 'photo' ? (b.order ?? b.id) : (b.photos[0]?.order ?? b.photos[0]?.id ?? 0);
            return orderA - orderB;
        });

        return itemsCopy;

    }, [galleryItems, showHiddenPhotos, sortBy, votingPhase, hidingPhotoId, expandedGroupId, comparePhotos]);

    const photosForViewer = useMemo(() => {
        // Create a flat list of all photos for seamless navigation in viewers.
        const flatList: Photo[] = [];
        sortedGalleryItems.forEach(item => {
            if (item.type === 'stack') {
                // Add all photos from the group to the viewer list
                flatList.push(...item.photos);
            } else {
                flatList.push(item);
            }
        });
        return flatList;
    }, [sortedGalleryItems]);


    const selectedPhoto = useMemo(() => selectedPhotoId !== null ? photosForViewer.find(p => p.id === selectedPhotoId) : null, [selectedPhotoId, photosForViewer]);
    const selectedPhotoIndex = useMemo(() => selectedPhotoId !== null ? photosForViewer.findIndex(p => p.id === selectedPhotoId) : -1, [selectedPhotoId, photosForViewer]);

    const handleCloseModal = useCallback(() => {
        scrollToPhoto(selectedPhotoId);
        setSelectedPhotoId(null);
    }, [selectedPhotoId, scrollToPhoto]);

    const handleNextPhoto = useCallback(() => {
        if (photosForViewer.length === 0) {
            setSelectedPhotoId(null);
            return;
        };
        const nextIndex = (selectedPhotoIndex + 1) % photosForViewer.length;
        setSelectedPhotoId(photosForViewer[nextIndex].id);
    }, [selectedPhotoIndex, photosForViewer]);

    const handlePrevPhoto = useCallback(() => {
        if (photosForViewer.length === 0) return;
        const prevIndex = (selectedPhotoIndex - 1 + photosForViewer.length) % photosForViewer.length;
        setSelectedPhotoId(photosForViewer[prevIndex].id);
    }, [selectedPhotoIndex, photosForViewer]);

    const handleImageClick = useCallback((photo: Photo) => {
        if (isTouchDevice) {
            setImmersivePhotoId(photo.id);
        } else {
            setSelectedPhotoId(photo.id);
        }
    }, [isTouchDevice]);

    const immersivePhotoIndex = useMemo(() => immersivePhotoId !== null ? photosForViewer.findIndex(p => p.id === immersivePhotoId) : -1, [immersivePhotoId, photosForViewer]);

    const handleEnterImmersive = useCallback(() => {
        if (selectedPhoto) {
            setImmersivePhotoId(selectedPhoto.id);
            setSelectedPhotoId(null);
        }
    }, [selectedPhoto]);

    const handleCloseImmersive = useCallback((lastViewedPhotoId?: number) => {
        const finalPhotoId = lastViewedPhotoId ?? immersivePhotoId;
        setImmersivePhotoId(null);

        if (!isTouchDevice && finalPhotoId !== null) {
            setSelectedPhotoId(finalPhotoId);
        } else {
            scrollToPhoto(finalPhotoId);
        }
    }, [isTouchDevice, immersivePhotoId, scrollToPhoto]);

    const handleOpenGroupFromViewer = useCallback((groupId: string) => {
        setSelectedPhotoId(null);
        setImmersivePhotoId(null);
        setExpertViewGroupId(groupId);
    }, []);


    const handleNextImmersive = useCallback(() => {
        if (photosForViewer.length === 0 || immersivePhotoIndex === -1) {
            setImmersivePhotoId(null);
            return;
        }
        const nextIndex = (immersivePhotoIndex + 1) % photosForViewer.length;
        setImmersivePhotoId(photosForViewer[nextIndex].id);
    }, [immersivePhotoIndex, photosForViewer]);

    const handlePrevImmersive = useCallback(() => {
        if (photosForViewer.length === 0 || immersivePhotoIndex === -1) return;
        const prevIndex = (immersivePhotoIndex - 1 + photosForViewer.length) % photosForViewer.length;
        setImmersivePhotoId(photosForViewer[prevIndex].id);
    }, [immersivePhotoIndex, photosForViewer]);

    const handleTogglePhase = () => {
        setVotingPhase(p => p === 'voting' ? 'results' : 'voting');
        // Default to stars sort when switching to results if currently on ID
        if (votingPhase === 'voting' && sortBy === 'id') {
            setSortBy('stars');
        }
    };

    const handleSaveSettings = (settings: Settings) => {
        setSettings(settings);
        localStorage.setItem('userSettings', JSON.stringify(settings));
        setIsSettingsModalOpen(false);
    };

    const handleGroupSelectionChange = useCallback((groupId: string, newSelectedId: number | null, initiatedByRate = false) => {
        const oldSelectedId = groupSelections[groupId] || null;
        if (oldSelectedId === newSelectedId) return;

        const oldSelectedPhoto = oldSelectedId ? photos.find(p => p.id === oldSelectedId) : null;

        const performSelectionChange = () => {
            const newSelections = { ...groupSelections, [groupId]: newSelectedId };
            setGroupSelections(newSelections);
            if (sessionId) {
                localStorage.setItem(`groupSelections_${sessionId}`, JSON.stringify(newSelections));
            }
        };

        // Special Case: Unselecting a photo that has a rating
        if (newSelectedId === null && oldSelectedPhoto?.userRating) {
            handleRate(oldSelectedPhoto.id, 0); // Remove rating
            performSelectionChange();
            return;
        }

        const transferRating = () => {
            if (!oldSelectedPhoto?.userRating || newSelectedId === null) return;
            const ratingToTransfer = oldSelectedPhoto.userRating;
            const newSelectedPhoto = photos.find(p => p.id === newSelectedId);
            if (!newSelectedPhoto) return;

            setPhotos(prevPhotos =>
                prevPhotos.map(p => {
                    if (p.id === oldSelectedId) return { ...p, userRating: undefined };
                    if (p.id === newSelectedId) return { ...p, userRating: ratingToTransfer, isVisible: true };
                    return p;
                })
            );

            // TRANSACTION FOR TRANSFER
            const fromUserVoteRef = ref(db, `sessions/${sessionId}/userVotes/${userId}/${oldSelectedId}`);
            const fromAggregateVoteRef = ref(db, `sessions/${sessionId}/votes/${oldSelectedId}`);
            const toUserVoteRef = ref(db, `sessions/${sessionId}/userVotes/${userId}/${newSelectedId}`);
            const toAggregateVoteRef = ref(db, `sessions/${sessionId}/votes/${newSelectedId}`);

            const ratingNorm = calculateNormalizedScore(ratingToTransfer);

            const promises = [
                remove(fromUserVoteRef),
                // Decrement old
                runTransaction(fromAggregateVoteRef, (data) => {
                    let s = 0, c = 0, n = 0;
                    if(typeof data === 'number') { s = data; }
                    else if(data) { s = data.s||0; c = data.c||0; n = data.n||0; }

                    return { s: s - ratingToTransfer, c: c - 1, n: n - ratingNorm };
                }),
                set(toUserVoteRef, ratingToTransfer),
                // Increment new
                runTransaction(toAggregateVoteRef, (data) => {
                    let s = 0, c = 0, n = 0;
                    if(typeof data === 'number') { s = data; }
                    else if(data) { s = data.s||0; c = data.c||0; n = data.n||0; }

                    return { s: s + ratingToTransfer, c: c + 1, n: n + ratingNorm };
                }),
            ];

            Promise.all(promises).catch((error: Error) => {
                console.error("Firebase write failed during rating transfer: ", error);
                setToastMessage('Ошибка: не удалось перенести оценку.');
                setPhotos(prevPhotos =>
                    prevPhotos.map(p => {
                        if (p.id === oldSelectedId) return oldSelectedPhoto;
                        if (p.id === newSelectedId) return newSelectedPhoto;
                        return p;
                    })
                );
            });
            performSelectionChange();
        };

        if (newSelectedId !== null && oldSelectedPhoto && oldSelectedPhoto.userRating && !initiatedByRate) {
            openConfirmation(
                "Перенести отметку?",
                "В этой группе отмечена другая фотография. Перенести оценку с нее на этот снимок?",
                () => {
                    closeConfirmation();
                    transferRating();
                },
                closeConfirmation
            );
            return;
        }

        performSelectionChange();

    }, [groupSelections, sessionId, photos, userId, handleRate]);


    const handleRateInGroup = (photoId: number, rating: number) => {
        const photo = photos.find(p => p.id === photoId);
        if (!photo?.groupId) {
            handleRate(photoId, rating); // Fallback for safety
            return;
        }

        const groupId = photo.groupId;
        const currentSelectedId = groupSelections[groupId];
        const currentSelectedPhoto = currentSelectedId ? photos.find(p => p.id === currentSelectedId) : null;
        const isClearingRating = rating === 0 || rating === photo.userRating;
        const isNewRating = rating > 0 && !isClearingRating;

        if (isNewRating && currentSelectedId && currentSelectedId !== photoId && currentSelectedPhoto?.userRating) {
            openConfirmation(
                "Перенести отметку?",
                "В этой группе отмечена другая фотография. Перенести оценку с нее на этот снимок?",
                () => {
                    closeConfirmation();
                    // This function now handles both rating and selection transfer
                    handleGroupSelectionChange(groupId, photoId, true); // Mark as initiatedByRate
                    handleRate(currentSelectedId, 0); // Clear old rating
                    handleRate(photoId, rating); // Apply new rating
                },
                closeConfirmation
            );
        } else {
            handleRate(photoId, rating);

            if (isNewRating) {
                handleGroupSelectionChange(groupId, photoId, true);
            } else if (isClearingRating && currentSelectedId === photoId) {
                // Unconditionally remove selection when rating is cleared from selected photo.
                handleGroupSelectionChange(groupId, null, true);
            }
        }
    };

    const findGroupDetails = useCallback((photoId: number | null): { id: string; name: string; caption?: string; photos: Photo[] } | null => {
        if (photoId === null) return null;

        const photo = photos.find(p => p.id === photoId);
        if (!photo || !photo.groupId) return null;

        const groupData = groups[photo.groupId];
        if (!groupData) return null;

        const stack = galleryItems.find(item => item.type === 'stack' && item.groupId === photo.groupId) as PhotoStack | undefined;

        return { id: photo.groupId, name: groupData.name, caption: groupData.caption, photos: stack?.photos || [] };
    }, [photos, groups, galleryItems]);

    const selectedPhotoGroupInfo = useMemo(() => findGroupDetails(selectedPhotoId), [selectedPhotoId, findGroupDetails]);
    const immersivePhotoGroupInfo = useMemo(() => findGroupDetails(immersivePhotoId), [immersivePhotoId, findGroupDetails]);
    const expertViewStack = useMemo(() => {
        if (!expertViewGroupId) return null;
        return galleryItems.find(item => item.type === 'stack' && item.groupId === expertViewGroupId) as PhotoStack | null;
    }, [expertViewGroupId, galleryItems]);

    const handleShare = useCallback(() => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setToastMessage('Ссылка скопирована в буфер обмена');
        }).catch(() => {
            setToastMessage('Не удалось скопировать ссылку');
        });
    }, []);

    const handleExpandGroup = (groupId: string) => {
        if (closingTimeoutRef.current) {
            clearTimeout(closingTimeoutRef.current);
            closingTimeoutRef.current = null;
        }
        setExpandedGroupId(groupId);
        setClosingGroupId(null);
    };

    const handleCollapseGroup = (groupId: string) => {
        setClosingGroupId(groupId);
        setExpandedGroupId(null);

        closingTimeoutRef.current = window.setTimeout(() => {
            setClosingGroupId(null);
        }, 1500);
    };

    const StatsInfo = ({isCompact = false}) => {
        if (!config) return null;
        if (isCompact) {
            return (
                <div className="text-xs">
                    Оценено: <span className="font-bold text-indigo-400">{ratedPhotosCount}/{config.ratedPhotoLimit}</span>
                    <span className="text-gray-500 mx-2">|</span>
                    Звёзд: <span className="font-bold text-yellow-400">{starsUsed}/{config.totalStarsLimit}</span>
                </div>
            );
        }

        return (
            <div className="text-sm space-y-1 text-center text-gray-300 w-full">
                <div>Вы оценили фотографий: <span className="font-bold text-white">{ratedPhotosCount} / {config.ratedPhotoLimit}</span>, осталось: <span className="font-bold text-indigo-400">{config.ratedPhotoLimit - ratedPhotosCount}</span></div>
                <div>Израсходовали звезд: <span className="font-bold text-white">{starsUsed} / {config.totalStarsLimit}</span>, осталось: <span className="font-bold text-yellow-400">{config.totalStarsLimit - starsUsed}</span></div>
            </div>
        );
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center text-white">
                <Loader className="w-12 h-12 animate-spin text-indigo-400" />
                <p className="mt-4 text-lg">Загрузка сессии "{sessionId || '...'}"...</p>
            </div>
        );
    }

    if (status === 'selecting_session') {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center text-white p-4 text-center">
                <List className="w-12 h-12 text-indigo-400 mb-4" />
                <h1 className="text-3xl font-bold mb-6">Выберите сессию голосования</h1>
                <div className="max-w-sm w-full space-y-3">
                    {availableSessions.length > 0 ? (
                        availableSessions.map(session => (
                            <a
                                key={session.id}
                                href={`#${session.id}`}
                                className="block w-full text-center px-6 py-3 text-lg font-semibold rounded-lg bg-gray-700 hover:bg-indigo-600 focus:ring-indigo-500 text-white transition-colors"
                            >
                                {session.name}
                            </a>
                        ))
                    ) : (
                        <p className="text-gray-400">Доступных сессий не найдено.</p>
                    )}
                </div>
            </div>
        );
    }

    if (status === 'error' || !config || !settings) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center text-white p-4 text-center">
                <AlertTriangle className="w-12 h-12 text-red-500" />
                <h2 className="mt-4 text-2xl font-bold">Ошибка загрузки</h2>
                <p className="mt-2 text-gray-400 max-w-md">
                    Не удалось загрузить данные для сессии "{sessionId || 'неизвестно'}". Проверьте, что сессия с таким ID существует в Firebase и данные в ней корректны.
                </p>
                <a href="#" className="mt-6 px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                    Вернуться к выбору сессии
                </a>
            </div>
        );
    }

    const showStickyHeader = isScrolled || !!selectedPhoto;
    const hasVotes = ratedPhotosCount > 0;
    const sessionDisplayName = config.name || sessionId;

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
            <Toast message={toastMessage} onDismiss={() => setToastMessage(null)} />

            <ConfirmationModal
                isOpen={confirmation.isOpen}
                title={confirmation.title}
                message={confirmation.message}
                onConfirm={confirmation.onConfirm}
                onCancel={confirmation.onCancel || closeConfirmation}
            />

            {isArticleModalOpen && introArticle && (
                <ArticleModal content={introArticle} onClose={() => setIsArticleModalOpen(false)} />
            )}

            {isSettingsModalOpen && (
                <SettingsModal
                    currentSettings={settings}
                    onClose={() => setIsSettingsModalOpen(false)}
                    onSave={handleSaveSettings}
                />
            )}

            {isRatingInfoModalOpen && (
                <RatingInfoModal onClose={() => setIsRatingInfoModalOpen(false)} />
            )}

            {expertViewStack && (
                <GroupModal
                    isOpen={!!expertViewGroupId}
                    stack={expertViewStack}
                    groupName={groups[expertViewGroupId]?.name || ''}
                    groupCaption={groups[expertViewGroupId]?.caption}
                    onClose={() => setExpertViewGroupId(null)}
                    onRate={handleRateInGroup}
                    onImageClick={handleImageClick}
                    onToggleVisibility={handleToggleVisibility}
                    onSelectionChange={handleGroupSelectionChange}
                    displayVotes={votingPhase === 'results'}
                    layoutMode={settings.layout}
                    gridAspectRatio={settings.gridAspectRatio}
                    showHiddenPhotos={showHiddenPhotos}
                    isTouchDevice={isTouchDevice}
                    hidingPhotoId={hidingPhotoId}
                />
            )}

            <div className={`fixed top-0 left-0 right-0 bg-gray-800/80 backdrop-blur-lg border-b border-gray-700/50 shadow-lg transition-transform duration-300 ease-in-out px-4 py-2 flex justify-between items-center ${!!selectedPhoto ? 'z-[51]' : 'z-40'} ${showStickyHeader ? 'translate-y-0' : '-translate-y-full'}`}>
                <div className="flex items-center gap-4">
                    <ToggleSwitch id="sticky-show-hidden" checked={showHiddenPhotos} onChange={() => setShowHiddenPhotos(s => !s)} label="Показывать скрытые"/>
                </div>
                <StatsInfo isCompact={true} />
                <div className="w-48"></div> {/* Placeholder to balance the flex container */}
            </div>

            <main className={`container mx-auto px-4 py-8`}>
                <header ref={headerRef} className="text-center mb-8">
                    <div className="flex justify-center items-center gap-4 mb-2">
                        <h1 className="text-4xl font-bold tracking-tight">{sessionDisplayName}</h1>
                        <div className="flex items-center gap-2">
                            <button onClick={handleShare} className="text-gray-400 hover:text-white transition-colors" title="Поделиться ссылкой">
                                <Share2 className="w-6 h-6" />
                            </button>
                            <button onClick={() => setIsSettingsModalOpen(true)} className="text-gray-400 hover:text-white transition-colors" title="Настройки">
                                <SettingsIcon className="w-6 h-6" />
                            </button>
                        </div>
                    </div>
                    <p className="text-gray-400 mb-4 max-w-2xl mx-auto">Выберите до {config.ratedPhotoLimit} лучших фотографий. Вы можете распределить между ними до {config.totalStarsLimit} звезд.</p>
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 max-w-4xl mx-auto flex flex-col items-center gap-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4 w-full">
                            {/* Оценки */}
                            <div className="flex flex-col items-center gap-3 p-3 rounded-lg bg-gray-900/40">
                                <h3 className="font-semibold text-gray-400">Оценки</h3>
                                <StatsInfo />
                                <div className='flex flex-wrap items-center justify-center gap-4'>
                                    <button
                                        onClick={handleTogglePhase}
                                        className="inline-flex items-center gap-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-gray-600 hover:bg-gray-700 focus:ring-gray-500 text-white transition-colors"
                                    >
                                        <BarChart2 className="w-4 h-4" />
                                        <span>{votingPhase === 'voting' ? 'Показать общие' : 'Скрыть общие'}</span>
                                    </button>
                                    <button
                                        onClick={handleResetVotes}
                                        disabled={!hasVotes}
                                        className="inline-flex items-center gap-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-800 hover:bg-red-700 focus:ring-red-600 text-white transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        <span>Сбросить оценки</span>
                                    </button>
                                </div>
                            </div>

                            {/* Вид */}
                            <div className="flex flex-col items-center gap-3 p-3 rounded-lg bg-gray-900/40">
                                <h3 className="font-semibold text-gray-400">Вид</h3>
                                <ToggleSwitch id="main-show-hidden" checked={showHiddenPhotos} onChange={() => setShowHiddenPhotos(s => !s)} label="Показывать скрытые" />
                                <div className="flex flex-wrap justify-center gap-2">
                                    <span className="text-gray-400 text-sm self-center w-full sm:w-auto text-center">Сортировать по:</span>
                                    {votingPhase === 'voting' ? (
                                        <>
                                            <button onClick={() => setSortBy('id')} className={`px-3 py-1 text-sm rounded-md ${sortBy === 'id' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>№</button>
                                            <button onClick={() => setSortBy('score')} className={`px-3 py-1 text-sm rounded-md ${sortBy === 'score' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Мой рейтинг</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => setSortBy('id')} className={`px-3 py-1 text-sm rounded-md ${sortBy === 'id' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>№</button>
                                            <button onClick={() => setSortBy('stars')} className={`px-3 py-1 text-sm rounded-md ${sortBy === 'stars' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Звездам</button>
                                            <button onClick={() => setSortBy('score')} className={`px-3 py-1 text-sm rounded-md ${sortBy === 'score' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Баллам</button>
                                            <button onClick={() => setSortBy('count')} className={`px-3 py-1 text-sm rounded-md ${sortBy === 'count' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Голосам</button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </header>

                <div className={settings.layout === 'grid'
                    ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                    : "sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6"
                }>
                    {votingPhase === 'voting' ? (
                        sortedGalleryItems.map((item, index) => {

                            // LOGIC FOR "ROW EXPANDER"
                            const currentRow = Math.floor(index / columnsCount);
                            const isLastInRow = (index + 1) % columnsCount === 0;
                            const isLastItem = index === sortedGalleryItems.length - 1;

                            let expandedItemToRender: PhotoStack | null = null;
                            let expandedGroupData: any = null;
                            let isRenderedGroupClosing = false;

                            if (settings.layout === 'grid') {
                                const activeId = expandedGroupId || closingGroupId;
                                if (activeId) {
                                    const activeItemIndex = sortedGalleryItems.findIndex(i => i.type === 'stack' && i.groupId === activeId);
                                    if (activeItemIndex !== -1) {
                                        const activeRow = Math.floor(activeItemIndex / columnsCount);
                                        if (activeRow === currentRow && (isLastInRow || isLastItem)) {
                                            expandedItemToRender = sortedGalleryItems[activeItemIndex] as PhotoStack;
                                            expandedGroupData = groups[activeId];
                                            isRenderedGroupClosing = closingGroupId === activeId;
                                        }
                                    }
                                }
                            }

                            const itemElement = (
                                <React.Fragment key={item.type === 'stack' ? item.groupId : item.id}>
                                    {item.type === 'stack' ? (
                                        <div className={settings.layout === 'original' ? 'break-inside-avoid' : ''}>
                                            <PhotoStackComponent
                                                stack={item}
                                                groupName={groups[item.groupId]?.name || ''}
                                                onRate={handleRate}
                                                onImageClick={handleImageClick}
                                                onExpand={() => {
                                                    if (expandedGroupId === item.groupId) {
                                                        handleCollapseGroup(item.groupId);
                                                    } else {
                                                        handleExpandGroup(item.groupId);
                                                    }
                                                }}
                                                displayVotes={false}
                                                layoutMode={settings.layout}
                                                gridAspectRatio={settings.gridAspectRatio}
                                                isTouchDevice={isTouchDevice}
                                                onShowToast={(msg) => setToastMessage(msg)}
                                            />
                                            {settings.layout === 'original' && (expandedGroupId === item.groupId || closingGroupId === item.groupId) && (
                                                <ExpandedGroupComponent
                                                    item={item}
                                                    groupData={groups[item.groupId]}
                                                    isClosing={closingGroupId === item.groupId}
                                                    expandedGroupId={expandedGroupId}
                                                    showHiddenPhotos={showHiddenPhotos}
                                                    hidingPhotoId={hidingPhotoId}
                                                    settings={settings}
                                                    onCollapse={handleCollapseGroup}
                                                    onRate={handleRateInGroup}
                                                    onImageClick={handleImageClick}
                                                    onToggleVisibility={handleToggleVisibility}
                                                    groupSelections={groupSelections}
                                                    onSelectionChange={handleGroupSelectionChange}
                                                    isTouchDevice={isTouchDevice}
                                                />
                                            )}
                                        </div>
                                    ) : (
                                        <div className={settings.layout === 'original' ? 'break-inside-avoid' : ''}>
                                            <PhotoCard
                                                photo={item}
                                                onRate={handleRate}
                                                onImageClick={handleImageClick}
                                                displayVotes={false}
                                                layoutMode={settings.layout}
                                                gridAspectRatio={settings.gridAspectRatio}
                                                onToggleVisibility={handleToggleVisibility}
                                                isHiding={hidingPhotoId === item.id}
                                                isFilterActive={showHiddenPhotos}
                                            />
                                        </div>
                                    )}

                                    {expandedItemToRender && (
                                        <ExpandedGroupComponent
                                            item={expandedItemToRender}
                                            groupData={expandedGroupData}
                                            isClosing={isRenderedGroupClosing}
                                            expandedGroupId={expandedGroupId}
                                            showHiddenPhotos={showHiddenPhotos}
                                            hidingPhotoId={hidingPhotoId}
                                            settings={settings}
                                            onCollapse={handleCollapseGroup}
                                            onRate={handleRateInGroup}
                                            onImageClick={handleImageClick}
                                            onToggleVisibility={handleToggleVisibility}
                                            groupSelections={groupSelections}
                                            onSelectionChange={handleGroupSelectionChange}
                                            isTouchDevice={isTouchDevice}
                                        />
                                    )}
                                </React.Fragment>
                            );
                            return itemElement;
                        })
                    ) : (
                        sortedGalleryItems.map(item => {
                            if (item.type === 'stack') {
                                // Find best photo in stack based on current sort mode (or score by default)
                                const bestPhoto = item.photos.reduce((best, current) => {
                                    return comparePhotos(current, best, sortBy) < 0 ? current : best;
                                }, item.photos[0]);

                                if (!bestPhoto) return null;
                                const groupData = groups[item.groupId];
                                return (
                                    <div key={item.groupId} className={settings.layout === 'original' ? 'break-inside-avoid' : ''}>
                                        <PhotoCard
                                            photo={bestPhoto}
                                            onRate={handleRate}
                                            onImageClick={handleImageClick}
                                            displayVotes={true}
                                            layoutMode={settings.layout}
                                            gridAspectRatio={settings.gridAspectRatio}
                                            onToggleVisibility={handleToggleVisibility}
                                            isReadOnly={true}
                                        />
                                        <div className="text-center -mt-2 text-sm bg-gray-800 p-1 rounded-b-md">
                                            <p className="font-semibold">Лучшее из группы «{groupData?.name}»</p>
                                        </div>
                                    </div>
                                );
                            }
                            return (
                                <div key={item.id} className={settings.layout === 'original' ? 'break-inside-avoid' : ''}>
                                    <PhotoCard
                                        photo={item}
                                        onRate={()=>{}}
                                        onImageClick={handleImageClick}
                                        displayVotes={true}
                                        layoutMode={settings.layout}
                                        gridAspectRatio={settings.gridAspectRatio}
                                        onToggleVisibility={()=>{}}
                                        isReadOnly={true}
                                    />
                                </div>
                            );
                        })
                    )}
                </div>
            </main>

            {selectedPhoto && (
                <Modal
                    photo={selectedPhoto}
                    allPhotosInGroup={selectedPhotoGroupInfo?.photos || []}
                    onClose={handleCloseModal}
                    displayVotes={votingPhase === 'results'}
                    onNext={handleNextPhoto}
                    onPrev={handlePrevPhoto}
                    onEnterImmersive={handleEnterImmersive}
                    onRate={handleRateInGroup}
                    onToggleVisibility={handleToggleVisibility}
                    hasNext={photosForViewer.length > 1}
                    hasPrev={photosForViewer.length > 1}
                    config={config}
                    ratedPhotosCount={ratedPhotosCount}
                    starsUsed={starsUsed}
                    groupInfo={selectedPhotoGroupInfo}
                    groupSelections={groupSelections}
                    onGroupSelectionChange={handleGroupSelectionChange}
                    onOpenGroup={handleOpenGroupFromViewer}
                />
            )}

            {immersivePhotoId !== null && (
                <ImmersiveView
                    allPhotos={photosForViewer}
                    photoId={immersivePhotoId}
                    allPhotosInGroup={immersivePhotoGroupInfo?.photos || []}
                    onClose={handleCloseImmersive}
                    onNext={handleNextImmersive}
                    onPrev={handlePrevImmersive}
                    onRate={handleRateInGroup}
                    onToggleVisibility={handleToggleVisibility}
                    displayVotes={votingPhase === 'results'}
                    ratedPhotosCount={ratedPhotosCount}
                    starsUsed={starsUsed}
                    ratedPhotoLimit={config.ratedPhotoLimit}
                    totalStarsLimit={config.totalStarsLimit}
                    groupInfo={immersivePhotoGroupInfo}
                    groupSelections={groupSelections}
                    onGroupSelectionChange={handleGroupSelectionChange}
                    onOpenGroup={handleOpenGroupFromViewer}
                />
            )}
        </div>
    );
};

export default App;
