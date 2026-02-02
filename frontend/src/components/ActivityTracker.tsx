'use client';

import { useEffect, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
const INTERVAL_MS = 60000; // 1 min

export function ActivityTracker() {
  const { token, user } = useAuth();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startRef = useRef<number>(Date.now());

  useEffect(() => {
    if (!token || user?.role !== 'student') return;

    const sendActivity = () => {
      const elapsed = Math.round((Date.now() - startRef.current) / 1000);
      fetch(`${API_URL}/api/student/activity`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ totalTimeSeconds: elapsed }),
      }).catch(() => {});
      startRef.current = Date.now();
    };

    intervalRef.current = setInterval(sendActivity, INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [token, user?.role]);

  return null;
}
