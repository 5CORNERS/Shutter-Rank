import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { db } from './firebase';
import { ref, get, update } from 'firebase/database';
import { AdminLayout } from './components/AdminLayout';
import { Spinner } from './components/Spinner';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, Wand2, Download } from 'lucide-react';
import exifr from 'exifr';
import './index.css';
import { Config, FirebasePhotoData, FirebasePhoto } from './types';

type Status = 'loading' | 'success' | 'error' | 'not_found';
type SessionData = {
    config: Config;
    photos: FirebasePhotoData;
};

const generateHtmlForDownload = (photosInOrder: FirebasePhoto[], sessionId: string): string => {
    const authorCredit = 'Фото: Илья Думов';

    const photoFiguresHtml = photosInOrder.map(photo => {
        const caption = photo.caption || '';

        // As per user's HTML sample, the author credit is part of the alt text.
        // The figcaption contains only the main caption.
        const altText = `${caption} ${authorCredit}`.trim().replace(/"/g, '&quot;');

        // If caption contains '||' it was a special format, but the user's new sample doesn't use it.
        // We will stick to the provided sample: figcaption is just the caption.
        const figcaptionHtml = caption;

        return `
<figure class="photo-item" style="display: inline-table; vertical-align: top; margin: 8px;">
    <img src="${photo.url}" alt="${altText}" class="figure-img img-fluid rounded" style="max-width: 100%; height: auto;">
    <figcaption class="figure-caption" style="display: table-caption; caption-side: bottom; text-align: left;">${figcaptionHtml}</figcaption>
</figure>`.trim();

    }).join('\n');

    // This inline script adjusts caption layout dynamically, taken from user's sample.
    const inlineScript = `
<script>
    (function() {
        const container = document.getElementById('photo-gallery-container');
        if (!container) return;

        function adjustCaptions() {
            const figures = Array.from(container.querySelectorAll('.photo-item'));
            if (!figures.length) return;

            const rows = new Map();
            figures.forEach(figure => {
                const top = Math.round(figure.getBoundingClientRect().top);
                if (!rows.has(top)) {
                    rows.set(top, []);
                }
                rows.get(top).push(figure);
            });

            rows.forEach(figuresInRow => {
                const figcaption = figuresInRow[0].querySelector('.figure-caption');
                if (!figcaption) return;

                if (figuresInRow.length === 1) {
                    figcaption.style.display = 'block'; 
                    figcaption.style.maxWidth = 'none';
                } else {
                    figcaption.style.display = 'table-caption';
                    figcaption.style.maxWidth = '';
                }
            });
        }
        
        let resizeTimeout;
        const debouncedAdjust = () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(adjustCaptions, 100);
        };
        
        window.addEventListener('resize', debouncedAdjust);

        let imageLoadCheckInterval = setInterval(() => {
            const images = Array.from(container.querySelectorAll('img'));
            const allLoaded = images.every(img => img.complete);
            if (allLoaded) {
                clearInterval(imageLoadCheckInterval);
                adjustCaptions();
            }
        }, 100);

    })();
<\/script>
`;
    return `<div id="photo-gallery-container" style="text-align: left;">\n${photoFiguresHtml}\n</div>\n${inlineScript}`;
};


const EditorApp: React.FC = () => {
    const [sessionId, setSessionId] = useState<string | null>(null);
    const [sessionData, setSessionData] = useState<SessionData | null>(null);
    const [status, setStatus] = useState<Status>('loading');
    const [isSaving, setIsSaving] = useState(false);

    // For Drag and Drop
    const draggedItem = useRef<number | null>(null);
    const dragOverItem = useRef<number | null>(null);
    const scrollInterval = useRef<number | null>(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const id = params.get('session');
        if (id) {
            setSessionId(id);
        } else {
            setStatus('not_found');
        }
    }, []);

    const fetchData = useCallback(async (id: string) => {
        setStatus('loading');
        try {
            const sessionRef = ref(db, `sessions/${id}`);
            const snapshot = await get(sessionRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                setSessionData({ config: data.config, photos: data.photos });
                setStatus('success');
            } else {
                setStatus('not_found');
            }
        } catch (error) {
            console.error("Ошибка загрузки сессии:", error);
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        if (sessionId) {
            fetchData(sessionId);
        }
    }, [sessionId, fetchData]);

    const handleSave = async () => {
        if (!sessionId || !sessionData) return;
        setIsSaving(true);
        try {
            const updates: { [key: string]: any } = {};
            const finalPhotos = sessionData.photos.photos.map((p, i) => ({...p, id: i + 1}));

            updates[`sessions/${sessionId}/config`] = sessionData.config;
            updates[`sessions/${sessionId}/photos`] = { ...sessionData.photos, photos: finalPhotos };

            await update(ref(db), updates);

            alert('Изменения успешно сохранены!');
            fetchData(sessionId);
        } catch (error) {
            console.error("Ошибка сохранения:", error);
            alert('Не удалось сохранить изменения.');
        } finally {
            setIsSaving(false);
        }
    };

    const handleDownloadHtml = () => {
        if (!sessionData || !sessionId) return;
        try {
            const htmlContent = generateHtmlForDownload(sessionData.photos.photos, sessionId);
            const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${sessionId}-gallery.html`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } catch (error) {
            alert(`Ошибка при создании HTML: ${(error as Error).message}`);
            console.error(error);
        }
    };

    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;
        const parsedValue = type === 'number' ? parseFloat(value) || 0 : value;
        if (sessionData) {
            setSessionData({
                ...sessionData,
                config: { ...sessionData.config, [name]: parsedValue },
            });
        }
    };

    const handlePhotoChange = (index: number, field: keyof FirebasePhoto, value: string | boolean) => {
        if (sessionData) {
            const newPhotos = [...sessionData.photos.photos];
            newPhotos[index] = { ...newPhotos[index], [field]: value };
            setSessionData({
                ...sessionData,
                photos: { ...sessionData.photos, photos: newPhotos },
            });
        }
    };

    const handleMovePhoto = (index: number, direction: 'up' | 'down') => {
        if (!sessionData) return;
        const newPhotos = [...sessionData.photos.photos];
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= newPhotos.length) return;

        [newPhotos[index], newPhotos[targetIndex]] = [newPhotos[targetIndex], newPhotos[index]];

        setSessionData({
            ...sessionData,
            photos: { ...sessionData.photos, photos: newPhotos },
        });
    };

    const handleAddPhoto = () => {
        if (sessionData) {
            const newId = sessionData.photos.photos.length > 0 ? Math.max(...sessionData.photos.photos.map(p => p.id)) + 1 : 1;
            const newPhoto: FirebasePhoto = { id: newId, url: '', caption: 'Новое фото', isOutOfCompetition: false };
            setSessionData({
                ...sessionData,
                photos: { ...sessionData.photos, photos: [...sessionData.photos.photos, newPhoto] },
            });
        }
    };

    const handleDeletePhoto = (index: number) => {
        if (sessionData && window.confirm('Вы уверены, что хотите удалить эту фотографию?')) {
            const newPhotos = sessionData.photos.photos.filter((_, i) => i !== index);
            setSessionData({
                ...sessionData,
                photos: { ...sessionData.photos, photos: newPhotos },
            });
        }
    };

    const handleExtractExif = async () => {
        if (!sessionData || !window.confirm('Это действие попытается извлечь описания из метаданных EXIF/IPTC для всех фотографий и перезапишет текущие описания. Продолжить?')) {
            return;
        }

        setStatus('loading');
        let successCount = 0;
        const newPhotos = [...sessionData.photos.photos];

        const promises = newPhotos.map(async (photo, index) => {
            try {
                if (!photo.url) return;
                const exif = await exifr.parse(photo.url, { iptc: true, exif: true });
                if (exif && exif.ImageDescription) {
                    newPhotos[index].caption = exif.ImageDescription;
                    successCount++;
                }
            } catch (error) {
                console.warn(`Не удалось извлечь EXIF для фото ${photo.id} (${photo.url}):`, error);
            }
        });

        await Promise.allSettled(promises);

        setSessionData({ ...sessionData, photos: { ...sessionData.photos, photos: newPhotos } });
        setStatus('success');

        alert(`Успешно извлечено ${successCount} из ${newPhotos.length} описаний.\nНе забудьте сохранить изменения.`);
    };

    const stopScrolling = () => {
        if (scrollInterval.current) {
            clearInterval(scrollInterval.current);
            scrollInterval.current = null;
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const SCROLL_ZONE_HEIGHT = 80;
        const SCROLL_SPEED = 15;

        if (e.clientY < SCROLL_ZONE_HEIGHT) {
            if (!scrollInterval.current) {
                scrollInterval.current = window.setInterval(() => { window.scrollBy(0, -SCROLL_SPEED); }, 15);
            }
        } else if (window.innerHeight - e.clientY < SCROLL_ZONE_HEIGHT) {
            if (!scrollInterval.current) {
                scrollInterval.current = window.setInterval(() => { window.scrollBy(0, SCROLL_SPEED); }, 15);
            }
        } else {
            stopScrolling();
        }
    };

    const handleDrop = () => {
        if (sessionData && draggedItem.current !== null && dragOverItem.current !== null) {
            const newPhotos = [...sessionData.photos.photos];
            const dragged = newPhotos.splice(draggedItem.current, 1)[0];
            newPhotos.splice(dragOverItem.current, 0, dragged);
            draggedItem.current = null;
            dragOverItem.current = null;
            setSessionData({ ...sessionData, photos: { ...sessionData.photos, photos: newPhotos }});
        }
        stopScrolling();
    };

    const renderContent = () => {
        if (status === 'loading') return <Spinner text={`Загрузка сессии "${sessionId}"...`} />;
        if (status === 'error') return <div className="text-red-400 text-center">Ошибка загрузки данных.</div>;
        if (status === 'not_found' || !sessionData) return <div className="text-yellow-400 text-center">Сессия "{sessionId}" не найдена.</div>;

        return (
            <div className="space-y-8">
                {/* Config Editor */}
                <details open className="space-y-4 bg-gray-900/50 p-4 rounded-lg">
                    <summary className="text-xl font-semibold text-gray-300 cursor-pointer">Настройки сессии</summary>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        {Object.entries(sessionData.config).map(([key, value]) => (
                            <div key={key}>
                                <label className="block text-sm font-medium text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1')}</label>
                                {typeof value === 'number' ? (
                                    <input type="number" name={key} value={value} onChange={handleConfigChange} className="mt-1 w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white"/>
                                ) : (
                                    <select name={key} value={value} onChange={handleConfigChange} className="mt-1 w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white">
                                        {key.includes('Layout') ? <>
                                            <option value="grid">Grid</option>
                                            <option value="original">Original</option>
                                        </> : <>
                                            <option value="1/1">1/1</option>
                                            <option value="4/3">4/3</option>
                                            <option value="3/2">3/2</option>
                                        </>}
                                    </select>
                                )}
                            </div>
                        ))}
                    </div>
                </details>

                {/* Intro Article Editor */}
                <details className="space-y-4 bg-gray-900/50 p-4 rounded-lg">
                    <summary className="text-xl font-semibold text-gray-300 cursor-pointer">Вступительная статья (Markdown)</summary>
                    <textarea
                        value={sessionData.photos.introArticleMarkdown}
                        onChange={(e) => setSessionData({...sessionData, photos: {...sessionData.photos, introArticleMarkdown: e.target.value}})}
                        rows={10}
                        className="mt-4 w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white font-mono text-sm"
                    />
                </details>

                {/* Photos Editor */}
                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h2 className="text-xl font-semibold text-gray-300">Фотографии ({sessionData.photos.photos.length})</h2>
                        <div className="flex flex-wrap items-center gap-3">
                            <button onClick={handleDownloadHtml} className="inline-flex items-center gap-x-2 px-4 py-2 font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors">
                                <Download className="w-5 h-5"/> Скачать HTML
                            </button>
                            <button onClick={handleExtractExif} className="inline-flex items-center gap-x-2 px-4 py-2 font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors">
                                <Wand2 className="w-5 h-5"/> Извлечь описания из EXIF
                            </button>
                        </div>
                    </div>
                    <div onDragOver={handleDragOver} className="space-y-3">
                        {sessionData.photos.photos.map((photo, index) => (
                            <div key={photo.id}
                                 draggable
                                 onDragStart={() => draggedItem.current = index}
                                 onDragEnter={() => dragOverItem.current = index}
                                 onDragEnd={handleDrop}
                                 onDragOver={(e) => e.preventDefault()}
                                 className="flex flex-col md:flex-row items-start gap-3 p-3 bg-gray-700/50 rounded-lg cursor-grab active:cursor-grabbing">
                                <img src={photo.url} alt={`Фото ${photo.id}`} className="w-24 h-24 object-cover rounded-md flex-shrink-0"/>
                                <div className="flex-grow space-y-2">
                                    <input type="text" value={photo.url} onChange={(e) => handlePhotoChange(index, 'url', e.target.value)} className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white text-sm" placeholder="URL"/>
                                    <textarea value={photo.caption} onChange={(e) => handlePhotoChange(index, 'caption', e.target.value)} rows={2} className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white text-sm" placeholder="Описание"/>
                                    <div className="flex items-center">
                                        <input type="checkbox" id={`ooc-${photo.id}`} checked={!!photo.isOutOfCompetition} onChange={(e) => handlePhotoChange(index, 'isOutOfCompetition', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"/>
                                        <label htmlFor={`ooc-${photo.id}`} className="ml-2 block text-sm text-gray-300">Вне конкурса</label>
                                    </div>
                                </div>
                                <div className="flex flex-row md:flex-col gap-2 flex-shrink-0">
                                    <button onClick={() => handleMovePhoto(index, 'up')} disabled={index === 0} className="p-2 bg-gray-600 rounded hover:bg-gray-500 disabled:opacity-50"><ArrowUp className="w-4 h-4"/></button>
                                    <button onClick={() => handleMovePhoto(index, 'down')} disabled={index === sessionData.photos.photos.length-1} className="p-2 bg-gray-600 rounded hover:bg-gray-500 disabled:opacity-50"><ArrowDown className="w-4 h-4"/></button>
                                    <button onClick={() => handleDeletePhoto(index)} className="p-2 bg-red-800 rounded hover:bg-red-700"><Trash2 className="w-4 h-4"/></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <button onClick={handleAddPhoto} className="inline-flex items-center gap-x-2 px-4 py-2 font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                        <Plus className="w-5 h-5"/> Добавить фото
                    </button>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-700">
                    <button onClick={handleSave} disabled={isSaving} className="w-full inline-flex items-center justify-center gap-x-2 px-4 py-3 font-semibold text-lg rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:bg-gray-600 disabled:cursor-wait">
                        <Save className="w-6 h-6"/> {isSaving ? 'Сохранение...' : 'Сохранить все изменения'}
                    </button>
                </div>
            </div>
        );
    };

    return <AdminLayout title={`Редактор: ${sessionId || ''}`}>{renderContent()}</AdminLayout>;
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><EditorApp /></React.StrictMode>);