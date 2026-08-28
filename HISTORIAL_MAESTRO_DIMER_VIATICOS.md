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

Nunca registrar valores de estas variables en este documento.

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

## PROBLEMA ACTUAL — OBSERVACIONES DE RECHAZO

### Síntoma
Cuando una solicitud es rechazada directamente desde el enlace del correo, el correo/notificación posterior muestra en **Observaciones**:

`Rechazado directamente desde el correo electrónico`

### Diagnóstico actual
La base de datos y la RPC existente manejan un campo de comentarios/observaciones (`p_comments`). No se debe modificar Supabase ni la RPC sin evidencia adicional.

La corrección debe hacerse en el flujo que procesa la acción del token de aprobación/rechazo y determina el valor que se envía como comentario/observación.

### Comportamiento deseado
- Si el usuario/jefe introduce observaciones al rechazar: guardar y mostrar exactamente esas observaciones.
- Si rechaza sin escribir observaciones: dejar el campo de observaciones vacío o usar un valor neutro claramente distinguible de una observación del usuario.
- El texto técnico `Rechazado directamente desde el correo electrónico` puede conservarse como información de auditoría/evento si se necesita, pero **NO debe aparecer como si fuera la observación escrita por el aprobador**.
- No alterar el flujo de aprobación/rechazo ni los tokens.

### Regla para la siguiente corrección
Revisar primero:
1. `server/app.ts` — endpoint que procesa `/api/approval-tokens/:token/action` y/o la acción desde correo.
2. `server/db.ts` — llamada a `process_approval_token_action` y mapeo de `p_comments`.
3. `server/mailService.ts` — plantilla que presenta `comments`/`rejection_reason`.

No modificar `schema.sql` ni Supabase hasta confirmar que el origen no está en código.

## Vercel / Google AI Studio
- Los dos entornos ya lograron envío SMTP real.
- Google AI Studio también logró enviar correo de prueba.
- Vercel también logró enviar correo de prueba.
- El problema de `535 BadCredentials` quedó resuelto después de corregir las variables/secreto SMTP.
- No asumir que los Secrets de Google AI Studio y Vercel se sincronizan automáticamente: deben verificarse por separado.

## GitHub / sincronización
Existen/han existido diferencias entre la copia de AI Studio y GitHub. Antes de sincronizar:
- Comparar archivos modificados.
- Evitar workflows antiguos que puedan restaurar `server/app.ts` desde commits históricos.
- No ejecutar restauraciones destructivas sin verificar el contenido actual.
- Recompilar `api/index.js` después de cambios de backend cuando el proyecto lo requiera.

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

## Regla de continuidad para Google AI Studio
Cuando se retome el proyecto, entregar este archivo a Google AI Studio y solicitar:
- leerlo antes de modificar archivos;
- comparar el workspace actual contra estas decisiones;
- no regenerar ni duplicar variables de entorno;
- no modificar Supabase sin autorización/evidencia;
- conservar las correcciones ya documentadas;
- actualizar este historial después de cada cambio.

## Última actualización
28-08-2026 — Se creó este historial maestro en GitHub para documentar continuidad y preparar la corrección de observaciones de rechazo.
