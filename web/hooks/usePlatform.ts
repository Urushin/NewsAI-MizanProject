import { useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

export function usePlatform() {
  const [isNative, setIsNative] = useState(false);
  const [isClient, setIsClient] = useState(false);

  useEffect(() => {
    setIsClient(true);
    if (typeof window !== 'undefined') {
      setIsNative(Capacitor.isNativePlatform());
    }
  }, []);

  return { isNative, isClient };
}
