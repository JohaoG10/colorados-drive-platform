'use client';

import { motion } from 'framer-motion';
import type { Variants } from 'framer-motion';
import { fadeUpStaggerVariants } from '@/lib/motion';

type MotionSectionProps = {
  children: React.ReactNode;
  className?: string;
  as?: 'section' | 'header' | 'footer';
  variants?: Variants;
  reducedMotion?: boolean;
  viewport?: { once?: boolean; amount?: number };
};

export function MotionSection({
  children,
  className = '',
  as: Component = 'section',
  variants = fadeUpStaggerVariants,
  reducedMotion = false,
  viewport = { once: true, amount: 0.2 },
}: MotionSectionProps) {
  const M = motion[Component as keyof typeof motion] as typeof motion.section;
  return (
    <M
      className={className}
      initial="hidden"
      whileInView="visible"
      viewport={viewport}
      variants={variants}
      custom={reducedMotion}
    >
      {children}
    </M>
  );
}
