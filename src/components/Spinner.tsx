import React from 'react';
import { Loader } from 'lucide-react';

interface SpinnerProps {
    text: string;
}

export const Spinner: React.FC<SpinnerProps> = ({ text }) => {
    return (
        <div className="flex flex-col justify-center items-center text-white p-8">
            <Loader className="w-12 h-12 animate-spin text-indigo-400" />
            <p className="mt-4 text-lg">{text}</p>
        </div>
    );
};
