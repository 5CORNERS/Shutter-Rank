import React, { useEffect, useState } from 'react';
import { Info } from 'lucide-react';

interface ToastProps {
    message: string | null;
    onDismiss: () => void;
    duration?: number;
}

export const Toast: React.FC<ToastProps> = ({ message, onDismiss, duration = 3000 }) => {
    const [isVisible, setIsVisible] = useState(false);

    useEffect(() => {
        if (message) {
            setIsVisible(true);
            const timer = setTimeout(() => {
                setIsVisible(false);
                // Allow time for fade-out animation before clearing message
                setTimeout(onDismiss, 300);
            }, duration);
            return () => clearTimeout(timer);
        }
    }, [message, duration, onDismiss]);

    if (!message) {
        return null;
    }

    return (
        <div
            className={`fixed bottom-5 left-1/2 -translate-x-1/2 z-[400] px-4 py-3 rounded-lg shadow-lg bg-indigo-600 text-white flex items-center gap-3 transition-all duration-300 ease-in-out ${
                isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
        >
            <Info className="w-5 h-5" />
            <span className="font-semibold text-sm">{message}</span>
        </div>
    );
};
