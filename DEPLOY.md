# 🚀 Guía Rápida de Despliegue

## Opción Recomendada: Vercel + Railway + Supabase

### ✅ Ventajas:
- **100% Gratis** para empezar
- **Profesional** y confiable
- **Fácil** de configurar
- **Automático** desde GitHub

---

## 📋 Pasos Rápidos

### 1️⃣ Preparar el código

```bash
# Asegúrate de que todo funciona localmente
cd backend && npm run build
cd ../frontend && npm run build
```

### 2️⃣ Subir a GitHub

```bash
git add .
git commit -m "Listo para producción"
git push origin main
```

### 3️⃣ Desplegar Frontend (Vercel)

1. Ve a [vercel.com](https://vercel.com) → **Sign up with GitHub**
2. **Add New Project** → Selecciona tu repo
3. Configuración:
   - **Root Directory:** `frontend`
   - **Framework:** Next.js (auto-detectado)
4. **Environment Variables:**
   - `NEXT_PUBLIC_API_URL` = `https://tu-backend.railway.app` (lo actualizarás después)
5. **Deploy** → Copia la URL (ej: `https://colorados-drive.vercel.app`)

### 4️⃣ Desplegar Backend (Railway)

1. Ve a [railway.app](https://railway.app) → **Sign up with GitHub**
2. **New Project** → **Deploy from GitHub repo**
3. Selecciona tu repositorio
4. Configuración:
   - **Root Directory:** `backend`
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
5. **Variables de entorno** (Settings → Variables):
   ```
   PORT=3001
   NODE_ENV=production
   CORS_ORIGIN=https://colorados-drive.vercel.app
   SUPABASE_URL=https://tu-proyecto.supabase.co
   SUPABASE_ANON_KEY=tu-anon-key
   SUPABASE_SERVICE_KEY=tu-service-key
   SUPABASE_JWT_SECRET=tu-jwt-secret
   JWT_SECRET=tu-jwt-secret
   ```
6. Railway generará una URL → Cópiala
7. **Actualiza Vercel:** Ve a Vercel → Settings → Environment Variables → Actualiza `NEXT_PUBLIC_API_URL` → Redeploy

### 5️⃣ Verificar

- ✅ Frontend: `https://tu-app.vercel.app`
- ✅ Backend: `https://tu-backend.railway.app/health` (debe responder `{"status":"ok"}`)
- ✅ Login funciona correctamente

---

## 💰 Costos

| Servicio | Plan Gratuito | Límites |
|----------|---------------|---------|
| **Vercel** | ✅ Gratis | 100GB/mes bandwidth |
| **Railway** | ✅ Gratis | $5 crédito/mes (~500 horas) |
| **Supabase** | ✅ Gratis | 500MB DB, 2GB bandwidth |

**Total: $0/mes** para empezar 🎉

---

## 🔧 Troubleshooting

### Error CORS
- Verifica que `CORS_ORIGIN` en Railway tenga la URL exacta de Vercel (sin trailing slash)

### Variables no funcionan
- Reinicia el servicio después de cambiar variables
- En Vercel, las variables `NEXT_PUBLIC_*` son públicas

### Base de datos no conecta
- Verifica que las URLs de Supabase sean correctas
- Asegúrate de que el proyecto Supabase esté activo

---

## 📚 Más documentación

- **Despliegue completo:** [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)
- **Limpieza periódica (no pagar Supabase):** [docs/LIMPIEZA-PERIODICA.md](docs/LIMPIEZA-PERIODICA.md) — borrar usuarios y cursos ya no usados después de descargar el CSV.

---

## ✅ Checklist Final

- [ ] Código subido a GitHub
- [ ] Frontend desplegado en Vercel
- [ ] Backend desplegado en Railway
- [ ] Variables de entorno configuradas
- [ ] Login funciona
- [ ] Subida de archivos funciona
- [ ] Listo para entregar al cliente 🎊
