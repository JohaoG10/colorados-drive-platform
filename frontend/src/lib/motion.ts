'use client';

import { useState, useEffect } from 'react';
import type { Transition, Variants } from 'framer-motion';

// ─── Easing (motion identity) ──────────────────────────────────────────────
export const easeOut = [0.22, 1, 0.36, 1] as const;
export const easeInOut = [0.65, 0, 0.35, 1] as const;
export const easeOutExpo = [0.16, 1, 0.3, 1] as const;

// ─── Durations ─────────────────────────────────────────────────────────────
export const duration = {
  instant: 0.12,
  fast: 0.4,
  medium: 0.55,
  slow: 0.75,
  blob: 22,
} as const;

// ─── Transitions ───────────────────────────────────────────────────────────
export const tFast: Transition = { duration: duration.fast, ease: easeOut };
export const tMedium: Transition = { duration: duration.medium, ease: easeOut };
export const tSlow: Transition = { duration: duration.slow, ease: easeOut };
export const tInstant: Transition = { duration: duration.instant, ease: easeOut };

// ─── Stagger ───────────────────────────────────────────────────────────────
export const staggerDelay = 0.1;
export const staggerDelayChildren = 0.12;

// ─── Section / layout (align with theme) ───────────────────────────────────
export const sectionPadding = {
  y: 'py-24 sm:py-28 md:py-32',
  x: 'px-4 sm:px-6 lg:px-8',
};
export const sectionGap = 'gap-16 lg:gap-24';
export const maxWidth = 'max-w-5xl mx-auto';
export const maxWidthNarrow = 'max-w-2xl mx-auto';

// ─── Variants (motion identity) ────────────────────────────────────────────
export const fadeUpVariants: Variants = {
  hidden: { opacity: 0, y: 24 },
  visible: (reduced: boolean) => ({
    opacity: 1,
    y: 0,
    transition: reduced ? { duration: 0.01 } : tMedium,
  }),
};

export const fadeLeftVariants: Variants = {
  hidden: { opacity: 0, x: 24 },
  visible: (reduced: boolean) => ({
    opacity: 1,
    x: 0,
    transition: reduced ? { duration: 0.01 } : tMedium,
  }),
};

export const scaleInVariants: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: (reduced: boolean) => ({
    opacity: 1,
    scale: 1,
    transition: reduced ? { duration: 0.01 } : tMedium,
  }),
};

export const fadeUpStaggerVariants: Variants = {
  hidden: {},
  visible: (reduced: boolean) => ({
    transition: {
      staggerChildren: reduced ? 0 : staggerDelay,
      delayChildren: reduced ? 0 : staggerDelayChildren,
    },
  }),
};

/** Container variant: stagger children with fadeUp. Use on parent. */
export const containerStaggerVariants: Variants = {
  hidden: {},
  visible: (reduced: boolean) => ({
    transition: {
      staggerChildren: reduced ? 0 : 0.12,
      delayChildren: reduced ? 0 : 0.15,
    },
  }),
};

export const fadeUpVariantsChild: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: (reduced: boolean) => ({
    opacity: 1,
    y: 0,
    transition: reduced ? { duration: 0.01 } : { duration: 0.5, ease: easeOut },
  }),
};

// ─── Reduced motion ─────────────────────────────────────────────────────────
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReduced(mq.matches);
    const handler = () => setReduced(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);
  return reduced;
}

export function transitionWithReduced(base: Transition, reduced: boolean): Transition {
  if (reduced) return { duration: 0.01 };
  return base;
}
