# G2 Congresos — Backend

Backend chico (Node + Express) que le da vida real a la app de congresos:

- Sirve la app de asistentes (`/`) y el panel de administración (`/admin`).
- API pública: config del congreso y validación de credencial digital por DNI.
- API admin (con clave): editar branding, herramientas, notificaciones e información, y subir el Excel con el listado de personas habilitadas.
- Guarda todo en archivos JSON por congreso (`data/congresos/<id>.json`) — sin base de datos externa.

## Correrlo local

```
npm install
ADMIN_PASSWORD=tu-clave npm start
```

Abrir:
- App de asistentes: http://localhost:3000/?congreso=sagg-2026
- Panel admin: http://localhost:3000/admin  (clave: la que pusiste en `ADMIN_PASSWORD`, o `g2demo2026` si no la seteás)

Importante: la app ahora necesita que el backend esté corriendo — ya no funciona abriendo el `index.html` directo (doble clic), porque carga todo por `fetch` a la API.

## Estructura

```
server.js              servidor Express + toda la API
package.json
data/congresos/*.json  un archivo por congreso (config + roster)
public/                la app de asistentes (PWA)
admin/                 el panel de administración
```

## Multi-congreso

La misma app sirve a cualquier evento cargado en `data/congresos/`. Se elige con un parámetro en la URL:

```
https://tu-dominio.com/?congreso=sagg-2026
https://tu-dominio.com/?congreso=biociencias-2027
```

Cada congreso nuevo se da de alta desde el panel admin ("+ Nuevo"), o copiando un archivo JSON dentro de `data/congresos/`.

## Excel del listado de personas habilitadas

Columnas esperadas (no importan mayúsculas/acentos): `DNI`, `Nombre`, `Categoria`, `Habilitado` (SI/NO, TRUE/FALSE, 1/0 o X). Al subirlo, reemplaza el listado completo del congreso.

## Desplegarlo online

Es una app con backend (no un sitio estático), así que necesita un servicio que mantenga un proceso corriendo. Opciones simples con capa gratuita:

- **Render** (render.com) — "New Web Service", conectás el repo o subís la carpeta, build command `npm install`, start command `npm start`, variable de entorno `ADMIN_PASSWORD`.
- **Railway** (railway.app) — similar a Render, deploy por CLI o desde GitHub.

En ambos casos, los datos en `data/congresos/*.json` conviene después migrarlos a un volumen persistente o a una base de datos real si el servicio reinicia el filesystem en cada deploy (revisar la documentación del plan elegido).

## Seguridad — pendiente antes de producción

Esta es una base funcional, no lista para producción tal cual:

- El login admin es una clave única compartida (`ADMIN_PASSWORD`), sin usuarios individuales.
- Las sesiones (tokens) viven en memoria — se resetean si el servidor reinicia.
- No hay límite de intentos de login (rate limiting).
- El almacenamiento en JSON no soporta bien escrituras concurrentes a gran escala — bien para uso interno de un equipo chico, no para cientos de operadores simultáneos.
