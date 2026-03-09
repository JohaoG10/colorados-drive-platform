'use client';

import { useEffect, useState, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
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
  gender?: string | null;
  citizenship: string | null;
  blood_type: string | null;
  schedule_id: string | null;
  total_amount: number | null;
  amount_paid: number | null;
  birth_date?: string | null;
  address?: string | null;
  phone?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  modality?: string | null;
  courses?: { name: string; code: string; price?: number } | null;
  cohorts?: { id: string; name: string; code: string } | null;
  course_schedules?: {
    id: string;
    day_of_week: number;
    start_time: string;
    schedule_label?: string;
    instructors?: { id?: string; full_name: string; email: string | null } | null;
  } | null;
  practice_weeks?: number | null;
  practice_start_date?: string | null;
  practice_end_date?: string | null;
  practice_hours_per_day?: number | null;
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
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [courses, setCourses] = useState<{ id: string; name: string; code: string; price?: number }[]>([]);
  const [cohorts, setCohorts] = useState<{ id: string; name: string; code: string; course_id: string; courses?: { name: string } }[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [apiError, setApiError] = useState('');
  const [instructors, setInstructors] = useState<{ id: string; full_name: string; email: string | null; is_active: boolean }[]>([]);
  const [availableSlots, setAvailableSlots] = useState<{ day_of_week: number; start_time: string }[]>([]);
  const [availableStartBlocks, setAvailableStartBlocks] = useState<{ start_time: string; end_time: string }[]>([]);
  const [editAvailableSlots, setEditAvailableSlots] = useState<{ day_of_week: number; start_time: string }[]>([]);
  const [editAvailableStartBlocks, setEditAvailableStartBlocks] = useState<{ start_time: string; end_time: string }[]>([]);
  const [filterCohortId, setFilterCohortId] = useState('');
  const [filterRole, setFilterRole] = useState<'student' | 'instructor' | 'admin' | ''>('student');
  const [form, setForm] = useState<{
    email: string; password: string; fullName: string; cedula: string; gender: string; citizenship: string; bloodType: string;
    birthDate: string; address: string; phone: string; startDate: string; endDate: string; modality: string;
    practiceStartDate: string; practiceEndDate: string;
    role: 'admin' | 'student'; courseId: string; cohortId: string; instructorId: string;
    scheduleType: 'single' | 'weekdays' | 'weekends'; dayOfWeek: number; startTime: string; practiceWeeks: 1 | 2 | 3 | '';
    practiceHoursPerDay: 1 | 2 | 3 | 4;
    paymentType: 'full' | 'partial'; initialPaymentAmount: string;
  }>({
    email: '', password: '', fullName: '', cedula: '', gender: '', citizenship: '', bloodType: '',
    birthDate: '', address: '', phone: '', startDate: '', endDate: '', modality: '',
    practiceStartDate: '', practiceEndDate: '',
    role: 'student', courseId: '', cohortId: '', instructorId: '', scheduleType: 'weekdays', dayOfWeek: 0, startTime: '', practiceWeeks: '',
    practiceHoursPerDay: 1,
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
  const [editForm, setEditForm] = useState<{
    fullName: string; cedula: string; gender: string; citizenship: string; bloodType: string;
    role: 'admin' | 'student'; courseId: string; cohortId: string; instructorId: string;
    scheduleType: 'single' | 'weekdays' | 'weekends'; dayOfWeek: number; startTime: string;
    practiceWeeks: 1 | 2 | 3 | ''; practiceStartDate: string; practiceEndDate: string;
    practiceHoursPerDay: 1 | 2 | 3 | 4;
    birthDate: string; address: string; phone: string; startDate: string; endDate: string; modality: string;
    password: string;
  }>({
    fullName: '', cedula: '', gender: '', citizenship: '', bloodType: '',
    role: 'student', courseId: '', cohortId: '', instructorId: '', scheduleType: 'weekdays', dayOfWeek: 0, startTime: '', practiceWeeks: '',
    practiceStartDate: '', practiceEndDate: '',
    practiceHoursPerDay: 1,
    birthDate: '', address: '', phone: '', startDate: '', endDate: '', modality: '',
    password: '',
  });
  const [editError, setEditError] = useState('');
  const [editSuccess, setEditSuccess] = useState('');
  const appliedEnrollmentParamsRef = useRef(false);

  const load = (roleOverride?: 'student' | 'instructor' | 'admin' | '') => {
    if (!token) return;
    setApiError('');
    const headers = getAuthHeaders(token);
    const params = new URLSearchParams();
    const effectiveRole = roleOverride !== undefined ? roleOverride : filterRole;
    if (searchQuery.trim()) params.set('search', searchQuery.trim());
    if (effectiveRole) params.set('role', effectiveRole);
    if (effectiveRole === 'student' || effectiveRole === '') {
      if (filterCohortId) params.set('cohortId', filterCohortId);
    }
    const url = params.toString() ? `${API_URL}/api/admin/users?${params.toString()}` : `${API_URL}/api/admin/users`;
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

  /** Prellenar formulario de inscripción desde Horarios por curso (query params). */
  useEffect(() => {
    if (appliedEnrollmentParamsRef.current) return;
    const cohortId = searchParams.get('cohortId');
    const instructorId = searchParams.get('instructorId');
    const scheduleType = searchParams.get('scheduleType') as 'weekdays' | 'weekends' | 'single' | null;
    const startTime = searchParams.get('startTime');
    if (!cohortId || !instructorId || !startTime || cohorts.length === 0) return;
    const cohort = cohorts.find((c) => c.id === cohortId);
    if (!cohort) return;
    appliedEnrollmentParamsRef.current = true;
    setForm((prev) => ({
      ...prev,
      role: 'student',
      courseId: cohort.course_id,
      cohortId,
      instructorId,
      scheduleType: scheduleType === 'weekdays' || scheduleType === 'weekends' || scheduleType === 'single' ? scheduleType : 'weekdays',
      startTime: startTime.slice(0, 5),
      dayOfWeek: 0,
    }));
    setShowForm(true);
  }, [searchParams, cohorts]);

  useEffect(() => {
    if (!token || !form.cohortId || !form.instructorId) {
      setAvailableSlots([]);
      setAvailableStartBlocks([]);
      return;
    }
    const scheduleType = form.scheduleType === 'weekdays' || form.scheduleType === 'weekends' ? form.scheduleType : null;
    const hoursPerDay = form.practiceHoursPerDay ?? 1;
    if (scheduleType) {
      const url = `${API_URL}/api/admin/available-slots?cohortId=${encodeURIComponent(form.cohortId)}&instructorId=${encodeURIComponent(form.instructorId)}&scheduleType=${scheduleType}&hoursPerDay=${hoursPerDay}`;
      fetch(url, { headers: getAuthHeaders(token) })
        .then((r) => r.json())
        .then((data) => setAvailableStartBlocks(Array.isArray(data?.slots) ? data.slots : []))
        .catch(() => setAvailableStartBlocks([]));
      setAvailableSlots([]);
    } else {
      fetch(`${API_URL}/api/admin/available-slots?cohortId=${encodeURIComponent(form.cohortId)}&instructorId=${encodeURIComponent(form.instructorId)}`, { headers: getAuthHeaders(token) })
        .then((r) => r.json())
        .then((data) => setAvailableSlots(Array.isArray(data?.slots) ? data.slots : []))
        .catch(() => setAvailableSlots([]));
      setAvailableStartBlocks([]);
    }
  }, [token, form.cohortId, form.instructorId, form.scheduleType, form.practiceHoursPerDay]);

  useEffect(() => {
    if (!token || !editModal || !editForm.cohortId || !editForm.instructorId) {
      setEditAvailableSlots([]);
      setEditAvailableStartBlocks([]);
      return;
    }
    const currentScheduleId = editModal?.schedule_id ?? undefined;
    const scheduleType = editForm.scheduleType === 'weekdays' || editForm.scheduleType === 'weekends' ? editForm.scheduleType : null;
    const hoursPerDay = editForm.practiceHoursPerDay ?? 1;
    if (scheduleType) {
      const q = `cohortId=${encodeURIComponent(editForm.cohortId)}&instructorId=${encodeURIComponent(editForm.instructorId)}&scheduleType=${scheduleType}&hoursPerDay=${hoursPerDay}${currentScheduleId ? `&currentScheduleId=${encodeURIComponent(currentScheduleId)}` : ''}`;
      fetch(`${API_URL}/api/admin/available-slots?${q}`, { headers: getAuthHeaders(token) })
        .then((r) => r.json())
        .then((data) => setEditAvailableStartBlocks(Array.isArray(data?.slots) ? data.slots : []))
        .catch(() => setEditAvailableStartBlocks([]));
      setEditAvailableSlots([]);
    } else {
      const q = `cohortId=${encodeURIComponent(editForm.cohortId)}&instructorId=${encodeURIComponent(editForm.instructorId)}${currentScheduleId ? `&currentScheduleId=${encodeURIComponent(currentScheduleId)}` : ''}`;
      fetch(`${API_URL}/api/admin/available-slots?${q}`, { headers: getAuthHeaders(token) })
        .then((r) => r.json())
        .then((data) => {
          const slots = Array.isArray(data?.slots) ? data.slots : [];
          const current = editForm.dayOfWeek && editForm.startTime ? [{ day_of_week: editForm.dayOfWeek, start_time: editForm.startTime }] : [];
          const currentKey = `${editForm.dayOfWeek}-${editForm.startTime}`;
          const inSlots = slots.some((s: { day_of_week: number; start_time: string }) => `${s.day_of_week}-${s.start_time}` === currentKey);
          setEditAvailableSlots(inSlots ? slots : [...current, ...slots]);
        })
        .catch(() => setEditAvailableSlots([]));
      setEditAvailableStartBlocks([]);
    }
  }, [token, editModal, editForm.cohortId, editForm.instructorId, editForm.dayOfWeek, editForm.startTime, editForm.scheduleType, editForm.practiceHoursPerDay]);

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
    if (!form.fullName.trim()) {
      setError('El nombre completo es requerido.');
      return;
    }
    if (!form.cedula.trim()) {
      setError('El número de cédula es requerido.');
      return;
    }
    const hasBlankOptionals = form.role === 'student' && (
      !form.cohortId ||
      !form.instructorId ||
      !form.startTime ||
      !form.birthDate.trim() ||
      !form.practiceStartDate.trim() ||
      !form.practiceEndDate.trim() ||
      !form.phone.trim() ||
      !form.address.trim()
    );
    if (hasBlankOptionals) {
      const proceed = window.confirm(
        'Hay datos opcionales sin completar (curso, horario, fechas de práctica, teléfono, dirección, etc.). ' +
        '¿Desea inscribir al alumno de todos modos? Podrá completar esta información más tarde al editar el usuario.'
      );
      if (!proceed) return;
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
        gender: form.gender === 'masculino' || form.gender === 'femenino' ? form.gender : null,
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
        dayOfWeek: form.role === 'student' && form.scheduleType === 'single' ? form.dayOfWeek : null,
        startTime: form.role === 'student' ? form.startTime || null : null,
        scheduleType: form.role === 'student' && (form.scheduleType === 'weekdays' || form.scheduleType === 'weekends') ? form.scheduleType : null,
        practiceWeeks: null,
        practiceStartDate: form.role === 'student' ? (form.practiceStartDate.trim() || null) : null,
        practiceEndDate: form.role === 'student' ? (form.practiceEndDate.trim() || null) : null,
      };
      if (form.role === 'student') {
        delete (body as Record<string, unknown>).startDate;
        delete (body as Record<string, unknown>).endDate;
      }
      if (form.role === 'student' && initialPaymentAmount !== undefined) {
        body.initialPaymentAmount = initialPaymentAmount;
      }
      if (form.role === 'student' && (form.practiceHoursPerDay ?? 1) >= 1 && (form.practiceHoursPerDay ?? 1) <= 4) {
        body.practiceHoursPerDay = form.practiceHoursPerDay ?? 1;
      }
      const res = await fetch(`${API_URL}/api/admin/users`, {
        method: 'POST',
        headers: { ...getAuthHeaders(token!), 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401) { triggerSessionExpired(); return; }
      if (!res.ok) {
        const msg = typeof data?.error === 'string' ? data.error : Array.isArray(data?.errors) ? data.errors.map((e: { msg?: string }) => e.msg || '').join('. ') : 'Error al crear usuario';
        throw new Error(msg);
      }
      setSuccess('Usuario creado');
      setForm({ email: '', password: '', fullName: '', cedula: '', gender: '', citizenship: '', bloodType: '', birthDate: '', address: '', phone: '', startDate: '', endDate: '', modality: '', practiceStartDate: '', practiceEndDate: '', role: 'student', courseId: '', cohortId: '', instructorId: '', scheduleType: 'weekdays', dayOfWeek: 0, startTime: '', practiceWeeks: '', practiceHoursPerDay: 1, paymentType: 'partial', initialPaymentAmount: '' });
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
    if (s.schedule_label) return `${s.schedule_label}${u.practice_weeks ? ` · ${u.practice_weeks} sem. práctica` : ''}`;
    const day = DAYS[s.day_of_week] || '';
    const time = typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : s.start_time;
    const inst = s.instructors?.full_name || '';
    return day ? `${day} ${time}${inst ? ` (${inst})` : ''}` : '-';
  };

  const openEdit = (u: UserRow) => {
    setEditModal(u);
    const cohort = cohorts.find((c) => c.id === u.cohort_id);
    const s = u.course_schedules;
    const hasGroup = s?.schedule_label && (s.schedule_label.startsWith('Lunes a Viernes') || s.schedule_label.startsWith('Sábado y Domingo'));
    setEditForm({
      fullName: (u.full_name || '').trim(),
      cedula: (u.cedula || '').trim(),
      gender: u.gender === 'masculino' || u.gender === 'femenino' ? u.gender : '',
      citizenship: (u.citizenship || '').trim(),
      bloodType: (u.blood_type || '').trim(),
      role: (u.role as 'admin' | 'student') || 'student',
      courseId: cohort?.course_id || '',
      cohortId: u.cohort_id || '',
      instructorId: s?.instructors?.id ? String(s.instructors.id) : '',
      scheduleType: hasGroup ? (s.schedule_label?.startsWith('Sábado') ? 'weekends' : 'weekdays') : 'single',
      dayOfWeek: s?.day_of_week ?? 0,
      startTime: s?.start_time ? (typeof s.start_time === 'string' ? s.start_time.slice(0, 5) : String(s.start_time)) : '',
      practiceWeeks: (u.practice_weeks === 1 || u.practice_weeks === 2 || u.practice_weeks === 3) ? u.practice_weeks : '',
      practiceHoursPerDay: (typeof u.practice_hours_per_day === 'number' && u.practice_hours_per_day >= 1 && u.practice_hours_per_day <= 4) ? u.practice_hours_per_day : 1,
      practiceStartDate: (u.practice_start_date ?? '').toString().slice(0, 10),
      practiceEndDate: (u.practice_end_date ?? '').toString().slice(0, 10),
      birthDate: (u.birth_date ?? '').toString().slice(0, 10),
      address: (u.address || '').trim(),
      phone: (u.phone || '').trim(),
      startDate: (u.start_date ?? '').toString().slice(0, 10),
      endDate: (u.end_date ?? '').toString().slice(0, 10),
      modality: (u.modality || '').trim(),
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
    if (!editForm.fullName.trim()) {
      setEditError('El nombre completo es requerido.');
      return;
    }
    try {
      const body: { fullName?: string; role?: string; cohortId?: string | null; cedula?: string | null; gender?: string | null; instructorId?: string; dayOfWeek?: number; startTime?: string; scheduleType?: string; practiceWeeks?: number; practiceHoursPerDay?: number; practiceStartDate?: string | null; practiceEndDate?: string | null; citizenship?: string | null; bloodType?: string | null; birthDate?: string | null; address?: string | null; phone?: string | null; startDate?: string | null; endDate?: string | null; modality?: string | null; password?: string } = {
        fullName: editForm.fullName.trim(),
        role: editForm.role,
        cohortId: editForm.cohortId || null,
        cedula: editForm.cedula.trim() || null,
        gender: editForm.gender === 'masculino' || editForm.gender === 'femenino' ? editForm.gender : null,
        instructorId: editForm.role === 'student' ? editForm.instructorId || undefined : undefined,
        dayOfWeek: editForm.role === 'student' && editForm.scheduleType === 'single' ? editForm.dayOfWeek : undefined,
        startTime: editForm.role === 'student' ? editForm.startTime || undefined : undefined,
        scheduleType: editForm.role === 'student' ? (editForm.scheduleType === 'single' ? (editForm.dayOfWeek >= 6 ? 'weekends' : 'weekdays') : (editForm.scheduleType === 'weekdays' || editForm.scheduleType === 'weekends' ? editForm.scheduleType : undefined)) : undefined,
        practiceWeeks: undefined,
        practiceHoursPerDay: editForm.role === 'student' && (editForm.practiceHoursPerDay >= 1 && editForm.practiceHoursPerDay <= 4) ? editForm.practiceHoursPerDay : undefined,
        practiceStartDate: editForm.role === 'student' ? (editForm.practiceStartDate.trim() || null) : undefined,
        practiceEndDate: editForm.role === 'student' ? (editForm.practiceEndDate.trim() || null) : undefined,
        citizenship: editForm.citizenship.trim() || null,
        bloodType: editForm.bloodType || null,
        birthDate: editForm.role === 'student' ? (editForm.birthDate.trim() || null) : undefined,
        address: editForm.role === 'student' ? (editForm.address.trim() || null) : undefined,
        phone: editForm.role === 'student' ? (editForm.phone.trim() || null) : undefined,
        startDate: editForm.role === 'student' ? (editForm.startDate.trim() || null) : undefined,
        endDate: editForm.role === 'student' ? (editForm.endDate.trim() || null) : undefined,
        modality: editForm.role === 'student' && (editForm.modality === 'intensivo' || editForm.modality === 'regular' || editForm.modality === 'fin de semana') ? editForm.modality : undefined,
      };
      if (editForm.password.trim()) body.password = editForm.password.trim();
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
        <div className="flex flex-wrap gap-2 flex-1 min-w-0 w-full sm:w-auto">
          <select
            value={filterRole}
            onChange={(e) => {
              const newRole = e.target.value as 'student' | 'instructor' | 'admin' | '';
              setFilterRole(newRole);
              setLoading(true);
              load(newRole);
            }}
            className="form-select w-full sm:min-w-[180px] sm:w-auto"
            aria-label="Filtrar por tipo de usuario"
          >
            <option value="student">Estudiantes</option>
            <option value="instructor">Instructores</option>
            <option value="admin">Administradores</option>
            <option value="">Todos los usuarios</option>
          </select>
          <select
            value={filterCohortId}
            onChange={(e) => { setFilterCohortId(e.target.value); setLoading(true); load(); }}
            className="form-select w-full sm:min-w-[200px] sm:w-auto"
            aria-label="Filtrar por número de curso"
            style={{ display: (filterRole === 'student' || filterRole === '') ? undefined : 'none' }}
          >
            <option value="">Todos los cursos</option>
            {cohorts.map((c) => {
              const courseName = courses.find((cr) => cr.id === c.course_id)?.name ?? '';
              return (
                <option key={c.id} value={c.id}>
                  {courseName ? `${courseName} — ${c.name}` : c.name}
                </option>
              );
            })}
          </select>
          <form
            onSubmit={(e) => { e.preventDefault(); setLoading(true); load(); }}
            className="flex gap-2 flex-1 min-w-0 w-full sm:w-auto"
          >
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por cédula, nombre o email..."
              className="form-input flex-1 min-w-0 min-h-[44px] sm:min-h-0 sm:min-w-[200px]"
            />
            <button type="submit" className="btn-secondary shrink-0">
              Buscar
            </button>
          </form>
          <button
            onClick={() => setShowForm(!showForm)}
            className="btn-primary shrink-0 w-full sm:w-auto min-h-[44px] sm:min-h-0"
          >
            {showForm ? 'Cancelar' : 'Crear usuario'}
          </button>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="form-card overflow-hidden">
          <div className="form-card-header">
            <h3 className="text-lg font-semibold text-neutral-900">Nuevo usuario</h3>
            <p className="text-sm text-neutral-500">Completa los datos para dar de alta una cuenta.</p>
          </div>
          <div className="form-card-body space-y-8">
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
              <h4 className="form-section-title">
                <span className="form-section-icon">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                </span>
                Datos personales
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="form-label">Nombre completo *</label>
                  <input type="text" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} placeholder="Ej: María García" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Cédula *</label>
                  <input type="text" required value={form.cedula} onChange={(e) => setForm({ ...form, cedula: e.target.value })} placeholder="Ej: 1234567890" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Ciudadanía</label>
                  <input type="text" value={form.citizenship} onChange={(e) => setForm({ ...form, citizenship: e.target.value })} placeholder="Ej: Ecuatoriana" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Tipo de sangre</label>
                  <select value={form.bloodType} onChange={(e) => setForm({ ...form, bloodType: e.target.value })} className="form-select">
                    <option value="">Seleccionar</option>
                    {BLOOD_TYPES.map((b) => (
                      <option key={b} value={b}>{b}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="form-label">Género</label>
                  <select value={form.gender} onChange={(e) => setForm({ ...form, gender: e.target.value })} className="form-select">
                    <option value="">Seleccionar</option>
                    <option value="masculino">Masculino</option>
                    <option value="femenino">Femenino</option>
                  </select>
                </div>
              </div>
            </section>

            {form.role === 'student' && (
              <section className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
                <h4 className="form-section-title">
                  <span className="form-section-icon">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                  </span>
                  Datos de inscripción
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="form-label">Fecha de nacimiento</label>
                    <input type="date" value={form.birthDate} onChange={(e) => setForm({ ...form, birthDate: e.target.value })} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Teléfono</label>
                    <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="Ej: 0991234567" className="form-input" />
                  </div>
                  <div className="sm:col-span-2">
                    <label className="form-label">Dirección</label>
                    <input type="text" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Ej: Av. Principal 123, ciudad" className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Inicio prácticas</label>
                    <input type="date" value={form.practiceStartDate} onChange={(e) => {
                      const v = e.target.value;
                      setForm((prev) => {
                        const next = { ...prev, practiceStartDate: v };
                        if (prev.practiceWeeks && v) {
                          const d = new Date(v);
                          d.setDate(d.getDate() + (Number(prev.practiceWeeks) || 0) * 7 - 1);
                          next.practiceEndDate = d.toISOString().slice(0, 10);
                        }
                        return next;
                      });
                    }} className="form-input" />
                    <p className="mt-1 text-xs text-neutral-500">Desde cuándo empieza las prácticas de conducción. Puedes completarlo después al editar.</p>
                  </div>
                  <div>
                    <label className="form-label">Término prácticas</label>
                    <input type="date" value={form.practiceEndDate} onChange={(e) => setForm({ ...form, practiceEndDate: e.target.value })} className="form-input" />
                    <p className="mt-1 text-xs text-neutral-500">Se calcula por semanas de práctica si no lo cambias.</p>
                  </div>
                  <div>
                    <label className="form-label">Modalidad</label>
                    <select value={form.modality} onChange={(e) => setForm({ ...form, modality: e.target.value })} className="form-select">
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
              <h4 className="form-section-title">
                <span className="form-section-icon">
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" /></svg>
                </span>
                Acceso
              </h4>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="form-label">Email *</label>
                  <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="usuario@ejemplo.com" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Contraseña temporal *</label>
                  <input type="password" required minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Mínimo 6 caracteres" className="form-input" />
                </div>
                <div>
                  <label className="form-label">Rol *</label>
                  <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value as 'admin' | 'student', courseId: '', cohortId: '', instructorId: '', scheduleType: 'weekdays', dayOfWeek: 0, startTime: '', practiceWeeks: '', practiceHoursPerDay: 1 })} className="form-select">
                    <option value="admin">Administrador</option>
                    <option value="student">Estudiante</option>
                  </select>
                </div>
              </div>
            </section>
            {form.role === 'student' && (
              <section className="rounded-xl border border-neutral-200 bg-neutral-50/50 p-5">
                <h4 className="form-section-title">
                  <span className="form-section-icon">
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                  </span>
                  Curso y horario
                </h4>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div>
                    <label className="form-label">Tipo de curso</label>
                    <select value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value, cohortId: '', instructorId: '', scheduleType: 'weekdays', dayOfWeek: 0, startTime: '', practiceWeeks: '' })} className="form-select">
                      <option value="">Elegir tipo (opcional)</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                    {courses.length === 0 && <p className="mt-1 text-xs text-amber-600">Crea un curso en Cursos y materias.</p>}
                  </div>
                  <div>
                    <label className="form-label">Número de curso</label>
                    <select value={form.cohortId} onChange={(e) => setForm({ ...form, cohortId: e.target.value, instructorId: '', scheduleType: 'weekdays', dayOfWeek: 0, startTime: '', practiceWeeks: '' })} className="form-select" disabled={!form.courseId}>
                      <option value="">Elegir número (opcional)</option>
                      {cohorts.filter((c) => c.course_id === form.courseId).map((c) => (
                        <option key={c.id} value={c.id}>Nro {c.name}</option>
                      ))}
                    </select>
                    {form.courseId && cohorts.filter((c) => c.course_id === form.courseId).length === 0 && <p className="mt-1 text-xs text-amber-600">Crea un número en Cursos y materias.</p>}
                  </div>
                  <div>
                    <label className="form-label">Instructor</label>
                    <select value={form.instructorId} onChange={(e) => setForm({ ...form, instructorId: e.target.value, scheduleType: 'weekdays', dayOfWeek: 0, startTime: '', practiceWeeks: '' })} className="form-select" disabled={!form.cohortId}>
                      <option value="">Elegir instructor (opcional)</option>
                      {instructors.map((i) => (
                        <option key={i.id} value={i.id}>{i.full_name}</option>
                      ))}
                    </select>
                    {form.cohortId && instructors.length === 0 && <p className="mt-1 text-xs text-amber-600">Crea instructores en Instructores.</p>}
                  </div>
                  <div>
                    <label className="form-label">Modalidad de prácticas</label>
                    <select
                      value={form.scheduleType}
                      onChange={(e) => setForm({ ...form, scheduleType: e.target.value as 'weekdays' | 'weekends', startTime: '' })}
                      className="form-select"
                      disabled={!form.instructorId}
                    >
                      <option value="weekdays">Lunes a Viernes (misma hora)</option>
                      <option value="weekends">Fines de semana (Sábado y Domingo)</option>
                    </select>
                    <p className="mt-1 text-xs text-neutral-500">Las prácticas serán en ese rango de fechas (inicio y término) en esta modalidad.</p>
                  </div>
                  <div>
                    <label className="form-label">Horas por día</label>
                    <select
                      value={form.practiceHoursPerDay}
                      onChange={(e) => setForm({ ...form, practiceHoursPerDay: Number(e.target.value) as 1 | 2 | 3 | 4, startTime: '' })}
                      className="form-select"
                      disabled={!form.instructorId}
                    >
                      <option value={1}>1 hora</option>
                      <option value={2}>2 horas</option>
                      <option value={3}>3 horas</option>
                      <option value={4}>4 horas</option>
                    </select>
                    <p className="mt-1 text-xs text-neutral-500">Duración diaria de prácticas (bloque consecutivo).</p>
                  </div>
                  <div>
                    <label className="form-label">Hora (inicio)</label>
                    <select
                      value={form.startTime}
                      onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                      className="form-select"
                      disabled={!form.instructorId}
                    >
                      {!form.instructorId ? (
                        <option value="">Selecciona un instructor para ver horarios disponibles</option>
                      ) : (form.scheduleType === 'weekdays' || form.scheduleType === 'weekends') ? (
                        availableStartBlocks.length === 0 ? (
                          <option value="">No hay horarios disponibles para este instructor con la duración seleccionada</option>
                        ) : (
                          <>
                            <option value="">Elegir hora de inicio</option>
                            {availableStartBlocks.map((b) => (
                              <option key={`${b.start_time}-${b.end_time}`} value={b.start_time}>
                                {b.start_time} – {b.end_time}
                              </option>
                            ))}
                          </>
                        )
                      ) : (
                        <>
                          <option value="">06:00 - 23:00 (opcional)</option>
                          {Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </>
                      )}
                    </select>
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
                                <input type="number" min="0" step="0.01" value={form.initialPaymentAmount} onChange={(e) => setForm({ ...form, initialPaymentAmount: e.target.value })} placeholder="0.00" className="form-input w-28" />
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

            <div className="form-actions">
              <button type="submit" className="btn-primary">
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" /></svg>
                Crear usuario
              </button>
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary">
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      <div className="table-wrap">
        {loading ? (
          <div className="p-8 text-center text-neutral-500">Cargando...</div>
        ) : (
          <div className="overflow-x-auto -mx-2 sm:mx-0">
            <table className="table-pro min-w-[480px] w-full">
            <thead>
              <tr>
                <th className="!pl-6 !pr-8 !py-4 w-[min(220px,35%)]">Usuario</th>
                <th className="!px-6 !py-4">Curso</th>
                <th className="!px-6 !py-4">Horario</th>
                <th className="!px-6 !py-4 text-center w-36 min-w-[120px]">Debe</th>
                <th className="!px-6 !py-4">Actividad</th>
                <th className="!pr-6 !pl-4 !py-4 w-40 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const debe = u.role === 'student' && (u.total_amount != null || u.amount_paid != null)
                  ? Math.max(0, (Number(u.total_amount) || 0) - (Number(u.amount_paid) || 0))
                  : null;
                const debeIsZero = debe !== null && debe === 0;
                return (
                <tr key={u.id} className="border-b border-neutral-100 hover:bg-neutral-50/80">
                  <td className="!pl-6 !pr-8 !py-5 align-top">
                    <p className="font-semibold text-neutral-900 text-[15px] leading-tight">{u.full_name || u.email}</p>
                    <p className="text-sm text-neutral-500 mt-0.5">{u.email}</p>
                  </td>
                  <td className="!px-6 !py-5 text-neutral-600 text-sm">{getAssignation(u)}</td>
                  <td className="!px-6 !py-5 text-neutral-600 text-sm">{u.role === 'student' ? getScheduleLabel(u) : '-'}</td>
                  <td className="!px-6 !py-5 w-36 min-w-[120px] align-top">
                    <div className="flex justify-center w-full">
                      {debe === null ? (
                        <span className="text-neutral-400 text-sm">-</span>
                      ) : debeIsZero ? (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-800">
                          Al día
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-800">
                          Debe ${debe.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="!px-6 !py-5">
                    {u.role === 'student' && (
                      <button
                        onClick={() => setActivityModal({ userId: u.id, name: u.full_name || u.email })}
                        className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium transition-colors"
                      >
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                        </svg>
                        Ver actividad
                      </button>
                    )}
                  </td>
                  <td className="!pr-6 !pl-4 !py-5 text-right">
                    <div className="flex flex-wrap gap-4 justify-end">
                      <button onClick={() => setUserDetailModal(u)} className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-700 hover:underline text-sm font-medium transition-colors">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                        Ver todo
                      </button>
                      <button onClick={() => openEdit(u)} className="inline-flex items-center gap-1.5 text-amber-600 hover:text-amber-700 hover:underline text-sm font-medium transition-colors">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" /></svg>
                        Editar
                      </button>
                      <button onClick={() => deleteUser(u)} className="inline-flex items-center gap-1.5 text-red-600 hover:text-red-700 hover:underline text-sm font-medium transition-colors">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
                );
              })}
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
            <button onClick={() => setActivityModal(null)} className="mt-4 btn-secondary">Cerrar</button>
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
                <button onClick={() => setUserDetailModal(null)} className="btn-secondary">Cerrar</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setEditModal(null)}>
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-auto max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-4">Editar usuario: {editModal.email}</h3>
            {editError && <div className="p-3 rounded-lg bg-red-50 text-red-700 text-sm mb-4">{editError}</div>}
            {editSuccess && <div className="p-3 rounded-lg bg-green-50 text-green-700 text-sm mb-4">{editSuccess}</div>}
            <form onSubmit={handleUpdate} className="space-y-4">
              <div>
                <label className="form-label">Nombre completo</label>
                <input type="text" required value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} className="form-input" />
              </div>
              <div>
                <label className="form-label">Número de cédula</label>
                <input type="text" value={editForm.cedula} onChange={(e) => setEditForm({ ...editForm, cedula: e.target.value })} placeholder="Ej: 1234567890" className="form-input" />
              </div>
              <div>
                <label className="form-label">Ciudadanía</label>
                <input type="text" value={editForm.citizenship} onChange={(e) => setEditForm({ ...editForm, citizenship: e.target.value })} placeholder="Ej: Ecuatoriana" className="form-input" />
              </div>
              <div>
                <label className="form-label">Tipo de sangre</label>
                <select value={editForm.bloodType} onChange={(e) => setEditForm({ ...editForm, bloodType: e.target.value })} className="form-select">
                  <option value="">Seleccionar</option>
                  {BLOOD_TYPES.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Género</label>
                <select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value })} className="form-select">
                  <option value="">Seleccionar</option>
                  <option value="masculino">Masculino</option>
                  <option value="femenino">Femenino</option>
                </select>
              </div>
              <div>
                <label className="form-label">Rol</label>
                <select value={editForm.role} onChange={(e) => setEditForm({ ...editForm, role: e.target.value as 'admin' | 'student', courseId: '', cohortId: '', instructorId: '', scheduleType: 'weekdays', dayOfWeek: 0, startTime: '', practiceWeeks: '' })} className="form-select">
                  <option value="admin">Admin</option>
                  <option value="student">Estudiante</option>
                </select>
              </div>
              {editForm.role === 'student' && (
                <>
                  <div className="border-t border-neutral-100 pt-4 mt-2">
                    <h4 className="text-sm font-semibold text-neutral-700 mb-3">Datos de inscripción (completar o modificar)</h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3">
                      <div>
                        <label className="form-label">Fecha de nacimiento</label>
                        <input type="date" value={editForm.birthDate} onChange={(e) => setEditForm({ ...editForm, birthDate: e.target.value })} className="form-input" />
                      </div>
                      <div>
                        <label className="form-label">Teléfono</label>
                        <input type="tel" value={editForm.phone} onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })} placeholder="Ej: 0991234567" className="form-input" />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="form-label">Dirección</label>
                        <input type="text" value={editForm.address} onChange={(e) => setEditForm({ ...editForm, address: e.target.value })} placeholder="Ej: Av. Principal 123" className="form-input" />
                      </div>
                      <div>
                        <label className="form-label">Fecha de inicio (curso)</label>
                        <input type="date" value={editForm.startDate} onChange={(e) => setEditForm({ ...editForm, startDate: e.target.value })} className="form-input" />
                      </div>
                      <div>
                        <label className="form-label">Fecha de término (curso)</label>
                        <input type="date" value={editForm.endDate} onChange={(e) => setEditForm({ ...editForm, endDate: e.target.value })} className="form-input" />
                      </div>
                      <div>
                        <label className="form-label">Modalidad</label>
                        <select value={editForm.modality} onChange={(e) => setEditForm({ ...editForm, modality: e.target.value })} className="form-select">
                          <option value="">Seleccionar</option>
                          <option value="intensivo">Intensivo</option>
                          <option value="regular">Regular</option>
                          <option value="fin de semana">Fin de semana</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </>
              )}
              {editForm.role === 'student' && (
                <>
                  <div>
                    <label className="form-label">Tipo de curso</label>
                    <select value={editForm.courseId} onChange={(e) => setEditForm({ ...editForm, courseId: e.target.value, cohortId: '' })} className="form-select">
                      <option value="">Elegir tipo</option>
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Número de curso</label>
                    <select value={editForm.cohortId} onChange={(e) => setEditForm({ ...editForm, cohortId: e.target.value, instructorId: '', scheduleType: 'weekdays', dayOfWeek: 0, startTime: '', practiceWeeks: '' })} className="form-select" disabled={!editForm.courseId}>
                      <option value="">Elegir número</option>
                      {cohorts.filter((c) => c.course_id === editForm.courseId).map((c) => (
                        <option key={c.id} value={c.id}>Nro {c.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Instructor</label>
                    <select value={editForm.instructorId} onChange={(e) => setEditForm({ ...editForm, instructorId: e.target.value, scheduleType: 'weekdays', dayOfWeek: 0, startTime: '', practiceWeeks: '' })} className="form-select" disabled={!editForm.cohortId}>
                      <option value="">Elegir instructor</option>
                      {instructors.map((i) => (
                        <option key={i.id} value={i.id}>{i.full_name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Modalidad de prácticas</label>
                    <select value={editForm.scheduleType === 'single' ? (editForm.dayOfWeek >= 6 ? 'weekends' : 'weekdays') : editForm.scheduleType} onChange={(e) => setEditForm({ ...editForm, scheduleType: e.target.value as 'weekdays' | 'weekends', startTime: '' })} className="form-select" disabled={!editForm.instructorId}>
                      <option value="weekdays">Lunes a Viernes</option>
                      <option value="weekends">Fines de semana</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Horas por día</label>
                    <select value={editForm.practiceHoursPerDay} onChange={(e) => setEditForm({ ...editForm, practiceHoursPerDay: Number(e.target.value) as 1 | 2 | 3 | 4, startTime: '' })} className="form-select" disabled={!editForm.instructorId}>
                      <option value={1}>1 hora</option>
                      <option value={2}>2 horas</option>
                      <option value={3}>3 horas</option>
                      <option value={4}>4 horas</option>
                    </select>
                  </div>
                  <div>
                    <label className="form-label">Hora (inicio)</label>
                    <select value={editForm.startTime} onChange={(e) => setEditForm({ ...editForm, startTime: e.target.value })} className="form-select" disabled={!editForm.instructorId}>
                      {!editForm.instructorId ? (
                        <option value="">Selecciona un instructor para ver horarios disponibles</option>
                      ) : (editForm.scheduleType === 'weekdays' || editForm.scheduleType === 'weekends') ? (
                        editAvailableStartBlocks.length === 0 ? (
                          <option value="">No hay horarios disponibles para este instructor con la duración seleccionada</option>
                        ) : (
                          <>
                            <option value="">Elegir hora de inicio</option>
                            {editAvailableStartBlocks.map((b) => (
                              <option key={`${b.start_time}-${b.end_time}`} value={b.start_time}>
                                {b.start_time} – {b.end_time}
                              </option>
                            ))}
                          </>
                        )
                      ) : (
                        <>
                          <option value="">06:00 - 23:00</option>
                          {Array.from({ length: 18 }, (_, i) => `${String(i + 6).padStart(2, '0')}:00`).map((t) => (
                            <option key={t} value={t}>{t}</option>
                          ))}
                        </>
                      )}
                    </select>
                  </div>
                </>
              )}
              {editForm.role === 'student' && (
                <>
                  <div>
                    <label className="form-label">Inicio prácticas</label>
                    <input type="date" value={editForm.practiceStartDate} onChange={(e) => setEditForm({ ...editForm, practiceStartDate: e.target.value })} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Término prácticas</label>
                    <input type="date" value={editForm.practiceEndDate} onChange={(e) => setEditForm({ ...editForm, practiceEndDate: e.target.value })} className="form-input" />
                  </div>
                </>
              )}
              <div>
                <label className="form-label">Nueva contraseña (opcional)</label>
                <input type="password" minLength={6} value={editForm.password} onChange={(e) => setEditForm({ ...editForm, password: e.target.value })} placeholder="Dejar en blanco para no cambiar" className="form-input" />
              </div>
              <div className="flex gap-2">
                <button type="submit" className="btn-primary">Guardar</button>
                <button type="button" onClick={() => setEditModal(null)} className="btn-secondary">Cancelar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
