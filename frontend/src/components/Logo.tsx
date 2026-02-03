'use client';

import Link from 'next/link';
import { useState } from 'react';

interface LogoProps {
  variant?: 'default' | 'compact' | 'large';
  inverted?: boolean;
  href?: string;
  className?: string;
}

const SCHOOL_NAME = 'Colorados Drive';
const TAGLINE = 'Escuela de Conducción';

export function Logo({ variant = 'default', inverted = false, href = '/', className = '' }: LogoProps) {
  const [logoSrc, setLogoSrc] = useState<string | null>('/logo.png');
  const size = variant === 'compact' ? 40 : variant === 'large' ? 64 : 48;
  const showTagline = variant === 'large';

  const textColor = inverted ? 'text-white' : 'text-neutral-900';
  const mutedColor = inverted ? 'text-neutral-400' : 'text-neutral-500';

  const logoSymbol = (
    <div
      className={`
        relative shrink-0 rounded-xl flex items-center justify-center overflow-hidden
        ring-1 transition-all duration-300 ease-out
        ${inverted ? 'ring-white/20 bg-white/10' : 'ring-neutral-200/80 bg-white'}
        group-hover:ring-red-500/40 group-hover:shadow-lg group-hover:shadow-red-500/10
        group-hover:scale-[1.02] group-active:scale-[0.98]
      `}
      style={{ width: size, height: size }}
    >
      {logoSrc ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img
          src={logoSrc}
          alt=""
          className="w-full h-full object-contain p-1"
          onError={() => setLogoSrc(null)}
        />
      ) : (
        <span
          className={`font-bold ${inverted ? 'text-red-400' : 'text-red-600'}`}
          style={{ fontSize: size * 0.4 }}
          aria-hidden
        >
          C
        </span>
      )}
    </div>
  );

  const nameBlock = (
    <div className="flex flex-col min-w-0">
      <span
        className={`
          font-semibold tracking-tight leading-tight truncate
          transition-colors duration-200
          ${textColor}
          ${href !== undefined ? 'group-hover:text-red-600' : ''}
          ${inverted && href !== undefined ? 'group-hover:text-red-400' : ''}
          ${variant === 'compact' ? 'text-base' : variant === 'large' ? 'text-2xl' : 'text-lg'}
        `}
      >
        {SCHOOL_NAME}
      </span>
      {showTagline && (
        <span className={`text-sm mt-0.5 transition-colors duration-200 ${mutedColor}`}>{TAGLINE}</span>
      )}
    </div>
  );

  const content = (
    <span className="inline-flex items-center gap-3">
      {logoSymbol}
      {nameBlock}
    </span>
  );

  const wrapperClass = `inline-flex items-center gap-3 group ${className}`;

  if (href !== undefined) {
    return (
      <Link
        href={href}
        className={`${wrapperClass} focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 rounded-lg`}
      >
        {content}
      </Link>
    );
  }
  return <div className={wrapperClass}>{content}</div>;
}
