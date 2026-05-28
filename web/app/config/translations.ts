export const profileLabels: Record<string, Record<string, string>> = {
    fr: {
        language: "Langue",
        threshold: "Seuil de pertinence",
        manifesto: "Manifesto",
        manifestoPlaceholder: "Décrivez vos centres d'intérêt…",
        newPassword: "Nouveau mot de passe",
        passwordPlaceholder: "Laisser vide pour ne pas changer",
        accountActive: "Compte Actif",
        config: "Configuration",
        matrix: "Intelligence Matrix",
        remodel: "Remodeler",
        safety: "Sûreté",
        save: "Enregistrer",
        saving: "Sauvegarde…",
        saved: "✓ Enregistré",
        saveBrief: "Enregistrer pour plus tard",
        error: "Erreur",
        logout: "Se déconnecter",
        langNote: "Le changement de langue sera appliqué au prochain briefing.",
        generate: "🧪 Test Rapide (Preview)",
        generating: "⏳ Mode Test…",
        generated: "✓ Chargé !",
        generateError: "❌ Erreur",
        official: "Générer mon Brief Officiel",
        genInit: "Initialisation...",
        genDone: "Terminé !",
        genErrorMsg: "Erreur de génération",
        profileTitle: "Réglages",
        planPro: "🔒 PLAN PRO",
        readingSection: "Lecture",
        summaryFormat: "Format du résumé",
        formatBullets: "Puces",
        formatSentences: "Phrases",
        formatDetailed: "Détaillé",
        wizardBtn: "Configurateur AI Assistant",
        appearanceSection: "Apparence",
        langSelect: "Langue",
        themeSelect: "Thème de l’interface",
        themeLight: "☀️ Clair",
        themeDark: "🌙 Sombre",
        visualStyleSelect: "Gabarit Visuel",
        styleModern: "Journal Moderne",
        styleLegacy: "Grille Classique",
        securitySection: "Sécurité",
        saveBtn: "Enregistrer",
        logoutBtn: "Déconnexion",
        generateBtn: "Générer Nouvelle Édition"
    },
    en: {
        language: "Language",
        threshold: "Score Threshold",
        manifesto: "Editorial Manifesto",
        manifestoPlaceholder: "Describe your interests…",
        newPassword: "New password",
        passwordPlaceholder: "Leave empty to keep current",
        accountActive: "Active Account",
        config: "Configuration",
        matrix: "Intelligence Matrix",
        remodel: "Remodel",
        safety: "Safety",
        save: "Save",
        saving: "Saving…",
        saved: "✓ Saved",
        saveBrief: "Save for later",
        error: "Error",
        logout: "Log out",
        langNote: "Applies to the next briefing.",
        generate: "🧪 Quick Test (Preview)",
        generating: "⏳ Testing…",
        generated: "✓ Loaded!",
        generateError: "❌ Error",
        official: "Generate my Official Brief",
        genInit: "Initializing...",
        genDone: "Done!",
        genErrorMsg: "Generation error",
        profileTitle: "Settings",
        planPro: "🔒 PRO PLAN",
        readingSection: "Reading",
        summaryFormat: "Summary format",
        formatBullets: "Bullets",
        formatSentences: "Sentences",
        formatDetailed: "Detailed",
        wizardBtn: "AI Assistant Configurator",
        appearanceSection: "Appearance",
        langSelect: "Language",
        themeSelect: "Interface Theme",
        themeLight: "☀️ Light",
        themeDark: "🌙 Dark",
        visualStyleSelect: "Visual Layout",
        styleModern: "Modern Journal",
        styleLegacy: "Classic Grid",
        securitySection: "Security",
        saveBtn: "Save",
        logoutBtn: "Log out",
        generateBtn: "Generate New Edition"
    }
};

export const loaderMessages: Record<string, string[]> = {
    fr: [
        "Recrutement de correspondants virtuels...",
        "Lecture de la presse mondiale en accéléré...",
        "Entraînement des neurones de l'IA...",
        "Traduction des scoops internationaux...",
        "Filtrage des fake news et du bruit numérique...",
        "Préparation du café pour l'IA éditorialiste...",
        "Synchronisation avec les flux satellites...",
        "Analyse de l'impact géopolitique...",
        "Détection des signaux faibles...",
        "Nettoyage des archives poussiéreuses...",
        "Assemblage du puzzle de l'actualité...",
        "Mise en page de votre édition sur-mesure..."
    ],
    en: [
        "Recruiting virtual correspondents...",
        "Reading global press at high speed...",
        "Training AI neurons...",
        "Translating international scoops...",
        "Filtering fake news and digital noise...",
        "Preparing coffee for the AI editor...",
        "Syncing with satellite feeds...",
        "Analyzing geopolitical impact...",
        "Detecting weak signals...",
        "Cleaning dusty archives...",
        "Assembling the news puzzle...",
        "Formatting your custom edition..."
    ]
};

