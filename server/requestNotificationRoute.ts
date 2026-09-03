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
 */
export async function requestNotificationHandler(_req: Request, res: Response) {
  return res.status(410).json({
    success: false,
    deprecated: true,
    error: 'La notificación inicial se envía automáticamente al crear la solicitud. El endpoint /notify ya no reenvía correos.',
  });
}
