import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { db } from './firebase';
import { ref, set, get } from 'firebase/database';
import { AdminLayout } from './components/AdminLayout';
import { Spinner } from './components/Spinner';
import { Save, AlertTriangle } from 'lucide-react';
import './index.css';
import { FirebasePhoto, FirebasePhotoData } from './types';

type Status = 'idle' | 'processing' | 'processed' | 'saving' | 'error';

const PrepareApp: React.FC = () => {
    const [sessionId, setSessionId] = useState('');
    const [urls, setUrls] = useState('');
    const [intro, setIntro] = useState('');
    const [photos, setPhotos] = useState<FirebasePhoto[]>([]);
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState('');

    const handleProcessUrls = () => {
        setStatus('processing');
        const urlArray = urls.split('\n').map(u => u.trim()).filter(Boolean);
        if (urlArray.length === 0) {
            setError('Пожалуйста, введите хотя бы один URL.');
            setStatus('error');
            return;
        }
        const photoData = urlArray.map((url, index) => ({
            id: index + 1,
            url,
            caption: `Фото ${index + 1}`,
            isOutOfCompetition: false,
        }));
        setPhotos(photoData);
        setStatus('processed');
    };

    const handlePhotoChange = (index: number, field: keyof FirebasePhoto, value: string | boolean) => {
        const newPhotos = [...photos];
        newPhotos[index] = { ...newPhotos[index], [field]: value };
        setPhotos(newPhotos);
    };

    const handleSave = async () => {
        const trimmedId = sessionId.trim().replace(/[^a-zA-Z0-9-_]/g, '');
        if (!trimmedId) {
            setError('Пожалуйста, введите корректное имя сессии.');
            setStatus('error');
            return;
        }
        if (photos.length === 0) {
            setError('Нет фотографий для сохранения.');
            setStatus('error');
            return;
        }

        setStatus('saving');
        try {
            const sessionRef = ref(db, `sessions/${trimmedId}`);
            const snapshot = await get(sessionRef);
            if (snapshot.exists()) {
                if (!window.confirm(`Сессия "${trimmedId}" уже существует. Вы уверены, что хотите перезаписать ее данные о фотографиях?`)) {
                    setStatus('processed');
                    return;
                }
            }
            
            const photosData: FirebasePhotoData = {
                introArticleMarkdown: intro,
                photos: photos,
            };

            await set(ref(db, `sessions/${trimmedId}/photos`), photosData);
            
            // Initialize votes for new photos if they don't exist
            const votesRef = ref(db, `sessions/${trimmedId}/votes`);
            const votesSnapshot = await get(votesRef);
            const currentVotes = votesSnapshot.val() || {};
            photos.forEach(p => {
                if (currentVotes[p.id] === undefined) {
                    currentVotes[p.id] = 0;
                }
            });
            await set(votesRef, currentVotes);

            alert(`Сессия "${trimmedId}" успешно сохранена с ${photos.length} фотографиями.`);
            window.location.href = `/editor.html?session=${trimmedId}`;
        } catch (err) {
            console.error(err);
            setError('Ошибка сохранения данных в Firebase. Проверьте консоль.');
            setStatus('error');
        }
    };
    
    const renderContent = () => {
        if (status === 'saving') {
            return <Spinner text="Сохранение сессии в Firebase..." />;
        }

        if (status === 'error') {
            return (
                 <div className="text-center text-red-400">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
                    <p>{error}</p>
                    <button onClick={() => setStatus('idle')} className="mt-4 px-4 py-2 bg-indigo-600 rounded text-white">Попробовать снова</button>
                </div>
            );
        }

        if (status === 'processed' || status === 'processing') {
             return (
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">ID Сессии</label>
                        <input type="text" value={sessionId} disabled className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-gray-400" />
                    </div>
                    {photos.map((photo, index) => (
                        <div key={index} className="flex flex-col md:flex-row items-start gap-3 p-3 bg-gray-700/50 rounded-lg">
                            <img src={photo.url} alt={`Фото ${photo.id}`} className="w-24 h-24 object-cover rounded-md flex-shrink-0" />
                             <div className="flex-grow space-y-2">
                                <p className="text-sm text-gray-400 break-all">{photo.url}</p>
                                <textarea
                                    value={photo.caption}
                                    onChange={(e) => handlePhotoChange(index, 'caption', e.target.value)}
                                    rows={2}
                                    className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white text-sm"
                                    placeholder="Описание"
                                />
                                <div className="flex items-center">
                                    <input
                                        type="checkbox"
                                        id={`ooc-${photo.id}`}
                                        checked={!!photo.isOutOfCompetition}
                                        onChange={(e) => handlePhotoChange(index, 'isOutOfCompetition', e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-600"
                                    />
                                    <label htmlFor={`ooc-${photo.id}`} className="ml-2 block text-sm text-gray-300">Вне конкурса</label>
                                </div>
                            </div>
                        </div>
                    ))}
                    <div className="mt-6 pt-6 border-t border-gray-700">
                        <button onClick={handleSave} className="w-full inline-flex items-center justify-center gap-x-2 px-4 py-3 font-semibold text-lg rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors">
                            <Save className="w-6 h-6" /> Сохранить в Firebase
                        </button>
                    </div>
                </div>
            );
        }
        
        return (
            <div className="space-y-4">
                <div>
                    <label htmlFor="session-id" className="block text-sm font-medium text-gray-300 mb-1">1. ID Сессии</label>
                    <input type="text" id="session-id" value={sessionId} onChange={(e) => setSessionId(e.target.value)} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white" placeholder="Например, paris-2024" />
                </div>
                <div>
                    <label htmlFor="intro" className="block text-sm font-medium text-gray-300 mb-1">2. Вступительная статья (Markdown)</label>
                    <textarea id="intro" value={intro} onChange={(e) => setIntro(e.target.value)} rows={5} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white font-mono text-sm" placeholder="Заголовок, описание..."></textarea>
                </div>
                <div>
                    <label htmlFor="urls" className="block text-sm font-medium text-gray-300 mb-1">3. URL фотографий (каждый с новой строки)</label>
                    <textarea id="urls" value={urls} onChange={(e) => setUrls(e.target.value)} rows={10} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white font-mono text-sm" placeholder="https://.../photo1.jpg&#10;https://.../photo2.jpg"></textarea>
                </div>
                <button onClick={handleProcessUrls} className="w-full px-4 py-2 font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                    4. Обработать и подготовить к сохранению
                </button>
            </div>
        );
    };

    return <AdminLayout title="Подготовка сессии">{renderContent()}</AdminLayout>;
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><PrepareApp /></React.StrictMode>);
