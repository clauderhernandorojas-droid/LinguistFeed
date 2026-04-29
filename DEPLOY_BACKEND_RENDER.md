# Deploy Backend en Render (gratis)

1. Sube estos cambios al repositorio.
2. En Render: `New +` -> `Blueprint` -> selecciona este repo.
3. Render detectará `render.yaml` y creará el servicio `linguistfeed-api`.
4. Configura variables de entorno en Render:
   - `JWT_SECRET` (obligatoria, una cadena larga)
   - `OPENROUTER_API_KEY` (si usarás funciones de IA)
   - `CORS_ORIGINS=https://clauderhernandorojas-droid.github.io`
5. Espera el primer deploy y copia la URL final del backend.
6. Si cambias el nombre del servicio en Render, actualiza `frontend/js/config.js` con la URL real.

## URL esperada

- Backend: `https://linguistfeed-api.onrender.com/api`
- Frontend (Pages): `https://clauderhernandorojas-droid.github.io/LinguistFeed/`

## Nota sobre SQLite

`backend/linguistfeed.db` puede no persistir entre reinicios en planes gratuitos.
Para pruebas rápidas funciona, pero para estabilidad se recomienda migrar a una DB gestionada.
