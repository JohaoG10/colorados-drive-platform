'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { ImageWithShimmer } from './ImageWithShimmer';
import {
  fadeUpVariants,
  scaleInVariants,
  useReducedMotion,
  containerStaggerVariants,
} from '@/lib/motion';
import { spacing, maxWidth, typography, shadows } from '@/lib/theme';

const galleryImages = [
  { src: '/inicio-galeria-1.jpg', alt: 'Instalaciones', placeholder: 'Aula teórica' },
  { src: '/inicio-galeria-2.jpg', alt: 'Prácticas', placeholder: 'Vehículos y prácticas' },
  { src: '/inicio-galeria-3.jpg', alt: 'Equipo', placeholder: 'Nuestro equipo' },
];

export function GallerySection() {
  const reducedMotion = useReducedMotion();
  const [galleryErrors, setGalleryErrors] = useState<Record<number, boolean>>({});

  return (
    <section className={`border-t border-neutral-200/80 ${spacing.sectionY} bg-neutral-50/50`}>
      <div className={`${maxWidth.content} ${spacing.sectionX}`}>
        <motion.div
          className="mb-14 text-center"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.2 }}
          variants={fadeUpVariants}
          custom={reducedMotion}
        >
          <p className={`${typography.label} text-red-700 mb-2`}>Nuestra escuela</p>
          <h2 className={`${typography.heading2} text-neutral-900`}>Instalaciones y equipo</h2>
          <p className={`mt-2 ${typography.bodySm} ${typography.muted} max-w-lg mx-auto`}>
            Espacios preparados para tu formación teórica y práctica.
          </p>
        </motion.div>

        <motion.div
          className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8"
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
          variants={containerStaggerVariants}
          custom={reducedMotion}
        >
          {galleryImages.map((item, i) => {
            const hasError = galleryErrors[i];
            return (
              <motion.div
                key={i}
                className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-neutral-200/90 bg-neutral-200"
                variants={scaleInVariants}
                custom={reducedMotion}
                whileHover={
                  !reducedMotion
                    ? {
                        scale: 1.02,
                        boxShadow: shadows.cardHover,
                        transition: { duration: 0.3 },
                      }
                  : undefined
                }
                style={{ boxShadow: shadows.sm }}
              >
                {!hasError ? (
                  <>
                    <motion.span
                      className="absolute inset-0 block"
                      whileHover={!reducedMotion ? { scale: 1.05 } : undefined}
                      transition={{ duration: 0.5 }}
                    >
                      <ImageWithShimmer
                        src={item.src}
                        alt={item.alt}
                        sizes="(max-width: 640px) 100vw, 33vw"
                        className="object-cover"
                        onError={() => setGalleryErrors((prev) => ({ ...prev, [i]: true }))}
                      />
                    </motion.span>
                    <div
                      className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-90 group-hover:opacity-100 transition-opacity duration-300"
                      aria-hidden
                    />
                    <div className="absolute inset-x-0 bottom-0 p-4">
                      <span className="text-white font-semibold text-sm drop-shadow-sm">{item.placeholder}</span>
                    </div>
                  </>
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-neutral-300 text-neutral-500 text-sm p-4">
                    <svg className="w-10 h-10 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14" />
                    </svg>
                    <span>{item.placeholder}</span>
                  </div>
                )}
                {!reducedMotion && (
                  <span
                    className="absolute inset-0 rounded-2xl pointer-events-none border-2 border-transparent group-hover:border-red-400/50 group-hover:shadow-[0_0_24px_-4px_rgba(248,113,113,0.4)] transition-all duration-300"
                    aria-hidden
                  />
                )}
              </motion.div>
            );
          })}
        </motion.div>
      </div>
    </section>
  );
}