export const commonLabels: Record<string, Record<string, string>> = {
    fr: {
        back: "Retour",
        next: "Suivant",
        save: "Enregistrer",
        cancel: "Annuler",
        loading: "Chargement...",
        articles: "articles",
        sources: "sources",
        scanned: "analysées",
        today: "Aujourd'hui",
        yesterday: "Hier",
        errorTitle: "Oups, une petite interférence !",
        errorAuth: "Votre session a peut-être expiré. Essayez de vous reconnecter.",
        errorServer: "Nous n'avons pas pu récupérer votre briefing. Cela arrive parfois quand les serveurs prennent un café.",
        retry: "Réessayer maintenant",
        frontPage: "UNE",
        synthesis: "Synthèse",
        seenIn: "Vu dans",
        sourcesPlural: "sources",
        navBrief: "Brief",
        navSources: "Sources",
        navProfile: "Moi"
    },
    en: {
        back: "Back",
        next: "Next",
        save: "Save",
        cancel: "Cancel",
        loading: "Loading...",
        articles: "articles",
        sources: "sources",
        scanned: "scanned",
        today: "Today",
        yesterday: "Yesterday",
        errorTitle: "Oops, a small interference!",
        errorAuth: "Your session may have expired. Try logging in again.",
        errorServer: "We couldn't get your briefing. This happens sometimes when the servers are taking a coffee break.",
        retry: "Retry now",
        frontPage: "FRONT PG",
        synthesis: "Synthesis",
        seenIn: "Seen in",
        sourcesPlural: "sources",
        navBrief: "Brief",
        navSources: "Sources",
        navProfile: "Me"
    }
};

export const briefLabels: Record<string, Record<string, string>> = {
  fr: {
    title: "Le Briefing du Jour",
    nothingToday: "Aucune actualité pertinente pour aujourd'hui.",
    noData: "Aucun briefing disponible pour le moment.",
    nothingSub: "Revenez plus tard ou ajustez vos centres d'intérêt.",
    noDataSub: "Lancez une édition depuis votre profil.",
    endOfBrief: "Fin du briefing",
    endSub: "Vous êtes à jour. Revenez demain pour de nouvelles actualités.",
    digestShow: "Décrypter la journée",
    digestHide: "Résumé Quotidien",
    certified: "Certifié NewsAI",
    precision: "Confiance",
    youtubeTitle: "Vidéos de la Matinale",
    share: "Partager l'édition",
    tier1: "Ce que vous avez manqué ce matin",
    tier2: "L'essentiel de votre secteur",
    tier3: "Lecture détente (Passion)",
    general: "Général"
  },
  en: {
    title: "Today's Briefing",
    nothingToday: "Nothing relevant today.",
    noData: "No briefing available yet.",
    nothingSub: "Come back later or adjust your interests.",
    noDataSub: "Generate your first briefing from your profile.",
    endOfBrief: "End of briefing",
    endSub: "You're all caught up. Come back tomorrow.",
    digestShow: "Decrypt the day",
    digestHide: "Daily Summary",
    certified: "NewsAI Certified",
    precision: "Confidence",
    youtubeTitle: "Morning Videos",
    share: "Share edition",
    tier1: "What you missed this morning",
    tier2: "Strategic sector overview",
    tier3: "Relaxed Reading (Passions)",
    general: "General"
  }
};

export const historyLabels: Record<string, Record<string, string>> = {
    fr: {
        title: "Archives",
        empty: "Aucun historique disponible",
        backToToday: "← Retour à aujourd'hui"
    },
    en: {
        title: "History",
        empty: "No history available",
        backToToday: "← Back to today"
    }
};

export const sourcesLabels: Record<string, Record<string, string>> = {
    fr: {
        title: "Sources Traitées",
        subtitle: "Transparence algorithmique : explorez tous les points de données ayant servi à construire votre intelligence matinale.",
        tabUsed: "Retenus",
        tabGlobal: "Global",
        searchPlaceholder: "Domaine, Titre, Mot clé...",
        noResults: "Aucun résultat trouvé"
    },
    en: {
        title: "Processed Sources",
        subtitle: "Algorithm transparency: explore all the data points used to build your morning intelligence.",
        tabUsed: "Kept",
        tabGlobal: "Global",
        searchPlaceholder: "Domain, Title, Keyword...",
        noResults: "No results found"
    }
};

