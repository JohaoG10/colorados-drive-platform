'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders } from '@/lib/api';
import Link from 'next/link';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

interface QuestionItem {
  id: string;
  question_text: string;
  type?: string;
}

interface ExamWithQuestions {
  id: string;
  title: string;
  subject_id: string | null;
  course_id: string | null;
  question_count: number;
  questions: QuestionItem[];
}

export default function AddExamQuestionsPage() {
  const params = useParams();
  const { token } = useAuth();
  const examId = params.id as string;
  const [exam, setExam] = useState<ExamWithQuestions | null>(null);
  const [form, setForm] = useState({
    questionText: '',
    imageUrl: '',
    type: 'multiple_choice' as 'multiple_choice' | 'open_text',
    openTextParts: 1,
    correctAnswerText: '',
    correctAnswerParts: [''] as string[],
    options: ['', '', '', ''],
    correctIndex: 0,
  });
  const [message, setMessage] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  const uploadImage = async (file: File) => {
    if (!token) return null;
    setUploadingImage(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await fetch(`${API_URL}/api/admin/upload?folder=questions`, {
        method: 'POST',
        headers: getAuthHeaders(token),
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      return data.url as string;
    } catch {
      return null;
    } finally {
      setUploadingImage(false);
    }
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage('');
    const isOpen = form.type === 'open_text';
    let options: { text: string; isCorrect: boolean }[] = [];
    let correctAnswerParts: string[] | undefined;
    if (isOpen) {
      const n = Math.max(1, Math.min(10, form.openTextParts));
      if (n === 1) {
        if (form.correctAnswerText.trim()) correctAnswerParts = [form.correctAnswerText.trim()];
      } else {
        correctAnswerParts = form.correctAnswerParts.slice(0, n).map((p) => p.trim()).filter(Boolean);
        if (correctAnswerParts.length < n) {
          setMessage('Completa las respuestas modelo de cada parte (a, b, c, d...)');
          return;
        }
      }
      if (!correctAnswerParts?.length) {
        setMessage('Indica al menos una respuesta modelo para que el sistema califique.');
        return;
      }
    }
    if (!isOpen) {
      const filled = form.options
        .map((text, i) => ({ text: text.trim(), originalIndex: i }))
        .filter((o) => o.text);
      if (filled.length < 2) {
        setMessage('Mínimo 2 opciones para opción múltiple');
        return;
      }
      const correctText = form.options[form.correctIndex]?.trim();
      options = filled.map((o) => ({
        text: o.text,
        isCorrect: o.text === correctText,
      }));
      if (!options.some((o) => o.isCorrect)) {
        setMessage('Marca una opción correcta');
        return;
      }
    }
    try {
      const res = await fetch(`${API_URL}/api/admin/exams/${examId}/questions`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token!), 'Content-Type': 'application/json' },
        body: JSON.stringify({
          questionText: form.questionText.trim(),
          imageUrl: form.imageUrl || undefined,
          type: form.type,
          correctAnswerText: isOpen && form.openTextParts === 1 && form.correctAnswerText.trim() ? form.correctAnswerText.trim() : undefined,
          correctAnswerParts: isOpen ? correctAnswerParts : undefined,
          options,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      setMessage('Pregunta agregada al banco correctamente');
      setForm({
        questionText: '',
        imageUrl: '',
        type: 'multiple_choice',
        openTextParts: 1,
        correctAnswerText: '',
        correctAnswerParts: [''],
        options: ['', '', '', ''],
        correctIndex: 0,
      });
      loadExam();
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Error');
    }
  };

  const loadExam = useCallback(() => {
    if (!token || !examId) return;
    fetch(`${API_URL}/api/admin/exams/${examId}/questions`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then((data) => {
        if (data.id && data.questions) setExam(data);
        else setExam(null);
      })
      .catch(() => setExam(null));
  }, [token, examId]);

  useEffect(() => {
    loadExam();
  }, [loadExam]);

  const deleteQuestion = async (qId: string) => {
    if (!confirm('¿Eliminar esta pregunta del banco?')) return;
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/questions/${qId}`, { method: 'DELETE', headers: getAuthHeaders(token) });
      if (!res.ok) throw new Error('Error');
      setMessage('Pregunta eliminada');
      loadExam();
    } catch {
      setMessage('Error al eliminar');
    }
  };

  const isBankMode = exam?.subject_id != null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <Link href="/admin/exams" className="inline-flex items-center gap-1 text-sm text-neutral-500 hover:text-red-600 transition-colors">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Volver a exámenes
      </Link>

      <div className="rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-6 text-white shadow-xl shadow-red-600/20">
        <h1 className="text-xl font-bold">
          {isBankMode ? 'Banco de preguntas' : 'Agregar preguntas'}
        </h1>
        <p className="text-red-100 text-sm mt-1">
          {exam?.title || 'Cargando...'}
          {isBankMode && exam && (
            <span className="ml-0 mt-2 block sm:inline sm:mt-0">
              · {exam.questions.length} en el banco · se eligen {exam.question_count} al azar por estudiante
            </span>
          )}
        </p>
      </div>

      {exam && exam.questions.length > 0 && (
        <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/80">
            <h2 className="font-semibold text-neutral-900">
              {isBankMode ? `Preguntas en el banco (${exam.questions.length})` : `Preguntas del examen (${exam.questions.length})`}
            </h2>
            {isBankMode && (
              <p className="text-sm text-neutral-500 mt-0.5">Cada estudiante recibe {exam.question_count} preguntas aleatorias de este banco</p>
            )}
          </div>
          <ul className="divide-y">
            {exam.questions.map((q) => (
              <li key={q.id} className="px-6 py-4 flex justify-between items-start gap-4">
                <p className="text-sm text-neutral-700 flex-1 line-clamp-2">{q.question_text}</p>
                <span className="text-xs text-neutral-400 shrink-0">{q.type === 'open_text' ? 'Abierta' : 'Opción múltiple'}</span>
                <button type="button" onClick={() => deleteQuestion(q.id)} className="text-red-600 hover:text-red-700 text-sm shrink-0">Eliminar</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 shadow-sm overflow-hidden">
        {message && (
          <div className={`p-4 mx-6 mt-6 rounded-xl border ${message.includes('agregad') ? 'bg-green-50 text-green-700 border-green-200' : 'bg-red-50 text-red-700 border-red-200'}`}>
            {message}
          </div>
        )}

        <form onSubmit={handleAdd} className="p-6 space-y-6">
          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">Pregunta</label>
            <textarea
              required
              value={form.questionText}
              onChange={(e) => setForm({ ...form, questionText: e.target.value })}
              rows={3}
              className="w-full px-4 py-3 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none"
              placeholder="Ej: ¿Cuál es la velocidad máxima permitida en zona urbana en Ecuador?"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">Imagen de la pregunta (opcional)</label>
            <p className="text-xs text-neutral-500 mb-2">Útil para señales de tránsito o diagramas. JPG, PNG, GIF. Máx. 10MB</p>
            <div className="flex items-start gap-4">
              <input
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const url = await uploadImage(file);
                  if (url) setForm((f) => ({ ...f, imageUrl: url }));
                  else setMessage('Error al subir imagen');
                }}
                className="text-sm file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-red-50 file:text-red-700 file:font-medium"
              />
              {uploadingImage && <span className="text-sm text-neutral-500">Subiendo...</span>}
            </div>
            {form.imageUrl && (
              <div className="mt-3 p-3 rounded-lg bg-neutral-50 border border-neutral-200">
                <p className="text-xs text-green-600 font-medium mb-2">✓ Imagen cargada</p>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={form.imageUrl} alt="Vista previa" className="max-h-40 rounded-lg object-contain" />
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, imageUrl: '' }))}
                  className="mt-2 text-sm text-red-600 hover:underline"
                >
                  Quitar imagen
                </button>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-neutral-900 mb-2">Tipo de pregunta</label>
            <div className="flex gap-4 mb-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="qtype"
                  checked={form.type === 'multiple_choice'}
                  onChange={() => setForm({ ...form, type: 'multiple_choice' })}
                  className="w-4 h-4 text-red-600"
                />
                <span>Opción múltiple</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="qtype"
                  checked={form.type === 'open_text'}
                  onChange={() => setForm({ ...form, type: 'open_text' })}
                  className="w-4 h-4 text-red-600"
                />
                <span>Respuesta abierta (escriben ellos)</span>
              </label>
            </div>

            {form.type === 'open_text' ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-semibold text-neutral-900 mb-1">Número de partes (ej: 4 para a, b, c, d)</label>
                  <input
                    type="number"
                    min={1}
                    max={10}
                    value={form.openTextParts}
                    onChange={(e) => {
                      const n = Math.max(1, Math.min(10, parseInt(e.target.value, 10) || 1));
                      setForm((f) => ({
                        ...f,
                        openTextParts: n,
                        correctAnswerParts: Array.from({ length: n }, (_, i) => f.correctAnswerParts[i] ?? ''),
                      }));
                    }}
                    className="w-24 px-3 py-2 rounded-lg border border-neutral-300"
                  />
                </div>
                {form.openTextParts === 1 ? (
                  <div>
                    <label className="block text-sm font-semibold text-neutral-900 mb-2">Respuesta(s) modelo (una o más por línea)</label>
                    <p className="text-xs text-neutral-500 mb-2">El sistema dará por correcta si el estudiante escribe exactamente una de las líneas (se ignoran mayúsculas y espacios).</p>
                    <textarea
                      value={form.correctAnswerText}
                      onChange={(e) => setForm({ ...form, correctAnswerText: e.target.value })}
                      rows={3}
                      className="w-full px-4 py-3 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 outline-none"
                      placeholder={'Ej: 50 km/h\n50km/h'}
                    />
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-xs text-neutral-500">Para cada parte (a, b, c, d...) indica las respuestas modelo aceptadas, una por línea.</p>
                    {Array.from({ length: form.openTextParts }, (_, i) => (
                      <div key={i}>
                        <label className="block text-sm font-medium mb-1">{String.fromCharCode(97 + i)}) Parte {i + 1}</label>
                        <textarea
                          value={form.correctAnswerParts[i] ?? ''}
                          onChange={(e) => {
                            const arr = [...form.correctAnswerParts];
                            arr[i] = e.target.value;
                            setForm({ ...form, correctAnswerParts: arr });
                          }}
                          rows={2}
                          className="w-full px-4 py-2 rounded-lg border border-neutral-300 focus:ring-2 focus:ring-red-500 outline-none"
                          placeholder="Una o más respuestas (una por línea)"
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <>
                <label className="block text-sm font-semibold text-neutral-900 mb-3">Opciones de respuesta (marca la correcta)</label>
                <div className="space-y-3">
                  {form.options.map((opt, i) => (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        form.correctIndex === i ? 'border-red-600 bg-red-50/50' : 'border-neutral-200 hover:border-neutral-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="correct"
                        checked={form.correctIndex === i}
                        onChange={() => setForm({ ...form, correctIndex: i })}
                        className="w-5 h-5 text-red-600"
                      />
                      <span className="w-6 h-6 rounded-full bg-neutral-200 text-neutral-600 flex items-center justify-center text-xs font-bold shrink-0">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <input
                        type="text"
                        value={opt}
                        onChange={(e) => {
                          const arr = [...form.options];
                          arr[i] = e.target.value;
                          setForm({ ...form, options: arr });
                        }}
                        className="flex-1 px-4 py-2 rounded-lg border border-neutral-200 focus:ring-2 focus:ring-red-500 outline-none"
                        placeholder={`Opción ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              className="px-6 py-3 rounded-lg bg-red-600 text-white font-semibold hover:bg-red-700 transition-colors"
            >
              {isBankMode ? 'Agregar al banco' : 'Agregar pregunta'}
            </button>
            <Link
              href="/admin/exams"
              className="px-6 py-3 rounded-lg border border-neutral-300 text-neutral-700 font-medium hover:bg-neutral-50"
            >
              Terminar
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
