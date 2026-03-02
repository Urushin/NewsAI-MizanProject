"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await login(email, password);
            router.push("/");
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="auth-page">
            <div className="auth-container">
                <div className="auth-brand">
                    <h1>ميزان</h1>
                    <p className="auth-brand-sub">Mizan.ai</p>
                </div>

                <form onSubmit={handleSubmit} className="auth-form">
                    <h2>Connexion</h2>

                    {error && <p className="auth-error">{error}</p>}

                    <div className="auth-field">
                        <label htmlFor="email">Email</label>
                        <input
                            id="email"
                            type="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="vous@email.com"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="password">Mot de passe</label>
                        <input
                            id="password"
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••"
                            required
                        />
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? "Connexion…" : "Se connecter"}
                    </button>

                    <p className="auth-link">
                        Pas de compte ?{" "}
                        <a href="/signup">Créer un compte</a>
                    </p>
                </form>
            </div>
        </main>
    );
}
