"use client";

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";

interface User {
    id: string;
    username: string;
    email: string;
    language: string;
    score_threshold: number;
}

interface AuthContextType {
    user: User | null;
    token: string | null;
    login: (email: string, password: string) => Promise<void>;
    signup: (email: string, password: string, username: string, language?: string) => Promise<void>;
    logout: () => void;
    updateProfile: (data: Partial<User>) => Promise<void>;
    refreshProfile: () => Promise<void>;
    loading: boolean;
    refreshKey: number;
    triggerRefresh: () => void;
    genStatus: { active: boolean; step: string; percent: number; isDone: boolean };
    setGenStatus: (status: { active: boolean; step: string; percent: number; isDone: boolean }) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Use environment variable for API URL, allow empty string for relative paths
const API = process.env.NEXT_PUBLIC_API_URL ?? "";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [genStatus, setGenStatus] = useState({ active: false, step: "", percent: 0, isDone: false });

    // Initialize from localStorage
    useEffect(() => {
        const savedToken = localStorage.getItem("newsai_token");
        const savedUserJSON = localStorage.getItem("newsai_user");
        
        if (savedToken && savedUserJSON) {
            try {
                const parsed = JSON.parse(savedUserJSON);
                setToken(savedToken);
                setUser(parsed);
            } catch (e) {
                console.error("Failed to parse saved user", e);
                localStorage.removeItem("newsai_token");
                localStorage.removeItem("newsai_user");
            }
        }
        setLoading(false);
    }, []);

    const triggerRefresh = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    const login = async (email: string, password: string) => {
        const res = await fetch(`${API}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Erreur réseau" }));
            throw new Error(err.detail || "Erreur de connexion");
        }

        const data = await res.json();
        setToken(data.access_token);
        setUser(data.user);
        localStorage.setItem("newsai_token", data.access_token);
        localStorage.setItem("newsai_user", JSON.stringify(data.user));
    };

    const signup = async (email: string, password: string, username: string, language: string = "fr") => {
        const res = await fetch(`${API}/api/auth/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, username }),
        });

        if (!res.ok) {
            const err = await res.json().catch(() => ({ detail: "Erreur réseau" }));
            throw new Error(err.detail || "Erreur de création");
        }

        const data = await res.json();
        if (data.access_token) {
            setToken(data.access_token);
            setUser(data.user);
            localStorage.setItem("newsai_token", data.access_token);
            localStorage.setItem("newsai_user", JSON.stringify(data.user));
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("newsai_token");
        localStorage.removeItem("newsai_user");
    };

    const refreshProfile = useCallback(async () => {
        if (!token) return;
        const res = await fetch(`${API}/api/me`, {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (res.ok) {
            const profile = await res.json();
            setUser(profile);
            localStorage.setItem("newsai_user", JSON.stringify(profile));
        }
    }, [token]);

    const updateProfile = async (data: Partial<User>) => {
        if (!token) return;
        const res = await fetch(`${API}/api/me/profile`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify(data),
        });
        if (res.ok) {
            await refreshProfile();
        }
    };

    const value = React.useMemo(() => ({
        user, token, login, signup, logout, updateProfile, refreshProfile,
        loading, refreshKey, triggerRefresh,
        genStatus, setGenStatus
    }), [user, token, loading, refreshKey, triggerRefresh, genStatus, refreshProfile]);

    return (
        <AuthContext.Provider value={value}>
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
