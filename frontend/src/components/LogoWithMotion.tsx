'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Logo } from '@/components/Logo';
import { useReducedMotion } from '@/lib/motion';

type LogoWithMotionProps = {
  variant?: 'default' | 'compact' | 'large';
  href?: string;
  className?: string;
  /** Show glow + shine + float (for hero). */
  enhanced?: boolean;
};

export function LogoWithMotion({
  variant = 'default',
  href = '',
  className = '',
  enhanced = true,
}: LogoWithMotionProps) {
  const reducedMotion = useReducedMotion();
  const [hover, setHover] = useState(false);

  if (!enhanced || reducedMotion) {
    return <Logo variant={variant} href={href} className={className} />;
  }

  return (
    <motion.div
      className={`relative inline-flex justify-center ${className}`}
      onHoverStart={() => setHover(true)}
      onHoverEnd={() => setHover(false)}
      animate={{ y: [0, -1.5, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Glow behind logo */}
      <motion.span
        className="absolute inset-0 -z-10 rounded-2xl bg-red-500/10 blur-2xl scale-150"
        animate={{ opacity: [0.25, 0.45, 0.25] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />
      {/* Shine sweep: periodic or on hover */}
      <span className="relative block overflow-hidden rounded-2xl">
        <motion.span
          className="pointer-events-none absolute inset-0 z-10 rounded-2xl bg-gradient-to-r from-transparent via-white/20 to-transparent"
          initial={false}
          animate={{ x: ['-100%', '200%'] }}
          transition={{
            x: {
              duration: hover ? 0.6 : 2,
              repeat: Infinity,
              repeatDelay: hover ? 0 : 7,
              ease: [0.22, 1, 0.36, 1],
            },
          }}
          style={{ width: '50%' }}
        />
        <span className="relative block">
          <Logo variant={variant} href={href} className="pointer-events-none" />
        </span>
      </span>
    </motion.div>
  );
}
