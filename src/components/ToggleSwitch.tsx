import React from 'react';

interface ToggleSwitchProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label?: string;
}

export const ToggleSwitch: React.FC<ToggleSwitchProps> = ({ id, checked, onChange, label }) => {
  return (
    <div className="flex items-center gap-3">
       {label && <label htmlFor={id} className="text-sm text-gray-300 cursor-pointer select-none" onClick={() => onChange(!checked)}>{label}</label>}
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`${
          checked ? 'bg-indigo-600' : 'bg-gray-600'
        } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-gray-900`}
      >
        <span
          aria-hidden="true"
          className={`${
            checked ? 'translate-x-5' : 'translate-x-0'
          } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
      </button>
    </div>
  );
};