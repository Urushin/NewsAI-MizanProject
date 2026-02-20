"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { API, useAuth } from "../context/AuthContext";

interface OnboardingWizardProps {
    onClose: () => void;
    onSuccess: () => void;
}

export default function OnboardingWizard({ onClose, onSuccess }: OnboardingWizardProps) {
    const { token } = useAuth();
    const [step, setStep] = useState(1);
    const [taxonomy, setTaxonomy] = useState<Record<string, string[]>>({});
    const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
    const [selectedSubtopics, setSelectedSubtopics] = useState<string[]>([]);
    const [custom, setCustom] = useState("");
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        fetch(`${API}/api/taxonomy`)
            .then((r) => r.json())
            .then((data) => {
                setTaxonomy(data);
                setLoading(false);
            })
            .catch(() => setLoading(false));
    }, []);

    const toggleTopic = (t: string) => {
        if (selectedTopics.includes(t)) {
            setSelectedTopics((prev) => prev.filter((x) => x !== t));
            // Remove associated subtopics
            const subsToRemove = taxonomy[t] || [];
            setSelectedSubtopics((prev) => prev.filter((s) => !subsToRemove.includes(s)));
        } else {
            setSelectedTopics((prev) => [...prev, t]);
        }
    };

    const toggleSub = (s: string) => {
        if (selectedSubtopics.includes(s)) {
            setSelectedSubtopics((prev) => prev.filter((x) => x !== s));
        } else {
            setSelectedSubtopics((prev) => [...prev, s]);
        }
    };

    const handleFinish = async () => {
        setGenerating(true);
        try {
            await fetch(`${API}/api/onboarding/manifesto`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({
                    topics: selectedTopics,
                    subtopics: selectedSubtopics,
                    custom,
                }),
            });
            onSuccess();
        } catch (e) {
            console.error(e);
            setGenerating(false);
        }
    };

    if (loading) return <div className="p-8 text-center">Chargement...</div>;

    return (
        <div className="wizard-overlay">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="wizard-panel"
            >
                {/* Header */}
                <div className="wizard-header">
                    <h2>Définissez vos Intérêts</h2>
                    <div className="wizard-steps">
                        <span className={step >= 1 ? "active" : ""}>1. Thèmes</span>
                        <span className="line"></span>
                        <span className={step >= 2 ? "active" : ""}>2. Détails</span>
                        <span className="line"></span>
                        <span className={step >= 3 ? "active" : ""}>3. Bonus</span>
                    </div>
                </div>

                {/* Content */}
                <div className="wizard-content">
                    <AnimatePresence mode="wait">
                        {step === 1 && (
                            <motion.div
                                key="step1"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <p className="wizard-desc">Sélectionnez vos grands domaines d'intérêt.</p>
                                <div className="grid-topics">
                                    {Object.keys(taxonomy).map((topic) => (
                                        <button
                                            key={topic}
                                            className={`topic-card ${selectedTopics.includes(topic) ? "selected" : ""}`}
                                            onClick={() => toggleTopic(topic)}
                                        >
                                            {topic}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}

                        {step === 2 && (
                            <motion.div
                                key="step2"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <p className="wizard-desc">Affinez avec des sous-thèmes spécifiques.</p>
                                {selectedTopics.length === 0 ? (
                                    <p className="empty-msg">Aucun thème sélectionné.</p>
                                ) : (
                                    <div className="subs-container">
                                        {selectedTopics.map((topic) => (
                                            <div key={topic} className="sub-group">
                                                <h3>{topic}</h3>
                                                <div className="chips-wrap">
                                                    {taxonomy[topic]?.map((sub) => (
                                                        <button
                                                            key={sub}
                                                            className={`chip ${selectedSubtopics.includes(sub) ? "selected" : ""}`}
                                                            onClick={() => toggleSub(sub)}
                                                        >
                                                            {sub}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </motion.div>
                        )}

                        {step === 3 && (
                            <motion.div
                                key="step3"
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -20 }}
                            >
                                <p className="wizard-desc">
                                    Avez-vous d'autres centres d'intérêt spécifiques ? (Optionnel)
                                </p>
                                <textarea
                                    className="custom-textarea"
                                    placeholder="Ex: Passion pour l'horlogerie vintage, suivi de l'équipe de Rugby de Toulouse..."
                                    value={custom}
                                    onChange={(e) => setCustom(e.target.value)}
                                    rows={6}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                {/* Footer */}
                <div className="wizard-footer">
                    {step > 1 && (
                        <button className="btn-secondary" onClick={() => setStep(step - 1)}>
                            Retour
                        </button>
                    )}
                    <div style={{ flex: 1 }}></div>
                    {step < 3 ? (
                        <button
                            className="btn-primary"
                            onClick={() => setStep(step + 1)}
                            disabled={step === 1 && selectedTopics.length === 0}
                        >
                            Suivant
                        </button>
                    ) : (
                        <button className="btn-primary" onClick={handleFinish} disabled={generating}>
                            {generating ? "Génération..." : "C'est parti !"}
                        </button>
                    )}
                </div>
            </motion.div>

            {/* Styles inline for Wizard (scoped) */}
            <style jsx>{`
        .wizard-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          backdrop-filter: blur(8px);
          z-index: 2000;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .wizard-panel {
          background: var(--bg-card);
          width: 100%;
          max-width: 600px;
          height: 80vh;
          max-height: 700px;
          border-radius: 24px;
          display: flex;
          flex-direction: column;
          box-shadow: 0 20px 50px rgba(0,0,0,0.3);
          border: 1px solid var(--separator);
          overflow: hidden;
        }
        .wizard-header {
          padding: 24px 32px;
          border-bottom: 1px solid var(--separator);
        }
        .wizard-header h2 {
          margin: 0 0 16px;
          font-family: var(--font-serif);
          font-size: 24px;
        }
        .wizard-steps {
          display: flex;
          align-items: center;
          gap: 12px;
          font-size: 13px;
          color: var(--text-lighter);
        }
        .wizard-steps .active {
          color: var(--primary);
          font-weight: 600;
        }
        .wizard-steps .line {
          height: 1px;
          flex: 1;
          background: var(--separator);
        }
        .wizard-content {
          flex: 1;
          padding: 32px;
          overflow-y: auto;
        }
        .wizard-desc {
          margin-bottom: 24px;
          color: var(--text-light);
          font-size: 15px;
        }
        .grid-topics {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 16px;
        }
        .topic-card {
          padding: 24px 16px;
          border: 2px solid var(--separator);
          border-radius: 12px;
          background: transparent;
          color: var(--text);
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
          text-align: center;
        }
        .topic-card:hover {
          border-color: var(--primary);
        }
        .topic-card.selected {
          border-color: var(--primary);
          background: rgba(var(--primary-rgb), 0.05);
          color: var(--primary);
        }
        .sub-group {
          margin-bottom: 32px;
        }
        .sub-group h3 {
          font-size: 16px;
          margin-bottom: 12px;
          font-weight: 600;
        }
        .chips-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .chip {
          padding: 8px 16px;
          border-radius: 20px;
          border: 1px solid var(--separator);
          background: var(--bg);
          cursor: pointer;
          font-size: 14px;
          transition: all 0.2s;
        }
        .chip.selected {
          background: var(--primary);
          color: white;
          border-color: var(--primary);
        }
        .custom-textarea {
          width: 100%;
          padding: 16px;
          border-radius: 12px;
          border: 1px solid var(--separator);
          background: var(--bg);
          color: var(--text);
          font-size: 15px;
          resize: vertical;
        }
        .wizard-footer {
          padding: 24px 32px;
          border-top: 1px solid var(--separator);
          display: flex;
          gap: 16px;
        }
        .btn-primary {
          background: var(--text);
          color: var(--bg);
          padding: 12px 32px;
          border-radius: 12px;
          font-weight: 600;
          cursor: pointer;
          border: none;
        }
        .btn-primary:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-secondary {
          background: transparent;
          color: var(--text-light);
          padding: 12px 24px;
          cursor: pointer;
          border: none;
        }
      `}</style>
        </div>
    );
}
