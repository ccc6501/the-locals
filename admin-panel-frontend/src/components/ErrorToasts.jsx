import React, { useEffect } from 'react';

export const ErrorToasts = ({ errors, dismiss }) => {
    // Auto-dismiss newest error after 6s
    useEffect(() => {
        if (!errors.length) return;
        const timer = setTimeout(() => dismiss(errors[0].id), 6000);
        return () => clearTimeout(timer);
    }, [errors, dismiss]);

    return (
        <div className="fixed bottom-4 left-4 z-50 flex flex-col gap-2 max-w-xs">
            {errors.slice(0, 3).map(err => (
                <div key={err.id} className="px-3 py-2 rounded-lg bg-red-600/20 border border-red-500/40 backdrop-blur-md text-[11px] text-red-200 shadow-lg flex items-start gap-2">
                    <span className="font-bold">⚠️</span>
                    <div className="flex-1 whitespace-pre-wrap">{err.message}</div>
                    <button
                        onClick={() => dismiss(err.id)}
                        className="ml-1 text-red-300/70 hover:text-red-100 transition-colors text-xs font-semibold"
                        aria-label="Dismiss error"
                    >×</button>
                </div>
            ))}
        </div>
    );
};
