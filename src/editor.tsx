import React, { useState, useEffect, useCallback, useRef } from 'react';
import ReactDOM from 'react-dom/client';
import { db, storage, auth } from './firebase';
import { ref, get, update } from 'firebase/database';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { signInAnonymously } from 'firebase/auth';
import { AdminLayout } from './components/AdminLayout';
import { Spinner } from './components/Spinner';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, Wand2, Download, Loader, UploadCloud } from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import './index.css';
import { Config, FirebasePhotoData, FirebasePhoto, FirebaseDataGroups, GroupData } from './types';

type Status = 'loading' | 'success' | 'error' | 'not_found';
type SessionData = {
    config: Config;
    photos: FirebasePhotoData;
    groups?: FirebaseDataGroups;
};

const GEMINI_API_KEY_STORAGE_KEY = 'geminiApiKey';
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
    const [geminiApiKey, setGeminiApiKey] = useState<string>(() => localStorage.getItem(GEMINI_API_KEY_STORAGE_KEY) || '');
    const [geminiCustomPrompt, setGeminiCustomPrompt] = useState<string>(() => localStorage.getItem(GEMINI_CUSTOM_PROMPT_STORAGE_KEY) || DEFAULT_PROMPT);
    const [uploadProgress, setUploadProgress] = useState<{current: number, total: number} | null>(null);


    // For Drag and Drop
    const photoListRef = useRef<HTMLDivElement>(null);
    const placeholderRef = useRef<HTMLDivElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const draggedItemIndex = useRef<number | null>(null);
    const scrollInterval = useRef<number | null>(null);
    const dragCounter = useRef(0);

    useEffect(() => {
        // Sign in anonymously to allow Storage operations if rules require auth
        signInAnonymously(auth)
            .then(() => console.log("Signed in anonymously"))
            .catch((error) => console.error("Error signing in anonymously:", error));
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

        try {
            const updates: { [key: string]: any } = {};
            updates[`/sessions/${sessionId}/config`] = finalSessionData.config;
            updates[`/sessions/${sessionId}/photos`] = finalSessionData.photos;
            updates[`/sessions/${sessionId}/groups`] = finalSessionData.groups || {};

            await update(ref(db), updates);

            alert('Изменения успешно сохранены!');
            await fetchData(sessionId);
        } catch (error: any) {
            console.error("Ошибка сохранения в Firebase:", error);
            alert(`Не удалось сохранить изменения. Проверьте правила безопасности. Подробности в консоли разработчика (F12).`);
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

        const key = geminiApiKey.trim();
        if (!key) {
            alert("Пожалуйста, введите ваш Google AI API Key в настройках сессии.");
            document.getElementById('geminiApiKey')?.focus();
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

            const ai = new GoogleGenAI({ apiKey: key });

            const imagePart = {
                inlineData: {
                    mimeType: mimeType,
                    data: base64,
                },
            };

            const textPart = {
                text: prompt
            };

            const response = await ai.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: { parts: [imagePart, textPart] },
            });

            const caption = response.text.trim();

            if (caption) {
                handlePhotoChange(index, 'caption', caption);
            } else {
                throw new Error("Gemini вернул пустое описание.");
            }

        } catch (error) {
            console.error("Ошибка генерации описания:", error);
            let errorMessage = (error as Error).message;
            if (errorMessage.includes('API key not valid')) {
                errorMessage = "API-ключ недействителен. Проверьте правильность ключа."
            }
            alert(`Не удалось сгенерировать описание: ${errorMessage}`);
        } finally {
            setGeneratingCaptionFor(null);
        }
    }, [sessionData, handlePhotoChange, geminiApiKey, geminiCustomPrompt]);

    const handleApiKeyChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newKey = e.target.value;
        setGeminiApiKey(newKey);
        localStorage.setItem(GEMINI_API_KEY_STORAGE_KEY, newKey);
    };

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

        // Dynamic import to prevent load issues
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

                // Fetch the image as a buffer to avoid some CORS issues with the library's internal fetch
                const response = await fetch(photo.url);
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                const buffer = await response.arrayBuffer();

                const exif = await exifr.parse(buffer, {
                    iptc: true,
                    exif: true,
                    xmp: true,
                    userComment: true,
                });

                const description = exif?.ImageDescription
                    || exif?.UserComment
                    || exif?.description
                    || exif?.['Caption/Abstract'];

                if (typeof description === 'string' && description.trim()) {
                    newPhotos[i] = { ...newPhotos[i], caption: description.trim() };
                    successCount++;
                } else {
                    throw new Error("Описание не найдено в метаданных.");
                }
            } catch (error: any) {
                const errorMessage = error.message || 'Неизвестная ошибка';
                failedPhotos.push({ id: photo.id, url: photo.url, error: errorMessage });
                console.warn(`Не удалось извлечь EXIF для фото ${photo.id} (${photo.url}):`, error);
            }
        }

        setSessionData({ ...sessionData, photos: { ...sessionData.photos, photos: newPhotos } });
        setStatus('success');

        let alertMessage = `Успешно извлечено ${successCount} из ${newPhotos.length} описаний.`;
        if (failedPhotos.length > 0) {
            alertMessage += `\n\nНе удалось обработать ${failedPhotos.length} фото.`;
            alertMessage += `\n\nВозможные причины:`;
            alertMessage += `\n- CORS-политика на сервере изображений (проверьте, что она настроена).`;
            alertMessage += `\n- Файл изображения поврежден или недоступен по URL.`;
            alertMessage += `\n- В метаданных фотографии отсутствует поле с описанием.`;
            alertMessage += '\n\nОткройте консоль разработчика (F12) для просмотра полного списка ошибок.'
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
        dragCounter.current = 0;

        const overlay = document.getElementById('drop-overlay');
        if (overlay) overlay.style.display = 'none';
    }, [stopScrolling]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        // If dragging files, show overlay and do nothing else
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
            return;
        }

        // Handle reordering logic
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
        dragCounter.current++;
        if (e.dataTransfer.types.includes('Files')) {
            const overlay = document.getElementById('drop-overlay');
            if (overlay) overlay.style.display = 'flex';
        }
    }

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current--;
        if (dragCounter.current === 0) {
            const overlay = document.getElementById('drop-overlay');
            if (overlay) overlay.style.display = 'none';
        }
    }

    const handleUploadFiles = async (files: FileList | null) => {
        if (!files || files.length === 0 || !sessionData || !sessionId) return;

        // Ensure auth is initialized
        if (!auth.currentUser) {
            try {
                await signInAnonymously(auth);
            } catch (err) {
                console.error("Auth required for upload:", err);
                alert("Ошибка авторизации перед загрузкой. Проверьте консоль.");
                return;
            }
        }

        const newPhotos: FirebasePhoto[] = [];
        const total = files.length;
        let current = 0;
        setUploadProgress({ current: 0, total });

        const failedUploads: string[] = [];

        let maxId = sessionData.photos.photos.length > 0 ? Math.max(...sessionData.photos.photos.map(p => p.id)) : 0;

        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            if (!file.type.startsWith('image/')) continue;

            try {
                const filename = `${Date.now()}_${file.name}`;
                const fileRef = storageRef(storage, `sessions/${sessionId}/${filename}`);

                await uploadBytes(fileRef, file);
                const url = await getDownloadURL(fileRef);

                maxId++;
                newPhotos.push({
                    id: maxId,
                    url: url,
                    caption: '',
                    isOutOfCompetition: false,
                    order: sessionData.photos.photos.length + i
                });

            } catch (error) {
                console.error(`Error uploading ${file.name}:`, error);
                failedUploads.push(file.name);
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
                    photos: {
                        ...prev.photos,
                        photos: [...prev.photos.photos, ...newPhotos]
                    }
                }
            });
        }

        setUploadProgress(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }

        if (failedUploads.length > 0) {
            alert(`Не удалось загрузить следующие файлы (${failedUploads.length}):\n${failedUploads.join('\n')}\n\nПроверьте права доступа к хранилищу (ошибка 412 или 403).`);
        }
    }

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();

        const overlay = document.getElementById('drop-overlay');
        if (overlay) overlay.style.display = 'none';
        dragCounter.current = 0;

        // 1. Handle Files Upload
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            handleUploadFiles(e.dataTransfer.files);
            return;
        }

        // 2. Handle Reordering
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
            <div
                className="space-y-8 relative"
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
            >
                {/* Hidden File Input */}
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={(e) => handleUploadFiles(e.target.files)}
                    className="hidden"
                    multiple
                    accept="image/*"
                />

                {/* Drop Zone Overlay */}
                <div id="drop-overlay" className="hidden fixed inset-0 z-50 bg-black/80 flex-col items-center justify-center text-white backdrop-blur-sm transition-opacity pointer-events-none">
                    <UploadCloud className="w-24 h-24 text-indigo-500 mb-4 animate-bounce" />
                    <p className="text-2xl font-bold">Отпустите файлы для загрузки</p>
                    <p className="text-gray-400 mt-2">Они будут добавлены в конец списка</p>
                </div>

                {/* Upload Progress Modal */}
                {uploadProgress && (
                    <div className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center backdrop-blur-sm">
                        <div className="bg-gray-800 p-8 rounded-xl shadow-2xl text-center border border-gray-700">
                            <Loader className="w-12 h-12 text-indigo-500 animate-spin mx-auto mb-4" />
                            <h3 className="text-xl font-bold text-white mb-2">Загрузка фотографий...</h3>
                            <p className="text-gray-300 text-lg">{uploadProgress.current} / {uploadProgress.total}</p>
                            <div className="w-64 h-2 bg-gray-700 rounded-full mt-4 overflow-hidden">
                                <div
                                    className="h-full bg-indigo-500 transition-all duration-300"
                                    style={{width: `${(uploadProgress.current / uploadProgress.total) * 100}%`}}
                                />
                            </div>
                        </div>
                    </div>
                )}

                <details open className="space-y-4 bg-gray-900/50 p-4 rounded-lg">
                    <summary className="text-xl font-semibold text-gray-300 cursor-pointer">Настройки сессии</summary>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-400">Session Name</label>
                            <input type="text" name="name" value={sessionData.config.name || ''} onChange={handleConfigChange} className="mt-1 w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white"/>
                        </div>
                        {Object.entries(sessionData.config).filter(([key]) => key !== 'name').map(([key, value]) => (
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
                        <div>
                            <label htmlFor="geminiApiKey" className="block text-sm font-medium text-gray-400">Google AI API Key</label>
                            <input id="geminiApiKey" type="password" value={geminiApiKey} onChange={handleApiKeyChange} className="mt-1 w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white" placeholder="Вставьте ваш ключ"/>
                            <p className="text-xs text-gray-500 mt-1">Ключ сохраняется в вашем браузере и не передается на сервер.</p>
                        </div>
                    </div>
                    <div className="mt-4">
                        <label htmlFor="geminiCustomPrompt" className="block text-sm font-medium text-gray-400">Стиль описаний от ИИ (промпт)</label>
                        <textarea id="geminiCustomPrompt" value={geminiCustomPrompt} onChange={handlePromptChange} rows={4} className="mt-1 w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white font-mono text-xs" placeholder="Задайте стиль для генерации..."/>
                        <p className="text-xs text-gray-500 mt-1">Инструкция для Gemini. Сохраняется в вашем браузере.</p>
                    </div>
                </details>

                <details className="space-y-4 bg-gray-900/50 p-4 rounded-lg">
                    <summary className="text-xl font-semibold text-gray-300 cursor-pointer">Вступительная статья (Markdown)</summary>
                    <textarea
                        value={sessionData.photos.introArticleMarkdown}
                        onChange={(e) => setSessionData({...sessionData, photos: {...sessionData.photos, introArticleMarkdown: e.target.value}})}
                        rows={10}
                        className="mt-4 w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white font-mono text-sm"
                    />
                </details>

                <details open className="space-y-4 bg-gray-900/50 p-4 rounded-lg">
                    <summary className="text-xl font-semibold text-gray-300 cursor-pointer">Группы фотографий</summary>
                    <div className="mt-4 space-y-4">
                        <div className="flex gap-2 p-3 bg-gray-700/50 rounded-lg">
                            <input
                                type="text"
                                value={newGroupName}
                                onChange={(e) => setNewGroupName(e.target.value)}
                                className="flex-grow p-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                                placeholder="Название новой группы"
                            />
                            <button onClick={handleAddGroup} className="inline-flex items-center gap-x-2 px-4 py-2 font-semibold rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors">
                                <Plus className="w-5 h-5"/> Добавить
                            </button>
                        </div>
                        {availableGroups.length > 0 && (
                            <div className="space-y-3">
                                {availableGroups.map(([id, groupData]) => (
                                    <div key={id} className="space-y-2 p-3 bg-gray-700/50 rounded-lg">
                                        <div className="flex items-center justify-between">
                                            <input
                                                type="text"
                                                value={groupData.name}
                                                onChange={(e) => handleGroupChange(id, 'name', e.target.value)}
                                                className="flex-grow p-1 border-b border-gray-600 bg-transparent text-gray-200 focus:outline-none focus:border-indigo-500 font-semibold"
                                                placeholder="Название группы"
                                            />
                                            <button onClick={() => handleDeleteGroup(id)} className="ml-2 p-1 text-red-400 hover:text-red-300"><Trash2 className="w-4 h-4"/></button>
                                        </div>
                                        <textarea
                                            value={groupData.caption || ''}
                                            onChange={(e) => handleGroupChange(id, 'caption', e.target.value)}
                                            rows={2}
                                            className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white text-sm"
                                            placeholder="Описание группы (необязательно)"
                                        />
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </details>

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
                    <div ref={photoListRef} className="space-y-3 min-h-[200px] border-2 border-dashed border-gray-700 rounded-xl p-4 transition-colors hover:border-indigo-500/50">
                        {sessionData.photos.photos.length === 0 && (
                            <div className="flex flex-col items-center justify-center h-48 text-gray-500 pointer-events-none">
                                <UploadCloud className="w-12 h-12 mb-2" />
                                <p>Перетащите сюда фотографии для загрузки</p>
                            </div>
                        )}
                        {sessionData.photos.photos.map((photo, index) => (
                            <div key={photo.id}
                                 draggable
                                 onDragStart={(e) => handleDragStart(e, index)}
                                 onDragEnd={handleDragEnd}
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
                    <div className='grid grid-cols-2 gap-4 mt-4'>
                        <button onClick={() => fileInputRef.current?.click()} className="inline-flex items-center justify-center gap-x-2 px-4 py-2 font-semibold rounded-lg bg-indigo-600/80 hover:bg-indigo-600 text-white transition-colors">
                            <UploadCloud className="w-5 h-5"/> Загрузить фото
                        </button>
                        <button onClick={handleAddPhoto} className="inline-flex items-center justify-center gap-x-2 px-4 py-2 font-semibold rounded-lg bg-blue-600/80 hover:bg-blue-600 text-white transition-colors">
                            <Plus className="w-5 h-5"/> Добавить пустую карточку
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