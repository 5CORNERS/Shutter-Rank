

import * as React from 'react';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { db } from './firebase';
import { ref, get, onValue, runTransaction, DataSnapshot, set, remove, TransactionResult } from 'firebase/database';
import { Photo, FirebasePhotoData, Settings, Config, GalleryItem, PhotoStack, FirebaseDataGroups } from './types';
import { PhotoCard } from './components/PhotoCard';
import { Modal } from './components/Modal';
import { ImmersiveView } from './components/ImmersiveView';
import { SettingsModal } from './components/SettingsModal';
import { ArticleModal } from './components/IntroModal';
import { RatingInfoModal } from './components/RatingInfoModal';
import { PhotoStackComponent } from './components/PhotoStack';
import { Toast } from './components/Toast';
import { useDeviceType } from './hooks/useDeviceType';
import { Eye, EyeOff, Loader, AlertTriangle, Trash2, Settings as SettingsIcon, Flag, FlagOff, List } from 'lucide-react';

type SortMode = 'score' | 'id';
type VotingPhase = 'voting' | 'results';
type AppStatus = 'loading' | 'success' | 'error' | 'selecting_session';

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
    const [availableSessions, setAvailableSessions] = useState<string[]>([]);
    const [userId] = useState<string>(getUserId());

    const [photos, setPhotos] = useState<Photo[]>([]);
    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
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
    const [filterFlags, setFilterFlags] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);

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
                        setAvailableSessions(Object.keys(snapshot.val()));
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

                const initialPhotos = photosData.photos;
                const initialVotes = data.votes || {};

                const userVotesRef = ref(db, `sessions/${sessionId}/userVotes/${userId}`);
                const userVotesSnapshot = await get(userVotesRef);
                const userRatings: Record<string, number> = userVotesSnapshot.exists() ? userVotesSnapshot.val() : {};

                const flagsKey = `userFlags_${sessionId}`;
                const savedFlagsRaw = localStorage.getItem(flagsKey);
                const userFlags: Record<string, boolean> = savedFlagsRaw ? JSON.parse(savedFlagsRaw) : {};

                const initialPhotoState: Photo[] = initialPhotos.map(p => ({
                    ...p,
                    votes: initialVotes[String(p.id)] || 0,
                    userRating: userRatings[p.id],
                    isFlagged: userFlags[p.id] === undefined ? true : userFlags[p.id]
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
        // Save only UI preferences like flags to localStorage
        if (status !== 'success' || !sessionId) return;
        const userFlags: { [key: number]: boolean } = {};
        photos.forEach(p => {
            userFlags[p.id] = p.isFlagged !== false;
        });
        localStorage.setItem(`userFlags_${sessionId}`, JSON.stringify(userFlags));
    }, [photos, status, sessionId]);

    useEffect(() => {
        if (scrollToId === null) return;

        const element = document.getElementById(`photo-card-${scrollToId}`) || document.getElementById(`photo-stack-${scrollToId}`);
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
                    const existingStack = galleryItems.find(item => 'photos' in item && item.groupId === photo.groupId) as PhotoStack | undefined;

                    groupsProcessed[photo.groupId] = {
                        type: 'stack',
                        groupId: photo.groupId,
                        photos: [],
                        isExpanded: existingStack?.isExpanded || false,
                        selectedPhotoId: existingStack?.selectedPhotoId || null,
                    };
                    grouped.push(groupsProcessed[photo.groupId]);
                }
                groupsProcessed[photo.groupId].photos.push(photo);
            } else {
                grouped.push({ ...photo, type: 'photo' });
            }
        });

        Object.values(groupsProcessed).forEach(stack => {
            if (stack.selectedPhotoId === null && stack.photos.length > 0) {
                // Find first rated photo in stack to be the cover, or default to first photo.
                const firstRated = stack.photos.find(p => p.userRating && p.userRating > 0);
                stack.selectedPhotoId = firstRated ? firstRated.id : stack.photos[0].id;
            } else if (stack.selectedPhotoId !== null) {
                // Ensure selected photo is still in the group
                const isSelectedPhotoPresent = stack.photos.some(p => p.id === stack.selectedPhotoId);
                if (!isSelectedPhotoPresent && stack.photos.length > 0) {
                    stack.selectedPhotoId = stack.photos[0].id;
                }
            }
        });

        setGalleryItems(grouped);
    }, [photosWithMaxRating]);


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
            alert(`Можно оценить не более ${config.ratedPhotoLimit} фотографий.`);
            return;
        }

        const starsDifference = newRating - currentRating;
        if (starsUsed + starsDifference > config.totalStarsLimit) {
            alert(`Общее количество звезд не может превышать ${config.totalStarsLimit}. У вас осталось ${config.totalStarsLimit - starsUsed} звезд.`);
            return;
        }

        // Optimistic UI update
        setPhotos(prevPhotos =>
            prevPhotos.map(p =>
                p.id === photoId ? { ...p, userRating: newRating === 0 ? undefined : newRating } : p
            )
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
            alert('Не удалось сохранить вашу оценку. Попробуйте еще раз.');
            // Revert optimistic UI update on failure
            setPhotos(prevPhotos =>
                prevPhotos.map(p =>
                    p.id === photoId ? { ...p, userRating: currentRating === 0 ? undefined : currentRating } : p
                )
            );
        });

    }, [photosWithMaxRating, config, ratedPhotosCount, starsUsed, sessionId, userId]);

    const handleToggleFlag = useCallback((photoId: number) => {
        setPhotos(prevPhotos =>
            prevPhotos.map(photo =>
                photo.id === photoId && !photo.isOutOfCompetition
                    ? { ...photo, isFlagged: !(photo.isFlagged !== false) }
                    : photo
            )
        );
    }, []);

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
                        prevPhotos.map(p => ({...p, userRating: undefined, isFlagged: true }))
                    );
                    // Also clear flags from localStorage
                    localStorage.removeItem(`userFlags_${sessionId}`);
                })
                .catch(err => {
                    console.error("Failed to clear votes in Firebase", err);
                    alert("Не удалось сбросить оценки. Попробуйте еще раз.");
                });
        }
    }, [sessionId, userId]);

    const sortedPhotosForImmersive = useMemo(() => {
        let photosCopy = [...photosWithMaxRating];
        if (filterFlags) {
            photosCopy = photosCopy.filter(p => p.isFlagged !== false);
        }
        if (sortBy === 'score') {
            photosCopy.sort((a, b) => {
                const getScore = (p: Photo) => {
                    if (votingPhase === 'results') {
                        return p.votes;
                    }
                    return p.userRating || 0;
                };
                const scoreA = getScore(a);
                const scoreB = getScore(b);
                if (scoreB !== scoreA) return scoreB - scoreA;
                return (a.order ?? a.id) - (b.order ?? b.id);
            });
        } else {
            photosCopy.sort((a, b) => (a.order ?? a.id) - (b.order ?? b.id));
        }
        return photosCopy;
    }, [photosWithMaxRating, sortBy, votingPhase, filterFlags]);

    const sortedGalleryItems = useMemo(() => {
        let itemsCopy = [...galleryItems];
        if (filterFlags) {
            itemsCopy = itemsCopy.filter(item => {
                if ('photos' in item) {
                    // Show stack if at least one photo in it is flagged
                    return item.photos.some(p => p.isFlagged !== false);
                } else {
                    return item.isFlagged !== false;
                }
            });
        }
        // Sorting logic is complex with stacks, so we keep the default order for now.
        // The default order is already sorted by `order` field.
        return itemsCopy;

    }, [galleryItems, sortBy, votingPhase, filterFlags]);


    const scrollToPhoto = (photoId: number | null) => {
        if (photoId !== null) {
            setTimeout(() => setScrollToId(photoId), 50);
        }
    };

    const selectedPhoto = useMemo(() => selectedPhotoId !== null ? sortedPhotosForImmersive.find(p => p.id === selectedPhotoId) : null, [selectedPhotoId, sortedPhotosForImmersive]);
    const selectedPhotoIndex = useMemo(() => selectedPhotoId !== null ? sortedPhotosForImmersive.findIndex(p => p.id === selectedPhotoId) : -1, [selectedPhotoId, sortedPhotosForImmersive]);

    const handleCloseModal = useCallback(() => {
        scrollToPhoto(selectedPhotoId);
        setSelectedPhotoId(null);
    }, [selectedPhotoId]);

    const handleNextPhoto = useCallback(() => {
        if (selectedPhotoIndex < sortedPhotosForImmersive.length - 1) {
            setSelectedPhotoId(sortedPhotosForImmersive[selectedPhotoIndex + 1].id);
        }
    }, [selectedPhotoIndex, sortedPhotosForImmersive]);

    const handlePrevPhoto = useCallback(() => {
        if (selectedPhotoIndex > 0) {
            setSelectedPhotoId(sortedPhotosForImmersive[selectedPhotoIndex - 1].id);
        }
    }, [selectedPhotoIndex, sortedPhotosForImmersive]);

    const handleImageClick = useCallback((photo: Photo) => {
        if (isTouchDevice) {
            setImmersivePhotoId(photo.id);
        } else {
            setSelectedPhotoId(photo.id);
        }
    }, [isTouchDevice]);

    const immersivePhotoIndex = useMemo(() => immersivePhotoId !== null ? sortedPhotosForImmersive.findIndex(p => p.id === immersivePhotoId) : -1, [immersivePhotoId, sortedPhotosForImmersive]);

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
    }, [isTouchDevice, immersivePhotoId]);

    const handleNextImmersive = useCallback(() => {
        if (immersivePhotoIndex > -1 && immersivePhotoIndex < sortedPhotosForImmersive.length - 1) {
            setImmersivePhotoId(sortedPhotosForImmersive[immersivePhotoIndex + 1].id);
        }
    }, [immersivePhotoIndex, sortedPhotosForImmersive]);

    const handlePrevImmersive = useCallback(() => {
        if (immersivePhotoIndex > 0) {
            setImmersivePhotoId(sortedPhotosForImmersive[immersivePhotoIndex - 1].id);
        }
    }, [immersivePhotoIndex, sortedPhotosForImmersive]);

    const handleTogglePhase = () => {
        setVotingPhase(p => p === 'voting' ? 'results' : 'voting');
    };

    const handleSaveSettings = (settings: Settings) => {
        setSettings(settings);
        localStorage.setItem('userSettings', JSON.stringify(settings));
        setIsSettingsModalOpen(false);
    };

    const handleStackStateChange = (groupId: string, changes: Partial<PhotoStack>) => {
        setGalleryItems(currentItems =>
            currentItems.map(item => {
                if ('photos' in item && item.groupId === groupId) {
                    return { ...item, ...changes };
                }
                return item;
            })
        );
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
            <div className="text-sm space-y-1 text-center text-gray-300">
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
                                key={session}
                                href={`#${session}`}
                                className="block w-full text-center px-6 py-3 text-lg font-semibold rounded-lg bg-gray-700 hover:bg-indigo-600 focus:ring-indigo-500 text-white transition-colors"
                            >
                                {session}
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

            <div className={`fixed top-0 left-0 right-0 bg-gray-800/80 backdrop-blur-lg border-b border-gray-700/50 shadow-lg transition-transform duration-300 ease-in-out px-4 py-2 flex justify-between items-center ${!!selectedPhoto ? 'z-[51]' : 'z-40'} ${showStickyHeader ? 'translate-y-0' : '-translate-y-full'}`}>
                <a href="#" className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors">← К выбору сессии</a>
                <StatsInfo isCompact={true} />
                <div className="w-24"></div>
            </div>

            <main className="container mx-auto px-4 py-8">
                <header ref={headerRef} className="text-center mb-8">
                    <div className="flex justify-center items-center gap-3 mb-2">
                        <h1 className="text-4xl font-bold tracking-tight capitalize">{sessionId ? sessionId.replace(/[-_]/g, ' ') : ''}</h1>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="text-gray-400 hover:text-white transition-colors" title="Настройки">
                            <SettingsIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <p className="text-gray-400 mb-4 max-w-2xl mx-auto">Выберите до {config.ratedPhotoLimit} лучших фотографий. Вы можете распределить между ними до {config.totalStarsLimit} звезд.</p>
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 max-w-4xl mx-auto flex flex-col items-center gap-4">
                        <StatsInfo />
                        <div className='flex flex-wrap items-center justify-center gap-4'>
                            <button
                                onClick={handleResetVotes}
                                disabled={!hasVotes}
                                className="inline-flex items-center gap-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-red-800 hover:bg-red-700 focus:ring-red-600 text-white transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                                <Trash2 className="w-4 h-4" />
                                <span>Сбросить оценки</span>
                            </button>
                        </div>
                        <div className='flex flex-wrap items-center justify-center gap-4 mt-2'>
                            <button
                                onClick={handleTogglePhase}
                                className={`inline-flex items-center gap-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors
                            ${votingPhase === 'voting' ? 'bg-indigo-600 hover:bg-indigo-700 focus:ring-indigo-500 text-white' : 'bg-gray-600 hover:bg-gray-700 focus:ring-gray-500 text-white'}
                        `}
                            >
                                {votingPhase === 'voting' ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                <span>{votingPhase === 'voting' ? 'Показать общие' : 'Скрыть общие'}</span>
                            </button>
                            <button
                                onClick={() => setFilterFlags(f => !f)}
                                className={`inline-flex items-center gap-x-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${filterFlags ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}
                                title={filterFlags ? "Показать все фотографии" : "Показать только отмеченные фото"}
                            >
                                {filterFlags ? <Flag className="w-4 h-4" /> : <FlagOff className="w-4 h-4" />}
                                <span>{filterFlags ? 'Показать все' : 'Скрыть неотмеченные'}</span>
                            </button>
                            <div className="flex space-x-2">
                                <span className="text-gray-400 text-sm self-center">Сортировать:</span>
                                <button onClick={() => setSortBy('score')} className={`px-3 py-1 text-sm rounded-md ${sortBy === 'score' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>По рейтингу</button>
                                <button onClick={() => setSortBy('id')} className={`px-3 py-1 text-sm rounded-md ${sortBy === 'id' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>По порядку</button>
                            </div>
                        </div>
                    </div>
                </header>

                <div className={settings.layout === 'grid'
                    ? "grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6"
                    : "sm:columns-2 md:columns-3 lg:columns-4 gap-6 space-y-6"
                }>
                    {sortedGalleryItems.map(item => {
                        if ('photos' in item && item.isExpanded) {
                            // Render expanded stack in a full-width container
                            return (
                                <div key={`${item.groupId}-expanded`} className="col-span-full">
                                    <PhotoStackComponent
                                        stack={item}
                                        onRate={handleRate}
                                        onImageClick={handleImageClick}
                                        onToggleFlag={handleToggleFlag}
                                        onStateChange={handleStackStateChange}
                                        displayVotes={votingPhase === 'results'}
                                        layoutMode={settings.layout}
                                        gridAspectRatio={settings.gridAspectRatio}
                                        showToast={setToastMessage}
                                    />
                                </div>
                            );
                        } else if ('photos' in item) {
                            // Render collapsed stack
                            return (
                                <div key={item.groupId} className={settings.layout === 'original' ? 'break-inside-avoid' : ''}>
                                    <PhotoStackComponent
                                        stack={item}
                                        onRate={handleRate}
                                        onImageClick={handleImageClick}
                                        onToggleFlag={handleToggleFlag}
                                        onStateChange={handleStackStateChange}
                                        displayVotes={votingPhase === 'results'}
                                        layoutMode={settings.layout}
                                        gridAspectRatio={settings.gridAspectRatio}
                                        showToast={setToastMessage}
                                    />
                                </div>
                            );
                        }
                        else {
                            // Render single photo
                            return (
                                <div key={item.id} className={settings.layout === 'original' ? 'break-inside-avoid' : ''}>
                                    <PhotoCard
                                        photo={item}
                                        onRate={handleRate}
                                        onImageClick={handleImageClick}
                                        displayVotes={votingPhase === 'results'}
                                        layoutMode={settings.layout}
                                        gridAspectRatio={settings.gridAspectRatio}
                                        onToggleFlag={handleToggleFlag}
                                    />
                                </div>
                            );
                        }
                    })}
                </div>
            </main>

            {!isTouchDevice && selectedPhoto && (
                <Modal
                    photo={selectedPhoto}
                    onClose={handleCloseModal}
                    displayVotes={votingPhase === 'results'}
                    onRate={handleRate}
                    onToggleFlag={handleToggleFlag}
                    onNext={handleNextPhoto}
                    onPrev={handlePrevPhoto}
                    onEnterImmersive={handleEnterImmersive}
                    hasNext={selectedPhotoIndex < sortedPhotosForImmersive.length - 1}
                    hasPrev={selectedPhotoIndex > 0}
                    config={config}
                    ratedPhotosCount={ratedPhotosCount}
                    starsUsed={starsUsed}
                />
            )}

            {immersivePhotoId !== null && (
                <ImmersiveView
                    allPhotos={sortedPhotosForImmersive}
                    photoId={immersivePhotoId}
                    onClose={handleCloseImmersive}
                    onNext={handleNextImmersive}
                    onPrev={handlePrevImmersive}
                    onRate={handleRate}
                    onToggleFlag={handleToggleFlag}
                    displayVotes={votingPhase === 'results'}
                    ratedPhotosCount={ratedPhotosCount}
                    starsUsed={starsUsed}
                    ratedPhotoLimit={config.ratedPhotoLimit}
                    totalStarsLimit={config.totalStarsLimit}
                />
            )}
        </div>
    );
};

export default App;