# Diagnóstico: RLS (Row Level Security) en Supabase – Plataforma Colorados Drive

Este documento resume la auditoría del proyecto ante los avisos de Supabase **"RLS Disabled in Public"** y la posible falla de la plataforma. **No se ha modificado ninguna tabla todavía**; primero se presenta el análisis y el plan.

---

## A. DIAGNÓSTICO

### 1. Qué está mal

- **Varias tablas del esquema `public` tienen RLS deshabilitado.**  
  Supabase las marca como expuestas porque cualquiera que tenga la **anon key** (por ejemplo desde el navegador) podría, en teoría, leer o escribir datos si conociera los nombres de las tablas y tuviera permisos GRANT en el esquema.  
  Las tablas reportadas incluyen, entre otras:
  - `subjects`, `courses`, `contents`, `cohorts`
  - `user_profiles`, `payments`, `attendance`, `notifications`, `notification_reads`
  - `instructors`, `course_schedules`, `schedule_groups`, `user_schedule_day_override`
  - `exams`, `questions`, `options`, `exam_attempts`, `attempt_answers`, `exam_extra_attempts`, `exam_availability`
  - `user_activity`, `content_views`
  - `cash_sessions`, `cash_transactions`, `cash_audit`

- **En el código del proyecto no hay ninguna migración ni script que habilite RLS ni defina políticas.**  
  El control de acceso se hace en la **aplicación** (Express: middleware de auth y rutas por rol), no a nivel de base de datos.

### 2. Cómo se usa Supabase en este proyecto

| Origen              | Cliente usado     | Uso real |
|---------------------|------------------|----------|
| **Frontend**        | Ninguno          | No hay `createClient` ni `@supabase/supabase-js`. Todo pasa por la API del backend (`NEXT_PUBLIC_API_URL`) con Bearer token. |
| **Backend**         | `supabaseAdmin`  | **Service role key.** Todas las lecturas/escrituras a tablas (`user_profiles`, `courses`, `attendance`, `payments`, caja, exámenes, etc.) se hacen desde servicios y routers usando `supabaseAdmin`. |
| **Backend (solo Auth)** | `supabaseAnon` | **Anon key** únicamente para `auth.signInWithPassword` en login. No se accede a ninguna tabla `public` con anon. |

Conclusión: **todas las tablas listadas son consumidas solo desde el backend con service role.** No hay acceso directo desde el cliente (navegador) a tablas con anon key.

### 3. Por qué la plataforma podría haber dejado de funcionar

Posibles causas, en orden de probabilidad:

1. **RLS activado manualmente sin políticas**  
   Si en el dashboard de Supabase (o por un script) se activó RLS en algunas tablas y **no** se crearon políticas:
   - El **service role** en Supabase **bypasea RLS** por defecto. Por tanto, el backend que usa solo `supabaseAdmin` **no debería verse bloqueado**.
   - Solo se bloquearía algún acceso que usara **anon** o **authenticated** contra esas tablas; en este proyecto no hay ninguno.

2. **Problema no relacionado con RLS**  
   Caídas o errores pueden deberse a: variables de entorno (URL, service key, anon key), red, cuota del proyecto, cambios en Auth (JWT, dominio), o errores en el frontend/backend (rutas, CORS, etc.). Conviene revisar logs del backend, Supabase (Logs / Auth) y consola del navegador.

3. **Híbrido**  
   Algún script o herramienta externa que use la anon key para tocar tablas; si activaron RLS sin políticas, ese acceso quedaría bloqueado. En el código actual del repo no hay tal uso.

Recomendación: además de aplicar RLS de forma ordenada (ver más abajo), revisar logs y health (`/health`) para confirmar si los fallos coinciden con cambios en Supabase o en configuración.

### 4. Tablas más críticas para la operación (prioridad)

Estas tablas impactan directamente login, alumnos, horarios, pagos, caja y reportes:

| Prioridad | Tabla(s) | Módulos que las usan |
|-----------|----------|----------------------|
| Alta      | `user_profiles` | Auth (login, middleware), admin (usuarios), asistencia, pagos, horarios, exámenes, caja, reportes |
| Alta      | `courses`       | Admin, auth (crear usuario), estudiantes, reportes |
| Alta      | `instructors`   | Admin (instructores, horarios), scheduleService |
| Alta      | `attendance`    | attendanceService (check-in, listado, set manual) |
| Alta      | `payments`      | authService (pago inicial), paymentService |
| Alta      | `schedule_groups`, `course_schedules` | adminService, scheduleService (horarios, grupos, overrides) |
| Alta      | `cash_sessions`, `cash_transactions`, `cash_audit` | cashService (apertura/cierre, movimientos, auditoría) |
| Alta      | `notifications`, `notification_reads` | notificationService (avisos, marcar leído) |
| Media     | `cohorts`       | Admin, auth, reportes, exámenes |
| Media     | `exams`, `questions`, `options`, `exam_attempts`, `attempt_answers`, `exam_availability`, `exam_extra_attempts` | examService, admin, estudiante, reportes |
| Media     | `subjects`, `contents` | Admin, studentService |
| Media     | `user_activity`  | activityService, reportService |
| Baja      | `content_views` | Referida en docs; en código backend no hay `.from('content_views')`. Incluir en RLS por si la tabla existe en Supabase. |
| Baja      | `user_schedule_day_override` | authService, scheduleService |

