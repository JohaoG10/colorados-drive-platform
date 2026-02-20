'use client';

import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getAuthHeaders, triggerSessionExpired } from '@/lib/api';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

const BLOOD_TYPES = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

const DAYS = ['', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

interface UserRow {
  id: string;
  email: string;
  full_name: string;
  role: string;
  course_id: string | null;
  cohort_id: string | null;
  cedula: string | null;
  citizenship: string | null;
  blood_type: string | null;
  schedule_id: string | null;
  total_amount: number | null;
  amount_paid: number | null;
  courses?: { name: string; code: string; price?: number } | null;
  cohorts?: { id: string; name: string; code: string } | null;
  course_schedules?: {
    id: string;
    day_of_week: number;
    start_time: string;
    instructors?: { id?: string; full_name: string; email: string | null } | null;
  } | null;
  created_at: string;
}

interface PaymentRow {
  id: string;
  amount: number;
  paid_at: string;
  note: string | null;
  created_at: string;
}

export default function AdminUsersPage() {
  const { token } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string; code: string; price?: number }[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string; code: string; course_id: string; courses?: { name: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [apiError, setApiError] = useState('');
  const [instructors, setInstructors] = useState<{ id: string; full_name: string; email: string | null; is_active: boolean }[]>([]);
  const [availableSlots, setAvailableSlots] = useState<{ day_of_week: number; start_time: string }[]>([]);
  const [editAvailableSlots, setEditAvailableSlots] = useState<{ day_of_week: number; start_time: string }[]>([]);
  const [form, setForm] = useState<{
    email: string; password: string; fullName: string; cedula: string; citizenship: string; bloodType: string;
    birthDate: string; address: string; phone: string; startDate: string; endDate: string; modality: string;
    role: 'admin' | 'student'; courseId: string; cohortId: string; instructorId: string; dayOfWeek: number; startTime: string;
    paymentType: 'full' | 'partial'; initialPaymentAmount: string;
  }>({
    email: '', password: '', fullName: '', cedula: '', citizenship: '', bloodType: '',
    birthDate: '', address: '', phone: '', startDate: '', endDate: '', modality: '',
    role: 'student', courseId: '', cohortId: '', instructorId: '', dayOfWeek: 0, startTime: '',
    paymentType: 'partial', initialPaymentAmount: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [userDetailModal, setUserDetailModal] = useState<UserRow | null>(null);
  const [userDetail, setUserDetail] = useState<{
    activity: { last_active_at: string | null; total_time_seconds: number } | null;
    examResults: { examTitle: string; score: number; passed: boolean; attemptId: string }[];
  } | null>(null);
  const [userPayments, setUserPayments] = useState<PaymentRow[]>([]);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentForm, setPaymentForm] = useState({ amount: '', note: '' });
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [activityModal, setActivityModal] = useState<{ userId: string; name: string } | null>(null);
  const [activity, setActivity] = useState<{ last_active_at: string | null; total_time_seconds: number } | null>(null);
  const [editModal, setEditModal] = useState<UserRow | null>(null);
  const [editForm, setEditForm] = useState<{ fullName: string; cedula: string; citizenship: string; bloodType: string; role: 'admin' | 'student'; courseId: string; cohortId: string; instructorId: string; dayOfWeek: number; startTime: string; password: string }>({
    fullName: '', cedula: '', citizenship: '', bloodType: '', role: 'student', courseId: '', cohortId: '', instructorId: '', dayOfWeek: 0, startTime: '', password: '',
  });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');

  const load = () => {
    if (!token) return;
    setApiError('');
    const headers = getAuthHeaders(token);
    const url = searchQuery.trim() ? `${API_URL}/api/admin/users?search=${encodeURIComponent(searchQuery.trim())}` : `${API_URL}/api/admin/users`;
    fetch(url, { headers })
      .then((r) => r.json().then((data) => ({ ok: r.ok, status: r.status, data })))
      .then(({ ok, status, data }) => {
        if (ok && Array.isArray(data)) {
          setUsers(data);
          setApiError('');
        } else {
          setUsers([]);
          if (status === 401) {
            triggerSessionExpired();
            return;
          }
          if (status === 403) setApiError('No tienes permiso.');
          else setApiError(data?.error || 'Error al cargar.');
        }
      })
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    if (token) {
      Promise.all([
        fetch(`${API_URL}/api/admin/courses`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
        fetch(`${API_URL}/api/admin/cohorts`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
        fetch(`${API_URL}/api/admin/instructors?active=true`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
      ]).then(([coursesData, cohortsData, instructorsData]) => {
        setCourses(Array.isArray(coursesData) ? coursesData : []);
        setCohorts(Array.isArray(cohortsData) ? cohortsData : []);
        setInstructors(Array.isArray(instructorsData) ? instructorsData : []);
      });
    }
  }, [token]);

  useEffect(() => {
    if (!token || !form.cohortId || !form.instructorId) {
      setAvailableSlots([]);
      return;
    }
    fetch(`${API_URL}/api/admin/available-slots?cohortId=${encodeURIComponent(form.cohortId)}&instructorId=${encodeURIComponent(form.instructorId)}`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then((data) => setAvailableSlots(Array.isArray(data?.slots) ? data.slots : []))
      .catch(() => setAvailableSlots([]));
  }, [token, form.cohortId, form.instructorId]);

  useEffect(() => {
    if (!token || !editModal || !editForm.cohortId || !editForm.instructorId) {
      setEditAvailableSlots([]);
      return;
    }
    fetch(`${API_URL}/api/admin/available-slots?cohortId=${encodeURIComponent(editForm.cohortId)}&instructorId=${encodeURIComponent(editForm.instructorId)}`, { headers: getAuthHeaders(token) })
      .then((r) => r.json())
      .then((data) => {
        const slots = Array.isArray(data?.slots) ? data.slots : [];
        const current = editForm.dayOfWeek && editForm.startTime ? [{ day_of_week: editForm.dayOfWeek, start_time: editForm.startTime }] : [];
        const currentKey = `${editForm.dayOfWeek}-${editForm.startTime}`;
        const inSlots = slots.some((s: { day_of_week: number; start_time: string }) => `${s.day_of_week}-${s.start_time}` === currentKey);
        setEditAvailableSlots(inSlots ? slots : [...current, ...slots]);
      })
      .catch(() => setEditAvailableSlots([]));
  }, [token, editModal, editForm.cohortId, editForm.instructorId, editForm.dayOfWeek, editForm.startTime]);

  useEffect(() => {
    if (activityModal && token) {
      fetch(`${API_URL}/api/admin/users/${activityModal.userId}/activity`, { headers: getAuthHeaders(token) })
        .then((r) => r.json())
        .then(setActivity)
        .catch(() => setActivity(null));
    } else {
      setActivity(null);
    }
  }, [activityModal, token]);

  useEffect(() => {
    if (!userDetailModal || !token) {
      setUserDetail(null);
      setUserPayments([]);
      setShowPaymentForm(false);
      setPaymentForm({ amount: '', note: '' });
      return;
    }
    Promise.all([
      fetch(`${API_URL}/api/admin/users/${userDetailModal.id}/activity`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
      fetch(`${API_URL}/api/admin/users/${userDetailModal.id}/exam-results`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
      fetch(`${API_URL}/api/admin/users/${userDetailModal.id}/payments`, { headers: getAuthHeaders(token) }).then((r) => r.json()),
    ]).then(([activityData, examData, paymentsData]) => {
      setUserDetail({
        activity: activityData && typeof activityData === 'object' ? { last_active_at: activityData.last_active_at ?? null, total_time_seconds: activityData.total_time_seconds ?? 0 } : null,
        examResults: Array.isArray(examData) ? examData : [],
      });
      setUserPayments(Array.isArray(paymentsData) ? paymentsData : []);
    }).catch(() => { setUserDetail(null); setUserPayments([]); });
  }, [userDetailModal, token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    if (form.role === 'student' && !form.cohortId) {
      setError('Selecciona el tipo de curso y el número. Si no hay cursos, créalos en Cursos y materias.');
      return;
    }
    if (form.role === 'student' && (!form.instructorId || !form.dayOfWeek || !form.startTime)) {
      setError('Selecciona instructor y un horario disponible (día y hora).');
      return;
    }
    const courseForPrice = form.courseId ? courses.find((c) => c.id === form.courseId) : null;
    const totalPrice = courseForPrice && typeof (courseForPrice as { price?: number }).price === 'number' ? (courseForPrice as { price?: number }).price! : 0;
    const initialPaymentAmount = form.role === 'student' && totalPrice != null
      ? (form.paymentType === 'full' ? totalPrice : (parseFloat(form.initialPaymentAmount) || 0))
      : undefined;
    try {
      const body: Record<string, unknown> = {
        email: form.email,
        password: form.password,
        fullName: form.fullName,
        cedula: form.cedula.trim() || null,
        citizenship: form.citizenship.trim() || null,
        bloodType: form.bloodType || null,
        birthDate: form.role === 'student' ? (form.birthDate.trim() || null) : null,
        address: form.role === 'student' ? (form.address.trim() || null) : null,
        phone: form.role === 'student' ? (form.phone.trim() || null) : null,
        startDate: form.role === 'student' ? (form.startDate.trim() || null) : null,
        endDate: form.role === 'student' ? (form.endDate.trim() || null) : null,
        modality: form.role === 'student' ? (form.modality || null) : null,
        role: form.role,
        cohortId: form.role === 'student' ? form.cohortId || null : null,
        instructorId: form.role === 'student' ? form.instructorId || null : null,
        dayOfWeek: form.role === 'student' ? form.dayOfWeek : null,
        startTime: form.role === 'student' ? form.startTime || null : null,
      };
      if (form.role === 'student' && initialPaymentAmount !== undefined) {
        body.initialPaymentAmount = initialPaymentAmount;
      }
      const res = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token!), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data.error || 'Error');
      setSuccess('Usuario creado');
      setForm({ email: '', password: '', fullName: '', cedula: '', citizenship: '', bloodType: '', birthDate: '', address: '', phone: '', startDate: '', endDate: '', modality: '', role: 'student', courseId: '', cohortId: '', instructorId: '', dayOfWeek: 0, startTime: '', paymentType: 'partial', initialPaymentAmount: '' });
      setShowForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    }
  };

  const submitPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userDetailModal || !token) return;
    const amount = parseFloat(paymentForm.amount);
    if (Number.isNaN(amount) || amount <= 0) return;
    setPaymentSubmitting(true);
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${userDetailModal.id}/payments`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, note: paymentForm.note.trim() || null }),
      });
      const data = await res.json();
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data.error || 'Error al registrar');
      setUserPayments((prev) => [...prev, data]);
      setUserDetailModal((prev) => (prev ? { ...prev, amount_paid: (Number(prev.amount_paid) || 0) + amount } : null));
      setPaymentForm({ amount: '', note: '' });
      setShowPaymentForm(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const getAssignation = (u: UserRow) => {
    if (u.cohorts) return `${u.courses?.name || 'Curso'} Nro ${u.cohorts.name}`;
    if (u.courses) return `${u.courses.name} Nro ${u.courses.code}`;
    return '-';
  };

  const getScheduleLabel = (u: UserRow) => {
    const s = u.course_schedules;
    if (!s) return '-';
    const day = DAYS[s.day_of_week] || '';
    const time = typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time;
    const inst = s.instructors?.full_name || '';
    return day ? `${day} ${time}${inst ? ` (${inst})` : ''}` : '-';
  };

  const openEdit = (u: UserRow) => {
    setEditModal(u);
    const cohort = cohorts.find((c) => c.id === u.cohort_id);
    const s = u.course_schedules;
    setEditForm({
      fullName: u.full_name || '',
      cedula: u.cedula || '',
      citizenship: u.citizenship || '',
      bloodType: u.blood_type || '',
      role: (u.role as 'admin' | 'student') || 'student',
      courseId: cohort?.course_id || '',
      cohortId: u.cohort_id || '',
      instructorId: s?.instructors?.id ? String(s.instructors.id) : '',
      dayOfWeek: s?.day_of_week ?? 0,
      startTime: s?.start_time ? (typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : String(s.start_time)) : '',
      password: '',
    });
    setEditError('');
    setEditSuccess('');
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editModal || !token) return;
    setEditError('');
    setEditSuccess('');
    if (editForm.role === 'student' && !editForm.cohortId) {
      setEditError('Selecciona el tipo de curso y el número');
      return;
    }
    if (editForm.role === 'student' && (!editForm.instructorId || !editForm.dayOfWeek || !editForm.startTime)) {
      setEditError('Selecciona instructor y un horario disponible.');
      return;
    }
    try {
      const body: { fullName?: string; role?: string; cohortId?: string | null; cedula?: string | null; instructorId?: string; dayOfWeek?: number; startTime?: string; citizenship?: string | null; bloodType?: string | null; password?: string } = {
        fullName: editForm.fullName,
        role: editForm.role,
        cohortId: editForm.cohortId || null,
        cedula: editForm.cedula.trim() || null,
        instructorId: editForm.role === 'student' ? editForm.instructorId || undefined : undefined,
        dayOfWeek: editForm.role === 'student' ? editForm.dayOfWeek : undefined,
        startTime: editForm.role === 'student' ? editForm.startTime || undefined : undefined,
        citizenship: editForm.citizenship.trim() || null,
        bloodType: editForm.bloodType || null,
      };
      if (editForm.password.trim()) body.password = editForm.password;
      const res = await fetch(`${API_URL}/api/admin/users/${editModal.id}`, {
        method: 'PATCH',
        headers: { ...getAuthHeaders(token), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) throw new Error(data.error || 'Error');
      setEditSuccess('Usuario actualizado');
      setEditModal(null);
      load();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Error');
    }
  };

  const deleteUser = async (u: UserRow) => {
    if (!confirm(`¿Eliminar usuario ${u.full_name || u.email}? Esta acción no se puede deshacer.`)) return;
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/api/admin/users/${u.id}`, { method: 'DELETE', headers: getAuthHeaders(token) });
      if (res.status === 401) { triggerSessionExpired(); return; }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error');
      load();
    } catch (err) {
      setApiError(err instanceof Error ? err.message : 'Error al eliminar');
    }
  };

  const formatTime = (sec: number) => {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return h > 0 ? `${h}h ${m}m` : `${m} min`;
  };

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-600 to-red-700 p-6 text-white shadow-xl shadow-red-600/20">
        <div className="relative z-10">
          <h2 className="text-xl font-bold mb-1">Usuarios</h2>
          <p className="text-red-100 text-sm">Crea y gestiona cuentas de estudiantes y administradores.</p>
        </div>
      </div>

      {apiError && (
        <div className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 flex items-center gap-2">
          <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {apiError}
        </div>
      )}
      <div className="flex flex-wrap justify-between items-center gap-4">
        <div className="flex gap-2 flex-1 min-w-0">
          <form
            onSubmit={(e) => { e.preventDefault(); setLoading(true); load(); }}
            className="flex gap-2 flex-1 min-w-0"
          >
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cédula, nombre o email..."
              className="px-4 py-2.5 rounded-xl border border-neutral-200 min-w-[200px] focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none transition-all"
            />
            <button type="submit" className="px-4 py-2.5 rounded-xl border border-neutral-200 font-medium hover:bg-neutral-50 transition-colors">
              Buscar
            </button>
          </form>
          <button
            onClick={() => setShowForm(!showForm)}
            className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 shadow-md shadow-red-600/20 hover:shadow-red-600/30 transition-all shrink-0"
          >
            {showForm ? 'Cancelar' : 'Crear usuario'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-lg">
          <div className="border-b border-neutral-100 bg-neutral-50/80 px-6 py-4">
            <h3 className="text-lg font-semibold text-neutral-900">Nuevo usuario</h3>
            <p className="text-sm text-neutral-500">Completa los datos para dar de alta una cuenta.</p>
          </div>
          <div className="p-6 space-y-8">
            {error && (
              <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                <svg className="h-5 w-5 shrink-0 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                {error}
              </div>
            )}
            {success && (
              <div className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
                <svg className="h-5 w-5 shrink-0 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                {success}
              </div>
            )}

            <section>
              <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </span>
                Datos personales
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">Nombre completo *</label>
                  <input type="text" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Ej: María García" className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">Cédula</label>
                  <input type="text" value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="Ej: 1234567890" className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">Ciudadanía</label>
                  <input type="text" value={form.citizenship} onChange={(e) => setForm({ ...form, citizenship: e.target.value })} placeholder="Ej: Ecuatoriana" className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">Tipo de sangre</label>
                  <select value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0">
                    <option value="">Seleccionar</option>
                    {BLOOD_TYPES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
              </div>
            </section>

            {form.role === 'student' && (
              <section className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
                <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-600">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </span>
                  Datos de inscripción
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">Fecha de nacimiento</label>
                    <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">Teléfono</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Ej: 0991234567" className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">Dirección</label>
                    <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ej: Av. Principal 123, ciudad" className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">Fecha de inicio</label>
                    <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">Fecha de término</label>
                    <input type="date" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">Modalidad</label>
                    <select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })} className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0">
                      <option value="">Seleccionar</option>
                      <option value="intensivo">Intensivo</option>
                      <option value="regular">Regular</option>
                      <option value="fin de semana">Fin de semana</option>
                    </select>
                  </div>
                </div>
              </section>
            )}

            <section className="border-t border-neutral-100 pt-8">
              <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-500">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </span>
                Acceso
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">Email *</label>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="usuario@ejemplo.com" className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">Contraseña temporal *</label>
                  <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 placeholder:text-neutral-400 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-neutral-700">Rol *</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'student', courseId: '', cohortId: '', instructorId: '', dayOfWeek: 0, startTime: '' })} className="w-full rounded-xl border border-neutral-200 px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0">
                    <option value="admin">Administrador</option>
                    <option value="student">Estudiante</option>
                  </select>
                </div>
              </div>
            </section>
            {form.role === 'student' && (
              <section className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
                <h4 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wider text-neutral-600">
                  <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-100 text-red-600">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  Curso y horario
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">Tipo de curso *</label>
                    <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value, cohortId: '', instructorId: '', dayOfWeek: 0, startTime: '' })} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" required>
                      <option value="">Elegir tipo</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {courses.length === 0 && <p className="mt-1 text-xs text-amber-600">Crea un curso en Cursos y materias.</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">Número de curso *</label>
                    <select value={form.cohortId} onChange={(e) => setForm({ ...form, cohortId: e.target.value, instructorId: '', dayOfWeek: 0, startTime: '' })} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" required disabled={!form.courseId}>
                      <option value="">Elegir número</option>
                      {cohorts.filter((c) => c.course_id === form.courseId).map((c) => (
                        <option key={c.id} value={c.id}>Nro {c.name}</option>
                      ))}
                    </select>
                    {form.courseId && cohorts.filter((c) => c.course_id === form.courseId).length === 0 && <p className="mt-1 text-xs text-amber-600">Crea un número en Cursos y materias.</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">Instructor *</label>
                    <select value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value, dayOfWeek: 0, startTime: '' })} className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0" required disabled={!form.cohortId}>
                      <option value="">Elegir instructor</option>
                      {instructors.map((i) => (
                        <option key={i.id} value={i.id}>{i.full_name}</option>
                      ))}
                    </select>
                    {form.cohortId && instructors.length === 0 && <p className="mt-1 text-xs text-amber-600">Crea instructores en Instructores.</p>}
                  </div>
                  <div>
                    <label className="mb-1.5 block text-sm font-medium text-neutral-700">Horario disponible *</label>
                    <select
                      value={form.dayOfWeek && form.startTime ? `${form.dayOfWeek}-${form.startTime}` : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) { setForm({ ...form, dayOfWeek: 0, startTime: '' }); return; }
                        const [d, t] = v.split('-');
                        setForm({ ...form, dayOfWeek: Number(d), startTime: t });
                      }}
                      className="w-full rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-neutral-900 focus:border-red-500 focus:ring-2 focus:ring-red-500/20 focus:ring-offset-0"
                      required
                      disabled={!form.instructorId || availableSlots.length === 0}
                    >
                      <option value="">Día y hora (6:00 - 23:00)</option>
                      {availableSlots.map((s) => (
                        <option key={`${s.day_of_week}-${s.start_time}`} value={`${s.day_of_week}-${s.start_time}`}>
                          {DAYS[s.day_of_week]} {typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time}
                        </option>
                      ))}
                    </select>
                    {form.instructorId && availableSlots.length === 0 && <p className="mt-1 text-xs text-amber-600">No hay horarios libres. Elige otro instructor.</p>}
                  </div>
                </div>
                {form.courseId && (
                  <div className="mt-4 rounded-xl border border-neutral-200 bg-white p-4">
                    <h5 className="mb-2 text-sm font-semibold text-neutral-700">Pago del curso</h5>
                    {(() => {
                      const course = courses.find((c) => c.id === form.courseId);
                      const totalPrice = course && typeof (course as { price?: number }).price === 'number' ? (course as { price?: number }).price! : 0;
                      return (
                        <>
                          <p className="mb-3 text-sm text-neutral-600">Total del curso: <span className="font-semibold text-neutral-900">${totalPrice.toFixed(2)}</span></p>
                          <div className="flex flex-wrap gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="paymentType" checked={form.paymentType === 'full'} onChange={() => setForm({ ...form, paymentType: 'full', initialPaymentAmount: totalPrice ? String(totalPrice) : '' })} className="rounded border-neutral-300 text-red-600 focus:ring-red-500" />
                              <span className="text-sm font-medium text-neutral-800">Paga todo</span>
                            </label>
                            <label className="flex items-center gap-2 cursor-pointer">
                              <input type="radio" name="paymentType" checked={form.paymentType === 'partial'} onChange={() => setForm({ ...form, paymentType: 'partial' })} className="rounded border-neutral-300 text-red-600 focus:ring-red-500" />
                              <span className="text-sm font-medium text-neutral-800">Abona</span>
                            </label>
                            {form.paymentType === 'partial' && (
                              <span className="flex items-center gap-2">
                                <span className="text-sm text-neutral-600">$</span>
                                <input type="number" min="0" step="0.01" value={form.initialPaymentAmount} onChange={(e) => setForm({ ...form, initialPaymentAmount: e.target.value })} placeholder="0.00" className="w-28 rounded-lg border border-neutral-200 px-3 py-1.5 text-sm focus:border-red-500 focus:ring-1 focus:ring-red-500" />
                              </span>
                            )}
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </section>
            )}

            <div className="flex flex-wrap items-center gap-3 border-t border-neutral-100 pt-6">
              <button type="submit" className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-5 py-2.5 font-medium text-white shadow-md shadow-red-600/25 transition-all hover:bg-red-700 hover:shadow-red-600/30">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Crear usuario
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-neutral-200 px-5 py-2.5 font-medium text-neutral-700 transition-colors hover:bg-neutral-50">
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="bg-white rounded-2xl border border-neutral-200 overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px]">
            <thead className="bg-neutral-50/80 border-b border-neutral-100">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Usuario</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Cédula</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Rol</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Curso</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Horario</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Debe</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Actividad</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700">Registro</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-neutral-700 w-40">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-neutral-100 hover:bg-neutral-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium">{u.full_name || u.email}</p>
                    <p className="text-sm text-neutral-500">{u.email}</p>
                  </td>
                  <td className="px-6 py-4 text-neutral-600">{u.cedula || '-'}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-medium ${u.role === 'admin' ? 'bg-red-100 text-red-800' : 'bg-neutral-100'}`}>{u.role}</span>
                  </td>
                  <td className="px-6 py-4 text-neutral-600">{getAssignation(u)}</td>
                  <td className="px-6 py-4 text-neutral-600 text-sm">{u.role === 'student' ? getScheduleLabel(u) : '-'}</td>
                  <td className="px-6 py-4 text-neutral-600 text-sm">
                    {u.role === 'student' && (u.total_amount != null || u.amount_paid != null)
                      ? `$${Math.max(0, (Number(u.total_amount) || 0) - (Number(u.amount_paid) || 0)).toFixed(2)}`
                      : '-'}
                  </td>
                  <td className="px-6 py-4">
                    {u.role === 'student' && (
                      <button onClick={() => setActivityModal({ userId: u.id, name: u.full_name || u.email })} className="text-red-600 hover:underline text-sm">
                        Ver actividad
                      </button>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm text-neutral-500">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button onClick={() => setUserDetailModal(u)} className="inline-flex items-center gap-1 text-red-600 hover:underline text-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Ver todo
                      </button>
                      <button onClick={() => openEdit(u)} className="text-red-600 hover:underline text-sm">Editar</button>
                      <button onClick={() => deleteUser(u)} className="text-neutral-600 hover:underline text-sm">Eliminar</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            </table>
          </div>
        )}
      </div>

      {activityModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setActivityModal(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-neutral-900 mb-4">Actividad: {activityModal.name}</h3>
            {activity ? (
              <div className="space-y-2">
                <p><span className="text-neutral-500">Última actividad:</span> {activity.last_active_at ? new Date(activity.last_active_at).toLocaleString() : 'N/A'}</p>
                <p><span className="text-neutral-500">Tiempo en plataforma:</span> {formatTime(activity.total_time_seconds || 0)}</p>
              </div>
            ) : (
              <p className="text-neutral-500">Cargando...</p>
            )}
            <button onClick={() => setActivityModal(null)} className="mt-4 px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50 transition-colors">Cerrar</button>
          </div>
        </div>
      )}

      {userDetailModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setUserDetailModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center bg-neutral-50/50">
              <h3 className="font-semibold text-neutral-900">Información del usuario</h3>
              <button type="button" onClick={() => setUserDetailModal(null)} className="text-neutral-500 hover:text-neutral-700 p-1">✕</button>
            </div>
            <div className="p-6 overflow-auto flex-1 space-y-6">
              <div>
                <p className="font-medium text-neutral-900">{userDetailModal.full_name || userDetailModal.email}</p>
                <p className="text-sm text-neutral-500">{userDetailModal.email}</p>
                {userDetailModal.cedula && <p className="text-sm text-neutral-600 mt-1">Cédula: {userDetailModal.cedula}</p>}
                {userDetailModal.citizenship && <p className="text-sm text-neutral-600">Ciudadanía: {userDetailModal.citizenship}</p>}
                {userDetailModal.blood_type && <p className="text-sm text-neutral-600">Tipo de sangre: {userDetailModal.blood_type}</p>}
                <p className="text-sm mt-1">{getAssignation(userDetailModal)}</p>
                {userDetailModal.role === 'student' && <p className="text-sm text-neutral-600">Horario: {getScheduleLabel(userDetailModal)}</p>}
              </div>
              {userDetail ? (
                <>
                  <div>
                    <h4 className="font-medium text-neutral-800 mb-2">Actividad</h4>
                    <p className="text-sm text-neutral-600">
                      Última actividad: {userDetail.activity?.last_active_at ? new Date(userDetail.activity.last_active_at).toLocaleString() : 'N/A'}
                    </p>
                    <p className="text-sm text-neutral-600">
                      Tiempo en plataforma: {formatTime(userDetail.activity?.total_time_seconds || 0)}
                    </p>
                  </div>
                  <div>
                    <h4 className="font-medium text-neutral-800 mb-2">Resultados de exámenes</h4>
                    {userDetail.examResults?.length ? (
                      <ul className="space-y-1">
                        {userDetail.examResults.map((e, i) => (
                          <li key={i} className={`text-sm flex items-center gap-2 ${e.passed ? 'text-green-600' : 'text-red-600'}`}>
                            {e.examTitle}: {e.score?.toFixed(0)}% {e.passed ? '✓ Aprobado' : '✗ No aprobado'}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-neutral-500">Sin exámenes realizados</p>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-neutral-500">Cargando...</p>
              )}
              {userDetailModal.role === 'student' && (userDetailModal.total_amount != null || userDetailModal.amount_paid != null) && (
                <div className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-4">
                  <h4 className="font-medium text-neutral-800 mb-3">Pagos del curso</h4>
                  <div className="grid grid-cols-3 gap-2 text-sm mb-3">
                    <div><span className="text-neutral-500">Total:</span> <span className="font-medium">${(Number(userDetailModal.total_amount) || 0).toFixed(2)}</span></div>
                    <div><span className="text-neutral-500">Abonado:</span> <span className="font-medium text-green-700">${(Number(userDetailModal.amount_paid) || 0).toFixed(2)}</span></div>
                    <div><span className="text-neutral-500">Debe:</span> <span className="font-medium text-red-700">${Math.max(0, (Number(userDetailModal.total_amount) || 0) - (Number(userDetailModal.amount_paid) || 0)).toFixed(2)}</span></div>
                  </div>
                  {userPayments.length > 0 && (
                    <ul className="mb-3 space-y-1 text-sm">
                      {userPayments.map((p) => (
                        <li key={p.id} className="flex justify-between text-neutral-700">
                          <span>${(p.amount).toFixed(2)} {p.note ? `— ${p.note}` : ''}</span>
                          <span className="text-neutral-500">{new Date(p.paid_at).toLocaleDateString()}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  {!showPaymentForm ? (
                    <button type="button" onClick={() => setShowPaymentForm(true)} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700">Registrar abono</button>
                  ) : (
                    <form onSubmit={submitPayment} className="space-y-2">
                      <div className="flex flex-wrap gap-2 items-end">
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 mb-0.5">Monto ($)</label>
                          <input type="number" min="0.01" step="0.01" required value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} className="w-24 rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
                        </div>
                        <div className="flex-1 min-w-[120px]">
                          <label className="block text-xs font-medium text-neutral-600 mb-0.5">Nota (opcional)</label>
                          <input type="text" value={paymentForm.note} onChange={(e) => setPaymentForm({ ...paymentForm, note: e.target.value })} placeholder="Ej. Abono inicial" className="w-full rounded-lg border border-neutral-200 px-2 py-1.5 text-sm" />
                        </div>
                        <div className="flex gap-1">
                          <button type="submit" disabled={paymentSubmitting} className="px-3 py-2 rounded-lg bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50">Guardar</button>
                          <button type="button" onClick={() => { setShowPaymentForm(false); setPaymentForm({ amount: '', note: '' }); }} className="px-3 py-2 rounded-lg border border-neutral-200 text-sm hover:bg-neutral-50">Cancelar</button>
                        </div>
                      </div>
                    </form>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => { setUserDetailModal(null); openEdit(userDetailModal); }} className="px-4 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 shadow-md transition-all">
                  Editar usuario
                </button>
                <button onClick={() => setUserDetailModal(null)} className="px-4 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Editar usuario: {editModal.email}</h3>
            {editError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm mb-4">{editError}</div>}
            {editSuccess && <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm mb-4">{editSuccess}</div>}
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Nombre completo</label>
                <input type="text" required value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="w-full px-4 py-2 rounded-lg border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Número de cédula</label>
                <input type="text" value={editForm.cedula} onChange={(e) => setEditForm({ ...editForm, cedula: e.target.value })} placeholder="Ej: 1234567890" className="w-full px-4 py-2 rounded-lg border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ciudadanía</label>
                <input type="text" value={editForm.citizenship} onChange={(e) => setEditForm({ ...editForm, citizenship: e.target.value })} placeholder="Ej: Ecuatoriana" className="w-full px-4 py-2 rounded-lg border" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tipo de sangre</label>
                <select value={editForm.bloodType} onChange={(e) => setEditForm({ ...editForm, bloodType: e.target.value })} className="w-full px-4 py-2 rounded-lg border">
                  <option value="">Seleccionar</option>
                  {BLOOD_TYPES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rol</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'student', courseId: '', cohortId: '', instructorId: '', dayOfWeek: 0, startTime: '' })} className="w-full px-4 py-2 rounded-lg border">
                  <option value="admin">Admin</option>
                  <option value="student">Estudiante</option>
                </select>
              </div>
              {editForm.role === 'student' && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Tipo de curso</label>
                    <select value={editForm.courseId} onChange={(e) => setEditForm({ ...editForm, courseId: e.target.value, cohortId: '' })} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none" required>
                      <option value="">Elegir tipo</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Número de curso</label>
                    <select value={editForm.cohortId} onChange={(e) => setEditForm({ ...editForm, cohortId: e.target.value, instructorId: '', dayOfWeek: 0, startTime: '' })} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none" required disabled={!editForm.courseId}>
                      <option value="">Elegir número</option>
                      {cohorts.filter((c) => c.course_id === editForm.courseId).map((c) => (
                        <option key={c.id} value={c.id}>Nro {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Instructor</label>
                    <select value={editForm.instructorId} onChange={(e) => setEditForm({ ...editForm, instructorId: e.target.value, dayOfWeek: 0, startTime: '' })} className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none" disabled={!editForm.cohortId}>
                      <option value="">Elegir instructor</option>
                      {instructors.map((i) => (
                        <option key={i.id} value={i.id}>{i.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">Horario (día y hora)</label>
                    <select
                      value={editForm.dayOfWeek && editForm.startTime ? `${editForm.dayOfWeek}-${editForm.startTime}` : ''}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) { setEditForm({ ...editForm, dayOfWeek: 0, startTime: '' }); return; }
                        const [d, t] = v.split('-');
                        setEditForm({ ...editForm, dayOfWeek: Number(d), startTime: t });
                      }}
                      className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none"
                      disabled={!editForm.instructorId}
                    >
                      <option value="">Elegir día y hora</option>
                      {editAvailableSlots.map((s) => (
                        <option key={`${s.day_of_week}-${s.start_time}`} value={`${s.day_of_week}-${s.start_time}`}>
                          {DAYS[s.day_of_week]} {typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}
              <div>
                <label className="block text-sm font-medium text-neutral-700 mb-1">Nueva contraseña (opcional)</label>
                <input type="password" minLength={6} value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Dejar en blanco para no cambiar" className="w-full px-4 py-2.5 rounded-xl border border-neutral-200 focus:ring-2 focus:ring-red-500/20 focus:border-red-500 outline-none" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="px-5 py-2.5 rounded-xl bg-red-600 text-white font-medium hover:bg-red-700 shadow-md transition-all">Guardar</button>
                <button type="button" onClick={() => setEditModal(null)} className="px-5 py-2.5 rounded-xl border border-neutral-200 hover:bg-neutral-50">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
