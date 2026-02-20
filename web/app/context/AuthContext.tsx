"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface User {
    id: number;
    username: string;
    language: string;
    score_threshold: number;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (username: string, password: string) => Promise<void>;
    signup: (username: string, password: string, language: string) => Promise<void>;
    logout: () => void;
    updateProfile: (data: Partial<User>) => Promise<void>;
    loading: boolean;
    /** Increment to force page.tsx to re-fetch the brief */
    refreshKey: number;
    triggerRefresh: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

const API = "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);

    const triggerRefresh = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    // Restore session from localStorage, then re-validate with server
    useEffect(() => {
        const savedToken = localStorage.getItem("mizan_token");
        const savedUser = localStorage.getItem("mizan_user");
        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            // Re-fetch profile from server to ensure data is fresh
            fetch(`${API}/api/me`, {
                headers: { Authorization: `Bearer ${savedToken}` },
            })
                .then((res) => {
                    if (!res.ok) {
                        // Token expired or invalid — force logout
                        localStorage.removeItem("mizan_token");
                        localStorage.removeItem("mizan_user");
                        setToken(null);
                        setUser(null);
                        return null;
                    }
                    return res.json();
                })
                .then((profile) => {
                    if (profile) {
                        setUser(profile);
                        localStorage.setItem("mizan_user", JSON.stringify(profile));
                    }
                })
                .catch(() => { })
                .finally(() => setLoading(false));
        } else {
            setLoading(false);
        }
    }, []);

    const login = async (username: string, password: string) => {
        const res = await fetch(`${API}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Erreur de connexion");
        }
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem("mizan_token", data.token);
        localStorage.setItem("mizan_user", JSON.stringify(data.user));
    };

    const signup = async (username: string, password: string, language: string) => {
        const res = await fetch(`${API}/api/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password, language }),
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Erreur de création");
        }
        const data = await res.json();
        setToken(data.token);
        setUser(data.user);
        localStorage.setItem("mizan_token", data.token);
        localStorage.setItem("mizan_user", JSON.stringify(data.user));
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("mizan_token");
        localStorage.removeItem("mizan_user");
    };

    const updateProfile = async (data: Partial<User>) => {
        if (!token) return;
        const res = await fetch(`${API}/api/me`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            const body = await res.json();
            // Use the server-returned user object for consistency
            if (body.user) {
                setUser(body.user);
                localStorage.setItem("mizan_user", JSON.stringify(body.user));
            } else if (user) {
                const updated = { ...user, ...data };
                setUser(updated);
                localStorage.setItem("mizan_user", JSON.stringify(updated));
            }
        }
    };

    return (
        <AuthContext.Provider
            value={{ user, token, login, signup, logout, updateProfile, loading, refreshKey, triggerRefresh }}
        >
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be inside AuthProvider");
    return ctx;
}

export { API };
