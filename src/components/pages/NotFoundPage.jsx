import React from 'react';

export default function NotFoundPage({ onGoHome }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#e6ebf2] text-zinc-900 p-4">
      <div className="max-w-md w-full bg-[#e6ebf2] rounded-3xl p-8 text-center border border-white/80 shadow-[6px_6px_14px_#c2c9d4,-6px_-6px_14px_#ffffff]">
        <h1 className="text-xl font-extrabold text-zinc-900 mb-2">Page Not Found</h1>
        <p className="text-sm text-zinc-500 mb-6">Return to the clinical management console.</p>
        <button
          onClick={onGoHome || (() => { window.location.href = '/'; })}
          className="px-6 py-2.5 rounded-full text-xs font-bold text-white bg-emerald-700 shadow-md hover:bg-emerald-600 transition-colors"
        >
          Return to Console
        </button>
      </div>
    </div>
  );
}
