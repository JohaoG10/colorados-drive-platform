# Mantener el backend despierto (cron cada 10 minutos)

Para que el backend y Supabase no se duerman por inactividad, configura un servicio externo que llame al endpoint de health **cada 10 minutos**.

## URL a usar

Cuando tengas el backend desplegado (Render, Railway, Fly.io, etc.), la URL será algo como:

```
https://TU-BACKEND-URL/health
```

Ejemplo: `https://colorados-drive-api.onrender.com/health`

## Opción 1: cron-job.org (gratis)

1. Entra en **https://cron-job.org** y crea una cuenta.
2. **Cron Jobs** → **Create cron job**.
3. Configura:
   - **Title:** Keep-alive API
   - **URL:** `https://TU-BACKEND-URL/health`
   - **Schedule:** cada 10 minutos → elige **"Every 10 minutes"** o en expresión cron: `*/10 * * * *`
4. Guarda. El servicio llamará a tu API cada 10 minutos.

## Opción 2: UptimeRobot (gratis)

1. Entra en **https://uptimerobot.com** y crea una cuenta.
2. **Add New Monitor**.
3. Configura:
   - **Monitor Type:** HTTP(s)
   - **Friendly Name:** API Keep-alive
   - **URL:** `https://TU-BACKEND-URL/health`
   - **Monitoring Interval:** 5 minutes (el plan gratis suele permitir 5 min; si solo tienes 10 min, úsalo).
4. Guarda. Recibirás alertas si la URL deja de responder.

## Respuesta esperada

El endpoint devuelve algo como:

```json
{ "status": "ok", "timestamp": "2026-02-20T12:00:00.000Z", "db": "ok" }
```

Si `db` es `"error"`, el servidor sigue respondiendo pero Supabase podría estar lento o dormido; el siguiente ping suele despertarlo.
