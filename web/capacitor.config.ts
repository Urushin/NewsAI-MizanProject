import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'ai.newsai.app',
    appName: 'Insight',
    webDir: 'out', // Next.js static export directory
    server: {
        androidScheme: 'https',
        // Allow connecting to the backend for local development
        cleartext: true,
        allowNavigation: [
            'localhost:8000',
            '192.168.1.66:8000',
            '*.supabase.co'
        ]
    }
};

export default config;
