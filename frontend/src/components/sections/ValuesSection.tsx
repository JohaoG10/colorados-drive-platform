'use client';

import { motion } from 'framer-motion';
import {
  fadeUpVariants,
  scaleInVariants,
  useReducedMotion,
  containerStaggerVariants,
} from '@/lib/motion';
import { spacing, maxWidth, typography, colors } from '@/lib/theme';

const values = [
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
    title: 'Formación segura',
    description: 'Metodología probada para que obtengas tu licencia con confianza.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    title: 'Horarios flexibles',
    description: 'Nos adaptamos a tu disponibilidad en cada etapa.',
  },
  {
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    title: 'Instructores certificados',
    description: 'Profesionales con experiencia para guiarte hasta tu licencia.',
  },
];

export function ValuesSection() {
  const reducedMotion = useReducedMotion();

  return (
    <section className={`border-t border-neutral-200/80 bg-white ${spacing.sectionY}`}>
      <div className={`${maxWidth.content} ${spacing.sectionX}`}>
        <motion.div
          className="mb-14 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUpVariants}
          custom={reducedMotion}
        >
          <p className={`${typography.label} text-red-700 mb-2`}>Por qué elegirnos</p>
          <h2 className={`${typography.heading2} text-neutral-900`}>Nuestros valores</h2>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={containerStaggerVariants}
          custom={reducedMotion}
        >
          {values.map((v, i) => (
            <motion.div
              key={i}
              className="group relative flex flex-col sm:flex-row sm:items-start gap-4 p-6 sm:p-7 rounded-2xl bg-neutral-50/80 border border-neutral-200/80 backdrop-blur-sm"
              variants={scaleInVariants}
              custom={reducedMotion}
              whileHover={
                !reducedMotion
                  ? {
                      y: -4,
                      boxShadow: '0 20px 40px -12px rgb(0 0 0 / 0.1), 0 0 0 1px rgba(220, 38, 38, 0.08)',
                      transition: { duration: 0.35 },
                    }
                  : undefined
              }
              whileTap={!reducedMotion ? { scale: 0.99 } : undefined}
            >
              <div
                className="shrink-0 w-12 h-12 rounded-xl flex items-center justify-center text-white"
                style={{
                  background: `linear-gradient(135deg, ${colors.redDeep}, ${colors.red})`,
                  boxShadow: '0 4px 14px -2px rgba(220, 38, 38, 0.35)',
                }}
              >
                {v.icon}
              </div>
              <div className="min-w-0">
                <h3 className={`${typography.heading3} text-neutral-900 mb-1.5`}>{v.title}</h3>
                <p className={`${typography.bodySm} text-neutral-600 leading-relaxed`}>{v.description}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
