'use client';

import { useAuth } from '@/contexts/AuthContext';
import {
  HeroSection,
  AboutSection,
  GallerySection,
  ValuesSection,
  CTASection,
} from '@/components/sections';

export default function StudentHomePage() {
  const { user } = useAuth();
  const firstName = user?.fullName?.split(' ')[0] || 'Estudiante';

  return (
    <div className="min-h-screen bg-white">
      <HeroSection firstName={firstName} />
      <AboutSection />
      <GallerySection />
      <ValuesSection />
      <CTASection />
    </div>
  );
}
