"use client";

import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { useRouter } from "next/navigation";

export default function SignupPage() {
    const { signup } = useAuth();
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [language, setLanguage] = useState("fr");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");
        setLoading(true);
        try {
            await signup(email, password, username, language);
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
                    <h2>Créer un compte</h2>

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
                        <label htmlFor="username">Nom d&apos;utilisateur</label>
                        <input
                            id="username"
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Choisissez un nom"
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
                            placeholder="6 caractères minimum"
                            minLength={6}
                            required
                        />
                    </div>

                    <div className="auth-field">
                        <label htmlFor="language">Langue des news</label>
                        <select
                            id="language"
                            value={language}
                            onChange={(e) => setLanguage(e.target.value)}
                        >
                            <option value="fr">🇫🇷 Français</option>
                            <option value="en">🇬🇧 English</option>
                            <option value="ja">🇯🇵 日本語</option>
                        </select>
                    </div>

                    <button type="submit" className="auth-btn" disabled={loading}>
                        {loading ? "Création…" : "Créer mon compte"}
                    </button>

                    <p className="auth-link">
                        Déjà un compte ?{" "}
                        <a href="/login">Se connecter</a>
                    </p>
                </form>
            </div>
        </main>
    );
}
