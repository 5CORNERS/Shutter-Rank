import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { db, auth, signInAnonymously } from './firebase';
import { ref, get, update } from 'firebase/database';
import { AdminLayout } from './components/AdminLayout';
import { Spinner } from './components/Spinner';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, Wand2, Download, Loader, UploadCloud, AlertTriangle, X, Copy, CheckCircle2, HelpCircle } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import './index.css';
import { Config, FirebasePhotoData, FirebasePhoto, FirebaseDataGroups, GroupData } from './types';

type Status = 'loading' | 'success' | 'error' | 'not_found';
type SessionData = {
    config: Config;
    photos: FirebasePhotoData;
    groups?: FirebaseDataGroups;
};

const GEMINI_CUSTOM_PROMPT_STORAGE_KEY = 'geminiCustomPrompt';

const DEFAULT_PROMPT = `Ты — куратор музея или автор путеводителя. Опиши это изображение для фотоконкурса. Предоставь фактический, исторический или географический контекст, если это возможно. Избегай поэтического языка, субъективных эмоций и маркетинговых штампов. Будь кратким и информативным. Ответ дай на русском языке. Не используй markdown.`;

const urlToBase64 = async (url: string): Promise<{ base64: string; mimeType: string }> => {
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Failed to fetch image: ${response.statusText}`);
    }
    const blob = await response.blob();
    const mimeType = blob.type;
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const base64 = (reader.result as string).split(',')[1];
            resolve({ base64, mimeType });
        };
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const StorageHelpModal: React.FC<{ onClose: () => void, mode?: 'upload' | 'read' }> = ({ onClose, mode = 'upload' }) => {
    const [copied, setCopied] = useState(false);
    const bucketName = "shutter-rank-storage";

    const corsConfig = `[
  {
    "origin": ["*"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE", "OPTIONS"],
    "responseHeader": ["Content-Type", "Authorization", "Content-Length", "User-Agent", "x-goog-resumable", "x-goog-meta-full-image-url", "x-firebase-storage-version"],
    "maxAgeSeconds": 3600
  }
]`;

    const corsCommand = `echo '${corsConfig.replace(/\n/g, '').replace(/\s+/g, ' ')}' > cors.json && gcloud storage buckets update gs://${bucketName} --cors-file=cors.json`;
    const publicReadCommand = `gcloud storage buckets add-iam-policy-binding gs://${bucketName} --member=allUsers --role=roles/storage.objectViewer`;

    const command = mode === 'read' ? publicReadCommand : corsCommand;
    const title = mode === 'read' ? 'Файлы не открываются (Access Denied)' : 'Файлы не загружаются (CORS)';
    const description = mode === 'read'
        ? 'Файл успешно загружен, но у "всех пользователей" нет прав на его просмотр. Нужно добавить роль Storage Object Viewer.'
        : 'Браузер блокирует загрузку. Скорее всего, не настроена CORS-политика для бакета.';

    const handleCopy = () => {
        navigator.clipboard.writeText(command);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex justify-center items-center p-4" onClick={onClose}>
            <div className="bg-gray-900 border border-red-500/50 rounded-lg shadow-2xl max-w-2xl w-full p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-start gap-4">
                    <div className="p-3 bg-red-900/30 rounded-full">
                        <AlertTriangle className="w-8 h-8 text-red-500" />
                    </div>
                    <div className="flex-grow">
                        <h3 className="text-xl font-bold text-white mb-2">{title}</h3>
                        <p className="text-gray-300 text-sm mb-4">
                            {description}
                        </p>

                        <div className="bg-gray-950 rounded-lg p-4 border border-gray-800 font-mono text-xs text-green-400 overflow-x-auto relative mb-4">
                            <code className="whitespace-pre-wrap break-all">{command}</code>
                            <button
                                onClick={handleCopy}
                                className="absolute top-2 right-2 p-2 bg-gray-800 hover:bg-gray-700 rounded text-white transition-colors"
                                title="Копировать команду"
                            >
                                {copied ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                        </div>

                        <div className="text-sm text-gray-400 space-y-2">
                            <p><strong className="text-white">Как исправить (1 минута):</strong></p>
                            <ol className="list-decimal list-inside space-y-1">
                                <li>Откройте <a href="https://console.cloud.google.com/" target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">Google Cloud Console</a> (Cloud Shell).</li>
                                <li>Нажмите иконку терминала <strong>(&gt;_)</strong> в правом верхнем углу.</li>
                                <li>Вставьте скопированную команду и нажмите Enter.</li>
                            </ol>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-500 hover:text-white"><X className="w-6 h-6" /></button>
                </div>
            </div>
        </div>
    );
};

const generateHtmlForDownload = (photosInOrder: FirebasePhoto[], sessionId: string): string => {
    const photoFiguresHtml = photosInOrder.map(photo => {
        const caption = photo.caption || '';
        const cleanedUrl = photo.url.replace(/\/voting\/?/, '/');
        const altText = `${caption} Фото: Илья Думов`.trim().replace(/"/g, '&quot;');

        const figcaptionHtml = caption ? `${caption}<br>Фото: Илья Думов` : 'Фото: Илья Думов';

        return `
<figure class="photo-item" style="display: inline-table; vertical-align: top; margin: 8px;">
    <img src="${cleanedUrl}" alt="${altText}" class="figure-img img-fluid rounded" style="max-width: 100%; height: auto;">
    <figcaption class="figure-caption" style="display: table-caption; caption-side: bottom; text-align: left;">${figcaptionHtml}</figcaption>
</figure>`.trim();

    }).join('\n');

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
    const [newGroupName, setNewGroupName] = useState('');
    const [status, setStatus] = useState<Status>('loading');
    const [isSaving, setIsSaving] = useState(false);
    const [generatingCaptionFor, setGeneratingCaptionFor] = useState<number | null>(null);
    const [geminiCustomPrompt, setGeminiCustomPrompt] = useState<string>(() => localStorage.getItem(GEMINI_CUSTOM_PROMPT_STORAGE_KEY) || DEFAULT_PROMPT);
    const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);
    const [authStatus, setAuthStatus] = useState<'pending' | 'signed_in' | 'failed'>('pending');
    const [showHelpModal, setShowHelpModal] = useState(false);
    const [helpModalMode, setHelpModalMode] = useState<'upload' | 'read'>('upload');

    // For Drag and Drop
    const photoListRef = useRef<HTMLDivElement>(null);
    const placeholderRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const draggedItemIndex = useRef<number | null>(null);
    const scrollInterval = useRef<number | null>(null);

    useEffect(() => {
        const initAuth = async () => {
            try {
                await signInAnonymously(auth);
                console.log("Signed in anonymously to Firebase");
                setAuthStatus('signed_in');
            } catch (error: any) {
                console.warn("Firebase Auth failed (Public mode).", error);
                setAuthStatus('failed');
            }
        };
        initAuth();
    }, []);

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
                let hasBeenMigrated = false;

                if (!data.config.name) {
                    data.config.name = id;
                    hasBeenMigrated = true;
                }

                if (data.groups) {
                    const groupIds = Object.keys(data.groups);
                    if (groupIds.length > 0 && typeof data.groups[groupIds[0]] === 'string') {
                        const migratedGroups: FirebaseDataGroups = {};
                        for (const groupId of groupIds) {
                            migratedGroups[groupId] = {
                                name: data.groups[groupId],
                                caption: ''
                            };
                        }
                        data.groups = migratedGroups;
                        hasBeenMigrated = true;
                    }
                } else {
                    data.groups = {};
                }

                const photosArray = data.photos?.photos || [];
                if (photosArray.length > 0) {
                    const photosNeedOrderMigration = photosArray.some((p: FirebasePhoto) => p.order === undefined);
                    if (photosNeedOrderMigration) {
                        photosArray.forEach((photo: FirebasePhoto, index: number) => {
                            photo.order = photo.order ?? index;
                        });
                        hasBeenMigrated = true;
                    }
                }

                if (hasBeenMigrated) {
                    alert('Обнаружена сессия старого формата. Данные были обновлены в редакторе. Нажмите "Сохранить", чтобы применить изменения.');
                }

                const safePhotosData: FirebasePhotoData = {
                    introArticleMarkdown: data.photos?.introArticleMarkdown || '',
                    photos: photosArray,
                    groups: data.photos?.groups
                };

                setSessionData({
                    config: data.config,
                    photos: safePhotosData,
                    groups: data.groups || {}
                });
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

        const photosWithOrder = sessionData.photos.photos.map((photo, index) => ({
            ...photo,
            order: index,
        }));

        const finalSessionData = {
            ...sessionData,
            photos: {
                ...sessionData.photos,
                photos: photosWithOrder,
            },
        };

        const sanitizedData = JSON.parse(JSON.stringify(finalSessionData));

        try {
            const updates: { [key: string]: any } = {};
            updates[`/sessions/${sessionId}/config`] = sanitizedData.config;
            updates[`/sessions/${sessionId}/photos`] = sanitizedData.photos;
            updates[`/sessions/${sessionId}/groups`] = sanitizedData.groups || {};

            await update(ref(db), updates);

            alert('Изменения успешно сохранены!');
            await fetchData(sessionId);
        } catch (error: any) {
            console.error("Ошибка сохранения в Firebase:", error);
            alert(`Не удалось сохранить изменения. ${error.message}`);
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
        }
    };

    const handleConfigChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
        const { name, value, type } = e.target;
        const parsedValue = type === 'number' ? parseFloat(value) || 0 : value;
        if (sessionData) {
            setSessionData({
                ...sessionData,
                config: { ...sessionData.config, [name]: parsedValue },
            });
        }
    };

    const handleIntroChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        if (sessionData) {
            setSessionData({
                ...sessionData,
                photos: { ...sessionData.photos, introArticleMarkdown: e.target.value },
            });
        }
    };

    const handlePhotoChange = useCallback((index: number, field: keyof FirebasePhoto, value: string | boolean) => {
        setSessionData(currentData => {
            if (!currentData) return null;
            const newPhotos = [...currentData.photos.photos];
            const updatedPhoto = { ...newPhotos[index], [field]: value };
            if (field === 'groupId' && value === '') {
                delete updatedPhoto.groupId;
            }
            newPhotos[index] = updatedPhoto as FirebasePhoto;
            return {
                ...currentData,
                photos: { ...currentData.photos, photos: newPhotos },
            };
        });
    }, []);

    const handleGenerateCaption = useCallback(async (index: number) => {
        if (!sessionData) return;

        // Retrieve API key from environment variable injected by build process
        const apiKey = process.env.API_KEY;

        if (!apiKey) {
            alert("API Key не найден. Убедитесь, что переменная окружения API_KEY добавлена в Secrets репозитория GitHub.");
            return;
        }

        const prompt = geminiCustomPrompt.trim();
        if (!prompt) {
            alert("Пожалуйста, введите стиль (промпт) для генерации описаний.");
            document.getElementById('geminiCustomPrompt')?.focus();
            return;
        }
        const photo = sessionData.photos.photos[index];
        if (!photo.url) {
            alert("URL фотографии не указан.");
            return;
        }

        setGeneratingCaptionFor(photo.id);
        try {
            const { base64, mimeType } = await urlToBase64(photo.url);
            // DIRECT initialization using process.env.API_KEY as per instructions
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            const imagePart = { inlineData: { mimeType: mimeType, data: base64 } };
            const textPart = { text: prompt };
            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
            });
            const caption = response.text?.trim();
            if (caption) {
                handlePhotoChange(index, 'caption', caption);
            } else {
                throw new Error("Gemini вернул пустое описание.");
            }
        } catch (error: any) {
            console.error("Ошибка генерации описания:", error);
            let errorMessage = error.message;
            alert(`Не удалось сгенерировать описание: ${errorMessage}`);
        } finally {
            setGeneratingCaptionFor(null);
        }
    }, [sessionData, handlePhotoChange, geminiCustomPrompt]);

    const handlePromptChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newPrompt = e.target.value;
        setGeminiCustomPrompt(newPrompt);
        localStorage.setItem(GEMINI_CUSTOM_PROMPT_STORAGE_KEY, newPrompt);
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
            const newPhoto: FirebasePhoto = {
                id: newId,
                url: '',
                caption: 'Новое фото',
                isOutOfCompetition: false,
                order: sessionData.photos.photos.length,
            };
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

    const handleAddGroup = () => {
        const trimmedName = newGroupName.trim();
        if (!trimmedName || !sessionData) return;
        const newGroupId = `group-${crypto.randomUUID()}`;
        const newGroups: FirebaseDataGroups = { ...sessionData.groups, [newGroupId]: { name: trimmedName, caption: '' } };
        setSessionData({ ...sessionData, groups: newGroups });
        setNewGroupName('');
    };

    const handleGroupChange = (groupId: string, field: keyof GroupData, value: string) => {
        if (!sessionData || !sessionData.groups) return;
        const newGroups = { ...sessionData.groups };
        newGroups[groupId] = { ...newGroups[groupId], [field]: value };
        setSessionData({ ...sessionData, groups: newGroups });
    };

    const handleDeleteGroup = (groupId: string) => {
        if (!sessionData || !window.confirm(`Вы уверены, что хотите удалить группу? Все фотографии в ней будут откреплены.`)) return;
        const newGroups = { ...sessionData.groups };
        delete newGroups[groupId];
        const newPhotos = sessionData.photos.photos.map(p => {
            if (p.groupId === groupId) {
                const { groupId: _, ...rest } = p;
                return rest;
            }
            return p;
        });
        setSessionData({
            ...sessionData,
            groups: newGroups,
            photos: { ...sessionData.photos, photos: newPhotos }
        });
    };

    const handleExtractExif = async () => {
        if (!sessionData || !window.confirm('Это действие попытается извлечь описания из метаданных EXIF/IPTC для всех фотографий и перезапишет текущие описания. Продолжить?')) {
            return;
        }
        setStatus('loading');
        let successCount = 0;
        const failedPhotos: { id: number, url: string, error: string }[] = [];
        const newPhotos = [...sessionData.photos.photos];
        let exifr;
        try {
            const module = await import('exifr');
            exifr = module.default || module;
        } catch (e) {
            console.error("Failed to load exifr module", e);
            alert("Ошибка загрузки библиотеки EXIF. Проверьте интернет-соединение.");
            setStatus('success');
            return;
        }
        for (let i = 0; i < newPhotos.length; i++) {
            const photo = newPhotos[i];
            try {
                if (!photo.url) continue;
                const response = await fetch(photo.url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const buffer = await response.arrayBuffer();
                const exif = await exifr.parse(buffer, { iptc: true, exif: true, xmp: true, userComment: true });
                const description = exif?.ImageDescription || exif?.UserComment || exif?.description || exif?.['Caption/Abstract'];
                if (typeof description === 'string' && description.trim()) {
                    newPhotos[i] = { ...newPhotos[i], caption: description.trim() };
                    successCount++;
                } else {
                    throw new Error("Описание не найдено в метаданных.");
                }
            } catch (error: any) {
                const errorMessage = error.message || 'Неизвестная ошибка';
                failedPhotos.push({ id: photo.id, url: photo.url, error: errorMessage });
            }
        }
        setSessionData({ ...sessionData, photos: { ...sessionData.photos, photos: newPhotos } });
        setStatus('success');
        let alertMessage = `Успешно извлечено ${successCount} из ${newPhotos.length} описаний.`;
        if (failedPhotos.length > 0) {
            alertMessage += `\n\nНе удалось обработать ${failedPhotos.length} фото.`;
        }
        alert(alertMessage);
    };

    const stopScrolling = useCallback(() => {
        if (scrollInterval.current) {
            clearInterval(scrollInterval.current);
            scrollInterval.current = null;
        }
    }, []);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
        const target = e.currentTarget;
        draggedItemIndex.current = index;
        if (!placeholderRef.current) {
            placeholderRef.current = document.createElement('div');
            placeholderRef.current.className = 'drag-over-placeholder';
        }
        target.parentElement?.insertBefore(placeholderRef.current, target.nextSibling);
        setTimeout(() => {
            target.classList.add('dragging');
        }, 0);
    };

    const handleDragEnd = useCallback(() => {
        const draggedEl = photoListRef.current?.querySelector('.dragging');
        draggedEl?.classList.remove('dragging');
        placeholderRef.current?.remove();
        stopScrolling();
        draggedItemIndex.current = null;
        const overlay = document.getElementById('drop-overlay');
        if (overlay) overlay.style.display = 'none';
    }, [stopScrolling]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
            return;
        }
        const container = photoListRef.current;
        const placeholder = placeholderRef.current;
        if (!container || !placeholder || draggedItemIndex.current === null) return;

        const SCROLL_ZONE_HEIGHT = 80;
        const SCROLL_SPEED = 15;
        const clientY = e.clientY;
        const containerRect = container.getBoundingClientRect();

        if (clientY < containerRect.top + SCROLL_ZONE_HEIGHT) {
            if (!scrollInterval.current) {
                scrollInterval.current = window.setInterval(() => { window.scrollBy(0, -SCROLL_SPEED); }, 15);
            }
        } else if (clientY > window.innerHeight - SCROLL_ZONE_HEIGHT) {
            if (!scrollInterval.current) {
                scrollInterval.current = window.setInterval(() => { window.scrollBy(0, SCROLL_SPEED); }, 15);
            }
        } else {
            stopScrolling();
        }

        type Closest = { offset: number; element: HTMLElement | null };
        const afterElement = [...container.querySelectorAll<HTMLElement>('[draggable="true"]:not(.dragging)')]
            .reduce((closest: Closest, child: HTMLElement): Closest => {
                const box = child.getBoundingClientRect();
                const offset = clientY - box.top - box.height / 2;
                if (offset < 0 && offset > closest.offset) {
                    return { offset, element: child };
                }
                return closest;
            }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;

        if (afterElement) {
            container.insertBefore(placeholder, afterElement);
        } else {
            container.appendChild(placeholder);
        }
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            const overlay = document.getElementById('drop-overlay');
            if (overlay) overlay.style.display = 'flex';
        }
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.relatedTarget && (e.relatedTarget as HTMLElement).id !== 'drop-overlay') {
            const overlay = document.getElementById('drop-overlay');
            if (overlay) overlay.style.display = 'none';
        }
    }

    const verifyPublicAccess = async (url: string): Promise<boolean> => {
        try {
            const response = await fetch(url, { method: 'HEAD' });
            return response.ok;
        } catch (e) {
            console.warn("Verification check failed", e);
            return false;
        }
    }

    const handleUploadFiles = async (files: FileList | null) => {
        if (!files || files.length === 0 || !sessionData || !sessionId) return;
        const newPhotos: FirebasePhoto[] = [];
        const total = files.length;
        let current = 0;
        setUploadProgress({ current: 0, total });

        let maxId = sessionData.photos.photos.length > 0 ? Math.max(...sessionData.photos.photos.map(p => p.id)) : 0;
        const bucketName = "shutter-rank-storage";

        let hasVerificationError = false;
        let hasUploadError = false;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;
            try {
                const filename = `${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
                const filePath = `sessions/${sessionId}/${filename}`;

                // Use direct upload to Google Cloud Storage JSON API to bypass Firebase SDK issues
                const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${bucketName}/o?uploadType=media&name=${encodeURIComponent(filePath)}`;

                const response = await fetch(uploadUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': file.type,
                    },
                    body: file
                });

                if (!response.ok) {
                    throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
                }

                // Construct the public URL manually
                const publicUrl = `https://storage.googleapis.com/${bucketName}/${filePath}`;

                const isReadable = await verifyPublicAccess(publicUrl);
                if (!isReadable) {
                    hasVerificationError = true;
                }

                maxId++;
                newPhotos.push({
                    id: maxId,
                    url: publicUrl,
                    caption: '',
                    isOutOfCompetition: false,
                    order: sessionData.photos.photos.length + i
                });
            } catch (error: any) {
                console.warn(`Error uploading ${file.name}:`, error);
                hasUploadError = true;
            } finally {
                current++;
                setUploadProgress({ current, total });
            }
        }

        if (newPhotos.length > 0) {
            setSessionData(prev => {
                if(!prev) return null;
                return {
                    ...prev,
                    photos: { ...prev.photos, photos: [...prev.photos.photos, ...newPhotos] }
                }
            });
        }

        setUploadProgress(null);
        if (fileInputRef.current) fileInputRef.current.value = '';

        if (hasUploadError) {
            setHelpModalMode('upload');
            setShowHelpModal(true);
        } else if (hasVerificationError) {
            setHelpModalMode('read');
            setShowHelpModal(true);
        }
    }

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        const overlay = document.getElementById('drop-overlay');
        if (overlay) overlay.style.display = 'none';

        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUploadFiles(e.dataTransfer.files);
            return;
        }

        if (draggedItemIndex.current === null || !sessionData) {
            handleDragEnd();
            return;
        }

        const placeholder = placeholderRef.current;
        if (!placeholder || !placeholder.parentElement) {
            handleDragEnd();
            return;
        }

        const children = Array.from(placeholder.parentElement.children);
        const newIndex = children.indexOf(placeholder) - 1;

        const newPhotos = [...sessionData.photos.photos];
        const [draggedItem] = newPhotos.splice(draggedItemIndex.current, 1);

        if (newIndex >= 0) {
            newPhotos.splice(newIndex, 0, draggedItem);
            setSessionData({ ...sessionData, photos: { ...sessionData.photos, photos: newPhotos } });
        }

        handleDragEnd();
    }, [sessionData, handleDragEnd]);

    const renderContent = () => {
        if (status === 'loading') return <Spinner text={`Загрузка сессии "${sessionId}"...`} />;
        if (status === 'error') return <div className="text-red-400 text-center">Ошибка загрузки данных.</div>;
        if (status === 'not_found' || !sessionData) return <div className="text-yellow-400 text-center">Сессия "{sessionId}" не найдена.</div>;

        const availableGroups = sessionData.groups ? (Object.entries(sessionData.groups) as [string, GroupData][]) : [];

        return (
            <div className="space-y-8" onDragEnter={handleDragEnter} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
                {showHelpModal && <StorageHelpModal onClose={() => setShowHelpModal(false)} mode={helpModalMode} />}
                <input type="file" ref={fileInputRef} onChange={(e) => handleUploadFiles(e.target.files)} className="hidden" multiple accept="image/*" />

                <div id="drop-overlay" className="hidden fixed inset-0 z-50 bg-black/80 flex-col items-center justify-center text-white backdrop-blur-sm transition-opacity pointer-events-none">
                    <UploadCloud className="w-24 h-24 text-indigo-500 mb-4 animate-bounce" />
                    <p className="text-2xl font-bold">Отпустите файлы для загрузки</p>
                    <p className="text-gray-400 mt-2">Они будут добавлены в конец списка</p>
                </div>

                {uploadProgress && (
                    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center backdrop-blur-sm">
                        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl text-center border border-gray-700">
                            <Loader className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Загрузка файлов...</h3>
                            <p className="text-gray-300 mb-4">{uploadProgress.current} из {uploadProgress.total}</p>
                            <div className="w-64 h-2 bg-gray-700 rounded-full overflow-hidden">
                                <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
                            </div>
                        </div>
                    </div>
                )}

                <details open className="space-y-4 bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 shadow-sm">
                    <summary className="text-xl font-semibold mb-4 text-gray-200 flex items-center gap-2 cursor-pointer">
                        Настройки сессии
                        {isSaving && <span className="text-sm text-gray-400 font-normal flex items-center"><Loader className="w-4 h-4 animate-spin mr-1"/>Сохранение...</span>}
                    </summary>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-4">
                        <div className="lg:col-span-1">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Session Name</label>
                            <input type="text" name="name" value={sessionData.config.name || ''} onChange={handleConfigChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-900 text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Default Grid Aspect Ratio</label>
                            <select name="defaultGridAspectRatio" value={sessionData.config.defaultGridAspectRatio} onChange={handleConfigChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-900 text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                                <option value="4/3">4:3</option>
                                <option value="3/2">3:2</option>
                                <option value="1/1">1:1</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Default Layout Desktop</label>
                            <select name="defaultLayoutDesktop" value={sessionData.config.defaultLayoutDesktop} onChange={handleConfigChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-900 text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                                <option value="grid">Grid</option>
                                <option value="original">Original</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Default Layout Mobile</label>
                            <select name="defaultLayoutMobile" value={sessionData.config.defaultLayoutMobile} onChange={handleConfigChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-900 text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors">
                                <option value="original">Original</option>
                                <option value="grid">Grid</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Rated Photo Limit</label>
                            <input type="number" name="ratedPhotoLimit" value={sessionData.config.ratedPhotoLimit} onChange={handleConfigChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-900 text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Total Stars Limit</label>
                            <input type="number" name="totalStarsLimit" value={sessionData.config.totalStarsLimit} onChange={handleConfigChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-900 text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Unlock Five Stars Threshold Percent</label>
                            <input type="number" name="unlockFiveStarsThresholdPercent" value={sessionData.config.unlockFiveStarsThresholdPercent ?? 50} onChange={handleConfigChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-900 text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-400 mb-1">Unlock Four Stars Threshold Percent</label>
                            <input type="number" name="unlockFourStarsThresholdPercent" value={sessionData.config.unlockFourStarsThresholdPercent ?? 20} onChange={handleConfigChange} className="w-full p-2 border border-gray-600 rounded-md bg-gray-900 text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors" />
                        </div>
                        <div className="md:col-span-2 lg:col-span-3">
                            <label className="block text-sm font-medium text-gray-400 mb-1">Стиль описаний от ИИ (промпт)</label>
                            <textarea id="geminiCustomPrompt" value={geminiCustomPrompt} onChange={handlePromptChange} rows={3} className="w-full p-2 border border-gray-600 rounded-md bg-gray-900 text-white focus:ring-indigo-500 focus:border-indigo-500 transition-colors text-sm" />
                            <p className="text-xs text-gray-500 mt-1">Инструкция для Gemini. Сохраняется в вашем браузере.</p>
                        </div>
                    </div>
                </details>

                <details className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 shadow-sm">
                    <summary className="text-xl font-semibold mb-2 text-gray-200 cursor-pointer">
                        Вступительная статья (Markdown)
                    </summary>
                    <div className="mt-4">
                         <textarea
                             value={sessionData.photos.introArticleMarkdown}
                             onChange={handleIntroChange}
                             rows={10}
                             className="w-full p-2 border border-gray-600 rounded-md bg-gray-900 text-white font-mono text-sm"
                             placeholder="# Заголовок\n\nТекст статьи..."
                         />
                    </div>
                </details>

                <details open className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 shadow-sm">
                    <summary className="text-xl font-semibold mb-4 text-gray-200 cursor-pointer">Группы фотографий</summary>
                    <div className="mt-4">
                        <div className="flex gap-2 mb-4">
                            <input type="text" value={newGroupName} onChange={(e) => setNewGroupName(e.target.value)} className="flex-grow p-2 border border-gray-600 rounded-md bg-gray-900 text-white focus:ring-indigo-500 focus:border-indigo-500" placeholder="Название новой группы" />
                            <button onClick={handleAddGroup} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 transition-colors">
                                <Plus className="w-4 h-4" /> Добавить
                            </button>
                        </div>
                        {availableGroups.length > 0 ? (
                            <div className="space-y-3">
                                {availableGroups.map(([groupId, groupData]) => (
                                    <div key={groupId} className="flex flex-col sm:flex-row gap-2 items-start sm:items-center p-3 bg-gray-700/30 rounded-lg border border-gray-700/50">
                                        <div className="flex-grow grid grid-cols-1 sm:grid-cols-2 gap-2 w-full">
                                            <input type="text" value={groupData.name} onChange={(e) => handleGroupChange(groupId, 'name', e.target.value)} className="p-2 bg-gray-900 border border-gray-600 rounded text-white text-sm" placeholder="Название" />
                                            <input type="text" value={groupData.caption || ''} onChange={(e) => handleGroupChange(groupId, 'caption', e.target.value)} className="p-2 bg-gray-900 border border-gray-600 rounded text-white text-sm" placeholder="Описание группы (необязательно)" />
                                        </div>
                                        <button onClick={() => handleDeleteGroup(groupId)} className="text-red-400 hover:text-red-300 p-2" title="Удалить группу">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 italic">Группы пока не созданы.</p>
                        )}
                    </div>
                </details>

                <div className="space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-4">
                        <h2 className="text-xl font-semibold text-gray-300">Фотографии ({sessionData.photos.photos.length})</h2>
                        <div className="flex flex-wrap items-center gap-3">
                            <button
                                onClick={() => { setHelpModalMode('upload'); setShowHelpModal(true); }}
                                className="inline-flex items-center gap-x-2 px-3 py-2 text-sm font-semibold rounded-lg bg-gray-700 hover:bg-gray-600 text-gray-300 transition-colors"
                            >
                                <HelpCircle className="w-4 h-4"/> Проблемы с фото?
                            </button>
                            <button onClick={handleDownloadHtml} className="inline-flex items-center gap-x-2 px-4 py-2 font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors">
                                <Download className="w-5 h-5"/> Скачать HTML
                            </button>
                            <button onClick={handleExtractExif} className="inline-flex items-center gap-x-2 px-4 py-2 font-semibold rounded-lg bg-teal-600 hover:bg-teal-700 text-white transition-colors">
                                <Wand2 className="w-5 h-5"/> Извлечь описания из EXIF
                            </button>
                        </div>
                    </div>

                    {sessionData.photos.photos.length === 0 ? (
                        <div
                            className="border-2 border-dashed border-gray-700 rounded-lg p-12 flex flex-col items-center justify-center text-gray-500 bg-gray-800/30 transition-colors hover:bg-gray-800/50 hover:border-gray-500 cursor-pointer"
                            onDragOver={(e) => e.preventDefault()}
                            onDrop={handleDrop}
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <UploadCloud className="w-16 h-16 mb-4 text-gray-600" />
                            <p className="text-lg font-medium">Перетащите сюда фотографии для загрузки</p>
                            <p className="text-sm mt-2">или кликните, чтобы выбрать файлы</p>
                        </div>
                    ) : (
                        <div ref={photoListRef} className="space-y-3">
                            {sessionData.photos.photos.map((photo, index) => (
                                <div key={photo.id}
                                     draggable
                                     onDragStart={(e) => handleDragStart(e, index)}
                                     className={`flex flex-col md:flex-row items-start gap-3 p-3 bg-gray-700/50 rounded-lg transition-opacity duration-300`}
                                >
                                    <div className="flex-shrink-0 self-center flex md:flex-col items-center gap-2 drag-handle cursor-grab active:cursor-grabbing">
                                        <button onClick={() => handleMovePhoto(index, 'up')} disabled={index === 0} className="p-2 bg-gray-600/50 rounded hover:bg-gray-600 disabled:opacity-50"><ArrowUp className="w-4 h-4"/></button>
                                        <div className="text-gray-500">☰</div>
                                        <button onClick={() => handleMovePhoto(index, 'down')} disabled={index === sessionData.photos.photos.length - 1} className="p-2 bg-gray-600/50 rounded hover:bg-gray-600 disabled:opacity-50"><ArrowDown className="w-4 h-4"/></button>
                                    </div>
                                    <img src={photo.url} alt={`Фото ${photo.id}`} className="w-24 h-24 object-cover rounded-md flex-shrink-0 self-center" />
                                    <div className="flex-grow space-y-2">
                                        <input type="text" value={photo.url} onChange={(e) => handlePhotoChange(index, 'url', e.target.value)} className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white text-sm" placeholder="URL"/>
                                        <div className="relative">
                                            <textarea
                                                value={photo.caption}
                                                onChange={(e) => handlePhotoChange(index, 'caption', e.target.value)}
                                                rows={2}
                                                className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white text-sm pr-10"
                                                placeholder="Описание"
                                            />
                                            <button
                                                onClick={() => handleGenerateCaption(index)}
                                                disabled={generatingCaptionFor === photo.id}
                                                className="absolute top-1/2 -translate-y-1/2 right-2 p-1.5 text-gray-400 hover:text-indigo-400 transition-colors disabled:cursor-not-allowed disabled:text-gray-600"
                                                title="Сгенерировать описание с помощью Gemini"
                                            >
                                                {generatingCaptionFor === photo.id ? (
                                                    <Loader className="w-5 h-5 animate-spin"/>
                                                ) : (
                                                    <Wand2 className="w-5 h-5"/>
                                                )}
                                            </button>
                                        </div>
                                        <div className="flex items-center justify-between gap-4">
                                            <select
                                                value={photo.groupId || ''}
                                                onChange={(e) => handlePhotoChange(index, 'groupId', e.target.value)}
                                                className="p-2 border border-gray-600 rounded-md bg-gray-800 text-white text-sm"
                                                disabled={availableGroups.length === 0}
                                            >
                                                <option value="">Без группы</option>
                                                {availableGroups.map(([id, groupData]) => (
                                                    <option key={id} value={id}>{groupData.name}</option>
                                                ))}
                                            </select>

                                            <div className="flex items-center">
                                                <input type="checkbox" id={`ooc-${photo.id}`} checked={!!photo.isOutOfCompetition} onChange={(e) => handlePhotoChange(index, 'isOutOfCompetition', e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"/>
                                                <label htmlFor={`ooc-${photo.id}`} className="ml-2 block text-sm text-gray-300">Вне конкурса</label>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="self-center">
                                        <button onClick={() => handleDeletePhoto(index)} className="p-2 text-red-500 hover:text-red-400"><Trash2 className="w-5 h-5"/></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    <div className="flex gap-2 mt-4">
                        <button onClick={() => fileInputRef.current?.click()} className="flex-1 inline-flex items-center justify-center gap-x-2 px-4 py-2 font-semibold rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white transition-colors">
                            <UploadCloud className="w-5 h-5"/> Загрузить фото
                        </button>
                        <button onClick={handleAddPhoto} className="flex-1 inline-flex items-center justify-center gap-x-2 px-4 py-2 font-semibold rounded-lg bg-gray-700 hover:bg-gray-600 text-white transition-colors">
                            <Plus className="w-5 h-5"/> Добавить карточку
                        </button>
                    </div>
                </div>

                <div className="mt-8 pt-6 border-t border-gray-700">
                    <button onClick={handleSave} disabled={isSaving} className="w-full inline-flex items-center justify-center gap-x-2 px-4 py-3 font-semibold text-lg rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors disabled:bg-gray-600 disabled:cursor-wait">
                        <Save className="w-6 h-6"/> {isSaving ? 'Сохранение...' : 'Сохранить все изменения'}
                    </button>
                </div>
            </div>
        );
    };

    const pageTitle = `Редактор: ${sessionData?.config?.name || sessionId || '...'}`;

    return <AdminLayout title={pageTitle}>{renderContent()}</AdminLayout>;
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><EditorApp /></React.StrictMode>);