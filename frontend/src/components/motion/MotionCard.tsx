'use client';

import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { fadeUpVariants, tFast, transitionWithReduced } from '@/lib/motion';

type MotionCardProps = {
  children: React.ReactNode;
  className?: string;
  variants?: Variants;
  reducedMotion?: boolean;
  /** lift + glow + ring on hover */
  interactive?: boolean;
};

export function MotionCard({
  children,
  className = '',
  variants = fadeUpVariants,
  reducedMotion = false,
  interactive = true,
}: MotionCardProps) {
  const transition = transitionWithReduced(tFast, reducedMotion);
  return (
    <motion.div
      className={className}
      variants={variants}
      custom={reducedMotion}
      whileHover={
        interactive && !reducedMotion
          ? {
              y: -6,
              boxShadow: '0 20px 40px -12px rgba(0,0,0,0.12), 0 0 0 1px rgba(220, 38, 38, 0.08)',
              transition,
            }
          : undefined
      }
      whileTap={
        interactive && !reducedMotion
          ? { scale: 0.98, boxShadow: '0 4px 12px -4px rgba(0,0,0,0.08)', transition: { duration: 0.1 } }
          : undefined
      }
      transition={transition}
    >
      {children}
    </motion.div>
  );
}
