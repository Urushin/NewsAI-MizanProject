import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
    appId: 'ai.newsai.app',
    appName: 'Insight',
    webDir: 'out', // Next.js static export directory
    server: {
        // Comment the line below to use static export (production mode)
        // Uncomment for Live Reload (development mode — loads from your Mac's dev server)
        // url: 'http://192.168.1.199:3000',
        iosScheme: 'capacitor',
        androidScheme: 'https',
        // Allow connecting to the backend for local development
        cleartext: true,
        allowNavigation: [
            'localhost:8000',
            '192.168.1.199:8000',
            '192.168.1.199:3000',
            '*.supabase.co'
        ]
    }
};

export default config;
