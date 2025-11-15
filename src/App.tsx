import * as React from 'react';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { db } from './firebase';
import { ref, get, onValue, runTransaction, DataSnapshot, set, remove, TransactionResult, update } from 'firebase/database';
import { Photo, FirebasePhotoData, Settings, Config, GalleryItem, PhotoStack, FirebaseDataGroups } from './types';
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
import { useDeviceType } from './hooks/useDeviceType';
import { Eye, EyeOff, Loader, AlertTriangle, Trash2, Settings as SettingsIcon, List, BarChart2, ChevronsRight, X } from 'lucide-react';

type SortMode = 'score' | 'id';
type VotingPhase = 'voting' | 'results';
type AppStatus = 'loading' | 'success' | 'error' | 'selecting_session';
type SessionInfo = { id: string; name: string };

const getUserId = (): string => {
    let userId = localStorage.getItem('shutterRankUserId');
    if (!userId) {
        userId = crypto.randomUUID();
        localStorage.setItem('shutterRankUserId', userId);
    }
    return userId;
};

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
    const [expertViewGroupId, setExpertViewGroupId] = useState<string | null>(null);

    const [groupSelections, setGroupSelections] = useState<Record<string, number | null>>({});
    const [hidingPhotoId, setHidingPhotoId] = useState<number | null>(null);

    const { isDesktop, isTouchDevice } = useDeviceType();
    const headerRef = useRef<HTMLDivElement>(null);

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

                const photosData = data.photos as FirebasePhotoData;
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

                const initialPhotos = photosData.photos;
                const initialVotes = data.votes || {};

                const userVotesRef = ref(db, `sessions/${sessionId}/userVotes/${userId}`);
                const userVotesSnapshot = await get(userVotesRef);
                const userRatings: Record<string, number> = userVotesSnapshot.exists() ? userVotesSnapshot.val() : {};

                const visibilityKey = `userVisibility_${sessionId}`;
                const savedVisibilityRaw = localStorage.getItem(visibilityKey);
                const userVisibility: Record<string, boolean> = savedVisibilityRaw ? JSON.parse(savedVisibilityRaw) : {};

                const initialPhotoState: Photo[] = initialPhotos.map(p => ({
                    ...p,
                    votes: initialVotes[String(p.id)] || 0,
                    userRating: userRatings[p.id],
                    isVisible: userVisibility[p.id] === undefined ? true : userVisibility[p.id]
                })).sort((a,b) => (a.order ?? a.id) - (b.order ?? b.id));
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
                    const votes = voteSnapshot.val() || {};
                    setPhotos(prevPhotos => {
                        if (prevPhotos.length === 0) return prevPhotos;
                        return prevPhotos.map(p => ({
                            ...p,
                            votes: votes[String(p.id)] || 0
                        }));
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
        const isAnyModalOpen = isSettingsModalOpen || isArticleModalOpen || isRatingInfoModalOpen || !!expertViewGroupId || !!selectedPhotoId || immersivePhotoId !== null;
        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }, [isSettingsModalOpen, isArticleModalOpen, isRatingInfoModalOpen, expertViewGroupId, selectedPhotoId, immersivePhotoId]);

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

        Object.values(groupsProcessed).forEach(stack => {
            // Ensure selectedPhotoId from localStorage is still valid
            if (stack.selectedPhotoId && !stack.photos.some(p => p.id === stack.selectedPhotoId)) {
                stack.selectedPhotoId = null;
            }
        });

        setGalleryItems(grouped);
    }, [photosWithMaxRating, groupSelections, expandedGroupId]);


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

        // Update aggregate score
        const aggregateVoteRef = ref(db, `sessions/${sessionId}/votes/${photoId}`);
        const aggregateVotePromise: Promise<TransactionResult> = runTransaction(aggregateVoteRef, (currentVotes: number | null) => {
            return (currentVotes || 0) + starsDifference;
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
                // setToastMessage("Оцененные фотографии нельзя скрыть."); // Now handled by disabled button
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

        if (window.confirm('Вы уверены, что хотите сбросить все ваши оценки и отметки для этой сессии? Это действие нельзя отменить.')) {
            // TODO: Revert aggregate score in a future version with Cloud Functions for atomicity.
            // For now, we only clear the user's individual votes.

            const userVotesRef = ref(db, `sessions/${sessionId}/userVotes/${userId}`);

            // Clear Firebase data first
            remove(userVotesRef)
                .then(() => {
                    // Then clear local state on success
                    setPhotos(prevPhotos =>
                        prevPhotos.map(p => ({...p, userRating: undefined, isVisible: true }))
                    );
                    // Also clear visibility from localStorage
                    localStorage.removeItem(`userVisibility_${sessionId}`);
                })
                .catch(err => {
                    console.error("Failed to clear votes in Firebase", err);
                    setToastMessage("Не удалось сбросить оценки. Попробуйте еще раз.");
                });
        }
    }, [sessionId, userId]);

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
            // The default order is already sorted by the `order` field from initial load.
            return itemsCopy;
        }

        // sortBy === 'score'
        const getScore = (item: GalleryItem): number => {
            if (votingPhase === 'voting') {
                if (item.type === 'photo') {
                    return item.userRating || 0;
                } else { // stack
                    const selected = item.photos.find(p => p.id === item.selectedPhotoId);
                    return selected?.userRating || 0;
                }
            } else { // results phase
                if (item.type === 'photo') {
                    return item.votes || 0;
                } else { // stack
                    return Math.max(0, ...item.photos.map(p => p.votes || 0));
                }
            }
        };

        itemsCopy.sort((a, b) => {
            const scoreB = getScore(b);
            const scoreA = getScore(a);
            if (scoreB !== scoreA) {
                return scoreB - scoreA;
            }
            // Fallback to original order for items with the same score
            const orderA = a.type === 'photo' ? (a.order ?? a.id) : (a.photos[0]?.order ?? a.photos[0]?.id ?? 0);
            const orderB = b.type === 'photo' ? (b.order ?? b.id) : (b.photos[0]?.order ?? b.photos[0]?.id ?? 0);
            return orderA - orderB;
        });

        return itemsCopy;

    }, [galleryItems, showHiddenPhotos, sortBy, votingPhase, hidingPhotoId, expandedGroupId]);

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
    };

    const handleSaveSettings = (settings: Settings) => {
        setSettings(settings);
        localStorage.setItem('userSettings', JSON.stringify(settings));
        setIsSettingsModalOpen(false);
    };

    const handleGroupSelectionChange = useCallback((groupId: string, newSelectedId: number | null) => {
        const oldSelectedId = groupSelections[groupId] || null;
        if (oldSelectedId === newSelectedId) return;

        // Case: User manually deselects a rated photo via the checkmark
        if (newSelectedId === null && oldSelectedId) {
            const oldSelectedPhoto = photos.find(p => p.id === oldSelectedId);
            if (oldSelectedPhoto?.userRating) {
                if (window.confirm('Группа без выбранной фотографии не может иметь оценку. Снять выделение и сбросить оценку?')) {
                    handleRate(oldSelectedId, 0);
                } else {
                    return; // User cancelled, do not change selection
                }
            }
        }

        // Update selection state
        const newSelections = { ...groupSelections, [groupId]: newSelectedId };
        setGroupSelections(newSelections);
        if (sessionId) {
            localStorage.setItem(`groupSelections_${sessionId}`, JSON.stringify(newSelections));
        }
    }, [groupSelections, sessionId, photos, handleRate]);


    const handleRateInGroup = (photoId: number, rating: number) => {
        const photo = photos.find(p => p.id === photoId);
        if (!photo?.groupId) {
            handleRate(photoId, rating); // Fallback for safety
            return;
        }

        const groupId = photo.groupId;
        const currentSelectedId = groupSelections[groupId];
        const currentSelectedPhoto = currentSelectedId ? photos.find(p => p.id === currentSelectedId) : null;
        const isNewRating = rating > 0 && rating !== photo.userRating;

        // Is the user trying to rate a NEW photo while another one is already rated?
        if (isNewRating && currentSelectedId && currentSelectedId !== photoId && currentSelectedPhoto?.userRating) {
            if (window.confirm("В этой группе отмечена другая фотография. Перенести отметку с нее на этот снимок?")) {
                // 1. Clear old rating.
                handleRate(currentSelectedId, 0);
                // 2. Apply new rating.
                handleRate(photoId, rating);
                // 3. Update selection.
                handleGroupSelectionChange(groupId, photoId);
            }
            // If user cancels, do nothing.
        } else {
            // Standard case (first rating, changing rating of selected photo, clearing rating).
            handleRate(photoId, rating);
            const isClearingRating = rating === photo.userRating || rating === 0;

            if (!isClearingRating && rating > 0) {
                handleGroupSelectionChange(groupId, photoId);
            } else if (isClearingRating && currentSelectedId === photoId) {
                // If the rating of the selected photo is removed, deselect it.
                handleGroupSelectionChange(groupId, null);
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
                    onRate={handleRate}
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
                    {/* <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">← К выбору сессии</a> */}
                    <ToggleSwitch id="sticky-show-hidden" checked={showHiddenPhotos} onChange={() => setShowHiddenPhotos(s => !s)} label="Показывать скрытые"/>
                </div>
                <StatsInfo isCompact={true} />
                <div className="w-48"></div> {/* Placeholder to balance the flex container */}
            </div>

            <main className={`container mx-auto px-4 py-8`}>
                <header ref={headerRef} className="text-center mb-8">
                    <div className="flex justify-center items-center gap-3 mb-2">
                        <h1 className="text-4xl font-bold tracking-tight">{sessionDisplayName}</h1>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="text-gray-400 hover:text-white transition-colors" title="Настройки">
                            <SettingsIcon className="w-6 h-6" />
                        </button>
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
                                <div className="flex space-x-2">
                                    <span className="text-gray-400 text-sm self-center">Сортировать:</span>
                                    <button onClick={() => setSortBy('score')} className={`px-3 py-1 text-sm rounded-md ${sortBy === 'score' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>По рейтингу</button>
                                    <button onClick={() => setSortBy('id')} className={`px-3 py-1 text-sm rounded-md ${sortBy === 'id' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>По порядку</button>
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
                        sortedGalleryItems.map(item => {
                            if (item.type === 'stack') {
                                if (expandedGroupId === item.groupId) {
                                    // Render expanded group
                                    const groupData = groups[item.groupId];
                                    const photosToShow = showHiddenPhotos ? item.photos : item.photos.filter(p => p.isVisible !== false || p.id === hidingPhotoId);

                                    return (
                                        <div key={`expanded-${item.groupId}`} className={`col-span-full ${settings.layout === 'original' ? 'break-inside-avoid' : ''}`}>
                                            <div className="expanded-group-container">
                                                <div className="flex justify-between items-center mb-4">
                                                    <div>
                                                        <h3 className="text-lg font-bold text-gray-200">Группа: «{groupData?.name || ''}»</h3>
                                                        {groupData?.caption && <p className="text-sm text-gray-400">{groupData.caption}</p>}
                                                    </div>
                                                    <button onClick={() => setExpandedGroupId(null)} className="flex items-center gap-2 text-sm text-indigo-400 hover:text-indigo-300 font-semibold transition-colors">
                                                        <X size={18}/>
                                                        Свернуть группу
                                                    </button>
                                                </div>
                                                <div className={settings.layout === 'grid'
                                                    ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                                                    : "sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6"
                                                }>
                                                    {photosToShow.map(photo => {
                                                        const isSelected = item.selectedPhotoId === photo.id;
                                                        const isDimmed = item.selectedPhotoId !== null && !isSelected;
                                                        return (
                                                            <div key={photo.id} className={settings.layout === 'original' ? 'break-inside-avoid' : ''}>
                                                                <PhotoCard
                                                                    photo={photo}
                                                                    onRate={handleRateInGroup}
                                                                    onImageClick={handleImageClick}
                                                                    displayVotes={false}
                                                                    layoutMode={settings.layout}
                                                                    gridAspectRatio={settings.gridAspectRatio}
                                                                    onToggleVisibility={handleToggleVisibility}
                                                                    isHiding={hidingPhotoId === photo.id}
                                                                    isDimmed={isDimmed}
                                                                    showSelectionControl={true}
                                                                    isSelected={isSelected}
                                                                    onSelect={() => handleGroupSelectionChange(item.groupId, isSelected ? null : photo.id)}
                                                                />
                                                            </div>
                                                        )
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                } else {
                                    // Render collapsed stack
                                    return (
                                        <div key={item.groupId} className={`${settings.layout === 'original' ? 'break-inside-avoid' : ''}`}>
                                            <PhotoStackComponent
                                                stack={item}
                                                onRate={handleRate}
                                                onImageClick={handleImageClick}
                                                onToggleVisibility={handleToggleVisibility}
                                                onExpand={() => setExpandedGroupId(item.groupId)}
                                                displayVotes={false}
                                                layoutMode={settings.layout}
                                                gridAspectRatio={settings.gridAspectRatio}
                                                isTouchDevice={isTouchDevice}
                                                hidingPhotoId={hidingPhotoId}
                                            />
                                        </div>
                                    );
                                }
                            } else {
                                return (
                                    <div key={item.id} className={settings.layout === 'original' ? 'break-inside-avoid' : ''}>
                                        <PhotoCard
                                            photo={item}
                                            onRate={handleRate}
                                            onImageClick={handleImageClick}
                                            displayVotes={false}
                                            layoutMode={settings.layout}
                                            gridAspectRatio={settings.gridAspectRatio}
                                            onToggleVisibility={handleToggleVisibility}
                                            isHiding={hidingPhotoId === item.id}
                                        />
                                    </div>
                                );
                            }
                        })
                    ) : (
                        sortedGalleryItems.map(item => {
                            if (item.type === 'stack') {
                                const groupData = groups[item.groupId];
                                const sortedPhotosInGroup = item.photos.slice().sort((a, b) =>
                                    sortBy === 'score' ? (b.votes || 0) - (a.votes || 0) : (a.order ?? a.id) - (b.order ?? b.id)
                                );
                                return (
                                    <React.Fragment key={`group-results-${item.groupId}`}>
                                        <div className="col-span-full mt-8 mb-4">
                                            <h2 className="text-2xl font-bold text-gray-300 border-b-2 border-gray-700 pb-2">
                                                Группа: {groupData?.name || 'Без названия'}
                                            </h2>
                                        </div>
                                        {sortedPhotosInGroup.map(photo => (
                                            <div key={photo.id} className={settings.layout === 'original' ? 'break-inside-avoid' : ''}>
                                                <PhotoCard
                                                    photo={photo}
                                                    onRate={() => {}}
                                                    onImageClick={() => {}}
                                                    onToggleVisibility={() => {}}
                                                    displayVotes={true}
                                                    layoutMode={settings.layout}
                                                    gridAspectRatio={settings.gridAspectRatio}
                                                    isReadOnly={true}
                                                />
                                            </div>
                                        ))}
                                    </React.Fragment>
                                );
                            } else {
                                return (
                                    <div key={item.id} className={settings.layout === 'original' ? 'break-inside-avoid' : ''}>
                                        <PhotoCard
                                            photo={item}
                                            onRate={() => {}}
                                            onImageClick={() => {}}
                                            onToggleVisibility={() => {}}
                                            displayVotes={true}
                                            layoutMode={settings.layout}
                                            gridAspectRatio={settings.gridAspectRatio}
                                            isReadOnly={true}
                                        />
                                    </div>
                                );
                            }
                        })
                    )}
                </div>
            </main>

            {!isTouchDevice && selectedPhoto && (
                <Modal
                    photo={selectedPhoto}
                    allPhotosInGroup={selectedPhotoGroupInfo?.photos || []}
                    onClose={handleCloseModal}
                    displayVotes={votingPhase === 'results'}
                    onRate={handleRate}
                    onToggleVisibility={handleToggleVisibility}
                    onNext={handleNextPhoto}
                    onPrev={handlePrevPhoto}
                    onEnterImmersive={handleEnterImmersive}
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
                    onRate={handleRate}
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