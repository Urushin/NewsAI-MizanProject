"use client";

import { useEffect } from 'react';
import { usePlatform } from '../hooks/usePlatform';

export function PlatformProvider({ children }: { children: React.ReactNode }) {
  const { isNative } = usePlatform();

  useEffect(() => {
    if (isNative) {
      document.body.classList.add('is-native');
    } else {
      document.body.classList.remove('is-native');
    }
  }, [isNative]);

  return <>{children}</>;
}
