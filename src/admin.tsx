import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom/client';
import { db } from './firebase';
import { ref, get, set, remove, update } from 'firebase/database';
import { AdminLayout } from './components/AdminLayout';
import { AuthGuard } from './components/AuthGuard';
import { Spinner } from './components/Spinner';
import { Eye, Edit, Trash2, PlusCircle, AlertTriangle, Save, X, Lock, Unlock } from 'lucide-react';
import './index.css';
import { Config, FirebasePhotoData } from './types';

type Status = 'loading' | 'success' | 'error';
type SessionInfo = { id: string; name: string; isVotingClosed?: boolean };
type EditingState = { originalId: string; id: string; name: string };

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

const AdminApp: React.FC = () => {
    const [sessions, setSessions] = useState<SessionInfo[]>([]);
    const [newSessionName, setNewSessionName] = useState('');
    const [status, setStatus] = useState<Status>('loading');
    const [editingState, setEditingState] = useState<EditingState | null>(null);

    const fetchSessions = useCallback(async () => {
        setStatus('loading');
        try {
            const sessionsRef = ref(db, 'sessions');
            const snapshot = await get(sessionsRef);
            if (snapshot.exists()) {
                const data = snapshot.val();
                if (typeof data === 'object' && data !== null) {
                    const sessionList: SessionInfo[] = Object.keys(data).map(id => ({
                        id: id,
                        name: data[id]?.config?.name || id,
                        isVotingClosed: data[id]?.config?.isVotingClosed || false
                    }));
                    setSessions(sessionList);
                } else {
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
        const trimmedName = newSessionName.trim();
        if (!trimmedName) {
            alert('Пожалуйста, введите название сессии.');
            return;
        }
        const newSessionId = slugify(trimmedName);
        if (sessions.some(s => s.id === newSessionId)) {
            alert(`Сессия с ID "${newSessionId}" уже существует. Пожалуйста, выберите другое название.`);
            return;
        }

        const defaultConfig: Config = {
            name: trimmedName,
            ratedPhotoLimit: 15,
            totalStarsLimit: 25,
            defaultLayoutDesktop: 'grid',
            defaultLayoutMobile: 'original',
            defaultGridAspectRatio: '4/3',
            unlockFourStarsThresholdPercent: 20,
            unlockFiveStarsThresholdPercent: 50,
            isVotingClosed: false
        };
        const defaultPhotos: FirebasePhotoData = {
            introArticleMarkdown: `# Новая сессия: ${trimmedName}\n\nДобро пожаловать!`,
            photos: [],
        };

        try {
            await set(ref(db, `sessions/${newSessionId}`), {
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
        const session = sessions.find(s => s.id === sessionId);
        if (window.confirm(`Вы уверены, что хотите безвозвратно удалить сессию "${session?.name || sessionId}"?`)) {
            try {
                await remove(ref(db, `sessions/${sessionId}`));
                await fetchSessions();
            } catch (error) {
                console.error(`Ошибка удаления сессии ${sessionId}:`, error);
                alert('Не удалось удалить сессию. Подробности в консоли.');
            }
        }
    };
    
    const handleUpdateSession = async (originalId: string, updatedSession: SessionInfo) => {
        if (!updatedSession.id || !updatedSession.name) {
            alert("Имя и ID сессии не могут быть пустыми.");
            return;
        }

        try {
            const originalSessionRef = ref(db, `sessions/${originalId}`);
            const sessionSnapshot = await get(originalSessionRef);
            if (!sessionSnapshot.exists()) throw new Error("Original session not found");
            const sessionData = sessionSnapshot.val();

            // Update the name inside config
            sessionData.config.name = updatedSession.name;

            // If ID has changed, we need to move the data
            if (originalId !== updatedSession.id) {
                 if (sessions.some(s => s.id === updatedSession.id)) {
                    alert(`Сессия с ID "${updatedSession.id}" уже существует.`);
                    return;
                }
                const newSessionRef = ref(db, `sessions/${updatedSession.id}`);
                await set(newSessionRef, sessionData);
                await remove(originalSessionRef);
            } else {
                // If ID is the same, just update the data
                await set(originalSessionRef, sessionData);
            }
            
            setEditingState(null);
            await fetchSessions();
        } catch (error) {
             console.error(`Ошибка обновления сессии ${originalId}:`, error);
            alert('Не удалось обновить сессию. Подробности в консоли.');
        }
    };

    const handleToggleVotingClosed = async (sessionId: string, currentStatus: boolean) => {
        try {
            const updates: any = {};
            updates[`sessions/${sessionId}/config/isVotingClosed`] = !currentStatus;
            await update(ref(db), updates);
            // Optimistic update
            setSessions(prev => prev.map(s => s.id === sessionId ? { ...s, isVotingClosed: !currentStatus } : s));
        } catch (error) {
            console.error("Error toggling status:", error);
            alert("Не удалось изменить статус сессии.");
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
                            {sessions.map(session => (
                                <li key={session.id} className={`p-3 rounded-lg border transition-colors ${session.isVotingClosed ? 'bg-gray-800 border-red-900/50' : 'bg-gray-700/50 border-transparent'}`}>
                                    {editingState?.originalId === session.id ? (
                                        <div className="flex flex-col gap-2">
                                            <input type="text" value={editingState.name} onChange={e => setEditingState(s => s ? { ...s, name: e.target.value } : null)} className="p-2 border border-gray-600 rounded-md bg-gray-800 text-white" placeholder="Название"/>
                                            <input type="text" value={editingState.id} onChange={e => setEditingState(s => s ? { ...s, id: slugify(e.target.value) } : null)} className="p-2 border border-gray-600 rounded-md bg-gray-800 text-white font-mono" placeholder="ID"/>
                                            <div className="flex items-center gap-2">
                                                <button onClick={() => handleUpdateSession(editingState.originalId, { name: editingState.name, id: editingState.id })} className="flex items-center gap-1 text-sm text-green-400 hover:text-green-300"><Save className="w-4 h-4"/>Сохранить</button>
                                                <button onClick={() => setEditingState(null)} className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-300"><X className="w-4 h-4"/>Отмена</button>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                            <div className="flex items-center gap-3">
                                                <button 
                                                    onClick={() => handleToggleVotingClosed(session.id, !!session.isVotingClosed)}
                                                    className={`p-2 rounded-full transition-colors ${session.isVotingClosed ? 'bg-red-900/30 text-red-400 hover:bg-red-900/50' : 'bg-green-900/30 text-green-400 hover:bg-green-900/50'}`}
                                                    title={session.isVotingClosed ? "Голосование закрыто (Нажмите, чтобы открыть)" : "Голосование активно (Нажмите, чтобы закрыть)"}
                                                >
                                                    {session.isVotingClosed ? <Lock className="w-5 h-5" /> : <Unlock className="w-5 h-5" />}
                                                </button>
                                                <div>
                                                    <div className={`font-bold text-lg ${session.isVotingClosed ? 'text-gray-400' : 'text-white'}`}>
                                                        {session.name}
                                                        {session.isVotingClosed && <span className="ml-2 text-xs font-normal text-red-400 border border-red-800 px-2 py-0.5 rounded bg-red-900/20">Завершено</span>}
                                                    </div>
                                                    <div className="font-mono text-xs text-gray-500">{session.id}</div>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <a href={`/#${session.id}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm text-cyan-400 hover:text-cyan-300" title="Открыть"><Eye className="w-4 h-4"/><span>Смотреть</span></a>
                                                <a href={`/editor.html?session=${session.id}`} className="flex items-center gap-1 text-sm text-yellow-400 hover:text-yellow-300" title="Редактировать"><Edit className="w-4 h-4"/><span>Править</span></a>
                                                <button onClick={() => setEditingState({ originalId: session.id, name: session.name, id: session.id })} className="flex items-center gap-1 text-sm text-purple-400 hover:text-purple-300" title="Переименовать"><Edit className="w-4 h-4"/><span>Имя/ID</span></button>
                                                <button onClick={() => handleDeleteSession(session.id)} className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300" title="Удалить"><Trash2 className="w-4 h-4"/><span>Удалить</span></button>
                                            </div>
                                        </div>
                                    )}
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
                            placeholder="Название сессии (например, Paris 2024)"
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

    return (
        <AuthGuard>
            <AdminLayout title="Панель администратора">{renderContent()}</AdminLayout>
        </AuthGuard>
    );
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><AdminApp /></React.StrictMode>);