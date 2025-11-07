import { useState, useEffect, useMemo } from 'react';

const DESKTOP_BREAKPOINT = 768;

export const useDeviceType = () => {
  const isTouchDevice = useMemo(() => {
    if (typeof window === 'undefined') return false;
    return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
  }, []);

  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === 'undefined') return !isTouchDevice;
    return window.innerWidth >= DESKTOP_BREAKPOINT;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleResize = () => {
      setIsDesktop(window.innerWidth >= DESKTOP_BREAKPOINT);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return { isDesktop, isTouchDevice };
};
