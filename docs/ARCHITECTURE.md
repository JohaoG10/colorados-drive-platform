# Colorados Drive - Arquitectura de Plataforma

## 1. Stack Tecnológico Recomendado

### Opción A (Recomendada): Node.js + Supabase + Next.js
- **Backend**: Node.js + Express + TypeScript
- **Base de datos**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (Admin API para crear usuarios)
- **Frontend**: Next.js 14 (App Router)

### Opción B: Supabase como BFF
- **Backend**: Supabase Edge Functions + RLS
- **Base de datos**: Supabase PostgreSQL
- **Auth**: Supabase Auth
- **Frontend**: Next.js

---

## Recomendación: Opción A

### Justificación (7 puntos)

1. **Supabase (Postgres + Auth)**  
   Base de datos PostgreSQL en la nube con plan gratuito generoso. Auth integrado con JWT, Admin API para crear usuarios por rol. Fácil de mantener desde el dashboard.

2. **Separación backend/frontend**  
   Lógica de negocio, RBAC y validaciones centralizadas en el backend. El frontend solo consume APIs. Facilita testing y mantenimiento.

3. **Node.js + Express + TypeScript**  
   Ecosistema maduro, tipado seguro, muchas librerías. Express permite implementar RBAC con middleware de forma clara.

4. **Despliegue acorde a tu hosting**  
   Backend en Render (plan gratuito) o Railway. Frontend en Vercel (gratis) o Hostinger estático. DB en Supabase (gratis hasta ~500MB).

5. **Supabase Auth con Admin API**  
   El admin puede crear usuarios con contraseña temporal vía Admin API. Soporta link de activación. No manejas passwords directamente.

6. **Escalabilidad futura**  
   Si más adelante quieres VPS o más control, migras backend y DB sin tocar la arquitectura general.

7. **Costo bajo**  
   Supabase free, Render free, Vercel free = operación sin costo inicial.

---

## 2. Modelo de Datos

### Diagrama ER (conceptual)

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   courses   │────<│   subjects   │────<│  contents   │
└─────────────┘     └──────────────┘     └─────────────┘
       │                     │
       │                     │
       ▼                     ▼
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   users     │     │   exams      │────<│  questions  │
└─────────────┘     └──────────────┘     └─────────────┘
       │                     │                    │
       │                     │                    ▼
       │                     │             ┌─────────────┐
       │                     │             │  options    │
       │                     │             └─────────────┘
       │                     │
       └─────────────────────┼─────────────┐
                             ▼             │
                      ┌──────────────┐     │
                      │ exam_attempts│     │
                      └──────────────┘     │
                             │             │
                             ▼             ▼
                      ┌──────────────┐  ┌─────────────────┐
                      │user_activity │  │ attempt_answers │
                      └──────────────┘  └─────────────────┘
```

### Tablas

| Tabla | Descripción |
|-------|-------------|
| `courses` | Cursos (Tipo A, Tipo B) |
| `subjects` | Materias por curso |
| `contents` | Contenido por materia (texto + link) |
| `users` | Usuarios con rol y curso asignado (extiende auth.users) |
| `exams` | Exámenes por materia o por curso |
| `questions` | Preguntas de opción múltiple |
| `options` | Opciones por pregunta (4 opciones, 1 correcta) |
| `exam_attempts` | Intentos de examen (1 por usuario/examen) |
| `attempt_answers` | Respuestas por intento |
| `user_activity` | Registro de actividad (última sesión, tiempo estimado) |

### Esquema detallado

```sql
-- courses
id (uuid, PK), name (varchar), code (varchar, unique), created_at, updated_at

-- subjects
id (uuid, PK), course_id (FK), name (varchar), order_index (int), created_at, updated_at

-- contents
id (uuid, PK), subject_id (FK), title (varchar), body (text), external_link (varchar), order_index (int), created_at, updated_at

-- users (perfiles en nuestra app; auth en Supabase Auth)
id (uuid, PK, FK auth.users), email, full_name, role (admin|student), course_id (FK nullable), 
must_change_password (bool), created_at, updated_at

