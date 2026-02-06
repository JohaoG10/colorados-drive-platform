# 🚀 Despliegue a producción – Guía paso a paso

## ¿Vercel + Railway o Vercel + Render? (gratis)

| | **Vercel + Railway** | **Vercel + Render** |
|---|---|---|
| **Backend gratis** | ~$5 crédito/mes (suficiente para 1 app pequeña) | 750 h/mes gratis; el servicio **se duerme** tras ~15 min sin visitas |
| **Despertar** | Siempre encendido mientras haya crédito | Primera petición tras dormir tarda **30–60 s** (cold start) |
| **Facilidad** | Muy fácil, deploys rápidos | Fácil, muy similar |
| **Profesional** | Muy bueno | Muy bueno, mejor para producción seria |
| **Dominio propio** | ✅ Sí (gratis) | ✅ Sí (gratis) |

**Recomendación:**

- **Para lanzar ya y probar con clientes:** **Vercel + Railway**. Es más simple, no se duerme y con $5/mes suele bastar para una app de academia.
- **Si prefieres no depender de crédito y aceptas cold starts:** **Vercel + Render**. Plan gratis más “permanente”, pero la primera carga puede ser lenta tras inactividad.

**Dominio propio:** Tanto en Vercel como en Railway/Render puedes añadir un dominio que compres después (ej. en Namecheap, Google Domains, etc.). No hace falta tenerlo para empezar.

---

## Resumen rápido

1. Código en GitHub.
2. Frontend → Vercel (carpeta `frontend`).
3. Backend → Railway o Render (carpeta `backend`).
4. Variables de entorno en cada sitio.
5. Conectar frontend con la URL del backend.
6. (Opcional) Más adelante: comprar dominio y configurarlo en Vercel y, si quieres, en el backend.

---

# Pasos exactos (empezar ya)

## Paso 0: Comprobar que todo corre en local

Abre dos terminales.

**Terminal 1 – Backend:**
```powershell
cd c:\Users\johao\OneDrive\Desktop\colorados-drive-platform\backend
npm install
npm run build
npm start
```
Debe decir algo como: `Colorados Drive API running on port 3001`.

**Terminal 2 – Frontend:**
```powershell
cd c:\Users\johao\OneDrive\Desktop\colorados-drive-platform\frontend
npm install
npm run build
npm start
```
Abre http://localhost:3000 y prueba login y algo básico.

Si algo falla, revisa `.env` en `backend` y `frontend` (usa `env.example` como referencia). Cuando funcione en local, sigue.

---

## Paso 1: Subir el proyecto a GitHub

1. Crea un repositorio en GitHub (ej. `colorados-drive-platform`). No inicialices con README si ya tienes código.
2. En la raíz del proyecto (donde está `backend` y `frontend`):

```powershell
cd c:\Users\johao\OneDrive\Desktop\colorados-drive-platform
git init
git add .
git commit -m "Listo para producción"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/colorados-drive-platform.git
git push -u origin main
```
(Sustituye `TU_USUARIO` por tu usuario de GitHub.)

---

## Paso 2: Desplegar el frontend en Vercel

