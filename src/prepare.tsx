import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { db } from './firebase';
import { ref, set, get } from 'firebase/database';
import { AdminLayout } from './components/AdminLayout';
import { AuthGuard } from './components/AuthGuard';
import { Spinner } from './components/Spinner';
import { Save, AlertTriangle } from 'lucide-react';
import './index.css';
import { FirebasePhoto, FirebasePhotoData, Config } from './types';

type Status = 'idle' | 'processing' | 'processed' | 'saving' | 'error';

const slugify = (text: string): string => {
    const a = 'àáâäæãåāăąçćčđďèéêëēėęěğǵḧîïíīįìłḿñńǹňôöòóœøōõőṕŕřßśšşșťțûüùúūǘůűųẃẍÿýžźż·/_,:;'
    const b = 'aaaaaaaaaacccddeeeeeeeegghiiiiiilmnnnnoooooooooprrsssssttuuuuuuuuuwxyyzzz------'
    const p = new RegExp(a.split('').join('|'), 'g')
  
    return text.toString().toLowerCase()
      .replace(/\s+/g, '-') // Replace spaces with -
      .replace(p, c => b.charAt(a.indexOf(c))) // Replace special characters
      .replace(/&/g, '-and-') // Replace & with 'and'
      .replace(/[^\w\-]+/g, '') // Remove all non-word chars
      .replace(/\-\-+/g, '-') // Replace multiple - with single -
      .replace(/^-+/, '') // Trim - from start of text
      .replace(/-+$/, '') // Trim - from end of text
}


const PrepareApp: React.FC = () => {
    const [sessionName, setSessionName] = useState('');
    const [urls, setUrls] = useState('');
    const [intro, setIntro] = useState('');
    const [photos, setPhotos] = useState<FirebasePhoto[]>([]);
    const [status, setStatus] = useState<Status>('idle');
    const [error, setError] = useState('');
    const [generatedSessionId, setGeneratedSessionId] = useState('');

    const handleProcessUrls = () => {
        if (!sessionName.trim()) {
            setError('Пожалуйста, введите название сессии.');
            setStatus('error');
            return;
        }
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
            order: index,
        }));
        setPhotos(photoData);
        setGeneratedSessionId(slugify(sessionName));
        setStatus('processed');
    };

    const handlePhotoChange = (index: number, field: keyof FirebasePhoto, value: string | boolean) => {
        const newPhotos = [...photos];
        const photoToUpdate = { ...newPhotos[index], [field]: value };
        newPhotos[index] = photoToUpdate as FirebasePhoto;
        setPhotos(newPhotos);
    };

    const handleSave = async () => {
        if (!generatedSessionId) {
            setError('ID сессии не был сгенерирован.');
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
            const sessionRef = ref(db, `sessions/${generatedSessionId}`);
            const snapshot = await get(sessionRef);
            const sessionExists = snapshot.exists();

            if (sessionExists) {
                if (!window.confirm(`Сессия "${generatedSessionId}" уже существует. Вы уверены, что хотите перезаписать ее данные о фотографиях?`)) {
                    setStatus('processed');
                    return;
                }
            }
            
            const photosWithOrder: FirebasePhoto[] = photos.map((photo, index) => ({
                ...photo,
                order: index,
            }));

            const photosData: FirebasePhotoData = {
                introArticleMarkdown: intro,
                photos: photosWithOrder,
            };
            
            const configData: Config = {
                name: sessionName.trim(),
                ratedPhotoLimit: 15,
                totalStarsLimit: 25,
                defaultLayoutDesktop: 'grid',
                defaultLayoutMobile: 'original',
                defaultGridAspectRatio: '4/3',
                unlockFourStarsThresholdPercent: 20,
                unlockFiveStarsThresholdPercent: 50,
            };

            if (sessionExists) {
                const existingData = snapshot.val();
                await set(ref(db, `sessions/${generatedSessionId}/config`), existingData.config ? {...existingData.config, name: sessionName.trim()} : configData);
                await set(ref(db, `sessions/${generatedSessionId}/photos`), photosData);
                
                const votesRef = ref(db, `sessions/${generatedSessionId}/votes`);
                const votesSnapshot = await get(votesRef);
                const currentVotes = votesSnapshot.val() || {};
                photosWithOrder.forEach(p => {
                    if (currentVotes[p.id] === undefined) {
                        currentVotes[p.id] = 0;
                    }
                });
                await set(votesRef, currentVotes);

            } else {
                const initialVotes: { [key: number]: number } = {};
                photosWithOrder.forEach(p => {
                    initialVotes[p.id] = 0;
                });

                const newSessionData = {
                    config: configData,
                    photos: photosData,
                    groups: {},
                    votes: initialVotes,
                    userVotes: {}
                };
                
                await set(sessionRef, newSessionData);
            }

            alert(`Сессия "${generatedSessionId}" успешно сохранена с ${photos.length} фотографиями.`);
            window.location.href = `/editor.html?session=${generatedSessionId}`;

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
                    <button onClick={() => { setStatus(photos.length > 0 ? 'processed' : 'idle'); setError(''); }} className="mt-4 px-4 py-2 bg-indigo-600 rounded text-white">Попробовать снова</button>
                </div>
            );
        }

        if (status === 'processed' || status === 'processing') {
             return (
                <div className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300 mb-1">Название сессии</label>
                        <input type="text" value={sessionName} disabled className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-gray-400" />
                        <p className="text-xs text-gray-500 mt-1">Сгенерированный ID: <span className="font-mono">{generatedSessionId}</span></p>
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
                    <label htmlFor="session-name" className="block text-sm font-medium text-gray-300 mb-1">1. Название сессии</label>
                    <input type="text" id="session-name" value={sessionName} onChange={(e) => setSessionName(e.target.value)} className="w-full p-2 border border-gray-600 rounded-md bg-gray-700 text-white" placeholder="Например, Paris 2024" />
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

    return (
        <AuthGuard>
            <AdminLayout title="Подготовка сессии">{renderContent()}</AdminLayout>
        </AuthGuard>
    );
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><PrepareApp /></React.StrictMode>);