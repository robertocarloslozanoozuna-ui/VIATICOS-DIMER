import type { Request, Response } from 'express';

/**
 * Deprecated endpoint.
 *
 * Initial notifications are sent exactly once by POST /api/requests.
 * This endpoint used to resend both the approver and requester emails and
 * could therefore create duplicate notifications when an old frontend or
 * integration called /notify after request creation.
 *
 * Keep the route for backwards compatibility, but never send email here.
 * Return 200 so older clients do not report a false delivery failure.
 */
export async function requestNotificationHandler(_req: Request, res: Response) {
  return res.status(200).json({
    success: true,
    deprecated: true,
    skipped: true,
    message: 'La notificación inicial ya fue procesada al crear la solicitud. No se reenvió ningún correo.',
  });
}
