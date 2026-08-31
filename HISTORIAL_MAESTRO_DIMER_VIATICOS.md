# HISTORIAL MAESTRO — DIMER VIÁTICOS

## Propósito
Documento de continuidad técnica para mantener sincronizados los cambios realizados entre Google AI Studio, GitHub y Vercel. Debe actualizarse con cada cambio manual o asistido antes de modificar nuevamente el proyecto.

> **Seguridad:** NO almacenar aquí contraseñas, secretos SMTP, JWT, API keys, tokens ni valores sensibles. Registrar únicamente nombres de variables y su función.

## Estado base
- Repositorio: `robertocarloslozanoozuna-ui/VIATICOS-DIMER`
- Rama principal: `main`
- Producción: `viaticos-dimer.vercel.app`
- Persistencia: Supabase.
- No modificar Supabase salvo que una prueba demuestre que es necesario.
- El flujo de creación de solicitud debe conservar: insertar solicitud → obtener ID → crear approval token → enviar correo → auditar resultado.

## SMTP — configuración canónica
Variables principales:
- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_SECURE`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM`
- `FINANZAS_EMAIL`

Variables auxiliares históricas que NO deben introducir ambigüedad ni sobreescribir accidentalmente las principales:
- `DIMER_SMTP_USER`
- `DIMER_SMTP_APP_PASSWORD`

Nunca registrar valores de estas variables.

## Cambios realizados recientemente

### 1. Corrección de autenticación de Bandeja SMTP
Problema: `/api/smtp/test` respondía `Autenticación requerida` desde la interfaz.

Corrección realizada en Google AI Studio:
- Se agregó/preservó el token JWT en las respuestas de login y verificación.
- El cliente usa `safeFetchJson` para enviar autenticación Bearer y cookies.
- Se corrigieron las llamadas de Bandeja SMTP a `/api/smtp/status`, `/api/smtp/test` y `/api/outbox`.
- Se verificó envío SMTP real exitoso.

### 2. Corrección de pantalla blanca
Se protegieron:
- `src/components/OutboxView.tsx`
- `src/components/AuditoriaView.tsx`
- `src/components/AprobarView.tsx`

Se agregaron validaciones defensivas de respuestas y acceso seguro a propiedades anidadas.

### 3. Unificación SMTP
Se detectaron históricamente múltiples nombres de variables SMTP. Se decidió mantener una configuración canónica basada en `SMTP_USER` + `SMTP_PASS`, evitando que variables antiguas provoquen precedencias inesperadas.

También se corrigió un incidente en el que una contraseña de aplicación había terminado siendo interpretada como `SMTP_FROM`. El remitente debe ser siempre una dirección válida, no un secreto.

### 4. Remitente actual deseado
Objetivo funcional:
- Correo: `no_reply@dimer.com.mx` (o la dirección que esté actualmente configurada y validada en Vercel).
- Nombre visible: `Dimer Notificaciones`.

No guardar en este documento la contraseña ni secretos.

## 5. Persistencia definitiva de Bandeja SMTP / Outbox
Fecha: `2026-08-31`

Se identificó que `outboxLogs` en `server/mailService.ts` era únicamente memoria RAM. Esto no es persistente en Vercel Serverless y se perdía después de reinicios o entre invocaciones.

Corrección implementada en Google AI Studio:
- Los eventos de correo se registran de forma persistente en la tabla existente `audit_logs` de Supabase.
- Se utiliza la acción `ENVIO_CORREO_SMTP` para envíos de correo y `PRUEBA_SMTP` para diagnósticos cuando corresponde.
- Los detalles persistidos incluyen `logId`, destinatario, asunto, contenido HTML, estado, error, `requestId`, folio y timestamp cuando están disponibles.
- La persistencia está aislada con `try/catch` para que un fallo de auditoría no impida entregar un correo correctamente.
- `GET /api/outbox` recupera los últimos registros persistidos y los transforma al modelo consumido por `OutboxView.tsx`.
- Se mantiene compatibilidad con los registros existentes en memoria sin depender de ellos para la persistencia.
- No se creó una tabla nueva y no se modificó el esquema de Supabase.

### 6. Corrección de observaciones de aprobación/rechazo por correo
Fecha: `2026-08-31`

Problema corregido: las notificaciones posteriores podían mostrar como observación del aprobador el texto técnico `Rechazado directamente desde el correo electrónico`.

Comportamiento definitivo:
- Al aprobar desde correo sin observaciones, `comments` queda vacío/null y no se muestra una observación falsa.
- Al rechazar, se conserva únicamente el motivo/observación real proporcionado por el aprobador.
- El texto técnico del evento, si se requiere para auditoría, no debe presentarse como comentario escrito por el aprobador.
- No se modificaron tokens ni el flujo general de aprobación/rechazo.

## PROBLEMA ACTUAL — OBSERVACIONES DE RECHAZO

El problema descrito originalmente quedó corregido en el entorno de Google AI Studio. Antes de cualquier cambio adicional, verificar en GitHub que la corrección esté sincronizada y que `server/app.ts`, `server/db.ts` y `server/mailService.ts` mantengan el mismo comportamiento.

## Vercel / Google AI Studio
- Ambos entornos lograron envío SMTP real.
- Google AI Studio logró enviar correo de prueba.
- Vercel logró enviar correo de prueba.
- El problema `535 BadCredentials` quedó resuelto después de corregir las variables/secreto SMTP.
- No asumir que los Secrets de Google AI Studio y Vercel se sincronizan automáticamente: deben verificarse por separado.

## GitHub / sincronización
Existen/han existido diferencias entre la copia de AI Studio y GitHub. Antes de sincronizar:
- Comparar archivos modificados.
- Evitar workflows antiguos que puedan restaurar `server/app.ts` desde commits históricos.
- No ejecutar restauraciones destructivas sin verificar el contenido actual.
- Recompilar `api/index.js` después de cambios de backend cuando el proyecto lo requiera.
- El historial maestro debe reflejar cualquier cambio realizado en AI Studio antes de continuar con otra modificación.

## Validaciones obligatorias después de cambios
1. `npx tsc --noEmit`
2. `npm run build`
3. Prueba SMTP real.
4. Crear una solicitud de viáticos de prueba.
5. Verificar que se genere el folio.
6. Verificar `approval_token`.
7. Verificar recepción del correo.
8. Aprobar y rechazar mediante correo.
9. Verificar que las observaciones sean las introducidas por el aprobador y no texto técnico.
10. Verificar Bandeja SMTP y Log de Auditoría.
11. Reiniciar/redeployar y comprobar que el historial de Bandeja SMTP permanezca disponible.

## Regla de continuidad para Google AI Studio
Cuando se retome el proyecto, entregar este archivo a Google AI Studio y solicitar:
- leerlo antes de modificar archivos;
- comparar el workspace actual contra estas decisiones;
- no regenerar ni duplicar variables de entorno;
- no modificar Supabase sin autorización/evidencia;
- conservar las correcciones ya documentadas;
- actualizar este historial después de cada cambio.

## Última actualización
`2026-08-31` — Se sincronizó el historial maestro con los resultados de la corrección de persistencia de Bandeja SMTP/Outbox y la corrección de observaciones de aprobación/rechazo. No se almacenan secretos.
