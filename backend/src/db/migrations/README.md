# Migraciones de base de datos

Estas migraciones deben ejecutarse **en el SQL Editor de Supabase** (Dashboard → SQL Editor) en orden, si tu proyecto no partió del `schema.sql` completo.

## Orden recomendado

1. `009_instructors_and_schedules.sql` — instructores y horarios por curso  
2. `010_course_price_and_payments.sql` — precio por tipo de curso, total/abonado por alumno y tabla de pagos  
3. `011_student_extra_fields.sql` — fecha nacimiento, dirección, teléfono, fechas inicio/fin, modalidad (inscripción y reportes)  

## Cómo aplicar la migración 010 (precio y pagos)

Si ves errores como **"Could not find the 'price' column of 'courses' in the schema cache"** o **"column courses_1.price does not exist"**:

1. Entra en tu proyecto en [Supabase](https://supabase.com/dashboard) → **SQL Editor**.
2. Crea una nueva query y pega el contenido de `010_course_price_and_payments.sql`.
3. Ejecuta la query (Run).
4. Opcional: en **Settings → API** puedes forzar la actualización del schema cache si los cambios no se reflejan de inmediato.

Tras ejecutar la 010, la API usará la columna `price` en cursos y las de pagos en `user_profiles` y `payments` con normalidad.