export const wizardLabels: Record<string, Record<string, string>> = {
    fr: {
        title: "Personnalisez votre Brief",
        step: "Étape",
        step1: "1. Quels sont vos grands intérêts ?",
        step2: "2. On affine un peu ?",
        step2Warning: "Veuillez retourner à l'étape précédente pour sélectionner un thème.",
        step3: "3. Votre Radar d'Impact (Optionnel)",
        step3Sub: "Même si vous n'aimez pas l'économie ou la politique, certaines actualités peuvent avoir un impact direct sur vous. L'IA filtrera intelligemment tout ce qui peut vous concerner.",
        age: "Votre âge",
        agePlaceholder: "Âge précis...",
        location: "Où vivez-vous ?",
        locationPlaceholder: "Ville ou Région...",
        occupation: "Secteur ou Profession",
        occupationPlaceholder: "Profession...",
        years: "ans",
        step4: "4. Vos sources favorites ?",
        step4Placeholder: "Canaux YouTube (un par ligne...)",
        step4Custom: "Informez l'IA sur vos goûts, vos limites ou vos besoins spécifiques de filtrage...",
        finish: "Générer mon Brief",
        creating: "Création..."
    },
    en: {
        title: "Personalize your Brief",
        step: "Step",
        step1: "1. What are your main interests?",
        step2: "2. Shall we refine a bit?",
        step2Warning: "Please go back to the previous step to select a theme.",
        step3: "3. Your Impact Radar (Optional)",
        step3Sub: "Even if you don't like economics or politics, some news can have a direct impact on you. The AI will intelligently filter everything that may concern you.",
        age: "Your age",
        agePlaceholder: "Exact age...",
        location: "Where do you live?",
        locationPlaceholder: "City or Region...",
        occupation: "Sector or Profession",
        occupationPlaceholder: "Profession...",
        years: "years",
        step4: "4. Your favorite sources?",
        step4Placeholder: "YouTube Channels (one per line...)",
        step4Custom: "Tell the AI about your tastes, limits, or specific filtering needs...",
        finish: "Generate my Brief",
        creating: "Creating..."
    }
};

export const shareLabels: Record<string, Record<string, string>> = {
    fr: {
        title: "Partager l'édition",
        shareVia: "Partager via...",
        exportPdf: "Exporter en PDF",
        copy: "Copier (Notion)",
        copied: "Copié !",
        markdownTitle: "NewsAI - Édition du",
        digestTitle: "Résumé Éditorial",
        youtubeTitle: "Vidéos YouTube",
        readMore: "Lire la suite",
        watchVideo: "Voir la vidéo"
    },
    en: {
        title: "Share edition",
        shareVia: "Share via...",
        exportPdf: "Export to PDF",
        copy: "Copy (Notion)",
        copied: "Copied!",
        markdownTitle: "NewsAI - Edition of",
        digestTitle: "Editorial Summary",
        youtubeTitle: "YouTube Videos",
        readMore: "Read more",
        watchVideo: "Watch video"
    }
};

export const modalLabels: Record<string, Record<string, string>> = {
  fr: {
    impact: "Impact Direct",
    reliability: "Score Fiabilité",
    published: "Publié par",
    analysis: "Synthèse générée par l'IA",
    proReserved: "Analyse Réservée aux Membres Pro",
    proSub: "Débloquez le décryptage complet de l'IA, la synthèse multi-sources et les enjeux cachés.",
    proPlan: "Passer au Plan Pro",
    multiSource: "Synthèse Multi-Sources",
    original: "Accéder à l'Article Original",
    reject: "Rejeter",
    branding: "NewsAI Intelligence • Signal 021-X"
  },
  en: {
    impact: "Direct Impact",
    reliability: "Reliability Score",
    published: "Published by",
    analysis: "AI-Generated Synthesis",
    proReserved: "Analysis Reserved for Pro Members",
    proSub: "Unlock full AI decryption, multi-source synthesis, and hidden stakes.",
    proPlan: "Upgrade to Pro Plan",
    multiSource: "Multi-Source Synthesis",
    original: "Access Original Article",
    reject: "Reject",
    branding: "NewsAI Intelligence • Signal 021-X"
  }
};

export const loaderLabels: Record<string, Record<string, string>> = {
  fr: {
    ready: "Votre briefing est prêt",
    preparing: "Préparation de votre Brief",
    processing: "Traitement...",
    sync: "Synchronisation"
  },
  en: {
    ready: "Your briefing is ready",
    preparing: "Preparing your daily brief",
    processing: "Processing...",
    sync: "Synchronization"
  }
};

