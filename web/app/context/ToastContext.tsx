"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle, AlertCircle, Info } from "lucide-react";

type ToastType = "success" | "error" | "info" | "premium";

interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextType {
    showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType = "info") => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 5000);
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
                <AnimatePresence>
                    {toasts.map((toast) => (
                        <motion.div
                            key={toast.id}
                            initial={{ opacity: 0, x: 20, scale: 0.9 }}
                            animate={{ opacity: 1, x: 0, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
                            className={`
                                pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-[20px] shadow-2xl border min-w-[300px] max-w-md
                                ${toast.type === "success" ? "bg-white border-emerald-100 text-emerald-900" :
                                    toast.type === "error" ? "bg-white border-red-100 text-red-900" :
                                        toast.type === "premium" ? "bg-indigo-600 border-indigo-500 text-white" :
                                            "bg-white border-gray-100 text-gray-900"}
                            `}
                        >
                            <div className="shrink-0">
                                {toast.type === "success" && <CheckCircle size={20} className="text-emerald-500" aria-hidden="true" />}
                                {toast.type === "error" && <AlertCircle size={20} className="text-red-500" aria-hidden="true" />}
                                {toast.type === "premium" && <div className="text-xl">⭐</div>}
                                {toast.type === "info" && <Info size={20} className="text-indigo-500" aria-hidden="true" />}
                            </div>
                            <p className="flex-1 text-[14px] font-bold leading-tight">{toast.message}</p>
                            <button
                                onClick={() => removeToast(toast.id)}
                                className={`shrink-0 opacity-40 hover:opacity-100 transition-opacity ${toast.type === "premium" ? "text-white" : "text-gray-400"}`}
                            >
                                <X size={16} aria-hidden="true" />
                            </button>
                        </motion.div>
                    ))}
                </AnimatePresence>
            </div>
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}
