import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';
import { useModalLifecycle } from '../hooks/useModalLifecycle';

interface CreditWarningModalProps {
  onClose: () => void;
  limitType: 'count' | 'stars';
}

export const CreditWarningModal: React.FC<CreditWarningModalProps> = ({ onClose, limitType }) => {
  useModalLifecycle(onClose);

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[300] p-4 animate-fade-in" onClick={onClose}>
      <div className="relative max-w-md w-full bg-gray-900 rounded-lg shadow-2xl flex flex-col border border-cyan-500/30" onClick={(e) => e.stopPropagation()}>
        <div className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-cyan-400 mb-2">
                <Info className="w-8 h-8" />
                <h2 className="text-xl font-bold text-white">Голосование в кредит</h2>
            </div>
            
            <p className="text-gray-300">
                {limitType === 'count' 
                    ? 'Вы достигли или превысили лимит по количеству фотографий.' 
                    : 'Вы достигли или превысили лимит звезд.'}
            </p>
            
            <p className="text-gray-300">
                Но вы можете продолжать! Ваши новые оценки будут сохранены <strong>«в кредит»</strong> (они будут подсвечены голубым).
            </p>

            <div className="bg-gray-800/50 p-3 rounded-lg border border-gray-700/50 text-sm text-gray-400">
                <p>
                    Как только вы снимете оценку с другой фотографии, ваши «кредитные» голоса автоматически станут официальными и будут учтены в общем рейтинге.
                </p>
            </div>
        </div>
        <footer className="p-4 bg-gray-800/50 rounded-b-lg text-right">
             <button onClick={onClose} className="px-4 py-2 text-sm font-semibold rounded-lg bg-cyan-600 hover:bg-cyan-700 text-white transition-colors">
                Понятно, продолжить
            </button>
        </footer>
      </div>
    </div>
  );
};