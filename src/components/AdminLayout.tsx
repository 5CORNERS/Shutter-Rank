import React from 'react';
import { Home } from 'lucide-react';

interface AdminLayoutProps {
  title: string;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({ title, children }) => {
  return (
    <div className="min-h-screen bg-gray-900 text-gray-100 font-sans">
      <main className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <div className="flex justify-center items-center gap-4">
             <a href="/admin.html" className="text-gray-400 hover:text-indigo-400 transition-colors" title="На главную админ-панели">
                <Home className="w-8 h-8" />
             </a>
            <h1 className="text-4xl font-bold tracking-tight text-indigo-400">{title}</h1>
          </div>
        </header>
        <div className="max-w-5xl mx-auto bg-gray-800/50 border border-gray-700/50 rounded-lg p-6">
          {children}
        </div>
      </main>
    </div>
  );
};
