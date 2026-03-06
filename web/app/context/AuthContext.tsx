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
    loading: boolean;
    refreshKey: number;
    triggerRefresh: () => void;
    genStatus: { active: boolean; step: string; percent: number; isDone: boolean };
    setGenStatus: (status: { active: boolean; step: string; percent: number; isDone: boolean }) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Use environment variable for API URL, fallback to localhost in dev
const API = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [refreshKey, setRefreshKey] = useState(0);
    const [genStatus, setGenStatus] = useState({ active: false, step: "", percent: 0, isDone: false });

    const triggerRefresh = useCallback(() => {
        setRefreshKey((k) => k + 1);
    }, []);

    // Restore session from localStorage, then re-validate with server
    useEffect(() => {
        const savedToken = localStorage.getItem("mizan_token");
        const savedUser = localStorage.getItem("mizan_user");

        // DX Mode Bypass
        if (!savedToken && process.env.NEXT_PUBLIC_APP_STAGE === "development") {
            console.log("🛠️ DX Mode: Auto-login enabled via NEXT_PUBLIC_APP_STAGE");
            const mockUser = {
                id: "00000000-0000-0000-0000-000000000000",
                username: "DevUser",
                email: "dev@mizan.ai",
                language: "fr",
                score_threshold: 70
            };
            setUser(mockUser);
            setToken("dev_token_bypass");
            setLoading(false);
            return;
        }

        if (savedToken && savedUser) {
            setToken(savedToken);
            setUser(JSON.parse(savedUser));
            fetch(`${API}/api/me`, {
                headers: { Authorization: `Bearer ${savedToken}` },
            })
                .then((res) => {
                    if (!res.ok) {
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
        localStorage.setItem("mizan_token", data.access_token);
        localStorage.setItem("mizan_user", JSON.stringify(data.user));
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
            localStorage.setItem("mizan_token", data.access_token);
        }
        // Fetch full profile after signup
        if (data.access_token) {
            const profileRes = await fetch(`${API}/api/me`, {
                headers: { Authorization: `Bearer ${data.access_token}` },
            });
            if (profileRes.ok) {
                const profile = await profileRes.json();
                setUser(profile);
                localStorage.setItem("mizan_user", JSON.stringify(profile));
            }
        }
    };

    const logout = () => {
        setToken(null);
        setUser(null);
        localStorage.removeItem("mizan_token");
        localStorage.removeItem("mizan_user");
    };

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
            // Re-fetch profile to get accurate state
            const profileRes = await fetch(`${API}/api/me`, {
                headers: { Authorization: `Bearer ${token}` },
            });
            if (profileRes.ok) {
                const profile = await profileRes.json();
                setUser(profile);
                localStorage.setItem("mizan_user", JSON.stringify(profile));
            }
        }
    };

    return (
        <AuthContext.Provider
            value={{
                user, token, login, signup, logout, updateProfile,
                loading, refreshKey, triggerRefresh,
                genStatus, setGenStatus
            }}
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
