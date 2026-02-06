'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface Question {
  id: string;
  questionText: string;
  imageUrl?: string;
  type?: string;
  openTextParts?: number;
  options: { id: string; text: string }[];
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function TakeExamPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const examId = params.id as string;
  const [exam, setExam] = useState<{ id: string; title: string; questions: Question[]; durationMinutes?: number } | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const timerStartedAt = useRef<number | null>(null);
  const autoSubmitted = useRef(false);

  useEffect(() => {
    if (!token || !examId) return;
    setLoading(true);
    setError('');
    fetch(`${API_URL}/api/student/exams/${examId}/start`, {
      method: 'POST',
      headers: getAuthHeaders(token),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          if (data.error === 'no_more_attempts' || (data.message && String(data.message).toLowerCase().includes('intentos'))) {
            setError('Ya usaste todos los intentos permitidos para este examen. Revisa tu resultado en la lista.');
            setLoading(false);
            return;
          }
          const err = String(data.error).toLowerCase();
          if (err.includes('already attempted') || err.includes('duplicate') || err.includes('unique constraint')) {
            router.replace(`/student/exams/${examId}/result`);
            return;
          }
          setError('No se pudo cargar el examen. Si ya lo rendiste, ve a Ver resultado desde la lista de exámenes.');
          setLoading(false);
          return;
        }
        setAttemptId(data.attemptId);
        const durationMin = data.durationMinutes != null ? Number(data.durationMinutes) : undefined;
        setExam({ id: data.id, title: data.title, questions: data.questions || [], durationMinutes: durationMin });
        if (durationMin != null && durationMin > 0) {
          const totalSeconds = durationMin * 60;
          setSecondsLeft(totalSeconds);
          timerStartedAt.current = Date.now();
        }
        setLoading(false);
      })
      .catch(() => {
        setError('Error al cargar el examen. Intenta de nuevo.');
        setLoading(false);
      });
  }, [token, examId, router]);

  const answersRef = useRef(answers);
  useEffect(() => {
    answersRef.current = answers;
  }, [answers]);

  const doSubmit = useCallback(async (answerList: { questionId: string; optionId?: string; textAnswer?: string; textAnswers?: string[] }[]) => {
    if (!token || !attemptId) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/student/attempts/${attemptId}/submit`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ answers: answerList }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      router.push(`/student/exams/${examId}/result`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar');
    } finally {
      setSubmitting(false);
    }
  }, [token, attemptId, router, examId]);

  useEffect(() => {
    if (!exam?.durationMinutes || !attemptId || submitting) return;
    const totalSeconds = exam.durationMinutes * 60;
    const interval = setInterval(() => {
      if (timerStartedAt.current == null) return;
      const elapsed = Math.floor((Date.now() - timerStartedAt.current) / 1000);
      const left = Math.max(0, totalSeconds - elapsed);
      setSecondsLeft(left);
      if (left <= 0 && !autoSubmitted.current) {
        autoSubmitted.current = true;
        const a = answersRef.current;
        const list = exam.questions.map((q) => {
          const isOpen = q.type === 'open_text';
          const parts = q.openTextParts ?? 1;
          if (isOpen && parts > 1) {
            const textAnswers = Array.from({ length: parts }, (_, i) => (a[`${q.id}_${i}`] ?? '').trim());
            return { questionId: q.id, textAnswers };
          }
          if (isOpen) return { questionId: q.id, textAnswer: (a[q.id] ?? '').trim() };
          return { questionId: q.id, optionId: a[q.id] ?? '' };
        });
        doSubmit(list);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [exam, attemptId, submitting, doSubmit]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !attemptId || !exam) return;
    const answerList = exam.questions.map((q) => {
      const isOpen = q.type === 'open_text';
      const parts = q.openTextParts ?? 1;
      if (isOpen && parts > 1) {
        const textAnswers = Array.from({ length: parts }, (_, i) => (answers[`${q.id}_${i}`] ?? '').trim());
        return { questionId: q.id, textAnswers };
      }
      if (isOpen) {
        return { questionId: q.id, textAnswer: (answers[q.id] ?? '').trim() };
      }
      return { questionId: q.id, optionId: answers[q.id] ?? '' };
    });
    const missingCount = answerList.filter((a) => {
      if ('optionId' in a) return !(a as { optionId: string }).optionId;
      if ('textAnswers' in a) return (a as { textAnswers: string[] }).textAnswers.every((t) => !t);
      return !(a as { textAnswer: string }).textAnswer?.trim();
    }).length;
    if (missingCount > 0) {
      const confirmar = window.confirm(
        `¿Deseas enviar el examen con ${missingCount} pregunta${missingCount === 1 ? '' : 's'} sin responder? Las preguntas no respondidas se calificarán como incorrectas.`
      );
      if (!confirmar) return;
    }
    await doSubmit(answerList);
  };

  if (loading || (!exam && !error)) {
    return (
      <div className="flex justify-center py-12">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-500">Cargando examen...</p>
        </div>
      </div>
    );
  }

  if (error && !exam) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
          <p className="text-red-700">{error}</p>
          <Link href="/student/exams" className="mt-4 inline-block text-red-600 hover:underline">
            Volver a exámenes
          </Link>
        </div>
      </div>
    );
  }

  if (!exam) {
    return null;
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Link href="/student/exams" className="text-neutral-500 hover:text-neutral-700 text-sm flex items-center gap-1">
          ← Volver a exámenes
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-4 mt-2">
          <div>
            <h1 className="text-xl font-semibold text-neutral-900">{exam.title}</h1>
            <p className="text-neutral-500 text-sm">{exam.questions.length} preguntas</p>
          </div>
          {secondsLeft != null && (
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl font-mono text-lg font-semibold ${secondsLeft <= 60 ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-800'}`}>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatTime(secondsLeft)}
            </div>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {error && (
          <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm">{error}</div>
        )}
        {exam.questions.map((q, i) => (
          <div key={q.id} className="bg-white rounded-xl border border-neutral-200 p-6">
            <p className="font-medium text-neutral-900 mb-4">
              {i + 1}. {q.questionText}
            </p>
            {q.imageUrl && (
              <div className="mb-4 rounded-lg overflow-hidden border border-neutral-200">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={q.imageUrl} alt="Pregunta" className="max-h-64 w-auto object-contain" />
              </div>
            )}
            {q.type === 'open_text' ? (
              <div className="space-y-3">
                {(q.openTextParts ?? 1) > 1 ? (
                  Array.from({ length: q.openTextParts ?? 1 }, (_, i) => (
                    <div key={i}>
                      <label className="block text-sm font-medium text-neutral-600 mb-1">{String.fromCharCode(97 + i)})</label>
                      <input
                        type="text"
                        value={answers[`${q.id}_${i}`] ?? ''}
                        onChange={(e) => setAnswers((a) => ({ ...a, [`${q.id}_${i}`]: e.target.value }))}
                        className="w-full px-4 py-3 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                        placeholder="Tu respuesta..."
                      />
                    </div>
                  ))
                ) : (
                  <>
                    <label className="block text-sm font-medium text-neutral-600 mb-2">Escribe tu respuesta</label>
                    <textarea
                      value={answers[q.id] ?? ''}
                      onChange={(e) => setAnswers((a) => ({ ...a, [q.id]: e.target.value }))}
                      rows={4}
                      className="w-full px-4 py-3 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
                      placeholder="Tu respuesta..."
                    />
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {q.options.map((opt) => (
                  <label
                    key={opt.id}
                    className={`flex items-center gap-3 p-4 rounded-lg border cursor-pointer transition-colors ${
                      answers[q.id] === opt.id
                        ? 'border-red-600 bg-red-50'
                        : 'border-neutral-200 hover:border-neutral-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt.id}
                      checked={answers[q.id] === opt.id}
                      onChange={() => setAnswers((a) => ({ ...a, [q.id]: opt.id }))}
                      className="w-4 h-4 text-red-600"
                    />
                    <span className="text-neutral-700">{opt.text}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        ))}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 disabled:opacity-60"
          >
            {submitting ? 'Enviando...' : 'Enviar examen'}
          </button>
        </div>
      </form>
    </div>
  );
}
