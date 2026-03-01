'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { DashboardLayout } from '@/components/DashboardLayout';

function ScheduleIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

const navItems = [
  { href: '/instructor', label: 'Calendario', icon: <ScheduleIcon /> },
];

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (user.role !== 'instructor') {
      router.replace(user.role === 'admin' ? '/admin' : '/student');
    }
  }, [user, loading, router]);

  if (loading || !user || user.role !== 'instructor') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-neutral-400">Cargando...</div>
      </div>
    );
  }

  return (
    <DashboardLayout navItems={navItems} title="Calendario">
      {children}
    </DashboardLayout>
  );
}
