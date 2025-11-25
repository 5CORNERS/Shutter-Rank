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
import { CreditWarningModal } from './components/CreditWarningModal';
import { useDeviceType } from './hooks/useDeviceType';
import { useColumnCount } from './hooks/useColumnCount';
import { Loader, AlertTriangle, Trash2, Settings as SettingsIcon, List, BarChart2, Share2, Send } from 'lucide-react';
import { StatsInfo } from './components/StatsInfo';
import { ExpandedGroup } from './components/ExpandedGroup';

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
type LocalVote = { rating: number, timestamp: number };

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

const App: React.FC = () => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [availableSessions, setAvailableSessions] = useState<SessionInfo[]>([]);
    const [userId] = useState<string>(getUserId());

    // Core data state
    const [photos, setPhotos] = useState<Photo[]>([]); // Derived UI state (Firebase + Credit)
    const [firebasePhotos, setFirebasePhotos] = useState<Photo[]>([]); // Only Firebase data
    const [creditVotes, setCreditVotes] = useState<Record<number, LocalVote>>({}); // Local storage votes

    // Ref to track the "authoritative" state of what we have sent to Firebase to prevent race conditions
    const userFirebaseRatingsRef = useRef<Record<number, number>>({});

    const [galleryItems, setGalleryItems] = useState<GalleryItem[]>([]);
    const [groups, setGroups] = useState<FirebaseDataGroups>({});
    const [config, setConfig] = useState<Config | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [introArticle, setIntroArticle] = useState<string | null>(null);

    const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
    const [immersivePhotoId, setImmersivePhotoId] = useState<number | null>(null);

    const [votingSort, setVotingSort] = useState<'id' | 'score'>('id');
    const [resultsSort, setResultsSort] = useState<SortMode>('stars');
    const [votingPhase, setVotingPhase] = useState<VotingPhase>('voting');
    const [status, setStatus] = useState<AppStatus>('loading');
    const [isScrolled, setIsScrolled] = useState(false);
    const [scrollToId, setScrollToId] = useState<number | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
    const [isRatingInfoModalOpen, setIsRatingInfoModalOpen] = useState(false);
    const [showHiddenPhotos, setShowHiddenPhotos] = useState(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [creditWarning, setCreditWarning] = useState<{ isOpen: boolean; limitType: 'count' | 'stars' }>({ isOpen: false, limitType: 'count' });

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
    const frozenOrderRef = useRef<string[] | null>(null);

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

    // Load Session, Votes, Credit Votes
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

                // Load Credit Votes from LocalStorage
                const creditVotesKey = `creditVotes_${sessionId}_${userId}`;
                const savedCreditVotes = localStorage.getItem(creditVotesKey);
                const loadedCreditVotes = savedCreditVotes ? JSON.parse(savedCreditVotes) : {};
                setCreditVotes(loadedCreditVotes);

                const initialPhotos = photosData.photos || [];
                const initialVotes = data.votes || {};

                const userVotesRef = ref(db, `sessions/${sessionId}/userVotes/${userId}`);
                const userVotesSnapshot = await get(userVotesRef);
                const userRatings: Record<string, number> = userVotesSnapshot.exists() ? userVotesSnapshot.val() : {};

                // Sync the Ref with loaded data to ensure consistency
                // Convert string keys to numbers for the Ref
                const numericUserRatings: Record<number, number> = {};
                Object.keys(userRatings).forEach(key => {
                    numericUserRatings[Number(key)] = userRatings[key];
                });
                userFirebaseRatingsRef.current = numericUserRatings;

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

                setFirebasePhotos(initialPhotoState);
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
                    setFirebasePhotos(prevPhotos => {
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


    // Merge Firebase Photos and Credit Votes into Main 'photos' State
    useEffect(() => {
        if (firebasePhotos.length === 0) return;

        setPhotos(firebasePhotos.map(p => {
            const creditVote = creditVotes[p.id];
            // If credit vote exists, it overrides the userRating (which should be 0 from firebase anyway if not synced yet)
            // But we prefer Firebase source of truth if both exist (handled by FIFO logic elsewhere)
            if (creditVote) {
                return { ...p, userRating: creditVote.rating, isCredit: true, isVisible: true };
            }
            return p;
        }));
    }, [firebasePhotos, creditVotes]);


    // Helper to calculate stats
    const stats = useMemo(() => {
        // FIXED: Source from 'photos' (merged state) to ensure consistency.
        // We strictly separate Valid (Yellow) vs Credit (Blue) based on the isCredit flag.
        // This prevents "Double Counting" if a photo exists in both sources temporarily during sync.
        const validPhotos = photos.filter(p => p.userRating && p.userRating > 0 && !p.isCredit);

        const ratedCount = validPhotos.length;
        const starsUsed = validPhotos.reduce((sum, p) => sum + (p.userRating || 0), 0);

        const creditKeys = Object.keys(creditVotes);
        const creditCount = creditKeys.length;
        const creditStars = creditKeys.reduce((sum, key) => sum + (creditVotes[Number(key)]?.rating || 0), 0);

        return {
            valid: { count: ratedCount, stars: starsUsed },
            credit: { count: creditCount, stars: creditStars },
            total: { count: ratedCount + creditCount, stars: starsUsed + creditStars }
        };
    }, [photos, creditVotes]);

    // Persist credit votes
    useEffect(() => {
        if (sessionId && userId) {
            localStorage.setItem(`creditVotes_${sessionId}_${userId}`, JSON.stringify(creditVotes));
        }
    }, [creditVotes, sessionId, userId]);


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
        if (status !== 'success' || !sessionId) return;
        const userVisibility: { [key: number]: boolean } = {};
        photos.forEach(p => {
            userVisibility[p.id] = p.isVisible !== false;
        });
        localStorage.setItem(`userVisibility_${sessionId}`, JSON.stringify(userVisibility));
    }, [photos, status, sessionId]);

    useEffect(() => {
        const isAnyModalOpen = isSettingsModalOpen || isArticleModalOpen || isRatingInfoModalOpen || !!expertViewGroupId || !!selectedPhotoId || immersivePhotoId !== null || confirmation.isOpen || creditWarning.isOpen;
        if (isAnyModalOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = 'auto';
        }
    }, [isSettingsModalOpen, isArticleModalOpen, isRatingInfoModalOpen, expertViewGroupId, selectedPhotoId, immersivePhotoId, confirmation.isOpen, creditWarning.isOpen]);

    const scrollToPhoto = useCallback((photoId: number | null) => {
        if (photoId !== null) {
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

    // Auto-scroll to expanded group
    useEffect(() => {
        if (expandedGroupId) {
            const element = document.getElementById(`photo-stack-wrapper-${expandedGroupId}`);
            if (element) {
                setTimeout(() => {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 150); // Slight delay to allow animation start/layout shift
            }
        }
    }, [expandedGroupId]);

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

        const finalGalleryItems: GalleryItem[] = [];

        grouped.forEach(item => {
            if (item.type === 'stack') {
                const visiblePhotosInGroup = showHiddenPhotos
                    ? item.photos
                    : item.photos.filter(p => p.isVisible !== false || p.id === hidingPhotoId);

                if (visiblePhotosInGroup.length <= 1) {
                    visiblePhotosInGroup.forEach(p => {
                        finalGalleryItems.push({ ...p, type: 'photo' });
                    });
                } else {
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


    // --- VOTING LOGIC ---

    // Write to Firebase
    const writeVoteToFirebase = useCallback(async (photoId: number, rating: number, previousRating: number) => {
        if (!sessionId || !userId) return;

        // Save individual vote to Firebase
        const userVoteRef = ref(db, `sessions/${sessionId}/userVotes/${userId}/${photoId}`);
        const userVotePromise: Promise<void> = rating === 0 ? remove(userVoteRef) : set(userVoteRef, rating);

        // Update aggregate score TRANSACTION
        const aggregateVoteRef = ref(db, `sessions/${sessionId}/votes/${photoId}`);
        const aggregateVotePromise: Promise<TransactionResult> = runTransaction(aggregateVoteRef, (currentData: any) => {
            let stars = 0, count = 0, normalized = 0;
            if (typeof currentData === 'number') stars = currentData;
            else if (currentData) { stars = currentData.s || 0; count = currentData.c || 0; normalized = currentData.n || 0; }

            const starDelta = rating - previousRating;
            let countDelta = 0;
            if (previousRating === 0 && rating > 0) countDelta = 1;
            else if (previousRating > 0 && rating === 0) countDelta = -1;

            const oldNorm = calculateNormalizedScore(previousRating);
            const newNorm = calculateNormalizedScore(rating);
            const normDelta = newNorm - oldNorm;

            return { s: stars + starDelta, c: count + countDelta, n: normalized + normDelta };
        });

        const promises = [userVotePromise, aggregateVotePromise];
        try {
            await Promise.all(promises);
            // Update local state (Optimistic update is handled by listener mostly, but for immediate consistency in logic)
            setFirebasePhotos(prev => prev.map(p => p.id === photoId ? {...p, userRating: rating === 0 ? undefined : rating, isVisible: true } : p));
        } catch (error) {
            console.error("Firebase write failed: ", error);
            setToastMessage('Ошибка: не удалось сохранить вашу оценку.');
        }
    }, [sessionId, userId]);

    // Process Credit Queue (Promotion)
    // Runs as an Effect whenever data changes to allow automatic promotion
    useEffect(() => {
        if (!config || firebasePhotos.length === 0) return;

        const checkAndPromote = async () => {
            // 1. Calculate currently available space
            const validPhotos = firebasePhotos.filter(p => p.userRating && p.userRating > 0);
            let currentRatedCount = validPhotos.length;
            let currentStarsUsed = validPhotos.reduce((sum, p) => sum + (p.userRating || 0), 0);

            // 2. Get sorted credit votes (Oldest first)
            const sortedCredits = Object.entries(creditVotes)
                .map(([id, data]) => ({ id: Number(id), ...data }))
                .sort((a, b) => a.timestamp - b.timestamp);

            if (sortedCredits.length === 0) return;

            const newCreditVotes = { ...creditVotes };
            let hasChanges = false;

            for (const credit of sortedCredits) {
                const countSpace = config.ratedPhotoLimit - currentRatedCount;
                const starsSpace = config.totalStarsLimit - currentStarsUsed;

                // Check if this specific credit vote fits
                // Note: Since credit vote is "new" to Firebase, count increases by 1
                if (countSpace >= 1 && starsSpace >= credit.rating) {
                    // Promote!
                    // Use the ref to ensure we don't double count if there's some lag, though typically credit->valid is safe.
                    // Since it's coming from credit, the previous rating in Firebase MUST be 0.
                    // We update the ref here just in case.
                    userFirebaseRatingsRef.current[credit.id] = credit.rating;

                    await writeVoteToFirebase(credit.id, credit.rating, 0);

                    // Update local counters for next iteration in loop
                    currentRatedCount++;
                    currentStarsUsed += credit.rating;

                    // Remove from credit
                    delete newCreditVotes[credit.id];
                    hasChanges = true;
                    setToastMessage("Ваш голос из «кредита» был зачтен!");
                } else {
                    // STRICT FIFO: If the oldest doesn't fit, STOP.
                    // Do NOT let newer/smaller votes skip the queue.
                    break;
                }
            }

            if (hasChanges) {
                setCreditVotes(newCreditVotes);
            }
        };

        checkAndPromote();
        // Effect dependency on key stats ensuring it runs when space frees up
    }, [firebasePhotos, creditVotes, config, writeVoteToFirebase]);


    const handleRate = useCallback(async (photoId: number, rating: number) => {
        if (!config || !sessionId || !userId) return;

        const photoToUpdate = photosWithMaxRating.find(p => p.id === photoId);
        if (!photoToUpdate || photoToUpdate.isOutOfCompetition) return;

        const currentRating = photoToUpdate.userRating || 0;
        const isCurrentCredit = !!photoToUpdate.isCredit;
        let newRating = rating;

        if (newRating > (photoToUpdate.maxRating ?? 3)) {
            setIsRatingInfoModalOpen(true);
            return;
        }
        if (newRating === currentRating) {
            newRating = 0;
        }

        // Logic branching
        // Case 1: Unrating (0)
        if (newRating === 0) {
            if (isCurrentCredit) {
                // Remove from local storage
                const newCredits = { ...creditVotes };
                delete newCredits[photoId];
                setCreditVotes(newCredits);
            } else {
                // Remove from Firebase
                // CRITICAL FIX: Use the Ref for the previous rating to prevent race conditions
                const truePreviousRating = userFirebaseRatingsRef.current[photoId] || 0;
                // Update Ref synchronously
                userFirebaseRatingsRef.current[photoId] = 0;

                await writeVoteToFirebase(photoId, 0, truePreviousRating);
            }
            return;
        }

        // Case 2: Rating (Updating or New)

        // CHECK AGAINST *TOTAL* LIMITS (including credit debt)
        // This ensures that if we are already in debt (e.g. queue is not empty), new votes go to credit/queue
        // instead of skipping the line.

        const isNewVote = currentRating === 0;
        const projectedTotalCount = stats.total.count + (isNewVote ? 1 : 0);
        const projectedTotalStars = stats.total.stars - currentRating + newRating;

        // "Fits in budget" now means "Fits in Global Limit" AND "Does NOT jump queue"
        // If we have credit votes (stats.credit.count > 0), we should assume the queue is blocked,
        // UNLESS this specific photo is ALREADY in the queue (updating credit vote).

        let fitsInBudget = projectedTotalCount <= config.ratedPhotoLimit && projectedTotalStars <= config.totalStarsLimit;

        if (fitsInBudget && stats.credit.count > 0 && !isCurrentCredit) {
            // Attempting to jump queue?
            // This logic ensures new votes respect the waiting line.
            fitsInBudget = false;
        }

        // Warning triggers
        const warningKey = `hasSeenCreditWarning_${sessionId}`;
        const hasSeenWarning = localStorage.getItem(warningKey);

        // Determine if we are *reaching* or *exceeding* the limit
        const isReachingLimit = projectedTotalCount === config.ratedPhotoLimit || projectedTotalStars === config.totalStarsLimit;
        // const isExceeding = projectedTotalCount > config.ratedPhotoLimit || projectedTotalStars > config.totalStarsLimit;

        if (fitsInBudget) {
            // If it was credit, remove from credit first
            if (isCurrentCredit) {
                const newCredits = { ...creditVotes };
                delete newCredits[photoId];
                setCreditVotes(newCredits);
            }
            // Write to Firebase (Yellow/Valid)
            const truePreviousRating = userFirebaseRatingsRef.current[photoId] || 0;
            userFirebaseRatingsRef.current[photoId] = newRating;

            await writeVoteToFirebase(photoId, newRating, truePreviousRating);

            if (isReachingLimit && !hasSeenWarning) {
                const limitType = projectedTotalCount === config.ratedPhotoLimit ? 'count' : 'stars';
                setCreditWarning({ isOpen: true, limitType });
                localStorage.setItem(warningKey, 'true');
            }

        } else {
            // GOES TO CREDIT (Blue/Exceeding)
            const limitType = projectedTotalCount > config.ratedPhotoLimit ? 'count' : 'stars';

            // Show warning if not seen
            if (!hasSeenWarning) {
                setCreditWarning({ isOpen: true, limitType });
                localStorage.setItem(warningKey, 'true');
            }

            // Save to Credit (Local Storage)
            const newCredits = { ...creditVotes };
            newCredits[photoId] = { rating: newRating, timestamp: Date.now() };
            setCreditVotes(newCredits);

            // If it was valid before, remove from Firebase! (Demote to credit)
            if (!isCurrentCredit && currentRating > 0) {
                const truePreviousRating = userFirebaseRatingsRef.current[photoId] || 0;
                userFirebaseRatingsRef.current[photoId] = 0;

                await writeVoteToFirebase(photoId, 0, truePreviousRating);
            }
        }

    }, [photosWithMaxRating, config, stats, creditVotes, sessionId, userId, writeVoteToFirebase]);


    const handleToggleVisibility = useCallback((photoId: number) => {
        const photo = photos.find(p => p.id === photoId);
        if (!photo || photo.isOutOfCompetition) return;

        const currentVisibility = photo.isVisible !== false;

        if (currentVisibility) {
            if (photo.userRating && photo.userRating > 0) return;

            setHidingPhotoId(photoId);
            setTimeout(() => {
                setFirebasePhotos(prev => prev.map(p => p.id === photoId ? { ...p, isVisible: false } : p));
                setHidingPhotoId(null);
                if (selectedPhotoId === photoId) handleNextPhoto();
                if (immersivePhotoId === photoId) handleNextImmersive();
            }, 400);
        } else {
            setFirebasePhotos(prev => prev.map(p => p.id === photoId ? { ...p, isVisible: true } : p));
        }
    }, [photos, selectedPhotoId, immersivePhotoId]);

    const handleResetVotes = useCallback(() => {
        if (!sessionId || !userId) return;

        openConfirmation(
            'Сбросить все оценки?',
            'Вы уверены, что хотите сбросить все ваши оценки (включая кредитные) и отметки для этой сессии?',
            () => {
                closeConfirmation();
                const userVotesRef = ref(db, `sessions/${sessionId}/userVotes/${userId}`);
                remove(userVotesRef)
                    .then(() => {
                        setCreditVotes({}); // Clear local votes
                        userFirebaseRatingsRef.current = {}; // Clear the ref
                        localStorage.removeItem(`creditVotes_${sessionId}_${userId}`);
                        // Clear warning flag too so they can see it again in a new run? Maybe better UX.
                        localStorage.removeItem(`hasSeenCreditWarning_${sessionId}`);

                        setFirebasePhotos(prevPhotos =>
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
            if (valB_stars !== valA_stars) return valB_stars - valA_stars;
            if (valB_score !== valA_score) return valB_score - valA_score;
            return valB_count - valA_count;
        }
        if (mode === 'score') {
            if (valB_score !== valA_score) return valB_score - valA_score;
            if (valB_count !== valA_count) return valB_count - valA_count;
            return valB_stars - valA_stars;
        }
        if (mode === 'count') {
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
                // If this is the active group (expanded OR closing), keep it visible even if partially hidden logic applies
                const isActiveGroup = expandedGroupId === item.groupId || closingGroupId === item.groupId;
                
                if (item.type === 'stack' && !isActiveGroup) {
                    const visiblePhotosInStack = item.photos.filter(p => p.isVisible !== false || p.id === hidingPhotoId);
                    if (visiblePhotosInStack.length === 0) return null;
                } else if (item.type === 'photo' && item.isVisible === false && item.id !== hidingPhotoId) {
                    return null;
                }
                return item;
            }).filter((item): item is GalleryItem => item !== null);
        }

        const currentSortMode = votingPhase === 'voting' ? votingSort : resultsSort;

        const performSort = (items: GalleryItem[]) => {
            if (currentSortMode === 'id') return items;

            return [...items].sort((a, b) => {
                let photoA: Photo;
                let photoB: Photo;

                if (a.type === 'photo') {
                    photoA = a;
                } else {
                    if (votingPhase === 'voting') {
                        photoA = a.photos.find(p => p.id === a.selectedPhotoId) || a.photos[0];
                    } else {
                        photoA = a.photos.reduce((best, current) => {
                            return comparePhotos(current, best, currentSortMode) < 0 ? current : best;
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
                            return comparePhotos(current, best, currentSortMode) < 0 ? current : best;
                        }, b.photos[0]);
                    }
                }

                if (votingPhase === 'voting') {
                    // Simple sort by user rating in voting mode
                    if (currentSortMode === 'score') {
                        const scoreA = photoA.userRating || 0;
                        const scoreB = photoB.userRating || 0;
                        if (scoreB !== scoreA) return scoreB - scoreA;
                    }
                } else {
                    const comparison = comparePhotos(photoA, photoB, currentSortMode);
                    if (comparison !== 0) return comparison;
                }

                const orderA = a.type === 'photo' ? (a.order ?? a.id) : (a.photos[0]?.order ?? a.photos[0]?.id ?? 0);
                const orderB = b.type === 'photo' ? (b.order ?? b.id) : (b.photos[0]?.order ?? b.photos[0]?.id ?? 0);
                return orderA - orderB;
            });
        };

        const activeGroupId = expandedGroupId || closingGroupId;

        if (activeGroupId) {
            if (!frozenOrderRef.current) {
                const sorted = performSort(itemsCopy);
                frozenOrderRef.current = sorted.map(i => i.type === 'stack' ? i.groupId : String(i.id));
                return sorted;
            } else {
                const itemMap = new Map(itemsCopy.map(i => [i.type === 'stack' ? i.groupId : String(i.id), i]));
                const preservedList: GalleryItem[] = [];
                frozenOrderRef.current.forEach(key => {
                    const item = itemMap.get(key);
                    if (item) {
                        preservedList.push(item);
                        itemMap.delete(key);
                    }
                });
                preservedList.push(...itemMap.values());
                return preservedList;
            }
        } else {
            frozenOrderRef.current = null;
            return performSort(itemsCopy);
        }

    }, [galleryItems, showHiddenPhotos, votingPhase, hidingPhotoId, expandedGroupId, closingGroupId, comparePhotos, votingSort, resultsSort]);

    const photosForViewer = useMemo(() => {
        const flatList: Photo[] = [];
        sortedGalleryItems.forEach(item => {
            if (item.type === 'stack') {
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

    const handleGroupSelectionChange = useCallback((groupId: string, newSelectedId: number | null, initiatedByRate = false) => {
        const performSelectionChange = () => {
            const newSelections = { ...groupSelections, [groupId]: newSelectedId };
            setGroupSelections(newSelections);
            if (sessionId) {
                localStorage.setItem(`groupSelections_${sessionId}`, JSON.stringify(newSelections));
            }
        };

        const oldSelectedId = groupSelections[groupId] || null;
        if (oldSelectedId === newSelectedId) return;

        const oldSelectedPhoto = oldSelectedId ? photos.find(p => p.id === oldSelectedId) : null;

        // Special Case: Unselecting a photo that has a rating
        if (newSelectedId === null && oldSelectedPhoto?.userRating) {
            handleRate(oldSelectedPhoto.id, 0); // Remove rating
            performSelectionChange();
            return;
        }

        const transferRating = () => {
            if (!oldSelectedPhoto?.userRating || newSelectedId === null) return;
            const ratingToTransfer = oldSelectedPhoto.userRating;

            // Transfer logic: Unrate old, Rate new
            // Note: handleRate handles credit/firebase logic internally
            handleRate(oldSelectedId, 0);
            handleRate(newSelectedId, ratingToTransfer);

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

    }, [groupSelections, sessionId, photos, handleRate]);


    const handleRateInGroup = (photoId: number, rating: number) => {
        const photo = photos.find(p => p.id === photoId);
        if (!photo?.groupId) {
            handleRate(photoId, rating);
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
                    handleGroupSelectionChange(groupId, photoId, true);
                    handleRate(currentSelectedId, 0);
                    handleRate(photoId, rating);
                },
                closeConfirmation
            );
        } else {
            handleRate(photoId, rating);

            if (isNewRating) {
                handleGroupSelectionChange(groupId, photoId, true);
            } else if (isClearingRating && currentSelectedId === photoId) {
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

    const handleTelegramShare = useCallback(() => {
        const url = encodeURIComponent(window.location.href);
        const text = encodeURIComponent(`Голосуйте в сессии «${config?.name || sessionId}»!`);
        window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
    }, [config, sessionId]);

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
        }, 1500); // 1.5s delay to match CSS transition
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
    const hasVotes = stats.total.count > 0;
    const sessionDisplayName = config.name || sessionId;
    
    // Calculate global credit flag
    const hasCreditVotes = stats.credit.count > 0;

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

            {creditWarning.isOpen && (
                <CreditWarningModal
                    onClose={() => setCreditWarning(prev => ({ ...prev, isOpen: false }))}
                    limitType={creditWarning.limitType}
                />
            )}

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
                <StatsInfo stats={stats} config={config} isCompact={true} />
                <div className="w-48"></div> {/* Placeholder to balance the flex container */}
            </div>

            <main className={`container mx-auto px-4 py-8`}>
                <header ref={headerRef} className="text-center mb-8">
                    <div className="flex justify-center items-center gap-4 mb-2">
                        <h1 className="text-4xl font-bold tracking-tight">{sessionDisplayName}</h1>
                        <div className="flex items-center gap-2">
                            <button onClick={handleShare} className="text-gray-400 hover:text-white transition-colors" title="Копировать ссылку">
                                <Share2 className="w-6 h-6" />
                            </button>
                            <button onClick={handleTelegramShare} className="text-gray-400 hover:text-blue-400 transition-colors" title="Отправить в Telegram">
                                <Send className="w-6 h-6" />
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
                                <StatsInfo stats={stats} config={config} />
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
                                            <button onClick={() => setVotingSort('id')} className={`px-3 py-1 text-sm rounded-md ${votingSort === 'id' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>№</button>
                                            <button onClick={() => setVotingSort('score')} className={`px-3 py-1 text-sm rounded-md ${votingSort === 'score' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Мой рейтинг</button>
                                        </>
                                    ) : (
                                        <>
                                            <button onClick={() => setResultsSort('id')} className={`px-3 py-1 text-sm rounded-md ${resultsSort === 'id' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>№</button>
                                            <button onClick={() => setResultsSort('stars')} className={`px-3 py-1 text-sm rounded-md ${resultsSort === 'stars' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Звездам</button>
                                            <button onClick={() => setResultsSort('score')} className={`px-3 py-1 text-sm rounded-md ${resultsSort === 'score' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Баллам</button>
                                            <button onClick={() => setResultsSort('count')} className={`px-3 py-1 text-sm rounded-md ${resultsSort === 'count' ? 'bg-indigo-600' : 'bg-gray-700 hover:bg-gray-600'}`}>Голосам</button>
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
                                                onToggleVisibility={handleToggleVisibility}
                                                displayVotes={false}
                                                layoutMode={settings.layout}
                                                gridAspectRatio={settings.gridAspectRatio}
                                                isTouchDevice={isTouchDevice}
                                                onShowToast={(msg) => setToastMessage(msg)}
                                                starsUsed={stats.valid.stars}
                                                totalStarsLimit={config.totalStarsLimit}
                                                ratedPhotosCount={stats.valid.count}
                                                ratedPhotoLimit={config.ratedPhotoLimit}
                                                hasCreditVotes={hasCreditVotes}
                                            />
                                            {settings.layout === 'original' && (expandedGroupId === item.groupId || closingGroupId === item.groupId) && (
                                                <ExpandedGroup
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
                                                    starsUsed={stats.valid.stars}
                                                    totalStarsLimit={config.totalStarsLimit}
                                                    ratedPhotosCount={stats.valid.count}
                                                    ratedPhotoLimit={config.ratedPhotoLimit}
                                                    hasCreditVotes={hasCreditVotes}
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
                                                starsUsed={stats.valid.stars}
                                                totalStarsLimit={config.totalStarsLimit}
                                                ratedPhotosCount={stats.valid.count}
                                                ratedPhotoLimit={config.ratedPhotoLimit}
                                                hasCreditVotes={hasCreditVotes}
                                            />
                                        </div>
                                    )}

                                    {expandedItemToRender && (
                                        <ExpandedGroup
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
                                            starsUsed={stats.valid.stars}
                                            totalStarsLimit={config.totalStarsLimit}
                                            ratedPhotosCount={stats.valid.count}
                                            ratedPhotoLimit={config.ratedPhotoLimit}
                                            hasCreditVotes={hasCreditVotes}
                                        />
                                    )}
                                </React.Fragment>
                            );
                            return itemElement;
                        })
                    ) : (
                        sortedGalleryItems.map(item => {
                            if (item.type === 'stack') {
                                // Find best photo in stack based on current sort mode
                                const bestPhoto = item.photos.reduce((best, current) => {
                                    return comparePhotos(current, best, resultsSort) < 0 ? current : best;
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
                    ratedPhotosCount={stats.valid.count}
                    starsUsed={stats.valid.stars}
                    groupInfo={selectedPhotoGroupInfo}
                    groupSelections={groupSelections}
                    onGroupSelectionChange={handleGroupSelectionChange}
                    onOpenGroup={handleOpenGroupFromViewer}
                    totalStarsLimit={config.totalStarsLimit}
                    ratedPhotoLimit={config.ratedPhotoLimit}
                    hasCreditVotes={hasCreditVotes}
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
                    ratedPhotosCount={stats.valid.count}
                    starsUsed={stats.valid.stars}
                    ratedPhotoLimit={config.ratedPhotoLimit}
                    totalStarsLimit={config.totalStarsLimit}
                    groupInfo={immersivePhotoGroupInfo}
                    groupSelections={groupSelections}
                    onGroupSelectionChange={handleGroupSelectionChange}
                    onOpenGroup={handleOpenGroupFromViewer}
                    hasCreditVotes={hasCreditVotes}
                />
            )}
        </div>
    );
};

export default App;