Todas ellas están accedidas **solo con `supabaseAdmin`** en el backend.

### 5. Riesgo de activar RLS sin políticas

- **Backend (service role):** en Supabase, el rol que usa la **service role key** bypasea RLS. Por tanto, **activar RLS en todas las tablas y no crear políticas no rompe el backend**.
- **Frontend / anon:** no accede a tablas; no hay impacto.
- **Conclusión:** se puede habilitar RLS en todas las tablas listadas sin crear políticas y la aplicación debería seguir funcionando igual, porque el único acceso a datos es vía backend con service role.

---

## B. PLAN DE SOLUCIÓN POR FASES

### Fase 1: Diagnóstico (hecho)

- Auditoría de uso de Supabase (frontend/backend).
- Confirmar que no hay acceso a tablas con anon key.
- Identificar tablas críticas y dependencias.
- Documentar en este archivo.

### Fase 2: Habilitar RLS sin políticas (estabilizar avisos de seguridad)

- Crear **una sola migración** que ejecute `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` para todas las tablas del esquema `public` que Supabase reporta (y las que existan en tu instancia).
- **No** crear políticas en esta fase. El backend sigue usando service role y no se ve afectado.
- Resultado: los avisos "RLS Disabled in Public" desaparecen y la app no se rompe.

### Fase 3: Políticas mínimas (solo si en el futuro se usa anon/authenticated)

- Hoy **no es necesario** crear políticas para que la app funcione.
- Si más adelante se expone algo vía cliente Supabase (anon/authenticated), habrá que añadir políticas concretas para esas tablas y roles (por ejemplo `SELECT` para `authenticated` solo sobre sus propias filas). Eso se haría en migraciones nuevas, por tabla y caso de uso.

### Fase 4: Endurecimiento opcional

- Revisar permisos `GRANT` en el esquema `public` (qué roles pueden hacer SELECT/INSERT/UPDATE/DELETE).
- Mantener la regla: acceso a datos de negocio solo desde backend con service role; cliente solo API REST con JWT.

### Fase 5: Validación

- Ejecutar la migración en un entorno de staging o copia si es posible.
- Comprobar: login, listados (usuarios, cursos, horarios, caja, notificaciones), asistencia, pagos, exámenes, reportes.
- Revisar de nuevo el panel de seguridad de Supabase y confirmar que ya no aparece "RLS Disabled" en las tablas tratadas.

---

## C. MIGRACIONES SQL

Se ha creado **una migración**:

- **`024_enable_rls_public_tables.sql`**  
  Habilita RLS en todas las tablas del listado de Supabase (y `content_views` por si existe).  
  Incluye comentarios por bloque. No define políticas.  
  El backend no requiere cambios; sigue usando `supabaseAdmin`.

Ejecución recomendada: en el **SQL Editor** de Supabase, en el orden indicado en la carpeta de migraciones (después de 023).

---

## D. RECOMENDACIONES FRONTEND / BACKEND

- **Consultas que deben seguir por backend (service role):**  
  Todas las que tocan tablas de negocio (usuarios, cursos, cohortes, horarios, pagos, caja, exámenes, notificaciones, asistencia, etc.). Así se mantiene un solo punto de control (Express + middleware) y RLS actúa como red de seguridad (anon/authenticated no tienen políticas, luego no pueden acceder).

- **Consultas que pueden usar cliente autenticado con RLS:**  
  Ninguna en el diseño actual. Si en el futuro se quisiera que el frontend hable directo con Supabase (por ejemplo para realtime o para reducir carga en el backend), habría que:
  1. Crear políticas explícitas por tabla (por ejemplo solo `SELECT` sobre filas propias del usuario).
  2. Usar la anon key con el JWT del usuario (Supabase asigna ese JWT al rol `authenticated`).  
  Hoy no es necesario.

- **No usar políticas “permitir todo para todos”** en tablas con datos sensibles. Si en algún momento se añaden políticas temporales para depurar, deben estar marcadas como tales y eliminarse o reemplazarse por políticas restrictivas.

---

## E. SEGURIDAD

- La solución aplicada **no es agresiva**: solo activa RLS. No se abre acceso nuevo a anon/authenticated.
- No se ha usado ninguna policy del tipo “permitir todo” sin aviso; de hecho, en esta fase no se crean políticas.
- Las tablas quedan protegidas frente a accesos con anon/authenticated (no podrán leer ni escribir hasta que se definan políticas concretas). El backend no se ve afectado porque usa service role.

Si tras aplicar la migración algo dejara de funcionar, sería importante revisar:
- Que las variables de entorno del backend sigan usando la **service role key** (no la anon).
- Que no exista ningún otro cliente (script, herramienta, otro servicio) que use la anon key para acceder a esas tablas.

---

*Documento generado en el marco de la auditoría RLS del proyecto. Última revisión: marzo 2025.*
