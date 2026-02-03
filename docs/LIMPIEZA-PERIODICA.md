# Limpieza periódica para mantener el plan gratuito

## ¿Funciona?

**Sí.** Borrar usuarios y promociones que ya no necesitan la plataforma (después de descargar el CSV) libera espacio en Supabase y ayuda a no superar el plan gratuito. La empresa conserva los datos en los CSV que ya descargaron.

## Desde la plataforma (recomendado)

En **Reportes por curso**:

1. En la lista de cursos, descarga antes el **CSV** del curso que quieras archivar (selecciónalo y usa el botón verde).
2. Haz clic en **"Eliminar curso y usuarios"** (botón rojo) en la fila de ese curso.
3. Confirma en el modal. Se borrarán ese número de curso y todos los estudiantes asignados (y sus exámenes, respuestas y actividad). Así liberas espacio en un solo paso.

---

## Qué ocupa más espacio en la base de datos

| Tabla | Qué es | Impacto al borrar |
|-------|--------|--------------------|
| **attempt_answers** | Respuestas de cada examen | Mucho (miles de filas) |
| **exam_attempts** | Intentos de examen por usuario | Mucho |
| **user_activity** / **content_views** | Actividad y vistas | Medio |
| **user_profiles** + **auth.users** | Usuarios | Medio (pero al borrar usuario se borra todo lo anterior en cascada) |
| **cohorts** | Promociones (Tipo B Nro 200, etc.) | Poco |
| **courses** / **subjects** / **contents** | Cursos y contenido | Normalmente se mantienen |

Al **borrar un usuario** (estudiante que ya terminó), Supabase borra en cascada:

- Su perfil
- Sus intentos de examen
- Todas sus respuestas (attempt_answers)
- Su actividad y vistas

Eso es lo que más libera espacio.

---

## Flujo recomendado (sin pagar)

1. **Antes de borrar nada**
   - Descargar el **CSV del reporte** del curso/promoción desde **Reportes por curso**.
   - Guardar el CSV en un lugar seguro (Drive, carpeta de la empresa).

2. **Decidir qué borrar**
   - **Usuarios (estudiantes)** que ya no necesiten entrar (curso cerrado, ya tienen su CSV).
   - **Opcional:** promociones (cohorts) que ya no usen (ej. “Tipo B Nro 200” cerrado).  
   Borrar la promoción solo libera unas filas; lo que más ayuda es borrar usuarios.

3. **Orden de borrado**
   - Primero borrar **usuarios** de esa promoción/curso.
   - Después, si quieren, borrar el **cohort** (número de curso) ya vacío.

---

## Cómo borrar usuarios (Supabase)

### Opción A: Desde el dashboard (recomendado al inicio)

1. Entra a [Supabase](https://supabase.com/dashboard) → tu proyecto.
2. **Authentication** → **Users**.
3. Localiza al usuario (por email).
4. Abre el menú (⋮) del usuario → **Delete user**.

Al borrar el usuario de **Authentication**, Supabase borra en cascada:

- `user_profiles`
- `exam_attempts` (y con ellos `attempt_answers`)
- `user_activity`
- `content_views`

No hace falta borrar nada a mano en las otras tablas.

### Opción B: Varios usuarios de una promoción

Si quieres borrar muchos de una vez:

1. En **Reportes por curso** descarga el CSV (tienes la lista de estudiantes).
2. En Supabase **Authentication** → **Users** ve borrando uno por uno, o
3. Usar la API de Supabase (ver abajo) para borrar por lista de emails o por `cohort_id`.

---

## Cómo borrar una promoción (cohort) ya vacía

Solo tiene sentido cuando **ya no queden usuarios** asignados a esa promoción (o ya los borraste).

1. Supabase → **Table Editor** → tabla **cohorts**.
2. Localiza la fila (ej. “Tipo B” nombre “200”).
3. Borra la fila.

Antes de borrarla, asegúrate de que en **user_profiles** nadie tenga ese `cohort_id` (o ya habrás borrado a esos usuarios). Si alguien lo tuviera, al borrar el cohort Supabase pondrá su `cohort_id` en NULL (por el `ON DELETE SET NULL`), no fallará, pero esos usuarios quedarían “sin número de curso”.

---

## Resumen

- **Sí, funciona:** borrar usuarios (y opcionalmente cohorts) que ya no necesiten la plataforma, **después** de descargar el CSV, libera espacio y ayuda a no pagar.
- **Orden:** 1) Descargar CSV, 2) Borrar usuarios en Supabase Auth, 3) (Opcional) Borrar cohort si ya está vacío.
- **Dónde borrar:** Authentication → Users. No hace falta borrar manualmente en otras tablas por las cascadas.

Si más adelante quieres un botón en el panel de admin para “archivar curso” (exportar CSV + marcar o listar usuarios a borrar), se puede añadir como siguiente paso.
