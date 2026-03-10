import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
    id: number;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    addToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = (): ToastContextValue => {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within ToastProvider');
    return ctx;
};

const TOAST_ICONS: Record<ToastType, JSX.Element> = {
    success: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 6L9 17l-5-5"/></svg>,
    error: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M15 9l-6 6M9 9l6 6"/></svg>,
    warning: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
    info: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>,
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [toasts, setToasts] = useState<Toast[]>([]);
    const nextId = useRef(0);

    const addToast = useCallback((message: string, type: ToastType = 'info') => {
        const id = nextId.current++;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts(prev => prev.filter(t => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = useCallback((id: number) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    }, []);

    return (
        <ToastContext.Provider value={{ addToast }}>
            {children}
            <div className="toast-container">
                {toasts.map(toast => (
                    <div key={toast.id} className={`toast toast-${toast.type}`}>
                        <span className="toast-icon">{TOAST_ICONS[toast.type]}</span>
                        <span className="toast-message">{toast.message}</span>
                        <button className="toast-close" onClick={() => removeToast(toast.id)}>×</button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
};
