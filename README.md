# Colorados Drive - Plataforma Escuela de Conducción

Plataforma web para la escuela de conducción **Colorados Drive** en Santo Domingo, Ecuador.

## Arquitectura

- **Backend**: Node.js + Express + TypeScript
- **Base de datos**: Supabase (PostgreSQL)
- **Auth**: Supabase Auth (JWT)
- **Frontend**: (pendiente - Next.js recomendado)

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) para el diseño completo.

## Requisitos

- Node.js 18+
- Cuenta en [Supabase](https://supabase.com)

## Configuración

### 1. Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard).
2. En **SQL Editor**, ejecuta el contenido de `backend/src/db/schema.sql`.
3. En **Settings > API**, copia:
   - Project URL
   - anon (public) key
   - service_role key
4. En **Settings > API > JWT Settings**, copia el **JWT Secret**.

### 2. Variables de entorno

Crea `backend/.env`:

```env
PORT=3001
NODE_ENV=development

SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_KEY=tu-service-role-key
SUPABASE_JWT_SECRET=tu-jwt-secret

JWT_SECRET=tu-jwt-secret
```

> Usa el mismo valor para `SUPABASE_JWT_SECRET` y `JWT_SECRET` (el JWT Secret de Supabase).

### 3. Crear admin inicial

1. En Supabase **Authentication > Users**, crea un usuario (o usa la consola).
2. Copia el `id` (UUID) del usuario.
3. En **SQL Editor**:

```sql
INSERT INTO user_profiles (id, email, full_name, role, course_id)
VALUES (
  'UUID-del-usuario',
  'admin@coloradosdrive.com',
  'Administrador',
  'admin',
  NULL
);
```

O usa Supabase Auth Admin desde la consola del proyecto.

### 4. Seed de cursos

```bash
cd backend
npm install
npm run db:seed
```

Esto crea los cursos **Curso Tipo A (MOTO)** y **Curso Tipo B (AUTO)**.

### 5. Frontend

```bash
cd frontend
cp env.example .env.local
npm install
npm run dev
```

Abre http://localhost:3000

## Comandos

```bash
cd backend

# Desarrollo
npm run dev

# Build
npm run build

# Producción
npm start
```

## API Endpoints

### Auth
- `POST /api/auth/login` - Login (email, password)
- `GET /api/auth/me` - Usuario actual (Bearer token)

### Admin (requiere rol admin)
- `POST /api/admin/users` - Crear usuario
- `GET /api/admin/users` - Listar usuarios
- `GET /api/admin/users/:id/activity` - Actividad de usuario
- `GET /api/admin/courses` - Listar cursos
- `POST /api/admin/subjects` - Crear materia
- `GET /api/admin/subjects` - Listar materias
- `POST /api/admin/contents` - Crear contenido
- `POST /api/admin/exams` - Crear examen
- `POST /api/admin/exams/:id/questions` - Agregar pregunta
- `GET /api/admin/exams` - Listar exámenes
- `GET /api/admin/exams/:id/results` - Resultados por examen
- `GET /api/admin/users/:id/exam-results` - Resultados de un usuario

### Student (requiere rol student)
- `GET /api/student/course` - Mi curso
- `GET /api/student/subjects` - Materias de mi curso
- `GET /api/student/subjects/:id/contents` - Contenido de una materia
- `POST /api/student/activity` - Registrar actividad
- `GET /api/student/exams` - Exámenes disponibles
- `POST /api/student/exams/:id/start` - Iniciar examen (retorna preguntas)
- `POST /api/student/attempts/:attemptId/submit` - Enviar respuestas
- `GET /api/student/attempts/:attemptId/result` - Ver resultado
- `GET /api/student/progress` - Progreso general

## 🚀 Despliegue

### Opción Recomendada: Vercel + Railway + Supabase

**Costo:** $0/mes (gratis para empezar)

**Guía rápida:** Ver [DEPLOY.md](DEPLOY.md)

**Guía completa:** Ver [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

### Resumen:

1. **Frontend:** [Vercel](https://vercel.com) - Gratis, perfecto para Next.js
2. **Backend:** [Railway](https://railway.app) - Gratis ($5 crédito/mes)
3. **Base de datos:** Supabase - Ya configurado, plan gratuito suficiente

### Pasos:

1. Sube tu código a GitHub
2. Conecta Vercel para el frontend
3. Conecta Railway para el backend
4. Configura variables de entorno
5. ¡Listo! 🎉

**Nota:** Hostinger básico solo soporta HTML estático, no es adecuado para Next.js ni Node.js. Usa Vercel + Railway en su lugar.

## Estructura del backend

```
backend/
├── src/
│   ├── config/       # Configuración y Supabase
│   ├── db/           # Schema SQL, seed, migrate
│   ├── middleware/   # auth, RBAC
│   ├── routers/      # authRouter, adminRouter, studentRouter
│   ├── services/     # authService, adminService, studentService, examService, activityService
│   ├── types/        # AuthUser, etc.
│   └── index.ts      # Entry point
├── package.json
└── tsconfig.json
```

## Licencia

MIT
