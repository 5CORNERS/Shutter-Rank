import React, { useState } from 'react';
import ReactDOM from 'react-dom/client';
import { db } from './firebase';
import { ref, get, set } from 'firebase/database';
import { AdminLayout } from './components/AdminLayout';
import { Spinner } from './components/Spinner';
import { RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import './index.css';

const calculateNormalizedScore = (rating: number): number => {
    if (rating <= 0) return 0;
    // Formula: 1 + (Rating - 1) * 0.25
    // 1 star = 1 point
    // 2 stars = 1.25 points
    // ...
    // 5 stars = 2 points
    return 1 + (rating - 1) * 0.25;
};

const RecalculatorApp: React.FC = () => {
    const [sessionId, setSessionId] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
    const [logs, setLogs] = useState<string[]>([]);

    const addLog = (msg: string) => setLogs(prev => [...prev, msg]);

    const handleRecalculate = async () => {
        if (!sessionId.trim()) {
            alert('Введите ID сессии');
            return;
        }

        setStatus('loading');
        setLogs([]);
        addLog(`Начинаем пересчет для сессии: ${sessionId}...`);

        try {
            // 1. Fetch User Votes (Source of Truth)
            const userVotesRef = ref(db, `sessions/${sessionId}/userVotes`);
            const snapshot = await get(userVotesRef);

            if (!snapshot.exists()) {
                addLog('❌ Нет данных userVotes. Никто еще не голосовал или сессия неверна.');
                setStatus('error');
                return;
            }

            const userVotesData = snapshot.val();
            const userCount = Object.keys(userVotesData).length;
            addLog(`✅ Получены данные голосов от ${userCount} пользователей.`);

            // 2. Aggregate Data
            const aggregates: Record<string, { s: number, c: number, n: number }> = {};

            Object.entries(userVotesData).forEach(([userId, votes]) => {
                if (!votes || typeof votes !== 'object') return;

                Object.entries(votes as Record<string, number>).forEach(([photoIdStr, rating]) => {
                    const ratingNum = Number(rating);
                    if (ratingNum > 0) {
                        if (!aggregates[photoIdStr]) {
                            aggregates[photoIdStr] = { s: 0, c: 0, n: 0 };
                        }
                        
                        const norm = calculateNormalizedScore(ratingNum);

                        aggregates[photoIdStr].s += ratingNum;
                        aggregates[photoIdStr].c += 1;
                        aggregates[photoIdStr].n += norm;
                    }
                });
            });

            const photoCount = Object.keys(aggregates).length;
            addLog(`📊 Обработано фотографий: ${photoCount}`);

            // 3. Write back to 'votes' node (Replacing old aggregates completely to clean up stale data)
            addLog('💾 Сохранение новых агрегированных данных в Firebase (перезапись узла votes)...');
            
            const votesRef = ref(db, `sessions/${sessionId}/votes`);
            await set(votesRef, aggregates);

            addLog('✅ Успешно! Данные пересчитаны и сохранены.');
            setStatus('success');

        } catch (error: any) {
            console.error(error);
            addLog(`❌ Ошибка: ${error.message}`);
            setStatus('error');
        }
    };

    return (
        <AdminLayout title="Пересчет голосов">
            <div className="space-y-6">
                <div className="bg-blue-900/20 border border-blue-500/30 p-4 rounded-lg">
                    <div className="flex items-start gap-3">
                        <RefreshCw className="w-6 h-6 text-indigo-400 mt-1" />
                        <div>
                            <h3 className="font-bold text-indigo-400 mb-1">Инструмент восстановления целостности данных</h3>
                            <p className="text-gray-300 text-sm">
                                Этот инструмент пересчитывает глобальную статистику (узел <code>votes</code>) на основе индивидуальных голосов пользователей (<code>userVotes</code>).
                            </p>
                            <p className="text-gray-400 text-xs mt-2">
                                Используйте его, если заметили рассинхронизацию баллов или некорректные суммы (например, отрицательные значения или дублирование) из-за сетевых задержек.
                            </p>
                        </div>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-1">ID Сессии</label>
                    <input 
                        type="text" 
                        value={sessionId} 
                        onChange={(e) => setSessionId(e.target.value)} 
                        className="w-full p-2 border border-gray-600 rounded-md bg-gray-800 text-white"
                        placeholder="например, fontainebleau"
                    />
                </div>

                <button 
                    onClick={handleRecalculate} 
                    disabled={status === 'loading'}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {status === 'loading' ? <Spinner text="Считаем..." /> : (
                        <>
                            <RefreshCw className="w-5 h-5" /> Пересчитать результаты
                        </>
                    )}
                </button>

                <div className="bg-gray-950 rounded-lg p-4 font-mono text-sm h-64 overflow-y-auto border border-gray-800">
                    {logs.length === 0 && <span className="text-gray-600">Здесь появится лог операций...</span>}
                    {logs.map((log, i) => (
                        <div key={i} className="mb-1 border-b border-gray-800/50 pb-1 last:border-0">{log}</div>
                    ))}
                </div>
            </div>
        </AdminLayout>
    );
};

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Could not find root element");
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><RecalculatorApp /></React.StrictMode>);