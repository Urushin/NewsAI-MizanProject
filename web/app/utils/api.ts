"use client";

import { useAuth, API } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

export function useApi() {
    const { token, logout } = useAuth();
    const router = useRouter();

    const request = useCallback(async (path: string, options: RequestInit = {}): Promise<any> => {
        const url = path.startsWith('http') ? path : `${API}${path}`;

        const headers = new Headers(options.headers || {});
        if (token) {
            headers.set('Authorization', `Bearer ${token}`);
        }
        if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
            headers.set('Content-Type', 'application/json');
        }

        const res = await fetch(url, { ...options, headers });

        if (res.status === 401 || res.status === 403) {
            logout();
            router.push("/login");
            throw new Error(`Session expirée (${res.status})`);
        }

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            const message = errorData.detail || errorData.message || errorData.error || `Erreur ${res.status}`;
            throw new Error(message);
        }

        return res.json();
    }, [token, logout, router]);

    return useMemo(() => ({
        get: (path: string, options?: RequestInit) => request(path, { ...options, method: 'GET' }),
        post: (path: string, body?: any, options?: RequestInit) =>
            request(path, {
                ...options,
                method: 'POST',
                body: body ? JSON.stringify(body) : undefined
            }),
        put: (path: string, body?: any, options?: RequestInit) =>
            request(path, {
                ...options,
                method: 'PUT',
                body: body ? JSON.stringify(body) : undefined
            }),
    }), [request]);
}
