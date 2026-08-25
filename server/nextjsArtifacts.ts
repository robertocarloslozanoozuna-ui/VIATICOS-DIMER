export interface CodeFile {
  path: string;
  language: string;
  description: string;
  content: string;
}

export const NEXTJS_CODE_ARTIFACTS: CodeFile[] = [
  {
    path: 'prisma/schema.prisma',
    language: 'prisma',
    description: 'Esquema de Prisma ORM (v6) con Enums, Modelos de Usuario, Solicitud y Auditoría.',
    content: `datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

enum Role {
  ADMIN
  JEFE
  FINANZAS
  EMPLEADO
}

enum Status {
  BORRADOR
  PENDIENTE_APROBACION
  APROBADA
  RECHAZADA
  CORRECCION_SOLICITADA
  PAGADA
  FINALIZADA
}

model User {
  id        String          @id @default(cuid())
  name      String?
  email     String          @unique
  role      Role            @default(EMPLEADO)
  requests  TravelRequest[] @relation("Solicitante")
  createdAt DateTime        @default(now())
}

model TravelRequest {
  id               String   @id @default(cuid())
  folio            String   @unique
  status           Status   @default(PENDIENTE_APROBACION)
  userId           String
  user             User     @relation("Solicitante", fields: [userId], references: [id])
  bossEmail        String
  startDate        DateTime
  endDate          DateTime
  destination      String
  reason           String
  amountRequested  Float
  amountAuthorized Float?
  comments         String?  @db.Text
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([userId])
  @@index([bossEmail])
  @@index([status])
}

model AuditLog {
  id        String   @id @default(cuid())
  requestId String?
  userId    String
  action    String
  details   Json?
  createdAt DateTime @default(now())

  @@index([requestId])
  @@index([userId])
}
`
  },
  {
    path: 'lib/auth.ts',
    language: 'typescript',
    description: 'Opciones de NextAuth.js con Google Provider (prompt: select_account), Credentials Provider, persistencia de roles y callbacks.',
    content: `import { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

export const authOptions: NextAuthOptions = {
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID || "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || "",
      authorization: {
        params: {
          prompt: "select_account",
          access_type: "offline",
          response_type: "code",
        },
      },
    }),
    CredentialsProvider({
      name: "Dimer Credentials",
      credentials: {
        email: { label: "Correo", type: "email" },
        password: { label: "Contraseña", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Ingresa correo y contraseña");
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user || !user.passwordHash) {
          throw new Error("Usuario no encontrado o debe usar Google");
        }
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Contraseña incorrecta");
        }
        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (!user.email) return false;

      // Upsert usuario en PostgreSQL
      const existingUser = await prisma.user.findUnique({
        where: { email: user.email },
      });

      if (!existingUser) {
        await prisma.user.create({
          data: {
            name: user.name || "Usuario",
            email: user.email,
            role: Role.EMPLEADO,
          },
        });
      }
      return true;
    },
    async session({ session }) {
      if (session?.user?.email) {
        const dbUser = await prisma.user.findUnique({
          where: { email: session.user.email },
        });

        if (dbUser) {
          session.user.id = dbUser.id;
          session.user.role = dbUser.role;
        }
      }
      return session;
    },
  },
  pages: {
    signIn: "/auth/signin",
  },
  secret: process.env.NEXTAUTH_SECRET,
};
`
  },
  {
    path: 'app/api/auth/[...nextauth]/route.ts',
    language: 'typescript',
    description: 'Ruta API Handler de NextAuth para Next.js 14 App Router.',
    content: `import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
`
  },
  {
    path: 'lib/mail-service.ts',
    language: 'typescript',
    description: 'Servicio Nodemailer con plantillas HTML empresariales para Jefe y Finanzas.',
    content: `import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const defaultSender = process.env.SMTP_FROM || "Sistema de Viáticos <notificaciones@empresa.com>";
const finanzasEmail = process.env.FINANZAS_EMAIL || "finanzas@dimer.com.mx";

export async function sendBossNotificationEmail(params: {
  bossEmail: string;
  requesterName: string;
  requesterEmail: string;
  folio: string;
  destination: string;
  startDate: string;
  endDate: string;
  reason: string;
  amountRequested: number;
  approvalUrl: string;
}) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

  const html = \`
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family: sans-serif; background-color: #f4f5f7; padding: 20px; color: #1e293b;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
      <div style="background: #0f172a; padding: 24px; color: #ffffff;">
        <span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">AUTORIZACIÓN PENDIENTE</span>
        <h2 style="margin: 8px 0 0 0;">Solicitud de Viáticos: \${params.folio}</h2>
      </div>
      <div style="padding: 24px;">
        <p>Hola, <strong>\${params.requesterName}</strong> (\${params.requesterEmail}) ha ingresado una nueva solicitud de viáticos:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #64748b;">Folio:</td><td style="font-weight: bold;">\${params.folio}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Destino:</td><td><strong>\${params.destination}</strong></td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Periodo:</td><td>\${params.startDate} al \${params.endDate}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Motivo:</td><td>\${params.reason}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Monto Solicitado:</td><td style="font-size: 18px; font-weight: bold; color: #059669;">\${formatCurrency(params.amountRequested)}</td></tr>
        </table>
        <div style="text-align: center; margin: 30px 0;">
          <a href="\${params.approvalUrl}" style="background: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Revisar y Autorizar Solicitud</a>
        </div>
        <p style="font-size: 12px; color: #94a3b8;">* Solo el correo \${params.bossEmail} o un administrador están autorizados para procesar esta solicitud.</p>
      </div>
    </div>
  </body>
  </html>
  \`;

  return transporter.sendMail({
    from: defaultSender,
    to: params.bossEmail,
    subject: \`[Acción Requerida] Solicitud de Viáticos \${params.folio} - \${params.requesterName}\`,
    html,
  });
}

export async function sendFinanceNotificationEmail(params: {
  folio: string;
  requesterName: string;
  bossEmail: string;
  destination: string;
  amountRequested: number;
  amountAuthorized: number;
  comments?: string;
  financeUrl: string;
}) {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(val);

  const html = \`
  <!DOCTYPE html>
  <html>
  <head><meta charset="utf-8"></head>
  <body style="font-family: sans-serif; background-color: #f4f5f7; padding: 20px; color: #1e293b;">
    <div style="max-width: 600px; margin: 0 auto; background: #ffffff; border-radius: 8px; border: 1px solid #e2e8f0; overflow: hidden;">
      <div style="background: #064e3b; padding: 24px; color: #ffffff;">
        <span style="background: #10b981; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">SOLICITUD APROBADA</span>
        <h2 style="margin: 8px 0 0 0;">Viáticos Aprobados: \${params.folio}</h2>
      </div>
      <div style="padding: 24px;">
        <p>El Jefe Directo (<strong>\${params.bossEmail}</strong>) ha autorizado la siguiente solicitud para dispersión de recursos:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #64748b;">Folio:</td><td style="font-weight: bold;">\${params.folio}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Beneficiario:</td><td><strong>\${params.requesterName}</strong></td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Destino:</td><td>\${params.destination}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Monto Solicitado:</td><td>\${formatCurrency(params.amountRequested)}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Monto Autorizado:</td><td style="font-size: 18px; font-weight: bold; color: #059669;">\${formatCurrency(params.amountAuthorized)}</td></tr>
          \${params.comments ? \`<tr><td style="padding: 8px 0; color: #64748b;">Comentarios:</td><td><em>\${params.comments}</em></td></tr>\` : ""}
        </table>
        <div style="text-align: center; margin: 30px 0;">
          <a href="\${params.financeUrl}" style="background: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ver Póliza en Finanzas</a>
        </div>
      </div>
    </div>
  </body>
  </html>
  \`;

  return transporter.sendMail({
    from: defaultSender,
    to: finanzasEmail,
    subject: \`[Para Dispersión] Viáticos Aprobados \${params.folio} - \${params.requesterName}\`,
    html,
  });
}
`
  },
  {
    path: 'app/actions/viaticos.ts',
    language: 'typescript',
    description: 'Server Actions con validaciones de seguridad, folio consecutivo VIAT-YYYY-XXXXXX, auditoría y correos.',
    content: `import { revalidatePath } from "next/cache";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient, Status, Role } from "@prisma/client";
import { sendBossNotificationEmail, sendFinanceNotificationEmail } from "@/lib/mail-service";

const prisma = new PrismaClient();

/**
 * Genera el siguiente folio consecutivo con formato VIAT-YYYY-XXXXXX
 */
async function generateNextFolio(): Promise<string> {
  const currentYear = new Date().getFullYear();
  const prefix = \`VIAT-\${currentYear}-\`;
  
  const lastRequest = await prisma.travelRequest.findFirst({
    where: { folio: { startsWith: prefix } },
    orderBy: { folio: "desc" },
    select: { folio: true },
  });

  let nextNumber = 1;
  if (lastRequest && lastRequest.folio) {
    const parts = lastRequest.folio.split("-");
    if (parts.length === 3) {
      const num = parseInt(parts[2], 10);
      if (!isNaN(num)) nextNumber = num + 1;
    }
  }

  return \`VIAT-\${currentYear}-\${String(nextNumber).padStart(6, "0")}\`;
}

export async function createTravelRequest(formData: FormData) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id || !session?.user?.email) {
    throw new Error("No autenticado. Inicie sesión para continuar.");
  }

  const bossEmail = formData.get("bossEmail") as string;
  const destination = formData.get("destination") as string;
  const reason = formData.get("reason") as string;
  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;
  const amountRequested = parseFloat(formData.get("amountRequested") as string);
  const comments = formData.get("comments") as string | null;

  if (!bossEmail || !destination || !reason || !startDateStr || !endDateStr || isNaN(amountRequested) || amountRequested <= 0) {
    throw new Error("Por favor complete todos los campos obligatorios con valores válidos.");
  }

  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);

  if (endDate < startDate) {
    throw new Error("La fecha de fin no puede ser anterior a la fecha de inicio.");
  }

  const folio = await generateNextFolio();

  const request = await prisma.$transaction(async (tx) => {
    const newRequest = await tx.travelRequest.create({
      data: {
        folio,
        status: Status.PENDIENTE_APROBACION,
        userId: session.user.id,
        bossEmail: bossEmail.toLowerCase().trim(),
        destination: destination.trim(),
        reason: reason.trim(),
        startDate,
        endDate,
        amountRequested,
        comments: comments?.trim() || null,
      },
    });

    await tx.auditLog.create({
      data: {
        requestId: newRequest.id,
        userId: session.user.id,
        action: "CREACION_SOLICITUD",
        details: {
          folio,
          bossEmail,
          amountRequested,
          destination,
        },
      },
    });

    return newRequest;
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const approvalUrl = \`\${appUrl}/aprobar/\${request.id}\`;

  try {
    await sendBossNotificationEmail({
      bossEmail: request.bossEmail,
      requesterName: session.user.name || "Colaborador",
      requesterEmail: session.user.email,
      folio: request.folio,
      destination: request.destination,
      startDate: startDate.toLocaleDateString("es-MX"),
      endDate: endDate.toLocaleDateString("es-MX"),
      reason: request.reason,
      amountRequested: request.amountRequested,
      approvalUrl,
    });
  } catch (mailError) {
    console.error("Fallo al enviar correo al jefe:", mailError);
  }

  revalidatePath("/solicitar");
  revalidatePath("/mis-solicitudes");
  return { success: true, folio: request.folio, requestId: request.id };
}

export async function approveTravelRequest(params: {
  requestId: string;
  amountAuthorized: number;
  comments?: string;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    throw new Error("Debe autenticarse con su cuenta de Google.");
  }

  const request = await prisma.travelRequest.findUnique({
    where: { id: params.requestId },
    include: { user: true },
  });

  if (!request) {
    throw new Error("Solicitud no encontrada.");
  }

  // Validación de seguridad de jefe o admin
  const isBoss = request.bossEmail.toLowerCase() === session.user.email.toLowerCase();
  const isAdmin = session.user.role === Role.ADMIN;

  if (!isBoss && !isAdmin) {
    throw new Error(\`Acceso no autorizado. Debe iniciar sesión con \${request.bossEmail}\`);
  }

  if (isNaN(params.amountAuthorized) || params.amountAuthorized < 0) {
    throw new Error("El monto autorizado debe ser un valor positivo válido.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const req = await tx.travelRequest.update({
      where: { id: params.requestId },
      data: {
        status: Status.APROBADA,
        amountAuthorized: params.amountAuthorized,
        comments: params.comments?.trim() || request.comments,
      },
    });

    await tx.auditLog.create({
      data: {
        requestId: req.id,
        userId: session.user.id,
        action: "APROBACION_JEFE",
        details: {
          approvedBy: session.user.email,
          amountRequested: req.amountRequested,
          amountAuthorized: params.amountAuthorized,
          comments: params.comments,
        },
      },
    });

    return req;
  });

  const appUrl = process.env.APP_URL || "http://localhost:3000";
  const financeUrl = \`\${appUrl}/finanzas\`;

  try {
    await sendFinanceNotificationEmail({
      folio: updated.folio,
      requesterName: request.user.name || "Colaborador",
      bossEmail: session.user.email,
      destination: updated.destination,
      amountRequested: updated.amountRequested,
      amountAuthorized: params.amountAuthorized,
      comments: params.comments,
      financeUrl,
    });
  } catch (err) {
    console.error("Fallo al notificar a finanzas:", err);
  }

  revalidatePath(\`/aprobar/\${params.requestId}\`);
  revalidatePath("/finanzas");
  return { success: true, folio: updated.folio };
}

export async function rejectTravelRequest(params: { requestId: string; comments: string }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) throw new Error("Debe autenticarse.");

  const request = await prisma.travelRequest.findUnique({ where: { id: params.requestId } });
  if (!request) throw new Error("Solicitud no encontrada.");

  const isBoss = request.bossEmail.toLowerCase() === session.user.email.toLowerCase();
  const isAdmin = session.user.role === Role.ADMIN;
  if (!isBoss && !isAdmin) throw new Error("No autorizado.");

  await prisma.$transaction([
    prisma.travelRequest.update({
      where: { id: params.requestId },
      data: { status: Status.RECHAZADA, comments: params.comments },
    }),
    prisma.auditLog.create({
      data: {
        requestId: params.requestId,
        userId: session.user.id,
        action: "RECHAZO_JEFE",
        details: { rejectedBy: session.user.email, reason: params.comments },
      },
    }),
  ]);

  revalidatePath(\`/aprobar/\${params.requestId}\`);
  return { success: true };
}
`
  },
  {
    path: 'app/solicitar/page.tsx',
    language: 'typescript',
    description: 'Página de Formulario de Solicitud con validaciones, preview de folio y experiencia de usuario limpia.',
    content: `"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createTravelRequest } from "@/app/actions/viaticos";

export default function SolicitarViaticosPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    try {
      const res = await createTravelRequest(formData);
      if (res.success) {
        alert(\`¡Solicitud generada con éxito! Folio: \${res.folio}\`);
        router.push("/mis-solicitudes");
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar la solicitud.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6 md:p-8">
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Nueva Solicitud de Viáticos</h1>
        <p className="text-slate-600 mb-6 text-sm">
          Complete la información del viaje. El folio oficial se generará automáticamente y se enviará la notificación al correo del jefe especificado.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Correo Electrónico del Jefe Inmediato *
            </label>
            <input
              type="email"
              name="bossEmail"
              required
              placeholder="director@tuempresa.com"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Este correo recibirá la notificación con el enlace seguro de aprobación.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha Inicio del Viaje *</label>
              <input
                type="date"
                name="startDate"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1">Fecha Fin del Viaje *</label>
              <input
                type="date"
                name="endDate"
                required
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Ciudad / Destino *</label>
            <input
              type="text"
              name="destination"
              required
              placeholder="Ej. Monterrey, N.L. - Planta Industrial"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Monto Total Solicitado (MXN) *</label>
            <div className="relative">
              <span className="absolute left-3.5 top-2.5 text-slate-400 font-semibold">$</span>
              <input
                type="number"
                step="0.01"
                min="1"
                name="amountRequested"
                required
                placeholder="15000.00"
                className="w-full pl-8 pr-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Justificación / Motivo del Viaje *</label>
            <textarea
              name="reason"
              rows={3}
              required
              placeholder="Describa el objetivo del viaje, clientes a visitar y entregables esperados..."
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">Desglose o Comentarios Adicionales</label>
            <textarea
              name="comments"
              rows={2}
              placeholder="Ej. Hospedaje: $6,000, Vuelo: $5,000, Alimentos: $4,000"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex justify-end gap-3">
            <button
              type="button"
              onClick={() => router.back()}
              className="px-5 py-2.5 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-lg shadow-sm disabled:opacity-50 text-sm"
            >
              {loading ? "Enviando Solicitud..." : "Enviar a Aprobación"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
`
  },
  {
    path: 'app/aprobar/[id]/page.tsx',
    language: 'typescript',
    description: 'Página de Aprobación de Jefatura con validación de correo de sesión, ajuste de monto autorizado y registro de auditoría.',
    content: `import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { PrismaClient, Role } from "@prisma/client";
import { notFound } from "next/navigation";
import ApprovalForm from "./ApprovalForm";

const prisma = new PrismaClient();

interface Props {
  params: { id: string };
}

export default async function AprobarPage({ params }: Props) {
  const session = await getServerSession(authOptions);
  const request = await prisma.travelRequest.findUnique({
    where: { id: params.id },
    include: { user: true },
  });

  if (!request) notFound();

  // Registrar auditoría de apertura / visualización
  if (session?.user?.id) {
    await prisma.auditLog.create({
      data: {
        requestId: request.id,
        userId: session.user.id,
        action: "VISUALIZACION_SOLICITUD",
        details: { viewedBy: session.user.email },
      },
    });
  }

  const userEmail = session?.user?.email?.toLowerCase();
  const bossEmail = request.bossEmail.toLowerCase();
  const isAdmin = session?.user?.role === Role.ADMIN;
  const isAuthorized = userEmail === bossEmail || isAdmin;

  return (
    <div className="max-w-4xl mx-auto py-10 px-4">
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Cabecera */}
        <div className="bg-slate-900 text-white p-6 md:p-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="inline-block bg-blue-500 text-white text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider mb-2">
              Gestión de Aprobación
            </span>
            <h1 className="text-2xl font-bold">Folio {request.folio}</h1>
            <p className="text-slate-400 text-sm mt-1">
              Solicitado el {new Date(request.createdAt).toLocaleDateString("es-MX")} por {request.user.name}
            </p>
          </div>
          <div className="text-right">
            <span className="text-xs text-slate-400 block uppercase font-medium">Estado Actual</span>
            <span className="inline-block mt-1 font-semibold text-amber-400 bg-amber-950/40 border border-amber-800/60 px-3 py-1 rounded-lg text-sm">
              {request.status}
            </span>
          </div>
        </div>

        {/* Alerta de Seguridad de Validación de Correo */}
        {!isAuthorized && (
          <div className="p-6 bg-red-50 border-b border-red-200 text-red-800">
            <h3 className="font-bold text-base flex items-center gap-2">
              Acceso Restringido: Correo no Coincide
            </h3>
            <p className="text-sm mt-1">
              Esta solicitud está dirigida a <strong>{request.bossEmail}</strong>. Tu sesión actual es <strong>{session?.user?.email || "No autenticado"}</strong>.
              Para gestionar esta solicitud, debes iniciar sesión con la cuenta de Google autorizada.
            </p>
          </div>
        )}

        {/* Resumen del Viaje */}
        <div className="p-6 md:p-8 grid grid-cols-1 md:grid-cols-2 gap-6 border-b border-slate-200 bg-slate-50/50">
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Destino</h4>
            <p className="text-slate-900 font-semibold text-lg">{request.destination}</p>
          </div>
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Periodo de Viaje</h4>
            <p className="text-slate-900 font-medium">
              {new Date(request.startDate).toLocaleDateString("es-MX")} al {new Date(request.endDate).toLocaleDateString("es-MX")}
            </p>
          </div>
          <div className="md:col-span-2">
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Motivo / Justificación</h4>
            <p className="text-slate-800 text-sm leading-relaxed">{request.reason}</p>
          </div>
          <div className="md:col-span-2 bg-blue-50/80 border border-blue-200 rounded-lg p-4 flex justify-between items-center">
            <div>
              <span className="text-xs font-bold text-blue-900 uppercase">Monto Solicitado</span>
              <p className="text-2xl font-black text-blue-700">
                \${request.amountRequested.toLocaleString("es-MX", { minimumFractionDigits: 2 })} MXN
              </p>
            </div>
            <div className="text-right text-xs text-blue-600">
              Moneda: Pesos Mexicanos
            </div>
          </div>
        </div>

        {/* Formulario Interactivo del Jefe */}
        {isAuthorized && request.status === "PENDIENTE_APROBACION" && (
          <div className="p-6 md:p-8">
            <ApprovalForm
              requestId={request.id}
              initialAmount={request.amountRequested}
            />
          </div>
        )}
      </div>
    </div>
  );
}
`
  }
];
