# Guía paso a paso: Configurar Supabase y crear el primer admin

Esta guía te lleva desde cero hasta poder iniciar sesión en la plataforma Colorados Drive.

---

## 1. ¿Qué es Supabase?

Supabase es un servicio en la nube que ofrece:
- **Base de datos** (PostgreSQL)
- **Autenticación** (usuarios con email y contraseña)
- Un panel web para ver y editar datos

Es gratuito para proyectos pequeños. Solo necesitas una cuenta (puedes usar Google o GitHub).

---

## 2. Crear una cuenta y proyecto en Supabase

1. Entra a **https://supabase.com**
2. Haz clic en **"Start your project"**
3. Inicia sesión con **Google** o **GitHub**
4. Haz clic en **"New Project"**
5. Completa:
   - **Name**: `colorados-drive` (o el nombre que quieras)
   - **Database Password**: inventa una contraseña fuerte y **guárdala** (la necesitarás si quieres conectar desde un cliente SQL)
   - **Region**: elige la más cercana (por ejemplo South America - São Paulo)
6. Haz clic en **"Create new project"**
7. Espera 1–2 minutos hasta que el proyecto esté listo

---

## 3. Ejecutar el esquema de la base de datos

Esto crea las tablas que usa la plataforma.

1. En el panel de Supabase, en el menú izquierdo, haz clic en **"SQL Editor"** (ícono de código)
2. Haz clic en **"New query"**
3. Abre el archivo `backend/src/db/schema.sql` de este proyecto y **copia todo su contenido**
4. Pégalo en el editor SQL de Supabase
5. Haz clic en **"Run"** (o Ctrl+Enter)
6. Debe aparecer "Success" en verde

Si sale algún error, copia el mensaje. A veces la extensión UUID ya existe; si dice algo como "already exists", puedes ignorarlo o quitar esa línea del SQL.

**Si ya ejecutaste el schema antes:** ejecuta las migraciones en SQL Editor:

```sql
-- Archivos
ALTER TABLE contents ADD COLUMN IF NOT EXISTS file_url VARCHAR(500);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url VARCHAR(500);

-- Promociones (cohorts)
CREATE TABLE IF NOT EXISTS cohorts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  code VARCHAR(50) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(course_id, code)
);
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cohort_id UUID REFERENCES cohorts(id) ON DELETE SET NULL;

-- Cédula para usuarios (búsqueda e identificación)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS cedula VARCHAR(20);
CREATE INDEX IF NOT EXISTS idx_user_profiles_cedula ON user_profiles(cedula);

-- Banco de preguntas por materia (ejecutar en este orden)
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject_id UUID REFERENCES subjects(id) ON DELETE CASCADE;
ALTER TABLE questions ALTER COLUMN exam_id DROP NOT NULL;
UPDATE questions q SET subject_id = e.subject_id, exam_id = NULL FROM exams e WHERE q.exam_id = e.id AND e.subject_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_questions_subject ON questions(subject_id);
```

---

## 4. Obtener las credenciales (API Keys)

1. En el menú izquierdo, haz clic en **"Project Settings"** (engranaje abajo)
2. Entra a **"API"**
3. Anota estos valores:
   - **Project URL** (ej: `https://xxxxxxxx.supabase.co`)
   - **anon public** (clave larga que empieza con `eyJ...`)
   - **service_role** (otra clave larga) → ⚠️ **Esta clave es secreta**, no la compartas

4. En el menú izquierdo, entra a **"API"** y busca la sección **"JWT Settings"**
   - Copia **"JWT Secret"** (una clave larga)

---

## 5. Configurar el backend (.env)

1. En la carpeta `backend`, crea un archivo llamado `.env`
2. Copia el contenido de `backend/env.example` y reemplaza con tus datos:

```
PORT=3001
NODE_ENV=development

SUPABASE_URL=https://TU-PROYECTO.supabase.co
SUPABASE_ANON_KEY=eyJ...tu-anon-key...
SUPABASE_SERVICE_KEY=eyJ...tu-service-role-key...
SUPABASE_JWT_SECRET=tu-jwt-secret-copiado
JWT_SECRET=tu-jwt-secret-copiado
```

> Usa el mismo valor para `SUPABASE_JWT_SECRET` y `JWT_SECRET` (el JWT Secret de Supabase).

---

## 6. Crear los cursos iniciales

Abre una terminal en la carpeta del proyecto y ejecuta:

```bash
cd backend
npm install
npm run db:seed
```

