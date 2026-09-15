import React, { createContext, useContext, useState, useCallback } from 'react';

const ToastContext = createContext();

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, options = {}) => {
    const id = Date.now();
    const toast = { id, message, ...options };
    setToasts(prev => [...prev, toast]);
    const timeout = options.timeout ?? 5000;
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, timeout);
  }, []);

  const value = { addToast };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-container fixed top-4 right-4 z-50 space-y-2">
        {toasts.map(t => (
          <div key={t.id} className="toast bg-gray-800 text-white px-4 py-2 rounded shadow-lg animate-fade-in">
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
