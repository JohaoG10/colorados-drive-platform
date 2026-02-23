'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  fadeUpVariants,
  useReducedMotion,
} from '@/lib/motion';
import { spacing, maxWidth, typography, colors, shadows } from '@/lib/theme';

export function CTASection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className={`border-t border-neutral-200/80 ${spacing.sectionY} bg-neutral-50/50`}>
      <div className={`${maxWidth.narrow} mx-auto ${spacing.sectionX}`}>
        <motion.div
          className="relative rounded-3xl overflow-hidden text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUpVariants}
          custom={reducedMotion}
        >
          <div
            className="relative px-8 py-14 sm:px-12 sm:py-16"
            style={{
              background: `linear-gradient(135deg, ${colors.redSoft} 0%, ${colors.redLight}40 50%, ${colors.redSoft} 100%)`,
              boxShadow: shadows.lg,
            }}
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_100%,rgba(220,38,38,0.08),transparent)]" aria-hidden />
            <div className="relative">
              <h2 className={`${typography.heading2} text-neutral-900 mb-2`}>¿Listo para continuar?</h2>
              <p className={`${typography.body} ${typography.muted} mb-8 max-w-md mx-auto`}>
                Accede a tu curso, materias y exámenes desde un solo lugar.
              </p>
              <Link href="/student/curso">
                <motion.span
                  className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold text-white overflow-hidden relative"
                  style={{
                    background: `linear-gradient(135deg, ${colors.redDeep}, ${colors.red})`,
                    boxShadow: shadows.glow,
                  }}
                  whileHover={!reducedMotion ? { scale: 1.03, boxShadow: shadows.glowSoft } : undefined}
                  whileTap={!reducedMotion ? { scale: 0.98 } : undefined}
                  transition={{ duration: 0.35 }}
                >
                  Ir a mi curso
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
                  </svg>
                </motion.span>
              </Link>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