Debería aparecer algo como: `Seeded: Curso Tipo A (MOTO), Curso Tipo B (AUTO)`.

---

## 7. Crear el primer usuario admin

Hay dos formas:

### Opción A: Desde el panel de Supabase (más fácil)

1. En Supabase, ve al menú **"Authentication"** → **"Users"**
2. Haz clic en **"Add user"** → **"Create new user"**
3. Completa:
   - **Email**: `admin@coloradosdrive.com` (o el que prefieras)
   - **Password**: una contraseña que recuerdes (mínimo 6 caracteres)
   - **Auto Confirm User**: activa esta casilla ✅
4. Haz clic en **"Create user"**
5. Se creará el usuario. Haz clic en la fila del usuario para ver sus detalles
6. **Copia el UUID** del usuario (algo como `a1b2c3d4-e5f6-7890-abcd-ef1234567890`)

7. Ve al **SQL Editor** y ejecuta esta consulta (reemplaza los valores):

```sql
INSERT INTO user_profiles (id, email, full_name, role, course_id)
VALUES (
  'PEGA-AQUI-EL-UUID-DEL-USUARIO',
  'admin@coloradosdrive.com',
  'Administrador',
  'admin',
  NULL
);
```

> Cambia `admin@coloradosdrive.com` si usaste otro email. El `id` debe ser exactamente el UUID que copiaste.

### Opción B: Crear usuario con script (después de tener un admin)

Si ya tienes un admin creado, puedes crear más usuarios desde la propia plataforma en **Admin → Usuarios**.

---

## 8. Iniciar backend y frontend

### Terminal 1 – Backend

```bash
cd backend
npm run dev
```

Debe aparecer: `Colorados Drive API running on port 3001`

### Terminal 2 – Frontend

```bash
cd frontend
```

Crea el archivo `.env.local` con:

```
NEXT_PUBLIC_API_URL=http://localhost:3001
```

Luego:

```bash
npm install
npm run dev
```

---

## 9. Iniciar sesión

1. Abre el navegador en **http://localhost:3000**
2. Haz clic en **"Iniciar sesión"** o **"Acceder a la plataforma"**
3. Ingresa el **email** y **contraseña** del admin que creaste
4. Deberías entrar al panel de administración

---

## 10. Storage para archivos (opcional)

Para subir archivos en contenidos e imágenes en preguntas:

1. En Supabase, ve a **Storage** en el menú
2. Haz clic en **"New bucket"**
3. Nombre: `colorados-drive`
4. Activa **"Public bucket"** (para que los archivos sean accesibles)
5. Haz clic en **"Create bucket"**

## Resumen de URLs útiles

- **Supabase Dashboard**: https://supabase.com/dashboard  
- **Frontend local**: http://localhost:3000  
- **Backend local**: http://localhost:3001  

---

## Problemas frecuentes

**"Invalid email or password"**  
- Revisa que el usuario exista en Authentication → Users  
- Verifica que en `user_profiles` haya una fila con el mismo `id` (UUID) del usuario

**"User profile not found"**  
- El usuario está en Auth pero no en `user_profiles`. Ejecuta el INSERT del paso 7.

**"Sesión expirada" o "Token inválido o expirado"**  
- **Causa más común**: `JWT_SECRET` en el backend no coincide con Supabase. En Supabase → Project Settings → API → JWT Settings, copia el **JWT Secret** y pégalo exactamente en `JWT_SECRET` y `SUPABASE_JWT_SECRET` del archivo `backend/.env`.
- Los tokens de Supabase expiran en ~1 hora. Si pasó mucho tiempo, cierra sesión e inicia de nuevo.
- **Usuario sin perfil**: Verifica en Supabase (Table Editor → user_profiles) que exista una fila con `id` igual al UUID del usuario en Authentication → Users, y `role = 'admin'`.
- **Enlaces con recarga**: Usa los enlaces del menú lateral (Usuarios, Cursos y materias, Exámenes), no los botones de "Acciones rápidas" si recargan la página completa.

**"No se pudo conectar con el servidor"**  
- Comprueba que el backend esté corriendo: `cd backend` → `npm run dev`
- Revisa que `NEXT_PUBLIC_API_URL` en el frontend (`.env.local`) sea `http://localhost:3001`

**Error al ejecutar el schema.sql**  
- Si dice que `auth.users` no existe: Supabase lo crea automáticamente. Espera un poco y vuelve a intentar.  
- Si dice que la extensión UUID ya existe: quita la línea `CREATE EXTENSION IF NOT EXISTS "uuid-ossp";` y ejecuta el resto.