1. Entra en **[vercel.com](https://vercel.com)** e inicia sesión con **GitHub**.
2. **Add New…** → **Project**.
3. Importa el repo **colorados-drive-platform**.
4. Configuración del proyecto:
   - **Root Directory:** haz clic en **Edit** y elige **`frontend`**.
   - **Framework Preset:** Next.js (debe detectarse solo).
   - **Build Command:** `npm run build` (o vacío).
   - **Output Directory:** vacío (por defecto).
5. **Environment Variables:**
   - Nombre: `NEXT_PUBLIC_API_URL`
   - Valor: de momento pon un placeholder, ej. `https://placeholder.railway.app` (lo cambias en el Paso 4).
6. **Deploy**.
7. Cuando termine, copia la URL del proyecto (ej. `https://colorados-drive-platform.vercel.app`). La usarás en el backend (CORS) y para `NEXT_PUBLIC_API_URL`.

---

## Paso 3: Desplegar el backend (elegir uno)

### Opción A: Railway

1. Entra en **[railway.app](https://railway.app)** e inicia sesión con **GitHub**.
2. **New Project** → **Deploy from GitHub repo** → elige **colorados-drive-platform**.
3. En el servicio desplegado, entra en **Settings** (o **Variables**):
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
4. **Variables** (añade cada una):
   - `PORT` = `3001`
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = orígenes permitidos separados por coma. Ejemplo: `https://colorados-drive-platform.vercel.app,https://*.vercel.app` (dominio principal + previews de Vercel).
   - `SUPABASE_URL` = tu URL de Supabase.
   - `SUPABASE_ANON_KEY` = tu anon key.
   - `SUPABASE_SERVICE_KEY` = tu service role key.
   - `SUPABASE_JWT_SECRET` = tu JWT secret de Supabase.
   - `JWT_SECRET` = mismo valor que uses para JWT (puede ser el mismo que `SUPABASE_JWT_SECRET`).
5. **Deploy** (o espera al redeploy automático). Cuando esté en verde, abre **Settings** → **Networking** → **Generate Domain**. Copia la URL (ej. `https://colorados-drive-production-xxxx.up.railway.app`).

**Comprobar:** Abre en el navegador `https://TU-URL-RAILWAY/health`. Debe responder algo como `{"status":"ok", ...}`.

### Opción B: Render

El backend está preparado para Render (tipos TypeScript en `dependencies` para que el build funcione con `npm install && npm run build`).

1. Entra en **[render.com](https://render.com)** e inicia sesión con **GitHub**.
2. **New +** → **Web Service**.
3. Conecta el repo **colorados-drive-platform**.
4. Configuración:
   - **Name:** ej. `colorados-drive-api`
   - **Region:** el más cercano a tus usuarios.
   - **Root Directory:** `backend`
   - **Runtime:** Node.
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free (el servicio se dormirá tras inactividad).
5. **Environment Variables** (mismas que en Railway):
   - `PORT` = `3001`
   - `NODE_ENV` = `production`
   - `CORS_ORIGIN` = orígenes permitidos separados por coma. Ejemplo: `https://colorados-drive-platform.vercel.app,https://*.vercel.app` (dominio principal + previews).
   - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_KEY`, `SUPABASE_JWT_SECRET`, `JWT_SECRET`.
6. **Create Web Service**. Cuando termine, copia la URL (ej. `https://colorados-drive-api.onrender.com`).

**Comprobar:** `https://TU-URL-RENDER/health` → `{"status":"ok", ...}`.

---

## Paso 4: Enlazar frontend con backend

1. Vuelve a **Vercel** → tu proyecto → **Settings** → **Environment Variables**.
2. Edita `NEXT_PUBLIC_API_URL` y pon la URL **real** del backend:
   - Railway: `https://xxxx.up.railway.app`
   - Render: `https://colorados-drive-api.onrender.com`
   (Sin barra al final.)
3. **Save**.
4. **Deployments** → en el último deployment, menú **⋯** → **Redeploy** (para que el frontend use la nueva variable).

---

## Paso 5: Verificación final

- Frontend: abre la URL de Vercel y haz login.
- Si hay error de CORS: revisa que `CORS_ORIGIN` en Railway/Render sea **exactamente** la URL de Vercel (con `https://`, sin `/` al final).
- Prueba una acción que use la API (exámenes, subida, etc.).

---

## Dominio propio (después)

Cuando quieras usar un dominio comprado (ej. `coloradosdrive.com`):

1. **Comprar dominio** en el registrador que prefieras (Namecheap, Google Domains, Cloudflare, etc.).
2. **En Vercel (frontend):**
   - Proyecto → **Settings** → **Domains** → **Add**.
   - Escribes el dominio (ej. `app.coloradosdrive.com` o `coloradosdrive.com`).
   - Vercel te indica qué registros DNS crear (normalmente un **CNAME** apuntando a `cname.vercel-dns.com` o una **A** a una IP). Los configuras en el panel de tu registrador.
   - Cuando el DNS propague (minutos a 48 h), Vercel activa HTTPS automático.
3. **Actualizar backend:**
   - En Railway/Render, en `CORS_ORIGIN` añade o cambia a tu nuevo dominio (ej. `https://app.coloradosdrive.com`). Si tu backend debe aceptar varios orígenes, tendrías que ajustar el backend para permitir una lista (por ahora con uno basta).
4. **Opcional – subdominio para la API:**  
   En Railway/Render suele poder configurarse un dominio propio para el backend (ej. `api.coloradosdrive.com`). En ese caso, en Vercel actualizas `NEXT_PUBLIC_API_URL` a `https://api.coloradosdrive.com`.

No es obligatorio hacer esto el primer día; puedes empezar con las URLs de Vercel y Railway/Render y añadir el dominio cuando lo tengas.

---

## Checklist antes de dar por “en producción”

- [ ] Repo en GitHub y push reciente.
- [ ] Frontend en Vercel con `Root Directory` = `frontend`.
- [ ] Backend en Railway o Render con `Root Directory` = `backend`.
- [ ] Variables de entorno en backend (Supabase, JWT, CORS).
- [ ] `NEXT_PUBLIC_API_URL` en Vercel apuntando a la URL real del backend.
- [ ] `/health` del backend responde OK.
- [ ] Login y flujo principal probados en la URL de Vercel.
- [ ] (Opcional) Dominio añadido en Vercel y CORS/API URL actualizados.

Si sigues estos pasos en orden, tendrás el producto desplegado de forma profesional y, más adelante, podrás añadir el dominio sin cambiar la arquitectura.
