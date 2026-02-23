'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ImageWithShimmer } from './ImageWithShimmer';
import {
  fadeLeftVariants,
  scaleInVariants,
  useReducedMotion,
  containerStaggerVariants,
} from '@/lib/motion';
import { spacing, maxWidth, typography, shadows } from '@/lib/theme';

export function AboutSection() {
  const reducedMotion = useReducedMotion();
  const [mainImageError, setMainImageError] = useState(false);

  return (
    <section className={`border-t border-neutral-200/80 bg-white ${spacing.sectionY}`}>
      <div className={`${maxWidth.content} ${spacing.sectionX}`}>
        <motion.div
          className={`grid grid-cols-1 lg:grid-cols-2 ${spacing.block} items-center`}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={containerStaggerVariants}
          custom={reducedMotion}
        >
          <motion.div
            className="order-2 lg:order-1 space-y-6"
            variants={fadeLeftVariants}
            custom={reducedMotion}
          >
            <div className="inline-flex items-center rounded-full border border-red-200/80 bg-red-50/80 px-3.5 py-1.5">
              <span className={`${typography.label} text-red-700`} style={{ fontSize: '10px' }}>
                Quiénes somos
              </span>
            </div>
            <h2 className={`${typography.heading2} text-neutral-900 leading-tight`}>
              Colorados Drive es una empresa dedicada a la formación de conductores responsables
            </h2>
            <p className={`${typography.body} text-neutral-600`}>
              Somos una <strong className="text-neutral-800">escuela de conducción</strong> que te prepara de forma teórica y práctica para obtener tu licencia con seguridad. Clases teóricas de calidad, material actualizado y prácticas con instructores experimentados.
            </p>
            <p className={`${typography.body} text-neutral-600`}>
              En esta plataforma tienes el contenido de tu curso, exámenes y seguimiento de tu progreso. Nuestro objetivo es que salgas preparado para conducir con responsabilidad.
            </p>
          </motion.div>

          <motion.div
            className="order-1 lg:order-2 relative"
            variants={scaleInVariants}
            custom={reducedMotion}
          >
            <motion.div
              className="relative aspect-[4/3] min-h-[280px] rounded-2xl overflow-hidden border border-neutral-200/90 bg-neutral-100"
              style={{ boxShadow: shadows.md }}
              whileHover={
                !reducedMotion
                  ? {
                      boxShadow: shadows.cardHover,
                      transition: { duration: 0.35 },
                    }
                  : undefined
              }
            >
              {!mainImageError ? (
                <ImageWithShimmer
                  src="/inicio-empresa.jpg"
                  alt="Colorados Drive"
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="object-cover"
                  onError={() => setMainImageError(true)}
                />
              ) : null}
              <div
                className={`absolute inset-0 flex flex-col items-center justify-center gap-2 bg-neutral-200 text-neutral-500 text-sm p-6 ${mainImageError ? '' : 'hidden'}`}
              >
                <svg className="w-12 h-12 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Añade inicio-empresa.jpg en public</span>
              </div>
            </motion.div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
