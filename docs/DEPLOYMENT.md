# Guía de Despliegue - Colorados Drive Platform

## 🎯 Opciones Recomendadas (de mejor a más económica)

### ⭐ **OPCIÓN 1: Vercel + Railway + Supabase (RECOMENDADA)**

**Costo:** $0-5 USD/mes (gratis para empezar)

#### Ventajas:
- ✅ **Vercel**: Gratis, profesional, perfecto para Next.js (creado por el equipo de Next.js)
- ✅ **Railway**: Muy fácil de usar, plan gratuito generoso ($5 crédito/mes)
- ✅ **Supabase**: Ya lo tienes, plan gratuito es suficiente
- ✅ Despliegue automático desde GitHub
- ✅ SSL/HTTPS automático
- ✅ Muy rápido y confiable

#### Configuración:

**1. Frontend en Vercel:**
```bash
# 1. Sube tu código a GitHub (si no lo has hecho)
git init
git add .
git commit -m "Initial commit"
git remote add origin https://github.com/tu-usuario/colorados-drive-platform.git
git push -u origin main

# 2. Ve a vercel.com y conecta tu repositorio
# 3. Configura:
#    - Framework Preset: Next.js
#    - Root Directory: frontend
#    - Build Command: npm run build
#    - Output Directory: .next
# 4. Variables de entorno:
#    NEXT_PUBLIC_API_URL=https://tu-backend.railway.app
```

**2. Backend en Railway:**
```bash
# 1. Ve a railway.app y conecta tu GitHub
# 2. Crea un nuevo proyecto desde tu repo
# 3. Configura:
#    - Root Directory: backend
#    - Build Command: npm install && npm run build
#    - Start Command: npm start
# 4. Variables de entorno (desde Railway dashboard):
#    PORT=3001
#    NODE_ENV=production
#    SUPABASE_URL=tu-url-de-supabase
#    SUPABASE_ANON_KEY=tu-anon-key
#    SUPABASE_SERVICE_KEY=tu-service-key
#    SUPABASE_JWT_SECRET=tu-jwt-secret
#    JWT_SECRET=tu-jwt-secret
#    CORS_ORIGIN=https://tu-app.vercel.app
```

**3. Supabase:**
- Ya está configurado, solo asegúrate de que las variables de entorno apunten correctamente

---

### 🥈 **OPCIÓN 2: Vercel + Render + Supabase**

**Costo:** $0-7 USD/mes

#### Ventajas:
- ✅ Render tiene plan gratuito (más limitado que Railway)
- ✅ Muy estable y profesional
- ✅ Similar a Railway pero con más opciones de escalado

#### Configuración:

**Backend en Render:**
1. Ve a render.com y conecta GitHub
2. Crea un **Web Service**:
   - Build Command: `cd backend && npm install && npm run build`
   - Start Command: `cd backend && npm start`
3. Añade variables de entorno (igual que Railway)

---

### 🥉 **OPCIÓN 3: Render Full Stack**

**Costo:** $0-7 USD/mes

#### Ventajas:
- ✅ Todo en un solo lugar
- ✅ Plan gratuito disponible
- ✅ Fácil de gestionar

#### Configuración:

**Frontend en Render:**
- Tipo: **Static Site**
- Build Command: `cd frontend && npm install && npm run build`
- Publish Directory: `frontend/.next`

**Backend en Render:**
- Tipo: **Web Service** (igual que opción 2)

---

## 📋 Comparación de Opciones

| Característica | Vercel + Railway | Vercel + Render | Render Full Stack |
|---------------|------------------|-----------------|-------------------|
| **Costo inicial** | $0 | $0 | $0 |
| **Facilidad** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Velocidad** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Profesional** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| **Escalabilidad** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |

---

## 🚀 Pasos Detallados para Opción 1 (Recomendada)

### Paso 1: Preparar el código

#### 1.1 Actualizar variables de entorno

**`frontend/.env.production`** (crear este archivo):
```env
NEXT_PUBLIC_API_URL=https://tu-backend.railway.app
```

**`backend/.env.production`** (crear este archivo):
```env
PORT=3001
NODE_ENV=production
SUPABASE_URL=https://tu-proyecto.supabase.co
SUPABASE_ANON_KEY=tu-anon-key
SUPABASE_SERVICE_KEY=tu-service-key
SUPABASE_JWT_SECRET=tu-jwt-secret
JWT_SECRET=tu-jwt-secret
CORS_ORIGIN=https://tu-app.vercel.app
```

#### 1.2 Actualizar CORS en backend

Asegúrate de que `backend/src/index.ts` acepte el origen de producción:

```typescript
// En el archivo donde configuras CORS
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
};
```

### Paso 2: Subir a GitHub

