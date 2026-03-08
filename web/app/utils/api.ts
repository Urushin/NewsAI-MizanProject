import { useAuth, API } from "../context/AuthContext";
import { useRouter } from "next/navigation";
import { useCallback, useMemo } from "react";

export function useApi() {
    const { token, logout } = useAuth();
    const router = useRouter();

    const request = useCallback(async (path: string, options: RequestInit = {}) => {
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
            throw new Error(`Session expired (${res.status})`);
        }

        if (!res.ok) {
            const errorData = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
            throw new Error(errorData.detail || `Error ${res.status}`);
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
        delete: (path: string, options?: RequestInit) => request(path, { ...options, method: 'DELETE' }),
    }), [request]);
}
