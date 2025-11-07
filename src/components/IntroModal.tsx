import React, { useEffect, useMemo } from 'react';
import { X } from 'lucide-react';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

interface ArticleModalProps {
  content: string;
  onClose: () => void;
}

export const ArticleModal: React.FC<ArticleModalProps> = ({ content, onClose }) => {
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

  const sanitizedHtml = useMemo(() => {
    const rawHtml = marked.parse(content, { async: false }) as string;
    return DOMPurify.sanitize(rawHtml, { USE_PROFILES: { html: true } });
  }, [content]);

  return (
      <div
          className="fixed inset-0 bg-black/80 backdrop-blur-sm flex justify-center items-center z-[300] p-4 animate-fade-in"
          onClick={onClose}
      >
        <div
            className="relative max-w-4xl w-full max-h-[90vh] bg-gray-900 rounded-lg shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
        >
          <header className="flex justify-between items-center p-4 border-b border-gray-700/50">
            <h2 className="text-xl font-bold text-gray-200">Информация</h2>
            <button
                onClick={onClose}
                className="p-2 rounded-full bg-white/10 text-white hover:bg-white/20"
                aria-label="Закрыть"
            >
              <X className="w-6 h-6" />
            </button>
          </header>
          <div className="flex-grow p-6 overflow-y-auto">
            <article
                className="prose prose-invert max-w-none prose-img:rounded-lg prose-img:mx-auto prose-a:text-indigo-400 hover:prose-a:text-indigo-300"
                dangerouslySetInnerHTML={{ __html: sanitizedHtml }}
            />
          </div>
          <footer className="p-4 bg-gray-800/50 rounded-b-lg text-right">
            <button
                onClick={onClose}
                className="px-4 py-2 text-sm font-semibold rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white transition-colors"
            >
              Продолжить
            </button>
          </footer>
        </div>
      </div>
  );
};