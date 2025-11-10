import React from 'react';
import { X, Star } from 'lucide-react';
import { useModalLifecycle } from '../hooks/useModalLifecycle';

interface RatingInfoModalProps {
  onClose: () => void;
}

export const RatingInfoModal: React.FC<RatingInfoModalProps> = ({ onClose }) => {
  useModalLifecycle(onClose);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[300] p-4 animate-fade-in" onClick={onClose}>
      <div className="relative max-w-md w-full bg-gray-900 rounded-lg shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
        <header className="flex justify-between items-center p-4 border-b border-gray-700/50">
          <h2 className="text-xl font-bold text-gray-200">Оценка недоступна</h2>
          <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Закрыть"><X className="w-6 h-6" /></button>
        </header>
        <div className="p-6 space-y-4">
            <p className="text-gray-300">Эта фотография еще не заслужила право на высшие оценки по результатам общих голосований.</p>
            <div>
                <p className="text-gray-400 mb-2">Мы предлагаем такую систему оценок:</p>
                <ul className="space-y-1 text-gray-300 list-none p-0">
                    <li className="flex items-start"><span className="flex items-center w-28 flex-shrink-0"><Star className="w-4 h-4 mr-1 text-yellow-400"/></span> — достойная фотография, выбираю;</li>
                    <li className="flex items-start"><span className="flex items-center w-28 flex-shrink-0"><Star className="w-4 h-4 mr-1 text-yellow-400"/><Star className="w-4 h-4 mr-1 text-yellow-400"/></span> — превосходная фотография;</li>
                    <li className="flex items-start"><span className="flex items-center w-28 flex-shrink-0"><Star className="w-4 h-4 mr-1 text-yellow-400"/><Star className="w-4 h-4 mr-1 text-yellow-400"/><Star className="w-4 h-4 mr-1 text-yellow-400"/></span> — потрясающее фото, из ряда вон!</li>
                </ul>
            </div>
        </div>
        <footer className="p-4 bg-gray-800/50 rounded-b-lg text-right">
             <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">Понятно</button>
        </footer>
      </div>
    </div>
  );
};