import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

export const triggerHaptic = {
    light: async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                await Haptics.impact({ style: ImpactStyle.Light });
            } catch (e) {
                console.warn("Failed to trigger light haptic", e);
            }
        }
    },
    medium: async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                await Haptics.impact({ style: ImpactStyle.Medium });
            } catch (e) {
                console.warn("Failed to trigger medium haptic", e);
            }
        }
    },
    success: async () => {
        if (Capacitor.isNativePlatform()) {
            try {
                await Haptics.notification({ type: 'SUCCESS' as any });
            } catch (e) {
                console.warn("Failed to trigger success haptic", e);
            }
        }
    }
};
