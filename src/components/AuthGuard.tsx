import React, { useEffect, useState } from 'react';
import { auth, signInWithGoogle, logOut } from '../firebase';
// @ts-ignore
import { onAuthStateChanged, User } from 'firebase/auth';
import { Loader, LogIn, ShieldAlert, LogOut, User as UserIcon } from 'lucide-react';

// --- КОНФИГУРАЦИЯ ДОСТУПА ---
// Добавьте сюда email-адреса, которым разрешен доступ к админке
const ALLOWED_EMAILS = [
    'ilia.dumov@gmail.com', // Замените или добавьте свой email
    'antondumov@gmail.com'
];

interface AuthGuardProps {
    children: React.ReactNode;
}

export const AuthGuard: React.FC<AuthGuardProps> = ({ children }) => {
    const [user, setUser] = useState<User | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser: any) => {
            setUser(currentUser);
            setLoading(false);
        });
        return () => unsubscribe();
    }, []);

    const handleLogin = async () => {
        try {
            await signInWithGoogle();
        } catch (error) {
            console.error("Login failed", error);
            alert("Ошибка входа через Google");
        }
    };

    const handleLogout = async () => {
        await logOut();
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center text-white">
                <Loader className="w-12 h-12 animate-spin text-indigo-400" />
                <p className="mt-4 text-gray-400">Проверка доступа...</p>
            </div>
        );
    }

    // ИСПРАВЛЕНИЕ: Если пользователя нет ИЛИ у пользователя нет email (анонимный вход),
    // показываем экран входа. Анонимам вход запрещен.
    if (!user || !user.email) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center text-white p-4">
                <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-8 shadow-2xl text-center">
                    <div className="bg-indigo-900/30 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="w-10 h-10 text-indigo-400" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2">Административный доступ</h1>
                    <p className="text-gray-400 mb-8">
                        {user
                            ? "Вы вошли как анонимный участник голосования. Для доступа к админке войдите через Google."
                            : "Эта страница защищена. Пожалуйста, войдите через Google-аккаунт, имеющий права администратора."}
                    </p>

                    <button
                        onClick={handleLogin}
                        className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg transition-all transform hover:scale-105 shadow-lg"
                    >
                        <LogIn className="w-5 h-5" />
                        Войти через Google
                    </button>
                </div>
            </div>
        );
    }

    // Если Email есть, но его нет в белом списке — Доступ запрещен
    if (!ALLOWED_EMAILS.includes(user.email)) {
        return (
            <div className="min-h-screen bg-gray-900 flex flex-col justify-center items-center text-white p-4">
                <div className="max-w-md w-full bg-gray-800 border border-red-900/50 rounded-xl p-8 shadow-2xl text-center">
                    <div className="bg-red-900/20 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-6">
                        <ShieldAlert className="w-10 h-10 text-red-500" />
                    </div>
                    <h1 className="text-2xl font-bold mb-2 text-red-400">Доступ запрещен</h1>
                    <p className="text-gray-300 mb-2">Пользователь <strong>{user.email}</strong> не имеет прав доступа к этому разделу.</p>
                    <p className="text-gray-500 text-sm mb-8">Обратитесь к владельцу ресурса, чтобы добавить ваш email в список разрешенных.</p>

                    <button
                        onClick={handleLogout}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-colors"
                    >
                        <LogOut className="w-4 h-4" />
                        Выйти и сменить аккаунт
                    </button>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="fixed top-4 right-4 z-[1000]">
                <div className="flex items-center gap-3 bg-gray-800/80 backdrop-blur-sm border border-gray-700 px-4 py-2 rounded-full shadow-lg">
                    <div className="flex items-center gap-2">
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" />
                        ) : (
                            <UserIcon className="w-5 h-5 text-gray-400" />
                        )}
                        <span className="text-xs font-medium text-gray-300 hidden sm:inline">{user.email}</span>
                    </div>
                    <div className="w-px h-4 bg-gray-600"></div>
                    <button
                        onClick={handleLogout}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Выйти"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                </div>
            </div>
            {children}
        </>
    );
};
