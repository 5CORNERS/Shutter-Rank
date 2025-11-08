import * as React from 'react';
import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { Photo, PhotoFile, Settings, Config as AppConfig } from './types';
import { PhotoCard } from './components/PhotoCard';
import { Modal } from './components/Modal';
import { ImmersiveView } from './components/ImmersiveView';
import { SettingsModal } from './components/SettingsModal';
import { ArticleModal } from './components/IntroModal';
import { useDeviceType } from './hooks/useDeviceType';
import { Eye, EyeOff, Send, Loader, AlertTriangle, Copy, Trash2, Settings as SettingsIcon, Flag, FlagOff } from 'lucide-react';

type SortMode = 'score' | 'id';
type VotingPhase = 'voting' | 'results';
type LoadingStatus = 'loading' | 'success' | 'error';

const App: React.FC = () => {
    const [photos, setPhotos] = useState<Photo[]>([]);
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [settings, setSettings] = useState<Settings | null>(null);
    const [introArticle, setIntroArticle] = useState<string | null>(null);

    const [selectedPhotoId, setSelectedPhotoId] = useState<number | null>(null);
    const [immersivePhotoId, setImmersivePhotoId] = useState<number | null>(null);
    const [sortBy, setSortBy] = useState<SortMode>('id');
    const [votingPhase, setVotingPhase] = useState<VotingPhase>('voting');
    const [status, setStatus] = useState<LoadingStatus>('loading');
    const [isScrolled, setIsScrolled] = useState(false);
    const [copyStatus, setCopyStatus] = useState<'idle' | 'copied'>('idle');
    const [scrollToId, setScrollToId] = useState<number | null>(null);
    const [isSettingsModalOpen, setIsSettingsModalOpen] = useState(false);
    const [isArticleModalOpen, setIsArticleModalOpen] = useState(false);
    const [filterFlags, setFilterFlags] = useState(false);

    const { isDesktop } = useDeviceType();
    const headerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const headerElement = headerRef.current;
        if (!headerElement) return;

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
    }, [photos]);


    useEffect(() => {
        const loadAllData = async () => {
            try {
                const configResponse = await fetch('./config.json?cache-bust=' + new Date().getTime());
                if (!configResponse.ok) throw new Error('Не удалось загрузить config.json');
                const loadedConfig = (await configResponse.json()) as AppConfig;
                setConfig(loadedConfig);

                const [photosFileResponse, resultsResponse] = await Promise.all([
                    fetch(loadedConfig.photosPath + '?cache-bust=' + new Date().getTime()),
                    fetch(loadedConfig.resultsPath + '?cache-bust=' + new Date().getTime())
                ]);

                if (!photosFileResponse.ok) throw new Error(`Не удалось загрузить photos.json из ${loadedConfig.photosPath}`);
                if (!resultsResponse.ok && resultsResponse.status !== 404) {
                    throw new Error(`Не удалось загрузить results.json из ${loadedConfig.resultsPath}`);
                }

                const savedSettingsRaw = localStorage.getItem('userSettings');
                if (savedSettingsRaw) {
                    setSettings(JSON.parse(savedSettingsRaw) as Settings);
                } else {
                    const currentIsDesktop = window.innerWidth >= 768;
                    setSettings({
                        layout: currentIsDesktop ? loadedConfig.defaultLayoutDesktop : loadedConfig.defaultLayoutMobile,
                        gridAspectRatio: loadedConfig.defaultGridAspectRatio || '4/3'
                    });
                }

                const photosFile = (await photosFileResponse.json()) as PhotoFile;
                if (photosFile.introArticleMarkdown) {
                    setIntroArticle(photosFile.introArticleMarkdown);
                    setIsArticleModalOpen(true);
                }

                const initialResults = resultsResponse.status === 404 ? {} : await resultsResponse.json();

                const loadedPhotos: Photo[] = photosFile.photos.map(p => ({
                    ...p,
                    caption: p.caption || `Фото №${p.id}`,
                    votes: (initialResults as Record<string, number>)[String(p.id)] || 0,
                }));

                const photoListSignature = loadedPhotos.map(p => p.url).join(';');
                const savedSignature = localStorage.getItem('photoListSignature');

                const savedRatingsRaw = localStorage.getItem('userRatings');
                let userRatings: Record<string, number> = {};
                if (savedRatingsRaw) {
                    if (savedSignature && savedSignature !== photoListSignature) {
                        if (window.confirm('Состав фотографий изменился. Сбросить ваши старые оценки и отметки?')) {
                            localStorage.removeItem('userRatings');
                            localStorage.removeItem('userFlags');
                        } else {
                            userRatings = JSON.parse(savedRatingsRaw);
                        }
                    } else {
                        userRatings = JSON.parse(savedRatingsRaw);
                    }
                }
                localStorage.setItem('photoListSignature', photoListSignature);

                const savedFlagsRaw = localStorage.getItem('userFlags');
                const userFlags: Record<string, boolean> = savedFlagsRaw ? JSON.parse(savedFlagsRaw) : {};

                setPhotos(loadedPhotos.map(p => ({
                    ...p,
                    userRating: userRatings[p.id],
                    isFlagged: userFlags[p.id] === undefined ? true : userFlags[p.id]
                })));
                setStatus('success');
            } catch (error) {
                console.error("Ошибка загрузки данных:", error);
                setStatus('error');
            }
        };
        void loadAllData();
    }, []);

    useEffect(() => {
        if (status !== 'success') return;
        const userRatings: { [key: number]: number } = {};
        const userFlags: { [key: number]: boolean } = {};
        photos.forEach(p => {
            if (p.userRating) {
                userRatings[p.id] = p.userRating;
            }
            userFlags[p.id] = p.isFlagged !== false;
        });
        localStorage.setItem('userRatings', JSON.stringify(userRatings));
        localStorage.setItem('userFlags', JSON.stringify(userFlags));
    }, [photos, status]);

    useEffect(() => {
        if (scrollToId === null) return;

        const element = document.getElementById(`photo-card-${scrollToId}`);
        if (element) {
            element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
        setScrollToId(null);
    }, [scrollToId]);

    const ratedPhotosCount = useMemo(() => photos.filter(p => p.userRating && p.userRating > 0).length, [photos]);
    const starsUsed = useMemo(() => photos.reduce((sum, p) => sum + (p.userRating || 0), 0), [photos]);

    const handleRate = useCallback((photoId: number, rating: number) => {
        if (!config) return;
        setPhotos(prevPhotos =>
            prevPhotos.map(photo => {
                if (photo.id === photoId) {
                    if (photo.isOutOfCompetition) return photo;

                    const currentRating = photo.userRating || 0;
                    if (rating === currentRating) {
                        return { ...photo, userRating: 0 };
                    }

                    const isNewRating = currentRating === 0 && rating > 0;

                    if (isNewRating && ratedPhotosCount >= config.ratedPhotoLimit) {
                        alert(`Можно оценить не более ${config.ratedPhotoLimit} фотографий.`);
                        return photo;
                    }

                    const starsDifference = rating - currentRating;
                    if (starsUsed + starsDifference > config.totalStarsLimit) {
                        alert(`Общее количество звезд не может превышать ${config.totalStarsLimit}. У вас осталось ${config.totalStarsLimit - starsUsed} звезд.`);
                        return photo;
                    }

                    return { ...photo, userRating: rating === 0 ? undefined : rating };
                }
                return photo;
            })
        );
    }, [ratedPhotosCount, starsUsed, config]);

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
        if (window.confirm('Вы уверены, что хотите сбросить все ваши оценки и отметки? Это действие нельзя отменить.')) {
            setPhotos(prevPhotos =>
                prevPhotos.map(p => ({...p, userRating: undefined, isFlagged: true }))
            );
        }
    }, []);

    const getUserVotesJSON = useCallback(() => {
        const userRatings: { [key: number]: number } = {};
        photos.forEach(p => {
            if (p.userRating && p.userRating > 0) {
                userRatings[p.id] = p.userRating;
            }
        });
        return JSON.stringify(userRatings, null, 2);
    }, [photos]);

    const handleShareToTelegram = useCallback(() => {
        const dataStr = getUserVotesJSON();
        const text = `Мои голоса в фотоконкурсе:\n\n\`\`\`json\n${dataStr}\n\`\`\``;
        const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent('Результаты голосования')}&text=${encodeURIComponent(text)}`;
        window.open(telegramUrl, '_blank');
    }, [getUserVotesJSON]);

    const handleCopyToClipboard = useCallback(() => {
        const dataStr = getUserVotesJSON();
        navigator.clipboard.writeText(dataStr).then(() => {
            setCopyStatus('copied');
            setTimeout(() => setCopyStatus('idle'), 2000);
        }).catch(err => {
            console.error('Не удалось скопировать: ', err);
        });
    }, [getUserVotesJSON]);

    const sortedPhotos = useMemo(() => {
        let photosCopy = [...photos];
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
                return a.id - b.id;
            });
        } else {
            photosCopy.sort((a, b) => a.id - b.id);
        }
        return photosCopy;
    }, [photos, sortBy, votingPhase, filterFlags]);

    const scrollToPhoto = (photoId: number | null) => {
        if (photoId !== null) {
            setTimeout(() => setScrollToId(photoId), 50);
        }
    };

    const selectedPhoto = useMemo(() => selectedPhotoId !== null ? sortedPhotos.find(p => p.id === selectedPhotoId) : null, [selectedPhotoId, sortedPhotos]);
    const selectedPhotoIndex = useMemo(() => selectedPhotoId !== null ? sortedPhotos.findIndex(p => p.id === selectedPhotoId) : -1, [selectedPhotoId, sortedPhotos]);

    const handleCloseModal = useCallback(() => {
        scrollToPhoto(selectedPhotoId);
        setSelectedPhotoId(null);
    }, [selectedPhotoId]);

    const handleNextPhoto = useCallback(() => {
        if (selectedPhotoIndex < sortedPhotos.length - 1) {
            setSelectedPhotoId(sortedPhotos[selectedPhotoIndex + 1].id);
        }
    }, [selectedPhotoIndex, sortedPhotos]);

    const handlePrevPhoto = useCallback(() => {
        if (selectedPhotoIndex > 0) {
            setSelectedPhotoId(sortedPhotos[selectedPhotoIndex - 1].id);
        }
    }, [selectedPhotoIndex, sortedPhotos]);

    const handleImageClick = useCallback((photo: Photo) => {
        if (isDesktop) {
            setSelectedPhotoId(photo.id);
        } else {
            setImmersivePhotoId(photo.id);
        }
    }, [isDesktop]);

    const immersivePhotoIndex = useMemo(() => immersivePhotoId !== null ? sortedPhotos.findIndex(p => p.id === immersivePhotoId) : -1, [immersivePhotoId, sortedPhotos]);

    const handleEnterImmersive = useCallback(() => {
        if (selectedPhoto) {
            setImmersivePhotoId(selectedPhoto.id);
            setSelectedPhotoId(null);
        }
    }, [selectedPhoto]);

    const handleCloseImmersive = useCallback((lastViewedPhotoId?: number) => {
        const finalPhotoId = lastViewedPhotoId ?? immersivePhotoId;
        setImmersivePhotoId(null);

        if (isDesktop && finalPhotoId !== null) {
            setSelectedPhotoId(finalPhotoId);
        } else {
            scrollToPhoto(finalPhotoId);
        }
    }, [isDesktop, immersivePhotoId]);

    const handleNextImmersive = useCallback(() => {
        if (immersivePhotoIndex > -1 && immersivePhotoIndex < sortedPhotos.length - 1) {
            setImmersivePhotoId(sortedPhotos[immersivePhotoIndex + 1].id);
        }
    }, [immersivePhotoIndex, sortedPhotos]);

    const handlePrevImmersive = useCallback(() => {
        if (immersivePhotoIndex > 0) {
            setImmersivePhotoId(sortedPhotos[immersivePhotoIndex - 1].id);
        }
    }, [immersivePhotoIndex, sortedPhotos]);

    const handleTogglePhase = () => {
        setVotingPhase(p => p === 'voting' ? 'results' : 'voting');
    };

    const handleSaveSettings = (settings: Settings) => {
        setSettings(settings);
        localStorage.setItem('userSettings', JSON.stringify(settings));
        setIsSettingsModalOpen(false);
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

    if (status === 'loading' || !config || !settings) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center text-white">
                <Loader className="w-12 h-12 animate-spin text-indigo-400" />
                <p className="mt-4 text-lg">Загрузка данных...</p>
            </div>
        );
    }

    if (status === 'error') {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center text-white p-4 text-center">
                <AlertTriangle className="w-12 h-12 text-red-500" />
                <h2 className="mt-4 text-2xl font-bold">Ошибка загрузки</h2>
                <p className="mt-2 text-gray-400 max-w-md">Не удалось загрузить данные для голосования. Проверьте URL-адреса в <code className="bg-gray-700 p-1 rounded text-sm">config.json</code> и убедитесь, что файлы доступны.</p>
            </div>
        );
    }

    const showStickyHeader = isScrolled || !!selectedPhoto;
    const hasVotes = ratedPhotosCount > 0;

    return (
        <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">

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

            <div className={`fixed top-0 left-0 right-0 bg-gray-800/80 backdrop-blur-lg border-b border-gray-700/50 shadow-lg transition-transform duration-300 ease-in-out px-4 py-2 flex justify-center items-center ${!!selectedPhoto ? 'z-[51]' : 'z-40'} ${showStickyHeader ? 'translate-y-0' : '-translate-y-full'}`}>
                <StatsInfo isCompact={true} />
            </div>

            <main className="container mx-auto px-4 py-8">
                <header ref={headerRef} className="text-center mb-8">
                    <div className="flex justify-center items-center gap-3 mb-2">
                        <h1 className="text-4xl font-bold tracking-tight">Голосовалка</h1>
                        <button onClick={() => setIsSettingsModalOpen(true)} className="text-gray-400 hover:text-white transition-colors" title="Настройки">
                            <SettingsIcon className="w-6 h-6" />
                        </button>
                    </div>
                    <p className="text-gray-400 mb-4 max-w-2xl mx-auto">Выберите до {config.ratedPhotoLimit} лучших фотографий. Вы можете распределить между ними до {config.totalStarsLimit} звезд.</p>
                    <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-3 max-w-4xl mx-auto flex flex-col items-center gap-4">
                        <StatsInfo />
                        <div className='flex flex-wrap items-center justify-center gap-4'>
                            <button
                                onClick={handleShareToTelegram}
                                disabled={!hasVotes}
                                className="inline-flex items-center gap-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-blue-500 hover:bg-blue-600 focus:ring-blue-400 text-white transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                                <Send className="w-4 h-4" />
                                <span>Отправить результат</span>
                            </button>
                            <button
                                onClick={handleCopyToClipboard}
                                disabled={!hasVotes}
                                className="inline-flex items-center gap-x-2 px-4 py-2 text-sm font-semibold rounded-lg bg-gray-600 hover:bg-gray-700 focus:ring-gray-500 text-white transition-colors disabled:bg-gray-700 disabled:text-gray-500 disabled:cursor-not-allowed"
                            >
                                <Copy className="w-4 h-4" />
                                <span>{copyStatus === 'copied' ? 'Скопировано!' : 'Скопировать результат'}</span>
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
                    {sortedPhotos.map(photo => (
                        <div key={photo.id} className={settings.layout === 'original' ? 'break-inside-avoid' : ''}>
                            <PhotoCard
                                photo={photo}
                                onRate={handleRate}
                                onImageClick={handleImageClick}
                                displayVotes={votingPhase === 'results'}
                                layoutMode={settings.layout}
                                gridAspectRatio={settings.gridAspectRatio}
                                onToggleFlag={handleToggleFlag}
                            />
                        </div>
                    ))}
                </div>
            </main>

            {isDesktop && selectedPhoto && (
                <Modal
                    photo={selectedPhoto}
                    onClose={handleCloseModal}
                    displayVotes={votingPhase === 'results'}
                    onRate={handleRate}
                    onToggleFlag={handleToggleFlag}
                    onNext={handleNextPhoto}
                    onPrev={handlePrevPhoto}
                    onEnterImmersive={handleEnterImmersive}
                    hasNext={selectedPhotoIndex < sortedPhotos.length - 1}
                    hasPrev={selectedPhotoIndex > 0}
                    config={config}
                    ratedPhotosCount={ratedPhotosCount}
                    starsUsed={starsUsed}
                />
            )}

            {immersivePhotoId !== null && (
                <ImmersiveView
                    allPhotos={sortedPhotos}
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