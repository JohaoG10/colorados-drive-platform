'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tFast, transitionWithReduced } from '@/lib/motion';

type MotionButtonProps = {
  href: string;
  children: React.ReactNode;
  className?: string;
  reducedMotion?: boolean;
  /** Shine sweep on hover */
  shine?: boolean;
};

export function MotionButton({
  href,
  children,
  className = '',
  reducedMotion = false,
  shine = true,
}: MotionButtonProps) {
  const [hover, setHover] = useState(false);
  const transition = transitionWithReduced(tFast, reducedMotion);

  return (
    <Link href={href}>
      <motion.span
        className={`relative inline-flex items-center gap-2 overflow-hidden rounded-xl font-medium shadow-lg ${className}`}
        onHoverStart={() => setHover(true)}
        onHoverEnd={() => setHover(false)}
        whileHover={
          !reducedMotion
            ? { scale: 1.03, boxShadow: '0 12px 28px -8px rgba(220, 38, 38, 0.35)', transition }
            : undefined
        }
        whileTap={
          !reducedMotion ? { scale: 0.98, boxShadow: '0 6px 16px -4px rgba(220, 38, 38, 0.25)', transition: { duration: 0.1 } } : undefined
        }
        transition={transition}
      >
        {shine && !reducedMotion && (
          <motion.span
            className="pointer-events-none absolute inset-0 z-0"
            initial={false}
            animate={{
              opacity: hover ? 1 : 0,
            }}
            transition={{ duration: 0.25 }}
          >
            <motion.span
              className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/35 to-transparent"
              initial={{ x: '-50%' }}
              animate={{ x: hover ? '200%' : '-50%' }}
              transition={hover ? { duration: 0.55, ease: [0.22, 1, 0.36, 1] } : { duration: 0.2 }}
            />
          </motion.span>
        )}
        <span className="relative z-10 flex items-center gap-2">{children}</span>
      </motion.span>
    </Link>
  );
}
