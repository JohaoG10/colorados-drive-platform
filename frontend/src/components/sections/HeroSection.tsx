'use client';

import { useRef, useState } from 'react';
import { motion, useScroll, useTransform } from 'framer-motion';
import Link from 'next/link';
import { LogoWithMotion } from '@/components/LogoWithMotion';
import {
  duration,
  tFast,
  tMedium,
  useReducedMotion,
  transitionWithReduced,
  fadeUpVariants,
} from '@/lib/motion';
import { spacing, maxWidth, typography, colors, shadows } from '@/lib/theme';

const heroDelays = { label: 0.08, title: 0.18, subtitle: 0.28, primary: 0.38, secondary: 0.44, logo: 0.55 };

type HeroSectionProps = { firstName: string };

export function HeroSection({ firstName }: HeroSectionProps) {
  const reducedMotion = useReducedMotion();
  const containerRef = useRef<HTMLElement>(null);
  const [heroHover, setHeroHover] = useState(false);
  const [primaryBtnHover, setPrimaryBtnHover] = useState(false);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end start'],
  });

  const titleY = useTransform(scrollYProgress, [0, 0.45], reducedMotion ? [0, 0] : [0, 10]);
  const subtitleY = useTransform(scrollYProgress, [0, 0.45], reducedMotion ? [0, 0] : [0, 6]);
  const indicatorOpacity = useTransform(scrollYProgress, [0, 0.12], [1, 0]);

  const tF = transitionWithReduced(tFast, reducedMotion);
  const tM = transitionWithReduced(tMedium, reducedMotion);

  return (
    <header
      ref={containerRef}
      className="relative min-h-[92vh] flex flex-col justify-center overflow-hidden"
      onMouseEnter={() => setHeroHover(true)}
      onMouseLeave={() => setHeroHover(false)}
    >
      {/* Background: base + noise-style dots + gradients */}
      <div className="absolute inset-0 bg-[#fafafa]" aria-hidden />
      <div
        className="absolute inset-0 opacity-[0.7]"
        style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(0,0,0,0.06) 1px, transparent 0)`,
          backgroundSize: '32px 32px',
        }}
      />
      {!reducedMotion && (
        <>
          <motion.div
            className="absolute rounded-full blur-[100px] opacity-30"
            style={{
              width: 'min(90vw, 480px)',
              height: 'min(90vw, 480px)',
              left: '5%',
              top: '10%',
              background: `linear-gradient(135deg, ${colors.red}22, ${colors.redLight}44)`,
            }}
            animate={{
              x: [0, 40, 0],
              y: [0, -30, 0],
              opacity: [0.2, 0.4, 0.2],
            }}
            transition={{ duration: duration.blob, repeat: Infinity, ease: 'easeInOut' }}
          />
          <motion.div
            className="absolute rounded-full blur-[80px] opacity-25"
            style={{
              width: 'min(70vw, 360px)',
              height: 'min(70vw, 360px)',
              right: '-5%',
              bottom: '15%',
              background: `linear-gradient(225deg, ${colors.redDeep}18, transparent)`,
            }}
            animate={{
              x: [0, -30, 0],
              y: [0, 20, 0],
              opacity: [0.15, 0.35, 0.15],
            }}
            transition={{ duration: duration.blob + 3, repeat: Infinity, ease: 'easeInOut' }}
          />
        </>
      )}
      <motion.div
        className="pointer-events-none absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 90% 60% at 50% 10%, rgba(248, 113, 113, 0.12), transparent 55%)',
        }}
        animate={{ opacity: heroHover ? 1 : 0.7 }}
        transition={{ duration: 0.6 }}
      />

      <div className={`relative ${spacing.sectionY} ${spacing.sectionX}`}>
        <div className={`${maxWidth.narrow} mx-auto text-center`}>
          <motion.p
            className={`${typography.label} mb-6`}
            style={{ color: colors.redDeep }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tF, delay: heroDelays.label }}
          >
            Plataforma de formación
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tM, delay: heroDelays.title }}
          >
            <motion.h1
              className={`${typography.heading1} text-neutral-900 leading-[1.1] mb-5`}
              style={{ y: titleY }}
            >
              Bienvenido,{' '}
              <span
                className="relative inline-block"
                style={{
                  background: `linear-gradient(120deg, ${colors.redDeep}, ${colors.red})`,
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                {firstName}
                <motion.span
                  className="absolute bottom-0 left-0 right-0 h-0.5 rounded-full origin-left"
                  style={{ background: `linear-gradient(90deg, ${colors.redDeep}, ${colors.red})` }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ duration: 0.6, delay: heroDelays.title + 0.2 }}
                />
              </span>
            </motion.h1>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tF, delay: heroDelays.subtitle }}
          >
            <motion.p
              className={`${typography.body} ${typography.muted} max-w-md mx-auto mb-10`}
              style={{ y: subtitleY }}
            >
              En <strong className="text-neutral-800">Colorados Drive</strong> tienes todo tu curso, material y exámenes en un solo lugar.
            </motion.p>
          </motion.div>

          <motion.div
            className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-4"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tF, delay: heroDelays.primary }}
          >
            <Link href="/student/curso" className="inline-block">
              <motion.span
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white overflow-hidden relative"
                style={{
                  background: `linear-gradient(135deg, ${colors.redDeep}, ${colors.red})`,
                  boxShadow: shadows.glow,
                }}
                onHoverStart={() => setPrimaryBtnHover(true)}
                onHoverEnd={() => setPrimaryBtnHover(false)}
                whileHover={!reducedMotion ? { scale: 1.03, boxShadow: shadows.glowSoft } : undefined}
                whileTap={!reducedMotion ? { scale: 0.98 } : undefined}
                transition={tF}
              >
                {!reducedMotion && (
                  <motion.span
                    className="absolute inset-0 w-1/2 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                    animate={{ x: primaryBtnHover ? '200%' : '-100%' }}
                    transition={{ duration: primaryBtnHover ? 0.5 : 0.2 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-2">
                  Ir a mi curso
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </span>
              </motion.span>
            </Link>
            <Link href="/student/subjects">
              <motion.span
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-medium border-2 border-neutral-200 text-neutral-700 hover:border-red-200 hover:text-red-700 hover:bg-red-50/50 transition-colors duration-300"
                whileHover={!reducedMotion ? { scale: 1.02 } : undefined}
                whileTap={!reducedMotion ? { scale: 0.98 } : undefined}
                transition={tF}
              >
                Ver materias
              </motion.span>
            </Link>
          </motion.div>

          <motion.div
            className="mt-20 flex justify-center"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...tF, delay: heroDelays.logo }}
          >
            <LogoWithMotion variant="default" href="" enhanced />
          </motion.div>
        </div>
      </div>

      {!reducedMotion && (
        <motion.div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-1.5 text-neutral-400"
          style={{ opacity: indicatorOpacity }}
        >
          <span className="text-[10px] font-medium uppercase tracking-[0.2em]">Scroll</span>
          <motion.span
            animate={{ y: [0, 5, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </motion.span>
        </motion.div>
      )}
    </header>
  );
}
