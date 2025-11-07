import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { LayoutMode, GridAspectRatio, Settings } from '../types';

interface SettingsModalProps {
  currentSettings: Settings;
  onSave: (settings: Settings) => void;
  onClose: () => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ currentSettings, onSave, onClose }) => {
  const [layout, setLayout] = useState<LayoutMode>(currentSettings.layout);
  const [ratio, setRatio] = useState<GridAspectRatio>(currentSettings.gridAspectRatio);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = 'auto';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  const handleSave = () => {
    onSave({ layout, gridAspectRatio: ratio });
  };

  const aspectRatios: { value: GridAspectRatio; label: string }[] = [
    { value: '4/3', label: '4:3' },
    { value: '3/2', label: '3:2' },
    { value: '1/1', label: 'Квадрат' },
  ];

  return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[300] p-4 animate-fade-in" onClick={onClose}>
        <div className="relative max-w-md w-full bg-gray-900 rounded-lg shadow-2xl flex flex-col" onClick={(e) => e.stopPropagation()}>
          <header className="flex justify-between items-center p-4 border-b border-gray-700/50">
            <h2 className="text-xl font-bold text-gray-200">Настройки вида</h2>
            <button onClick={onClose} className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20" aria-label="Закрыть"><X className="w-6 h-6" /></button>
          </header>
          <div className="p-6 space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">Режим отображения</label>
              <div className="flex space-x-2">
                <button onClick={() => setLayout('grid')} className={`flex-1 py-2 text-sm rounded-md transition-colors ${layout === 'grid' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>Сетка</button>
                <button onClick={() => setLayout('original')} className={`flex-1 py-2 text-sm rounded-md transition-colors ${layout === 'original' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>Оригинальные пропорции</button>
              </div>
            </div>
            <div className={layout === 'grid' ? 'opacity-100' : 'opacity-40'}>
              <label className="block text-sm font-medium text-gray-300 mb-2">Пропорции сетки</label>
              <div className="flex space-x-2">
                {aspectRatios.map(r => (
                    <button key={r.value} onClick={() => setRatio(r.value)} disabled={layout !== 'grid'} className={`flex-1 py-2 text-sm rounded-md transition-colors disabled:cursor-not-allowed ${ratio === r.value && layout === 'grid' ? 'bg-indigo-600 text-white' : 'bg-gray-700 hover:bg-gray-600'}`}>{r.label}</button>
                ))}
              </div>
            </div>
          </div>
          <footer className="p-4 bg-gray-800/50 rounded-b-lg text-right">
            <button onClick={handleSave} className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors">Сохранить</button>
          </footer>
        </div>
      </div>
  );
};