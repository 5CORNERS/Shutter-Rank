import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { db } from './firebase';
import { ref, get, set, remove } from 'firebase/database';
import { AdminLayout } from './components/AdminLayout';
import { Spinner } from './components/Spinner';
import { Eye, Edit, Trash2, PlusCircle, AlertTriangle } from 'lucide-react';
import './index.css';
import { Config, FirebasePhotoData } from './types';

type Status = 'loading' | 'success' | 'error';

const AdminApp: React.FC = () => {
    const [sessions, setSessions] = useState<string[]>([]);
    const [newSessionName, setNewSessionName] = useState('');
    const [status, setStatus] = useState<Status>('loading');

    const fetchSessions = useCallback(async () => {
        setStatus('loading');
        try {
            const sessionsRef = ref(db, 'sessions');
            const snapshot = await get(sessionsRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (typeof data === 'object' && data !== null) {
                    setSessions(Object.keys(data));
                } else {
                    console.warn("Firebase 'sessions' node exists but is not an object:", data);
                    setSessions([]);
                }
            } else {
                setSessions([]);
            }
            setStatus('success');
        } catch (error) {
            console.error("Ошибка загрузки списка сессий:", error);
            setStatus('error');
        }
    }, []);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const handleCreateSession = async () => {
        const trimmedName = newSessionName.trim().replace(/[^a-zA-Z0-9-_]/g, '');
        if (!trimmedName) {
            alert('Пожалуйста, введите корректное имя сессии (только латинские буквы, цифры, дефис и подчеркивание).');
            return;
        }
        if (sessions.includes(trimmedName)) {
            alert('Сессия с таким именем уже существует.');
            return;
        }

        const defaultConfig: Config = {
            ratedPhotoLimit: 15,
            totalStarsLimit: 25,
            defaultLayoutDesktop: 'grid',
            defaultLayoutMobile: 'original',
            defaultGridAspectRatio: '4/3',
            unlockFourStarsThresholdPercent: 20,
            unlockFiveStarsThresholdPercent: 50,
        };
        const defaultPhotos: FirebasePhotoData = {
            introArticleMarkdown: `# Новая сессия: ${trimmedName}\n\nДобро пожаловать!`,
            photos: [],
        };

        const sessionRef = ref(db, `sessions/${trimmedName}`);
        try {
            await set(sessionRef, {
                config: defaultConfig,
                photos: defaultPhotos,
                votes: {},
                userVotes: {},
                groups: {}
            });
            setNewSessionName('');
            await fetchSessions();
        } catch (error) {
            console.error("Ошибка создания сессии:", error);
            alert('Не удалось создать сессию. Подробности в консоли.');
        }
    };

    const handleDeleteSession = async (sessionId: string) => {
        if (window.confirm(`Вы уверены, что хотите безвозвратно удалить сессию "${sessionId}"?`)) {
            const sessionRef = ref(db, `sessions/${sessionId}`);
            try {
                await remove(sessionRef);
                await fetchSessions();
            } catch (error) {
                console.error(`Ошибка удаления сессии ${sessionId}:`, error);
                alert('Не удалось удалить сессию. Подробности в консоли.');
            }
        }
    };

    const renderContent = () => {
        if (status === 'loading') {
            return <Spinner text="Загрузка сессий..." />;
        }
        if (status === 'error') {
            return (
                <div className="text-center text-red-400">
                    <AlertTriangle className="w-12 h-12 mx-auto mb-2" />
                    <p>Ошибка загрузки данных. Проверьте правила безопасности Firebase и соединение с интернетом.</p>
                </div>
            );
        }
        return (
            <div className="space-y-6">
                <div>
                    <h2 className="text-xl font-semibold mb-3 text-gray-300">Существующие сессии</h2>
                    {sessions.length > 0 ? (
                        <ul className="space-y-2">
                            {sessions.map(id => (
                                <li key={id} className="flex flex-wrap items-center justify-between p-3 bg-gray-700/50 rounded-lg">
                                    <span className="font-mono text-lg text-white">{id}</span>
                                    <div className="flex items-center gap-3">
                                        <a href={`/#${id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300" title="Открыть"><Eye className="w-4 h-4"/><span>Смотреть</span></a>
                                        <a href={`/editor.html?session=${id}`} className="flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300" title="Редактировать"><Edit className="w-4 h-4"/><span>Править</span></a>
                                        <button onClick={() => handleDeleteSession(id)} className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300" title="Удалить"><Trash2 className="w-4 h-4"/><span>Удалить</span></button>
                                    </div>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="text-gray-400">Сессий не найдено.</p>
                    )}
                </div>
                <div>
                    <h2 className="text-xl font-semibold mb-3 text-gray-300">Создать новую сессию</h2>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newSessionName}
                            onChange={(e) => setNewSessionName(e.target.value)}
                            className="flex-grow p-2 border border-gray-600 rounded-md bg-gray-700 text-white focus:ring-indigo-500 focus:border-indigo-500"
                            placeholder="Название сессии (например, paris-2024)"
                        />
                        <button onClick={handleCreateSession} className="inline-flex items-center gap-x-2 px-4 py-2 font-semibold rounded-lg bg-green-600 hover:bg-green-700 text-white transition-colors">
                            <PlusCircle className="w-5 h-5"/> Создать
                        </button>
                    </div>
                </div>
                <div>
                    <h2 className="text-xl font-semibold mb-3 text-gray-300">Инструменты</h2>
                    <a href="/prepare.html" className="inline-block px-4 py-2 font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">
                        Перейти к подготовке сессии из URL
                    </a>
                </div>
            </div>
        );
    };

    return <AdminLayout title="Панель администратора">{renderContent()}</AdminLayout>;
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><AdminApp /></React.StrictMode>);