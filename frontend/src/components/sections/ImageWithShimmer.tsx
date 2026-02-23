'use client';

import { useState } from 'react';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { useReducedMotion } from '@/lib/motion';
import { tMedium } from '@/lib/motion';

type ImageWithShimmerProps = {
  src: string;
  alt: string;
  fill?: boolean;
  sizes?: string;
  className?: string;
  onError?: () => void;
};

export function ImageWithShimmer({
  src,
  alt,
  fill = true,
  sizes,
  className = '',
  onError,
}: ImageWithShimmerProps) {
  const [loaded, setLoaded] = useState(false);
  const reducedMotion = useReducedMotion();

  return (
    <span className="relative block w-full h-full">
      {!loaded && (
        <motion.span
          className="absolute inset-0 z-10 bg-neutral-200 overflow-hidden"
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        >
          {!reducedMotion && (
            <motion.span
              className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/70 to-transparent"
              animate={{ x: ['0%', '200%'] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut' }}
            />
          )}
        </motion.span>
      )}
      <motion.span
        className="relative block w-full h-full"
        initial={reducedMotion ? false : { opacity: 0, scale: 1.02 }}
        animate={loaded ? { opacity: 1, scale: 1 } : (reducedMotion ? {} : { opacity: 0, scale: 1.02 })}
        transition={reducedMotion ? { duration: 0 } : tMedium}
      >
        <Image
          src={src}
          alt={alt}
          fill={fill}
          sizes={sizes}
          className={className}
          onLoad={() => setLoaded(true)}
          onError={onError}
        />
      </motion.span>
    </span>
  );
}
