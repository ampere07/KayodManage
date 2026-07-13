import React from 'react';
import { Shield } from 'lucide-react';

interface LoadingSpinnerProps {
  message?: string;
}

const LoadingSpinner: React.FC<LoadingSpinnerProps> = ({ message = 'Loading Admin Panel...' }) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50/40 flex items-center justify-center">
      <div className="flex flex-col items-center gap-7">

        {/* Brand */}
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center shadow-xl shadow-blue-600/20">
            <Shield className="h-8 w-8 text-white" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-black text-gray-900 tracking-tight">Kayod</h1>
            <p className="text-[13px] text-gray-400 font-semibold tracking-wide mt-0.5">Admin Panel</p>
          </div>
        </div>

        {/* Animated dots */}
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full bg-blue-600 animate-bounce"
            style={{ animationDelay: '0ms', animationDuration: '800ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-blue-400 animate-bounce"
            style={{ animationDelay: '150ms', animationDuration: '800ms' }}
          />
          <span
            className="w-2 h-2 rounded-full bg-blue-200 animate-bounce"
            style={{ animationDelay: '300ms', animationDuration: '800ms' }}
          />
        </div>

        {/* Status */}
        <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-widest">{message}</p>
      </div>
    </div>
  );
};

export default LoadingSpinner;
