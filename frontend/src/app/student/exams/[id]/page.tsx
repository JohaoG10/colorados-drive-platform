'use client';

import { useEffect, useState } from 'react';
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

export default function TakeExamPage() {
  const params = useParams();
  const router = useRouter();
  const { token } = useAuth();
  const examId = params.id as string;
  const [exam, setExam] = useState<{ id: string; title: string; questions: Question[] } | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token || !examId) return;
    fetch(`${API_URL}/api/student/exams/${examId}/start`, {
      method: 'POST',
      headers: getAuthHeaders(token),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          if (data.error.includes('already attempted')) {
            router.push(`/student/exams/${examId}/result`);
          }
          setError(data.error);
          return;
        }
        setAttemptId(data.attemptId);
        setExam({ id: data.id, title: data.title, questions: data.questions || [] });
      })
      .catch(() => setError('Error al cargar el examen'));
  }, [token, examId, router]);

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
    const missing = answerList.filter((a) => {
      if ('optionId' in a) return !(a as { optionId: string }).optionId;
      if ('textAnswers' in a) return (a as { textAnswers: string[] }).textAnswers.some((t) => !t);
      return !(a as { textAnswer: string }).textAnswer?.trim();
    });
    if (missing.length > 0) {
      setError(`Responde todas las preguntas (${exam.questions.length - missing.length}/${exam.questions.length})`);
      return;
    }
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
  };

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
    return (
      <div className="flex justify-center py-12">
        <div className="animate-pulse text-neutral-500">Cargando examen...</div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-8">
        <Link href="/student/exams" className="text-neutral-500 hover:text-neutral-700 text-sm flex items-center gap-1">
          ← Volver a exámenes
        </Link>
        <h1 className="text-xl font-semibold text-neutral-900 mt-2">{exam.title}</h1>
        <p className="text-neutral-500 text-sm">{exam.questions.length} preguntas</p>
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
