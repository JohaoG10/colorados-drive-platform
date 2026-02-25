import * as path from 'path';
import * as fs from 'fs';
import { supabaseAdmin } from '../config/supabase';
import { getCohortReport } from './reportService';
import { listAttendanceByCohort } from './attendanceService';
import ExcelJS from 'exceljs';

const ESCUELA_NOMBRE = 'COLORADOS DRIVE';
const SEP = ';'; // separador CSV (compatible Excel Ecuador/LATAM)
const RUC_ESCUELA = '17921308440001'; // RUC escuela; en CSV puede mostrarse como 1,79E+12 en Excel

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

/** Formato fecha corta d/m/yy (ej. 25/1/26) para Excel */
function fmtDateShort(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso.slice(0, 10));
  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = String(d.getFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

/** Convierte "Lunes 08:00" a "08H00" o "08:00" a "08H00" */
function toHorarioH(scheduleStr: string | null | undefined): string {
  if (!scheduleStr) return '';
  const match = scheduleStr.match(/(\d{1,2}):(\d{2})/);
  if (match) return `${match[1].padStart(2, '0')}H${match[2]}`;
  return scheduleStr.replace(':', 'H');
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
    gender: string;
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
      gender: s.gender === 'masculino' || s.gender === 'femenino' ? s.gender : '',
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
    'GÉNERO',
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
      r.gender === 'masculino' ? 'Masculino' : r.gender === 'femenino' ? 'Femenino' : '',
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

/** Genera CSV Compra de permisos - mismo orden que plantilla: Ruc, Escuela, Identificacion, Nombres, Nacionalidad, TipoSangre, Domicilio, Telefono, Email, Canton */
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
      RUC_ESCUELA,
      ESCUELA_NOMBRE,
      r.cedula,
      r.fullName,
      r.citizenship,
      r.bloodType,
      r.address,
      r.phone,
      r.email,
      '', // Canton (completar si se tiene)
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
      RUC_ESCUELA,
      'CEDULA', // TIPO_IDENTIFICACION
      r.cedula,
      r.fullName,
      r.citizenship,
      fmtDate(r.birthDate),
      r.gender === 'masculino' ? 'M' : r.gender === 'femenino' ? 'F' : '', // SEXO
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

const BORDER_THIN = { style: 'thin' as const };
const BORDER_MEDIUM = { style: 'medium' as const };
const FILL_GRAY_HEADER = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFE0E0E0' } };
const FILL_GRAY_SUB = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFD0D0D0' } };
const FILL_BLUE_ROW = { type: 'pattern' as const, pattern: 'solid' as const, fgColor: { argb: 'FFB0E0E6' } };
const FONT_HEADER = { bold: true, size: 11 };
const FONT_TITLE = { bold: true, size: 12 };
const VERTICAL_ALIGN = { textRotation: 90, horizontal: 'center' as const, vertical: 'middle' as const };

/** Filas con fondo azul claro (cada 5: 14, 19, 24...) */
function isBlueRow(studentNo: number): boolean {
  return studentNo >= 14 && (studentNo - 14) % 5 === 0;
}

/** Genera Excel CURSO INTENSIVO con 3 hojas (ANEXO 2, Listado, ANEXO 4) con diseño profesional: colores, bordes, pie con firmas y responsable */
export async function buildXlsxCursoIntensivo(data: CourseExportData): Promise<Buffer> {
  const { cohort, students, startDate, endDate, subjectLabels } = data;
  const code = cohort.code;
  const courseName = cohort.courseName || 'TIPO B';
  const startShort = fmtDateShort(startDate || '');
  const endShort = fmtDateShort(endDate || '');
  const fechaHoy = fmtDate(new Date().toISOString().slice(0, 10));

  const workbook = new ExcelJS.Workbook();
  workbook.creator = ESCUELA_NOMBRE;
  workbook.company = ESCUELA_NOMBRE;

  const assetsDir = path.join(process.cwd(), 'assets', 'logos');
  let imageIdAnt: number | null = null;
  let imageIdColorados: number | null = null;
  let imageIdPieFirmas: number | null = null;
  try {
    if (fs.existsSync(path.join(assetsDir, 'logo_ant.png'))) {
      imageIdAnt = workbook.addImage({ filename: path.join(assetsDir, 'logo_ant.png'), extension: 'png' });
    }
    const coloradosPng = path.join(assetsDir, 'logo_colorados.png');
    const coloradosJpg = path.join(assetsDir, 'logo_colorados.jpg');
    if (fs.existsSync(coloradosPng)) {
      imageIdColorados = workbook.addImage({ filename: coloradosPng, extension: 'png' });
    } else if (fs.existsSync(coloradosJpg)) {
      imageIdColorados = workbook.addImage({ filename: coloradosJpg, extension: 'jpeg' });
    }
    const pieFirmasPath = path.join(assetsDir, 'pie_firmas.png');
    const responsablePath = path.join(assetsDir, 'Responsable.png');
    if (fs.existsSync(pieFirmasPath)) {
      imageIdPieFirmas = workbook.addImage({ filename: pieFirmasPath, extension: 'png' });
    } else if (fs.existsSync(responsablePath)) {
      imageIdPieFirmas = workbook.addImage({ filename: responsablePath, extension: 'png' });
    }
  } catch {
    // Sin imágenes si falla
  }

  // ========== HOJA ANEXO 2 ==========
  const ws2 = workbook.addWorksheet('ANEXO 2', { views: [{ showGridLines: true }] });
  let rowNum = 1;
  if (imageIdAnt != null) {
    ws2.addImage(imageIdAnt, { tl: { col: 0, row: 0 }, ext: { width: 72, height: 72 } });
  }
  if (imageIdColorados != null) {
    ws2.addImage(imageIdColorados, { tl: { col: 14, row: 0 }, ext: { width: 72, height: 72 } });
  }
  ws2.getCell(rowNum, 2).value = 'COMISION NACIONAL DE TRANSPORTE TERRESTRE, TRANSITO Y SEGURIDAD VIAL';
  ws2.getCell(rowNum, 2).font = { bold: true, size: 14 };
  ws2.mergeCells(rowNum, 2, rowNum, 13);
  ws2.getCell(rowNum, 2).alignment = { horizontal: 'center' };
  rowNum++;
  ws2.getCell(rowNum, 2).value = 'UNIDAD DE ESCUELAS DE CAPACITACION';
  ws2.getCell(rowNum, 2).font = FONT_HEADER;
  ws2.mergeCells(rowNum, 2, rowNum, 13);
  ws2.getCell(rowNum, 2).alignment = { horizontal: 'center' };
  rowNum++;
  ws2.getCell(rowNum, 2).value = 'ART. 24 DEL REGLAMENTO DE ESCUELAS DE CAPACITACION DE CONDUCTORES NO PROFESIONALES';
  ws2.getCell(rowNum, 2).font = { bold: true, size: 10 };
  ws2.mergeCells(rowNum, 2, rowNum, 13);
  ws2.getCell(rowNum, 2).alignment = { horizontal: 'center' };
  rowNum++;
  ws2.mergeCells(rowNum, 1, rowNum, 19);
  ws2.getCell(rowNum, 1).border = { bottom: BORDER_MEDIUM };
  rowNum++;
  ws2.getCell(rowNum, 1).value = 'ESCUELAS DE CAPACITACION DE CONDUCTORES NO PROFESIONALES';
  ws2.getCell(rowNum, 1).font = FONT_HEADER;
  ws2.mergeCells(rowNum, 1, rowNum, 19);
  rowNum++;
  ws2.getCell(rowNum, 1).value = 'VERIFICACION DEL CUMPLIMIENTO DE REQUISITOS DE LOS ALUMNOS MATRICULADOS PARA OTORGAMIENTO DEL PERMISO DE APRENDIZAJE - ANEXO 2';
  ws2.getCell(rowNum, 1).font = FONT_HEADER;
  ws2.mergeCells(rowNum, 1, rowNum, 19);
  rowNum++;
  ws2.getCell(rowNum, 1).value = 'Nombre de la Escuela:';
  ws2.getCell(rowNum, 3).value = ESCUELA_NOMBRE;
  ws2.mergeCells(rowNum, 1, rowNum, 2);
  ws2.mergeCells(rowNum, 3, rowNum, 19);
  for (let c = 1; c <= 19; c++) {
    ws2.getCell(rowNum, c).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
  }
  rowNum++;
  ws2.getCell(rowNum, 1).value = 'Curso:';
  ws2.getCell(rowNum, 2).value = code;
  ws2.getCell(rowNum, 3).value = 'Paralelo:';
  ws2.getCell(rowNum, 4).value = '1A';
  ws2.getCell(rowNum, 5).value = 'Fecha Inicio Curso: ' + startShort;
  ws2.mergeCells(rowNum, 5, rowNum, 7);
  ws2.getCell(rowNum, 8).value = 'Fecha Fin Curso: ' + endShort;
  ws2.mergeCells(rowNum, 8, rowNum, 9);
  ws2.getCell(rowNum, 10).value = 'Horario: TEORIA / PRACTICA';
  ws2.mergeCells(rowNum, 10, rowNum, 19);
  for (let c = 1; c <= 19; c++) {
    ws2.getCell(rowNum, c).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
  }
  rowNum++;
  const headerRow2 = rowNum;
  const anexo2Headers = [
    'No.', 'Apellidos y Nombres', 'Cédula Ciudadanía', 'Fecha Nacimiento', 'Edad (años)',
    'Cédula', 'Certificado Votación', 'Educación Básica', 'Examen Psicotécnico', 'Examen Pisosensométrico', 'Examen Médico', 'Certificado Grupo Sanguíneo',
    'No. Matrícula', 'No. Factura', 'No. Permiso Aprendizaje', 'HORARIO DE TEORIA', 'HORARIO DE PRACTICA',
    'Garantía Bancaria (25RBU) Art. 90 Ley TTTSV', 'Observaciones',
  ];
  anexo2Headers.forEach((h, i) => {
    const col = i + 1;
    ws2.getCell(headerRow2, col).value = h;
    ws2.getCell(headerRow2, col).font = FONT_HEADER;
    ws2.getCell(headerRow2, col).fill = FILL_GRAY_HEADER;
    ws2.getCell(headerRow2, col).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    ws2.getCell(headerRow2, col).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
  });
  ws2.getRow(headerRow2).height = 28;
  rowNum++;

  for (const r of students) {
    const dr = ws2.getRow(rowNum);
    const vals = [
      r.no, r.fullName, r.cedula, fmtDateShort(r.birthDate), r.age,
      'X', 'X', 'X', 'X', 'X', 'X', 'X', '', '', '',
      toHorarioH(r.scheduleTheory) || r.scheduleTheory,
      toHorarioH(r.schedulePractice) || r.schedulePractice,
      '', '',
    ];
    const blue = isBlueRow(r.no);
    vals.forEach((v, i) => {
      dr.getCell(i + 1).value = v;
      dr.getCell(i + 1).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
      if (blue) dr.getCell(i + 1).fill = FILL_BLUE_ROW;
    });
    rowNum++;
  }

  rowNum++;
  ws2.getCell(rowNum, 1).value = 'Observaciones generales:';
  ws2.mergeCells(rowNum, 1, rowNum, 19);
  ws2.getCell(rowNum, 1).font = FONT_HEADER;
  rowNum++;
  if (imageIdPieFirmas != null) {
    ws2.addImage(imageIdPieFirmas, { tl: { col: 0, row: rowNum - 1 }, ext: { width: 480, height: 100 } });
    rowNum += 5;
  } else {
    const firmaRow = rowNum;
    ws2.mergeCells(firmaRow, 1, firmaRow, 3);
    ws2.getCell(firmaRow, 1).border = { bottom: BORDER_THIN };
    ws2.mergeCells(firmaRow, 5, firmaRow, 7);
    ws2.getCell(firmaRow, 5).border = { bottom: BORDER_THIN };
    rowNum++;
    ws2.getCell(rowNum, 1).value = 'DIRECTOR GENERAL';
    ws2.getCell(rowNum, 1).font = FONT_HEADER;
    ws2.getCell(rowNum, 2).value = 'Crnl. Fausto Gavilanes';
    ws2.getCell(rowNum, 5).value = 'Secretario/a Académico';
    ws2.getCell(rowNum, 5).font = FONT_HEADER;
    ws2.getCell(rowNum, 6).value = 'Ing. Dayana Farias';
    ws2.getCell(rowNum, 9).value = 'Responsable:';
    ws2.getCell(rowNum, 11).value = 'Fecha: ' + fechaHoy;
    rowNum += 2;
  }

  ws2.getColumn(1).width = 5;
  ws2.getColumn(2).width = 30;
  ws2.getColumn(3).width = 14;
  ws2.getColumn(4).width = 12;
  ws2.getColumn(5).width = 8;
  for (let c = 6; c <= 12; c++) ws2.getColumn(c).width = 10;
  ws2.getColumn(13).width = 12;
  ws2.getColumn(14).width = 10;
  ws2.getColumn(15).width = 14;
  ws2.getColumn(16).width = 14;
  ws2.getColumn(17).width = 14;
  ws2.getColumn(18).width = 24;
  ws2.getColumn(19).width = 14;

  // ========== HOJA LISTADO (Hoja1) ==========
  const wsList = workbook.addWorksheet('Hoja1');
  rowNum = 1;
  if (imageIdAnt != null) {
    wsList.addImage(imageIdAnt, { tl: { col: 0, row: 0 }, ext: { width: 56, height: 56 } });
  }
  if (imageIdColorados != null) {
    wsList.addImage(imageIdColorados, { tl: { col: 10, row: 0 }, ext: { width: 56, height: 56 } });
  }
  wsList.getCell(rowNum, 2).value = 'LISTADO EN EXCEL DE LA ESCUELA DE CONDUCCION ' + ESCUELA_NOMBRE;
  wsList.getCell(rowNum, 2).font = FONT_TITLE;
  wsList.mergeCells(rowNum, 2, rowNum, 9);
  wsList.getCell(rowNum, 2).alignment = { horizontal: 'center' };
  rowNum++;
  const listHeaders = ['Nº', 'APELLIDOS Y NOMBRES', 'CEDULA', 'TIPO DE LICENCIA', 'ESCUELA DE CONDUCCION', 'FECHA INICIO CURSO', 'FECHA FIN CURSO', 'Nº DE CURSO', 'APROBADO', 'Nº DE CERTIFICADO', 'Nº PERMISO', 'HORARIO TEORIA'];
  const listHeaderRow = wsList.getRow(rowNum);
  listHeaders.forEach((h, i) => {
    listHeaderRow.getCell(i + 1).value = h;
    listHeaderRow.getCell(i + 1).font = FONT_HEADER;
    listHeaderRow.getCell(i + 1).fill = FILL_GRAY_HEADER;
    listHeaderRow.getCell(i + 1).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
    listHeaderRow.getCell(i + 1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  });
  rowNum++;
  for (const r of students) {
    const lr = wsList.getRow(rowNum);
    const listVals = [r.no, r.fullName, r.cedula, courseName, ESCUELA_NOMBRE, startShort, endShort, code, r.approved ? 'SI' : 'NO', '', '', toHorarioH(r.scheduleTheory) || r.scheduleTheory];
    const blue = isBlueRow(r.no);
    listVals.forEach((v, i) => {
      lr.getCell(i + 1).value = v;
      lr.getCell(i + 1).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
      if (blue) lr.getCell(i + 1).fill = FILL_BLUE_ROW;
    });
    rowNum++;
  }
  rowNum++;
  wsList.getCell(rowNum, 1).value = 'Observaciones generales:';
  wsList.mergeCells(rowNum, 1, rowNum, 12);
  wsList.getCell(rowNum, 1).font = FONT_HEADER;
  rowNum++;
  if (imageIdPieFirmas != null) {
    wsList.addImage(imageIdPieFirmas, { tl: { col: 0, row: rowNum - 1 }, ext: { width: 480, height: 100 } });
    rowNum += 5;
  } else {
    const listFirmaRow = rowNum;
    wsList.mergeCells(listFirmaRow, 1, listFirmaRow, 2);
    wsList.getCell(listFirmaRow, 1).border = { bottom: BORDER_THIN };
    wsList.mergeCells(listFirmaRow, 4, listFirmaRow, 5);
    wsList.getCell(listFirmaRow, 4).border = { bottom: BORDER_THIN };
    rowNum++;
    wsList.getCell(rowNum, 1).value = 'DIRECTOR GENERAL';
    wsList.getCell(rowNum, 1).font = FONT_HEADER;
    wsList.getCell(rowNum, 2).value = 'Crnl. Fausto Gavilanes';
    wsList.getCell(rowNum, 4).value = 'Secretario/a Académico';
    wsList.getCell(rowNum, 4).font = FONT_HEADER;
    wsList.getCell(rowNum, 5).value = 'Ing. Dayana Farias';
    wsList.getCell(rowNum, 7).value = 'Responsable:';
    wsList.getCell(rowNum, 9).value = 'Fecha: ' + fechaHoy;
    rowNum += 2;
  }
  wsList.getColumn(1).width = 6;
  wsList.getColumn(2).width = 32;
  wsList.getColumn(3).width = 14;
  for (let c = 4; c <= 12; c++) wsList.getColumn(c).width = 18;

  // ========== HOJA ANEXO 4 ==========
  const ws4 = workbook.addWorksheet('ANEXO 4');
  rowNum = 1;
  if (imageIdAnt != null) {
    ws4.addImage(imageIdAnt, { tl: { col: 0, row: 0 }, ext: { width: 72, height: 72 } });
  }
  if (imageIdColorados != null) {
    ws4.addImage(imageIdColorados, { tl: { col: 14, row: 0 }, ext: { width: 72, height: 72 } });
  }
  ws4.getCell(rowNum, 2).value = 'COMISION NACIONAL DE TRANSPORTE TERRESTRE, TRANSITO Y SEGURIDAD VIAL';
  ws4.getCell(rowNum, 2).font = { ...FONT_TITLE, size: 14 };
  ws4.mergeCells(rowNum, 2, rowNum, 13);
  ws4.getCell(rowNum, 2).alignment = { horizontal: 'center' };
  rowNum++;
  ws4.getCell(rowNum, 2).value = 'UNIDAD DE ESCUELAS DE CAPACITACION';
  ws4.getCell(rowNum, 2).font = FONT_HEADER;
  ws4.mergeCells(rowNum, 2, rowNum, 13);
  ws4.getCell(rowNum, 2).alignment = { horizontal: 'center' };
  rowNum++;
  const lineRow4 = rowNum;
  ws4.mergeCells(lineRow4, 1, lineRow4, 18);
  ws4.getCell(lineRow4, 1).border = { bottom: BORDER_MEDIUM };
  rowNum++;
  ws4.getCell(rowNum, 1).value = 'ESCUELAS DE CAPACITACION DE CONDUCTORES NO PROFESIONALES';
  ws4.getCell(rowNum, 1).font = FONT_HEADER;
  rowNum++;
  ws4.getCell(rowNum, 1).value = 'VERIFICACION DEL CUMPLIMIENTO DE REQUISITOS DE LOS ALUMNOS PARA EL OTORGAMIENTO DEL TITULO DE CONDUCTOR NO PROFESIONAL - ANEXO 4';
  ws4.getCell(rowNum, 1).font = FONT_HEADER;
  rowNum++;
  ws4.getCell(rowNum, 1).value = 'Nombre de la Escuela:';
  ws4.getCell(rowNum, 2).value = ESCUELA_NOMBRE;
  ws4.getCell(rowNum, 3).value = 'Curso:';
  ws4.getCell(rowNum, 4).value = code;
  ws4.getCell(rowNum, 5).value = 'Paralelo:';
  ws4.getCell(rowNum, 6).value = '1A';
  ws4.getCell(rowNum, 7).value = 'Fecha Inicio Curso:';
  ws4.getCell(rowNum, 8).value = startShort;
  ws4.getCell(rowNum, 9).value = 'Fecha Fin Curso:';
  ws4.getCell(rowNum, 10).value = endShort;
  for (let c = 1; c <= 10; c++) {
    ws4.getCell(rowNum, c).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
  }
  rowNum += 2;

  const numSubjects = subjectLabels.length;
  const subCols = numSubjects * 4;
  const anexo4ColCount = 5 + subCols + 3;
  const hr4 = ws4.getRow(rowNum);
  hr4.getCell(1).value = 'No.';
  hr4.getCell(2).value = 'Apellidos y Nombres';
  hr4.getCell(3).value = 'Cédula';
  hr4.getCell(4).value = 'Matrícula No. Factura';
  hr4.getCell(5).value = 'No. Permiso';
  for (let s = 0; s < numSubjects; s++) {
    const startCol = 6 + s * 4;
    ws4.mergeCells(rowNum, startCol, rowNum, startCol + 3);
    hr4.getCell(startCol).value = subjectLabels[s];
    for (let k = 0; k < 4; k++) {
      ws4.getCell(rowNum, startCol + k).font = FONT_HEADER;
      ws4.getCell(rowNum, startCol + k).fill = FILL_GRAY_HEADER;
      ws4.getCell(rowNum, startCol + k).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
      ws4.getCell(rowNum, startCol + k).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    }
  }
  hr4.getCell(6 + subCols).value = 'Aprobado (S/N)';
  hr4.getCell(7 + subCols).value = 'No. Certificado';
  hr4.getCell(8 + subCols).value = 'Observaciones';
  for (let c = 6 + subCols; c <= anexo4ColCount; c++) {
    hr4.getCell(c).font = FONT_HEADER;
    hr4.getCell(c).fill = FILL_GRAY_HEADER;
    hr4.getCell(c).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
    hr4.getCell(c).alignment = { horizontal: 'center', wrapText: true };
  }
  rowNum++;
  const hr4b = ws4.getRow(rowNum);
  for (let c = 1; c <= 5; c++) {
    hr4b.getCell(c).value = '';
    hr4b.getCell(c).fill = FILL_GRAY_SUB;
    hr4b.getCell(c).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
  }
  for (let i = 0; i < numSubjects; i++) {
    const subH2 = ['Nota', 'Susp. 1', 'Susp. 2', 'Asist.'];
    for (let k = 0; k < 4; k++) {
      const col = 6 + i * 4 + k;
      hr4b.getCell(col).value = subH2[k];
      hr4b.getCell(col).font = FONT_HEADER;
      hr4b.getCell(col).fill = FILL_GRAY_SUB;
      hr4b.getCell(col).alignment = VERTICAL_ALIGN;
      hr4b.getCell(col).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
    }
  }
  for (let c = 6 + subCols; c <= anexo4ColCount; c++) {
    hr4b.getCell(c).value = '';
    hr4b.getCell(c).fill = FILL_GRAY_SUB;
    hr4b.getCell(c).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
  }
  ws4.getRow(rowNum).height = 48;
  rowNum++;

  for (const r of students) {
    const subjectCells = subjectLabels.flatMap((lbl) => {
      const ex = r.examBySubject[lbl];
      const nota = ex ? Math.round(ex.score) : '';
      return [nota, '', '', String(r.attendancePct)];
    });
    const dr4 = ws4.getRow(rowNum);
    const blue = isBlueRow(r.no);
    dr4.getCell(1).value = r.no;
    dr4.getCell(2).value = r.fullName;
    dr4.getCell(3).value = r.cedula;
    dr4.getCell(4).value = '';
    dr4.getCell(5).value = '';
    subjectCells.forEach((v, i) => { dr4.getCell(6 + i).value = v; });
    dr4.getCell(6 + subjectCells.length).value = r.approved ? 'S' : 'N';
    dr4.getCell(7 + subjectCells.length).value = '';
    dr4.getCell(8 + subjectCells.length).value = '';
    for (let c = 1; c <= anexo4ColCount; c++) {
      dr4.getCell(c).border = { top: BORDER_THIN, left: BORDER_THIN, bottom: BORDER_THIN, right: BORDER_THIN };
      if (blue) dr4.getCell(c).fill = FILL_BLUE_ROW;
    }
    rowNum++;
  }
  rowNum++;
  ws4.getCell(rowNum, 1).value = 'Observaciones generales:';
  ws4.mergeCells(rowNum, 1, rowNum, anexo4ColCount);
  ws4.getCell(rowNum, 1).font = FONT_HEADER;
  rowNum++;
  if (imageIdPieFirmas != null) {
    ws4.addImage(imageIdPieFirmas, { tl: { col: 0, row: rowNum - 1 }, ext: { width: 480, height: 100 } });
    rowNum += 5;
  } else {
    const anexo4FirmaRow = rowNum;
    ws4.mergeCells(anexo4FirmaRow, 1, anexo4FirmaRow, 2);
    ws4.getCell(anexo4FirmaRow, 1).border = { bottom: BORDER_THIN };
    ws4.mergeCells(anexo4FirmaRow, 4, anexo4FirmaRow, 5);
    ws4.getCell(anexo4FirmaRow, 4).border = { bottom: BORDER_THIN };
    rowNum++;
    ws4.getCell(rowNum, 1).value = 'DIRECTOR GENERAL';
    ws4.getCell(rowNum, 1).font = FONT_HEADER;
    ws4.getCell(rowNum, 2).value = 'Crnl. Fausto Gavilanes';
    ws4.getCell(rowNum, 4).value = 'Secretario/a Académico';
    ws4.getCell(rowNum, 4).font = FONT_HEADER;
    ws4.getCell(rowNum, 5).value = 'Ing. Dayana Farias';
    ws4.getCell(rowNum, 7).value = 'Responsable:';
    ws4.getCell(rowNum, 9).value = 'Fecha: ' + fechaHoy;
    rowNum += 2;
  }
  ws4.getColumn(1).width = 5;
  ws4.getColumn(2).width = 28;
  ws4.getColumn(3).width = 14;
  ws4.getColumn(4).width = 16;
  ws4.getColumn(5).width = 12;
  for (let c = 6; c <= anexo4ColCount - 3; c++) ws4.getColumn(c).width = 8;
  ws4.getColumn(anexo4ColCount - 2).width = 14;
  ws4.getColumn(anexo4ColCount - 1).width = 14;
  ws4.getColumn(anexo4ColCount).width = 14;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/** Sufijo seguro para nombres de archivo: número/código del curso (ej. CursoTipoB_178 o CLD-IN-308) */
export function getCourseFileSuffix(cohortCode: string): string {
  return cohortCode.replace(/[^a-zA-Z0-9-]/g, '_').trim() || 'curso';
}
