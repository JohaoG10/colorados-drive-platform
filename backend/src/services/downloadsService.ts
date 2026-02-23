import { supabaseAdmin } from '../config/supabase';
import { getCohortReport } from './reportService';
import { listAttendanceByCohort } from './attendanceService';

const ESCUELA_NOMBRE = 'COLORADOS DRIVE';
const SEP = ';'; // separador CSV (compatible Excel Ecuador/LATAM)

/** Escapa un valor para CSV (encierra en comillas si contiene SEP o comilla) */
function csvVal(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value).trim();
  if (s.includes(SEP) || s.includes('"') || s.includes('\n') || s.includes('\r')) {
    return '"' + s.replace(/"/g, '""') + '"';
  }
  return s;
}

/** Formato fecha dd/mm/yyyy */
function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10));
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
}

/** Edad en años desde fecha nacimiento */
function edad(birthDate: string | null | undefined): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate.slice(0, 10));
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return String(age);
}

/** Formato horario: día + hora (ej. "Lunes 06:00" o "06H00-08H00") */
function formatSchedule(dayOfWeek: number | null, startTime: string | null): string {
  if (dayOfWeek == null || !startTime) return '';
  const days = ['', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
  const t = typeof startTime === 'string' ? startTime.slice(0, 5) : startTime;
  return `${days[dayOfWeek] || ''} ${t}`.trim();
}

/** Mapeo de nombre de materia a etiqueta ANEXO (normalizado) */
const MATERIAS_ANEXO: Record<string, string> = {
  'educacion vial': 'Educación Vial',
  'educación vial': 'Educación Vial',
  'mecanica': 'Mecánica',
  'mecánica': 'Mecánica',
  'primeros auxilios': 'Primeros',
  'primeros': 'Primeros',
  'actitud': 'Actitud',
  'practica': 'Práctica',
  'práctica': 'Práctica',
};

function normalizarMateria(name: string): string {
  const n = name.toLowerCase().trim();
  for (const [key, label] of Object.entries(MATERIAS_ANEXO)) {
    if (n.includes(key) || key.includes(n)) return label;
  }
  return name;
}

export interface CourseExportData {
  cohort: { code: string; name: string; courseName: string; courseCode: string };
  startDate: string;
  endDate: string;
  students: {
    no: number;
    fullName: string;
    cedula: string;
    birthDate: string;
    age: string;
    startDate: string;
    endDate: string;
    scheduleTheory: string;
    schedulePractice: string;
    examBySubject: Record<string, { score: number; passed: boolean }>;
    attendancePct: number;
    daysPresent: number;
    totalDays: number;
    approved: boolean;
    /** Compra de permisos */
    email: string;
    citizenship: string;
    bloodType: string;
    address: string;
    phone: string;
  }[];
  subjectLabels: string[]; // orden: Educación Vial, Mecánica, Primeros, Actitud, Práctica
}

export async function getCourseExportData(cohortId: string): Promise<CourseExportData> {
  const report = await getCohortReport(cohortId);
  const { cohort, students } = report;
  const courseName = cohort.courseName ?? '';
  const courseCode = cohort.courseCode ?? cohort.code ?? '';

  // Fechas del curso: min/max de estudiantes o cohort
  let startDate = '';
  let endDate = '';
  for (const s of students) {
    if (s.startDate) {
      if (!startDate || s.startDate < startDate) startDate = s.startDate;
    }
    if (s.endDate) {
      if (!endDate || s.endDate > endDate) endDate = s.endDate;
    }
  }
  if (!startDate && students[0]?.startDate) startDate = students[0].startDate;
  if (!endDate && students[0]?.endDate) endDate = students[0].endDate;
  if (!startDate) startDate = new Date().toISOString().slice(0, 10);
  if (!endDate) endDate = startDate;

  // Asistencia por cohort en el rango
  const attendanceList = await listAttendanceByCohort(cohortId, startDate, endDate);
  const attendanceByUser = new Map(
    attendanceList.map((a) => [
      a.userId,
      { daysPresent: a.daysPresent, totalDays: a.totalDays, pct: a.totalDays ? Math.round((a.daysPresent / a.totalDays) * 100) : 0 },
    ])
  );

  // Horarios por estudiante (schedule_id -> course_schedules)
  const profileIds = students.map((s) => s.userId);
  const { data: profilesWithSchedule } = await supabaseAdmin
    .from('user_profiles')
    .select('id, schedule_id')
    .in('id', profileIds);
  const scheduleIds = [...new Set((profilesWithSchedule || []).map((p) => (p as { schedule_id?: string }).schedule_id).filter(Boolean))] as string[];
  let scheduleMap = new Map<string, { day_of_week: number; start_time: string }>();
  if (scheduleIds.length > 0) {
    const { data: schedules } = await supabaseAdmin
      .from('course_schedules')
      .select('id, day_of_week, start_time')
      .in('id', scheduleIds);
    for (const sc of schedules || []) {
      const t = typeof (sc as { start_time?: string }).start_time === 'string' ? (sc as { start_time: string }).start_time.slice(0, 5) : '';
      scheduleMap.set((sc as { id: string }).id, {
        day_of_week: (sc as { day_of_week: number }).day_of_week,
        start_time: t,
      });
    }
  }
  const userToSchedule = new Map<string, { day_of_week: number; start_time: string }>();
  for (const p of profilesWithSchedule || []) {
    const sid = (p as { schedule_id?: string }).schedule_id;
    if (sid) {
      const sch = scheduleMap.get(sid);
      if (sch) userToSchedule.set((p as { id: string }).id, sch);
    }
  }

  // Exámenes por materia (curso): mapear exam_id -> etiqueta ANEXO (Educación Vial, Mecánica, etc.)
  const { data: subjects } = await supabaseAdmin
    .from('subjects')
    .select('id, name')
    .eq('course_id', cohort.courseId);
  const subjectIds = (subjects || []).map((s) => (s as { id: string }).id);
  const examIdToSubjectLabel = new Map<string, string>();
  const subjectIdToName = new Map((subjects || []).map((s) => [(s as { id: string }).id, (s as { name: string }).name]));

  if (subjectIds.length > 0) {
    const { data: bySubject } = await supabaseAdmin
      .from('exams')
      .select('id, title, subject_id')
      .in('subject_id', subjectIds);
    for (const e of bySubject || []) {
      const sid = (e as { subject_id?: string }).subject_id;
      const subName = sid ? subjectIdToName.get(sid) : (e as { title?: string }).title;
      const label = normalizarMateria(subName || (e as { title: string }).title || '');
      examIdToSubjectLabel.set((e as { id: string }).id, label);
    }
  }
  const { data: byCourse } = await supabaseAdmin
    .from('exams')
    .select('id, title, subject_id')
    .eq('course_id', cohort.courseId);
  for (const e of byCourse || []) {
    const sid = (e as { subject_id?: string }).subject_id;
    const subName = sid ? subjectIdToName.get(sid) : (e as { title?: string }).title;
    const label = normalizarMateria(subName || (e as { title: string }).title || '');
    examIdToSubjectLabel.set((e as { id: string }).id, label);
  }
  const subjectLabelsOrder = ['Educación Vial', 'Mecánica', 'Primeros', 'Actitud', 'Práctica'];

  const rows: CourseExportData['students'] = [];
  let no = 1;
  for (const s of students) {
    const att = attendanceByUser.get(s.userId);
    const daysPresent = att?.daysPresent ?? 0;
    const totalDays = att?.totalDays ?? 0;
    const attendancePct = totalDays ? Math.round((daysPresent / totalDays) * 100) : 0;
    const schedule = userToSchedule.get(s.userId);
    const scheduleTheory = formatSchedule(schedule?.day_of_week ?? null, schedule?.start_time ?? null);
    const examBySubject: Record<string, { score: number; passed: boolean }> = {};
    for (const er of s.examResults) {
      const label = examIdToSubjectLabel.get(er.examId) || er.examTitle;
      examBySubject[label] = { score: er.score, passed: er.passed };
    }
    const allPassed = subjectLabelsOrder.every((lbl) => {
      const ex = examBySubject[lbl];
      return ex?.passed === true;
    });
    const approved = allPassed && attendancePct >= 70; // criterio típico

    rows.push({
      no: no++,
      fullName: s.fullName || '',
      cedula: s.cedula ?? '',
      birthDate: s.birthDate ?? '',
      age: edad(s.birthDate),
      startDate: s.startDate ?? '',
      endDate: s.endDate ?? '',
      scheduleTheory,
      schedulePractice: '', // la plataforma no diferencia práctica; dejar vacío o igual a teoría
      examBySubject,
      attendancePct,
      daysPresent,
      totalDays,
      approved,
      email: s.email ?? '',
      citizenship: s.citizenship ?? '',
      bloodType: s.bloodType ?? '',
      address: s.address ?? '',
      phone: s.phone ?? '',
    });
  }

  return {
    cohort: {
      code: cohort.code,
      name: cohort.name,
      courseName,
      courseCode,
    },
    startDate,
    endDate,
    students: rows,
    subjectLabels: subjectLabelsOrder,
  };
}

/** Genera CSV ANEXO 2 - Verificación requisitos permiso de aprendizaje */
export function buildCsvAnexo2(data: CourseExportData): string {
  const headers = [
    'No.',
    'Apellidos y Nombres',
    'Cédula Ciudadanía',
    'Fecha Nacimiento',
    'Edad (años)',
    'Cédula',
    'Certificado Votación',
    'Educación Básica',
    'Examen Psicotécnico',
    'Examen Pisosensométrico',
    'Examen Médico',
    'Certificado Grupo Sanguíneo',
    'No. Matrícula',
    'No. Factura',
    'No. Permiso Aprendizaje',
    'HORARIO DE TEORIA',
    'HORARIO DE PRACTICA',
    'Garantía Bancaria (25RBU) Art. 30 Leg. de TTTSV Art. 24 lit. d) Reglamento',
    'Observaciones',
  ];
  const lines: string[] = [headers.map(csvVal).join(SEP)];
  for (const r of data.students) {
    const row = [
      r.no,
      r.fullName,
      r.cedula,
      fmtDate(r.birthDate),
      r.age,
      '', // Cédula (verificación)
      '', // Certificado Votación
      '', // Educación Básica
      '', // Examen Psicotécnico
      '', // Examen Pisosensométrico
      '', // Examen Médico
      '', // Certificado Grupo Sanguíneo
      '', // No. Matrícula
      '', // No. Factura
      '', // No. Permiso Aprendizaje
      r.scheduleTheory,
      r.schedulePractice,
      '',
      '',
    ];
    lines.push(row.map((c) => csvVal(c)).join(SEP));
  }
  return '\uFEFF' + lines.join('\r\n'); // BOM UTF-8 para Excel
}

/** Genera CSV ANEXO 4 - Verificación cumplimiento requisitos título conductor no profesional */
export function buildCsvAnexo4(data: CourseExportData): string {
  const labels = data.subjectLabels;
  const headers = [
    'No.',
    'Apellidos y Nombres',
    'Cédula Ciudadanía',
    'Matrícula No. Factura',
    'No. Permiso Aprendizaje',
    ...labels.flatMap((l) => [`${l} Nota`, `${l} Susp. 1`, `${l} Susp. 2`, `${l} Asistencia`]),
    'Aprobado (S/N)',
    'No. Certificado',
    'Observaciones',
  ];
  const lines: string[] = [headers.map(csvVal).join(SEP)];
  for (const r of data.students) {
    const subjectCells = labels.flatMap((lbl) => {
      const ex = r.examBySubject[lbl];
      const nota = ex ? String(Math.round(ex.score)) : '';
      return [nota, '', '', String(r.attendancePct)];
    });
    const row = [
      r.no,
      r.fullName,
      r.cedula,
      '', // Matrícula No. Factura
      '', // No. Permiso Aprendizaje
      ...subjectCells,
      r.approved ? 'S' : 'N',
      '', // No. Certificado
      '',
    ];
    lines.push(row.map((c) => csvVal(c)).join(SEP));
  }
  return '\uFEFF' + lines.join('\r\n');
}

/** Genera CSV Listado Excel - Listado escuela de conducción */
export function buildCsvListado(data: CourseExportData): string {
  const headers = [
    'N°',
    'APELLIDOS Y NOMBRES',
    'CEDULA',
    'TIPO DE LICENCIA',
    'ESCUELA DE CONDUCCION',
    'FECHA DE INICIO DEL CURSO',
    'FECHA DE CULMINACION DEL CURSO',
    'N° DE CURSO',
    'APROBADO',
    'N° DE CERTIFICADO',
    'N° PERMISO DE APRENDIZAJE',
    'HORARIO TEORIA',
  ];
  const lines: string[] = [headers.map(csvVal).join(SEP)];
  for (const r of data.students) {
    const row = [
      r.no,
      r.fullName,
      r.cedula,
      data.cohort.courseName,
      ESCUELA_NOMBRE,
      fmtDate(r.startDate || data.startDate),
      fmtDate(r.endDate || data.endDate),
      data.cohort.courseCode,
      r.approved ? 'Sí' : 'No',
      '',
      '',
      r.scheduleTheory,
    ];
    lines.push(row.map((c) => csvVal(c)).join(SEP));
  }
  return '\uFEFF' + lines.join('\r\n');
}

/** Genera CSV Compra de permisos - Ruc, Escuela, Identificación, Nombres, Nacionalidad, TipoSangre, Domicilio, Telefono, Email, Canton */
export function buildCsvCompraPermisos(data: CourseExportData): string {
  const headers = [
    'Ruc',
    'Escuela',
    'Identificacion',
    'Nombres',
    'Nacionalidad',
    'TipoSangre',
    'Domicilio',
    'Telefono',
    'Email',
    'Canton',
  ];
  const lines: string[] = [headers.map(csvVal).join(SEP)];
  for (const r of data.students) {
    const row = [
      '', // Ruc (de la escuela o alumno; dejar para que admin complete)
      ESCUELA_NOMBRE,
      r.cedula,
      r.fullName,
      r.citizenship,
      r.bloodType,
      r.address,
      r.phone,
      r.email,
      '', // Canton (no tenemos en perfil; dejar para completar)
    ];
    lines.push(row.map((c) => csvVal(c)).join(SEP));
  }
  return '\uFEFF' + lines.join('\r\n');
}

/** Genera CSV Legalización de permisos - formato ANT (columnas exactas del modelo oficial) */
export function buildCsvLegalizacionPermisos(data: CourseExportData): string {
  const headers = [
    'NOMBRE_ESCUELA',
    'RUC_ESCUELA',
    'TIPO_IDENTIFICACION',
    'IDENTIFICACION',
    'NOMBRE_PERSONA',
    'NACIONALIDAD',
    'FECHA_DE_NACIMIENTO',
    'SEXO',
    'DIRECCION',
    'EMAIL',
    'TELEFONO',
    'PERMISO_DE_APRENDIZAJE',
    'INICIO_CURSO',
    'APROBACION_EXAMEN_TEORICO',
    'APROBACION_EXAMEN_PRACTICO',
    'APROBACION_CURSO',
    'ID_CLASE',
    'CLASE_LICENCIA',
    'NOVEDADES',
    'TIPO_RESTRICCION_2',
    'TIPO_RESTRICCION_3',
    'TIPO_RESTRICCION_4',
    'TIPO_RESTRICCION_5',
    'TIPO_RESTRICCION_6',
    'TIPO_RESTRICCION_7',
    'TIPO_RESTRICCION_8',
    'TIPO_RESTRICCION_9',
    'JORNADA_LABORAL',
  ];
  const lines: string[] = [headers.map(csvVal).join(SEP)];
  for (const r of data.students) {
    const row = [
      ESCUELA_NOMBRE,
      '', // RUC_ESCUELA
      'CEDULA', // TIPO_IDENTIFICACION
      r.cedula,
      r.fullName,
      r.citizenship,
      fmtDate(r.birthDate),
      '', // SEXO (no en perfil)
      r.address,
      r.email,
      r.phone,
      '', // PERMISO_DE_APRENDIZAJE
      fmtDate(r.startDate),
      r.approved ? 'S' : 'N', // APROBACION_EXAMEN_TEORICO (usamos aprobado curso)
      r.approved ? 'S' : 'N', // APROBACION_EXAMEN_PRACTICO
      r.approved ? 'S' : 'N', // APROBACION_CURSO
      '', // ID_CLASE
      data.cohort.courseName, // CLASE_LICENCIA (tipo de curso)
      '', // NOVEDADES
      '', '', '', '', '', '', '', '', // TIPO_RESTRICCION_2 a 9
      '', // JORNADA_LABORAL
    ];
    lines.push(row.map((c) => csvVal(c)).join(SEP));
  }
  return '\uFEFF' + lines.join('\r\n');
}

/** Sufijo seguro para nombres de archivo: número/código del curso (ej. CursoTipoB_178 o CLD-IN-308) */
export function getCourseFileSuffix(cohortCode: string): string {
  return cohortCode.replace(/[^a-zA-Z0-9-]/g, '_').trim() || 'curso';
}