export const landingLabels: Record<string, Record<string, string>> = {
  fr: {
    heroTitle1: "Lisez moins,",
    heroTitle2: "comprenez plus.",
    heroSub: "NewsAI filtre le bruit numérique pour ne vous livrer que l'essentiel. Une curation intelligente, personnalisée et sans distractions.",
    startExperience: "Démarrer l'expérience",
    login: "Se connecter",
    badge: "L'information redéfinie par l'IA",
    feat1Title: "L'Essentiel en 2 minutes",
    feat1Desc: "Notre IA analyse des milliers de sources pour ne vous présenter que les informations cruciales.",
    feat2Title: "IA Certifiée (Precision 98%)",
    feat2Desc: "Chaque résumé est vérifié pour sa véracité et sa pertinence par nos modèles de pointe.",
    feat3Title: "Pont Cognitif",
    feat3Desc: "NewsAI apprend de vos centres d'intérêt pour créer des connexions intelligentes entre les actualités."
  },
  en: {
    heroTitle1: "Read less,",
    heroTitle2: "understand more.",
    heroSub: "NewsAI filters digital noise to deliver only what matters. Intelligent, personalized curation without distractions.",
    startExperience: "Start the Experience",
    login: "Log in",
    badge: "Information redefined by AI",
    feat1Title: "The Essentials in 2 mins",
    feat1Desc: "Our AI analyzes thousands of sources to bring you only the crucial information.",
    feat2Title: "Certified AI (98% Precision)",
    feat2Desc: "Each summary is verified for truthfulness and relevance by our advanced models.",
    feat3Title: "Cognitive Bridge",
    feat3Desc: "NewsAI learns from your interests to create intelligent connections between news events."
  }
};

export const authLabels: Record<string, Record<string, string>> = {
  fr: {
    createAccount: "Créer un compte",
    email: "Email",
    emailPlaceholder: "vous@email.com",
    username: "Nom d'utilisateur",
    usernamePlaceholder: "Choisissez un nom",
    password: "Mot de passe",
    passwordPlaceholder: "6 caractères minimum",
    languageSelect: "Langue des news",
    btnCreate: "Créer mon compte",
    btnCreating: "Création…",
    alreadyAccount: "Déjà un compte ?",
    loginLink: "Se connecter",
    loginTitle: "Accès Lecteur",
    loginSub: "Authentification sécurisée",
    emailLabel: "Email de l'abonné",
    passwordLabel: "Clef d'accès",
    btnLogin: "Se connecter",
    btnChecking: "Vérification...",
    noAccountYet: "Pas encore membre ?",
    signupLink: "Créer un compte",
    signupTitle: "Souscription",
    signupSub: "Rejoindre l'expérience NewsAI",
    signingUp: "Impression du contrat...",
    identityLabel: "Identité Lecteur"
  },
  en: {
    createAccount: "Create an account",
    email: "Email",
    emailPlaceholder: "you@email.com",
    username: "Username",
    usernamePlaceholder: "Choose a name",
    password: "Password",
    passwordPlaceholder: "Min 6 characters",
    languageSelect: "News Language",
    btnCreate: "Create my account",
    btnCreating: "Creating…",
    alreadyAccount: "Already have an account?",
    loginLink: "Log in",
    loginTitle: "Reader Access",
    loginSub: "Secure authentication",
    emailLabel: "Subscriber email",
    passwordLabel: "Access key",
    btnLogin: "Log in",
    btnChecking: "Verifying...",
    noAccountYet: "Not a member yet?",
    signupLink: "Create an account",
    signupTitle: "Subscription",
    signupSub: "Join the NewsAI experience",
    signingUp: "Printing contract...",
    identityLabel: "Reader Identity"
  }
};

export const mapLabels: Record<string, Record<string, string>> = {
  fr: {
    title: "World Monitor",
    subtitle: "Veille Géo-temporelle",
    back: "Retour",
    recentDispatches: "Dépêches Récentes",
    activeNews: "Actus",
    openFullStream: "Ouvrir le Flux Complet",
    geopoliticalTensions: "Tensions géopolitiques croissantes",
    historicTradeAgreement: "Accord commercial historique signé",
    newClimateSummit: "Nouveau sommet sur le climat annoncé",
    mockSourceAI: "Intelligence AI"
  },
  en: {
    title: "World Monitor",
    subtitle: "Geo-temporal Intelligence Feed",
    back: "Back",
    recentDispatches: "Recent Dispatches",
    activeNews: "News",
    openFullStream: "Open Full Feed",
    geopoliticalTensions: "Rising geopolitical tensions",
    historicTradeAgreement: "Historic trade agreement signed",
    newClimateSummit: "New climate summit announced",
    mockSourceAI: "AI Intelligence"
  }
};