-- exams
id (uuid, PK), subject_id (FK nullable), course_id (FK nullable), 
title (varchar), description (text), question_count (int), passing_score (decimal), 
created_at, updated_at

-- questions
id (uuid, PK), exam_id (FK), question_text (text), order_index (int), created_at

-- options
id (uuid, PK), question_id (FK), option_text (text), is_correct (bool), order_index (int)

-- exam_attempts
id (uuid, PK), exam_id (FK), user_id (FK), score (decimal), passed (bool), 
started_at, finished_at, UNIQUE(exam_id, user_id)

-- attempt_answers
id (uuid, PK), attempt_id (FK), question_id (FK), option_id (FK), is_correct (bool)

-- user_activity
id (uuid, PK), user_id (FK), last_active_at, total_time_seconds (int), contents_viewed (jsonb), updated_at
```

---

## 3. Endpoints REST

### Auth

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| POST | `/api/auth/login` | público | Login (email + password) → JWT |
| POST | `/api/auth/refresh` | autenticado | Refrescar token |
| GET | `/api/auth/me` | autenticado | Obtener usuario actual |

### Admin - Usuarios

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| POST | `/api/admin/users` | admin | Crear usuario y asignar curso |
| GET | `/api/admin/users` | admin | Listar usuarios (filtros: curso, rol) |
| GET | `/api/admin/users/:id` | admin | Detalle de usuario |
| PATCH | `/api/admin/users/:id` | admin | Actualizar usuario |
| GET | `/api/admin/users/:id/activity` | admin | Actividad del usuario |

### Admin - Cursos y materias

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| GET | `/api/admin/courses` | admin | Listar cursos |
| POST | `/api/admin/subjects` | admin | Crear materia |
| GET | `/api/admin/subjects` | admin | Listar materias (por curso) |
| POST | `/api/admin/contents` | admin | Crear contenido |
| PATCH | `/api/admin/contents/:id` | admin | Editar contenido |

### Admin - Exámenes

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| POST | `/api/admin/exams` | admin | Crear examen |
| POST | `/api/admin/exams/:id/questions` | admin | Agregar pregunta |
| GET | `/api/admin/exams` | admin | Listar exámenes |
| GET | `/api/admin/exams/:id/results` | admin | Resultados por examen |
| GET | `/api/admin/users/:id/exam-results` | admin | Resultados de un usuario |

### Usuario (student)

| Método | Ruta | Permisos | Descripción |
|--------|------|----------|-------------|
| GET | `/api/student/course` | student | Mi curso asignado |
| GET | `/api/student/subjects` | student | Materias de mi curso |
| GET | `/api/student/subjects/:id/contents` | student | Contenido de una materia |
| POST | `/api/student/activity` | student | Registrar actividad (heartbeat) |
| GET | `/api/student/exams` | student | Exámenes disponibles |
| POST | `/api/student/exams/:id/attempt` | student | Iniciar/rendir examen |
| GET | `/api/student/exams/:id/attempt` | student | Ver resultado de mi intento |
| GET | `/api/student/progress` | student | Progreso (materias, exámenes) |

---

## 4. Permisos y RBAC

- **admin**: Acceso total a rutas `/api/admin/*`
- **student**: Solo `/api/student/*` y solo datos de su curso asignado
- Validación de `course_id` en cada request de student
- Un intento por examen: constraint `UNIQUE(exam_id, user_id)` en `exam_attempts`

---

## 5. Estrategia de Despliegue

| Componente | Servicio | Notas |
|------------|----------|-------|
| Backend API | Render (Web Service) | Plan free, auto-deploy desde GitHub |
| Base de datos | Supabase | Plan free, conexión directa desde Render |
| Auth | Supabase Auth | JWT validado en backend |
| Frontend | Vercel | Plan free, o Hostinger estático (SPA) |
| Variables | .env en cada servicio | `DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `JWT_SECRET` |

### Docker (desarrollo local)
- `docker-compose.yml` con PostgreSQL local (opcional, para dev sin Supabase)
- O uso directo de Supabase desde local con `.env`