```bash
# Si no tienes git inicializado
git init
git add .
git commit -m "Preparado para producción"

# Crea un repo en GitHub y luego:
git remote add origin https://github.com/tu-usuario/colorados-drive-platform.git
git branch -M main
git push -u origin main
```

### Paso 3: Desplegar Frontend en Vercel

1. Ve a [vercel.com](https://vercel.com) y regístrate con GitHub
2. Click en **"Add New Project"**
3. Importa tu repositorio
4. Configuración:
   - **Framework Preset:** Next.js (detectado automáticamente)
   - **Root Directory:** `frontend`
   - **Build Command:** `npm run build` (o déjalo vacío, Vercel lo detecta)
   - **Output Directory:** `.next` (o déjalo vacío)
5. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = `https://tu-backend.railway.app` (lo actualizarás después)
6. Click **Deploy**
7. Una vez desplegado, copia la URL (ej: `https://colorados-drive.vercel.app`)

### Paso 4: Desplegar Backend en Railway

1. Ve a [railway.app](https://railway.app) y regístrate con GitHub
2. Click **"New Project"** → **"Deploy from GitHub repo"**
3. Selecciona tu repositorio
4. Railway detectará automáticamente que es Node.js
5. Configuración:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
6. **Variables de entorno** (en Settings → Variables):
   ```
   PORT=3001
   NODE_ENV=production
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=tu-anon-key
   SUPABASE_SERVICE_KEY=tu-service-key
   SUPABASE_JWT_SECRET=tu-jwt-secret
   JWT_SECRET=tu-jwt-secret
   CORS_ORIGIN=https://colorados-drive.vercel.app
   ```
7. Railway generará una URL automáticamente (ej: `https://colorados-drive-production.up.railway.app`)
8. Copia esta URL y actualiza en Vercel:
   - Ve a Vercel → Tu proyecto → Settings → Environment Variables
   - Actualiza `NEXT_PUBLIC_API_URL` con la URL de Railway
   - Haz un nuevo deploy

### Paso 5: Configurar dominio personalizado (opcional)

**En Vercel:**
1. Settings → Domains
2. Añade tu dominio (ej: `app.coloradosdrive.com`)
3. Sigue las instrucciones de DNS

**En Railway:**
- Puedes usar el dominio gratuito que te dan, o configurar uno personalizado

---

## 🔒 Seguridad en Producción

### Checklist:

- [ ] Todas las variables de entorno están configuradas
- [ ] `NODE_ENV=production` en el backend
- [ ] CORS configurado solo para tu dominio de producción
- [ ] Supabase tiene las políticas RLS correctas
- [ ] No hay credenciales hardcodeadas en el código
- [ ] HTTPS está habilitado (automático en Vercel/Railway)

---

## 💰 Costos Estimados

### Plan Gratuito (suficiente para empezar):
- **Vercel:** Gratis (100GB bandwidth/mes)
- **Railway:** Gratis ($5 crédito/mes, suficiente para ~500 horas)
- **Supabase:** Gratis (500MB base de datos, 2GB bandwidth/mes)

### Si necesitas más:
- **Vercel Pro:** $20/mes (mejor para producción)
- **Railway:** $5-20/mes según uso
- **Supabase Pro:** $25/mes (8GB base de datos)

---

## 🆘 Troubleshooting

### Error: CORS bloqueado
- Verifica que `CORS_ORIGIN` en Railway tenga la URL exacta de Vercel
- Asegúrate de que no haya trailing slash

### Error: Variables de entorno no funcionan
- En Vercel, las variables que empiezan con `NEXT_PUBLIC_` son públicas
- Reinicia el servicio después de cambiar variables

### Error: Base de datos no conecta
- Verifica que las URLs de Supabase sean correctas
- Asegúrate de que el proyecto de Supabase esté activo

---

## 📞 Soporte

- **Vercel:** [vercel.com/docs](https://vercel.com/docs)
- **Railway:** [docs.railway.app](https://docs.railway.app)
- **Supabase:** [supabase.com/docs](https://supabase.com/docs)

---

## ✅ Checklist Final

Antes de entregar al cliente:

- [ ] Frontend desplegado y accesible
- [ ] Backend desplegado y respondiendo
- [ ] Login funciona correctamente
- [ ] Base de datos conectada
- [ ] Subida de archivos funciona
- [ ] Dominio personalizado configurado (si aplica)
- [ ] Documentación de acceso entregada al cliente
- [ ] Credenciales de admin creadas y entregadas

---

**Recomendación final:** Usa **Vercel + Railway + Supabase**. Es la combinación más profesional, fácil de usar y económica para empezar. Cuando el proyecto crezca, puedes escalar fácilmente.
