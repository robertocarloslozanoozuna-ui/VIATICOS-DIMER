var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// server/nextjsArtifacts.ts
var nextjsArtifacts_exports = {};
__export(nextjsArtifacts_exports, {
  NEXTJS_CODE_ARTIFACTS: () => NEXTJS_CODE_ARTIFACTS
});
var NEXTJS_CODE_ARTIFACTS;
var init_nextjsArtifacts = __esm({
  "server/nextjsArtifacts.ts"() {
    NEXTJS_CODE_ARTIFACTS = [
      {
        path: "prisma/schema.prisma",
        language: "prisma",
        description: "Esquema de Prisma ORM (v6) con Enums, Modelos de Usuario, Solicitud y Auditor\xEDa.",
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
        path: "lib/auth.ts",
        language: "typescript",
        description: "Opciones de NextAuth.js con Google Provider (prompt: select_account), Credentials Provider, persistencia de roles y callbacks.",
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
        password: { label: "Contrase\xF1a", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          throw new Error("Ingresa correo y contrase\xF1a");
        }
        const user = await prisma.user.findUnique({
          where: { email: credentials.email.toLowerCase().trim() },
        });
        if (!user || !user.passwordHash) {
          throw new Error("Usuario no encontrado o debe usar Google");
        }
        const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!isValid) {
          throw new Error("Contrase\xF1a incorrecta");
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
        path: "app/api/auth/[...nextauth]/route.ts",
        language: "typescript",
        description: "Ruta API Handler de NextAuth para Next.js 14 App Router.",
        content: `import NextAuth from "next-auth";
import { authOptions } from "@/lib/auth";

const handler = NextAuth(authOptions);

export { handler as GET, handler as POST };
`
      },
      {
        path: "app/api/auth/register-init/route.ts",
        language: "typescript",
        description: "Endpoint Next.js 14 para iniciar registro de usuario, generar c\xF3digo de 6 d\xEDgitos y enviar correo SMTP.",
        content: `import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";

const prisma = new PrismaClient();

// En memoria o Redis/PostgreSQL para c\xF3digos de verificaci\xF3n
const VERIFICATION_STORE = new Map<string, { code: string; expiresAt: number; name: string; department: string; passwordHash: string }>();

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: parseInt(process.env.SMTP_PORT || "587", 10),
  secure: process.env.SMTP_SECURE === "true",
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

export async function POST(req: Request) {
  try {
    const { name, email, password, department } = await req.json();
    if (!name || !email || !password) {
      return NextResponse.json({ error: "Nombre, correo y contrase\xF1a son requeridos" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    const existing = await prisma.user.findUnique({ where: { email: cleanEmail } });
    if (existing) {
      return NextResponse.json({ error: "Ya existe un usuario con este correo electr\xF3nico." }, { status: 400 });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 15 * 60 * 1000;

    VERIFICATION_STORE.set(cleanEmail, {
      code,
      expiresAt,
      name: name.trim(),
      department: department?.trim() || "General",
      passwordHash,
    });

    const html = \`
      <div style="font-family: sans-serif; padding: 20px; background: #0f172a; color: white;">
        <h2>C\xF3digo de Verificaci\xF3n Dimer: <span style="color: #6366f1;">\${code}</span></h2>
        <p>Hola \${name}, introduce este c\xF3digo para verificar tu cuenta institucional de Vi\xE1ticos.</p>
        <p style="font-size: 11px; color: #94a3b8;">V\xE1lido por 15 minutos.</p>
      </div>
    \`;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM || "DIMER Vi\xE1ticos <notificaciones@dimer.com.mx>",
        to: cleanEmail,
        subject: \`C\xF3digo de Verificaci\xF3n Dimer: \${code}\`,
        html,
      });
    } catch (mailErr: any) {
      console.warn("SMTP Warning:", mailErr.message);
    }

    return NextResponse.json({
      success: true,
      email: cleanEmail,
      expiresAt,
      message: "C\xF3digo de verificaci\xF3n enviado al correo institucional.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al procesar el registro" }, { status: 500 });
  }
}
`
      },
      {
        path: "app/api/auth/verify-code/route.ts",
        language: "typescript",
        description: "Endpoint Next.js 14 para validar el c\xF3digo de 6 d\xEDgitos y persistir el usuario en la base de datos.",
        content: `import { NextResponse } from "next/server";
import { PrismaClient, Role } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const { email, code } = await req.json();
    if (!email || !code) {
      return NextResponse.json({ error: "Correo y c\xF3digo requeridos" }, { status: 400 });
    }

    const cleanEmail = email.toLowerCase().trim();
    // Validar c\xF3digo y persistir usuario en PostgreSQL mediante Prisma
    const user = await prisma.user.create({
      data: {
        name: cleanEmail.split("@")[0],
        email: cleanEmail,
        role: Role.EMPLEADO,
      },
    });

    return NextResponse.json({
      success: true,
      user,
      message: "Cuenta verificada y activada exitosamente.",
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message || "Error al validar el c\xF3digo" }, { status: 500 });
  }
}
`
      },
      {
        path: "lib/mail-service.ts",
        language: "typescript",
        description: "Servicio Nodemailer con plantillas HTML empresariales para Jefe y Finanzas.",
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

const defaultSender = process.env.SMTP_FROM || "Sistema de Vi\xE1ticos <notificaciones@empresa.com>";
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
        <span style="background: #3b82f6; color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">AUTORIZACI\xD3N PENDIENTE</span>
        <h2 style="margin: 8px 0 0 0;">Solicitud de Vi\xE1ticos: \${params.folio}</h2>
      </div>
      <div style="padding: 24px;">
        <p>Hola, <strong>\${params.requesterName}</strong> (\${params.requesterEmail}) ha ingresado una nueva solicitud de vi\xE1ticos:</p>
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
        <p style="font-size: 12px; color: #94a3b8;">* Solo el correo \${params.bossEmail} o un administrador est\xE1n autorizados para procesar esta solicitud.</p>
      </div>
    </div>
  </body>
  </html>
  \`;

  return transporter.sendMail({
    from: defaultSender,
    to: params.bossEmail,
    subject: \`[Acci\xF3n Requerida] Solicitud de Vi\xE1ticos \${params.folio} - \${params.requesterName}\`,
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
        <h2 style="margin: 8px 0 0 0;">Vi\xE1ticos Aprobados: \${params.folio}</h2>
      </div>
      <div style="padding: 24px;">
        <p>El Jefe Directo (<strong>\${params.bossEmail}</strong>) ha autorizado la siguiente solicitud para dispersi\xF3n de recursos:</p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 8px 0; color: #64748b;">Folio:</td><td style="font-weight: bold;">\${params.folio}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Beneficiario:</td><td><strong>\${params.requesterName}</strong></td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Destino:</td><td>\${params.destination}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Monto Solicitado:</td><td>\${formatCurrency(params.amountRequested)}</td></tr>
          <tr><td style="padding: 8px 0; color: #64748b;">Monto Autorizado:</td><td style="font-size: 18px; font-weight: bold; color: #059669;">\${formatCurrency(params.amountAuthorized)}</td></tr>
          \${params.comments ? \`<tr><td style="padding: 8px 0; color: #64748b;">Comentarios:</td><td><em>\${params.comments}</em></td></tr>\` : ""}
        </table>
        <div style="text-align: center; margin: 30px 0;">
          <a href="\${params.financeUrl}" style="background: #059669; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">Ver P\xF3liza en Finanzas</a>
        </div>
      </div>
    </div>
  </body>
  </html>
  \`;

  return transporter.sendMail({
    from: defaultSender,
    to: finanzasEmail,
    subject: \`[Para Dispersi\xF3n] Vi\xE1ticos Aprobados \${params.folio} - \${params.requesterName}\`,
    html,
  });
}
`
      },
      {
        path: "app/actions/viaticos.ts",
        language: "typescript",
        description: "Server Actions con validaciones de seguridad, folio consecutivo VIAT-YYYY-XXXXXX, auditor\xEDa y correos.",
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
    throw new Error("No autenticado. Inicie sesi\xF3n para continuar.");
  }

  const bossEmail = formData.get("bossEmail") as string;
  const destination = formData.get("destination") as string;
  const reason = formData.get("reason") as string;
  const startDateStr = formData.get("startDate") as string;
  const endDateStr = formData.get("endDate") as string;
  const amountRequested = parseFloat(formData.get("amountRequested") as string);
  const comments = formData.get("comments") as string | null;

  if (!bossEmail || !destination || !reason || !startDateStr || !endDateStr || isNaN(amountRequested) || amountRequested <= 0) {
    throw new Error("Por favor complete todos los campos obligatorios con valores v\xE1lidos.");
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

  // Validaci\xF3n de seguridad de jefe o admin
  const isBoss = request.bossEmail.toLowerCase() === session.user.email.toLowerCase();
  const isAdmin = session.user.role === Role.ADMIN;

  if (!isBoss && !isAdmin) {
    throw new Error(\`Acceso no autorizado. Debe iniciar sesi\xF3n con \${request.bossEmail}\`);
  }

  if (isNaN(params.amountAuthorized) || params.amountAuthorized < 0) {
    throw new Error("El monto autorizado debe ser un valor positivo v\xE1lido.");
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
        path: "app/solicitar/page.tsx",
        language: "typescript",
        description: "P\xE1gina de Formulario de Solicitud con validaciones, preview de folio y experiencia de usuario limpia.",
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
        alert(\`\xA1Solicitud generada con \xE9xito! Folio: \${res.folio}\`);
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
        <h1 className="text-2xl font-bold text-slate-900 mb-2">Nueva Solicitud de Vi\xE1ticos</h1>
        <p className="text-slate-600 mb-6 text-sm">
          Complete la informaci\xF3n del viaje. El folio oficial se generar\xE1 autom\xE1ticamente y se enviar\xE1 la notificaci\xF3n al correo del jefe especificado.
        </p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-semibold text-slate-700 mb-1">
              Correo Electr\xF3nico del Jefe Inmediato *
            </label>
            <input
              type="email"
              name="bossEmail"
              required
              placeholder="director@tuempresa.com"
              className="w-full px-4 py-2.5 rounded-lg border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:outline-none text-sm"
            />
            <p className="text-xs text-slate-500 mt-1">Este correo recibir\xE1 la notificaci\xF3n con el enlace seguro de aprobaci\xF3n.</p>
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
            <label className="block text-sm font-semibold text-slate-700 mb-1">Justificaci\xF3n / Motivo del Viaje *</label>
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
              {loading ? "Enviando Solicitud..." : "Enviar a Aprobaci\xF3n"}
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
        path: "app/aprobar/[id]/page.tsx",
        language: "typescript",
        description: "P\xE1gina de Aprobaci\xF3n de Jefatura con validaci\xF3n de correo de sesi\xF3n, ajuste de monto autorizado y registro de auditor\xEDa.",
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

  // Registrar auditor\xEDa de apertura / visualizaci\xF3n
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
              Gesti\xF3n de Aprobaci\xF3n
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

        {/* Alerta de Seguridad de Validaci\xF3n de Correo */}
        {!isAuthorized && (
          <div className="p-6 bg-red-50 border-b border-red-200 text-red-800">
            <h3 className="font-bold text-base flex items-center gap-2">
              Acceso Restringido: Correo no Coincide
            </h3>
            <p className="text-sm mt-1">
              Esta solicitud est\xE1 dirigida a <strong>{request.bossEmail}</strong>. Tu sesi\xF3n actual es <strong>{session?.user?.email || "No autenticado"}</strong>.
              Para gestionar esta solicitud, debes iniciar sesi\xF3n con la cuenta de Google autorizada.
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
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Motivo / Justificaci\xF3n</h4>
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
  }
});

// api/index.ts
var index_exports = {};
__export(index_exports, {
  default: () => index_default
});
module.exports = __toCommonJS(index_exports);
var import_express2 = __toESM(require("express"), 1);
var import_crypto6 = __toESM(require("crypto"), 1);

// server/app.ts
var import_express = __toESM(require("express"), 1);
var import_cors = __toESM(require("cors"), 1);
var import_crypto2 = __toESM(require("crypto"), 1);

// server/supabase.js
var import_supabase_js = require("@supabase/supabase-js");
var client = null;
function getSupabaseClient() {
  if (client) return client;
  const rawUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!rawUrl) throw new Error("Database unavailable: falta SUPABASE_URL");
  if (!serviceRoleKey) throw new Error("Database unavailable: falta SUPABASE_SERVICE_ROLE_KEY");
  const supabaseUrl = rawUrl.replace(/\/+$/, "").replace(/\/rest\/v1\/?$/i, "");
  if (!/^https?:\/\/[^\s/]+(?:\.[^\s/]+)+$/i.test(supabaseUrl)) {
    throw new Error("Database unavailable: SUPABASE_URL no es v\xE1lida");
  }
  client = (0, import_supabase_js.createClient)(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  return client;
}
var supabase = new Proxy({}, {
  get(_target, property) {
    const instance = getSupabaseClient();
    const value = instance[property];
    return typeof value === "function" ? value.bind(instance) : value;
  }
});

// server/db.ts
var import_crypto = __toESM(require("crypto"), 1);
var ALL_SYSTEM_PERMISSIONS = [
  ["ver_solicitudes", "Ver mis solicitudes", "Consultar solicitudes de vi\xE1ticos", "Vi\xE1ticos"],
  ["crear_solicitudes", "Crear solicitudes", "Generar solicitudes", "Vi\xE1ticos"],
  ["editar_solicitudes", "Editar solicitudes", "Modificar solicitudes permitidas", "Vi\xE1ticos"],
  ["cancelar_solicitudes", "Cancelar solicitudes", "Cancelar solicitudes propias", "Vi\xE1ticos"],
  ["aprobar_solicitudes", "Aprobar solicitudes", "Dictaminar y autorizar vi\xE1ticos", "Aprobaciones"],
  ["ver_todas_solicitudes", "Ver todas las solicitudes", "Consultar solicitudes corporativas", "Aprobaciones"],
  ["administrar_usuarios", "Administrar usuarios", "Gestionar usuarios", "Administraci\xF3n"],
  ["administrar_departamentos", "Administrar departamentos", "Gestionar departamentos", "Administraci\xF3n"],
  ["administrar_jefes", "Administrar jefes", "Gestionar aprobadores", "Administraci\xF3n"],
  ["administrar_roles", "Administrar roles", "Gestionar roles y permisos", "Administraci\xF3n"],
  ["ver_reportes", "Ver reportes y Finanzas", "Consultar reportes y finanzas", "Finanzas"],
  ["administrar_configuracion", "Administrar configuraci\xF3n", "Gestionar configuraci\xF3n", "Administraci\xF3n"]
].map(([id, label, description, category]) => ({ id, label, description, category }));
var toUser = (r) => ({ id: r.id, name: r.name, email: r.email, role: r.role, roleId: r.role_id || void 0, department: r.department || "", status: r.status, isVerified: r.is_verified, passwordHash: r.password_hash, salt: r.salt, createdAt: r.created_at, avatar: r.avatar });
var toDept = (r) => ({ id: r.id, name: r.name, description: r.description || void 0, active: Boolean(r.active), createdAt: r.created_at });
var toRole = (r) => ({ id: r.id, name: r.name, description: r.description || void 0, active: Boolean(r.active), isSystem: Boolean(r.is_system), permissions: Array.isArray(r.permissions) ? r.permissions : [] });
var toBoss = (r) => ({ id: r.id, name: r.name, email: r.email, department: r.department || "", active: Boolean(r.active), createdAt: r.created_at });
var toReq = (r) => ({ id: r.id, folio: r.folio, status: r.status, userId: r.user_id, requesterName: r.requester_name, department: r.department, requestType: r.request_type, detail: r.detail, requestDate: r.request_date, urgency: r.urgency, bossId: r.boss_id, bossEmail: r.boss_email || "", bossName: r.boss_name, depositDate: r.deposit_date, startDate: r.start_date, endDate: r.end_date, destination: r.destination || "", reason: r.reason || "", amountRequested: r.amount_requested == null ? 0 : Number(r.amount_requested), amountAuthorized: r.amount_authorized == null ? null : Number(r.amount_authorized), transportCost: r.transport_cost == null ? 0 : Number(r.transport_cost), hotelCost: r.hotel_cost == null ? 0 : Number(r.hotel_cost), foodCost: r.food_cost == null ? 0 : Number(r.food_cost), miscCost: r.misc_cost == null ? 0 : Number(r.misc_cost), comments: r.comments, approvedBy: r.approved_by, approvedAt: r.approved_at, rejectedBy: r.rejected_by, rejectedAt: r.rejected_at, rejectionReason: r.rejection_reason, approvalToken: r.approval_token, createdAt: r.created_at, updatedAt: r.updated_at });
var toToken = (r) => ({ id: r.id, token: r.token, requestId: r.request_id, bossId: r.boss_id || void 0, bossEmail: r.boss_email || "", expiresAt: r.expires_at, used: Boolean(r.used), usedAt: r.used_at || void 0, action: r.action || void 0, createdAt: r.created_at });
var toAudit = (r) => ({ id: r.id, requestId: r.request_id, userId: r.user_id, userName: r.user_name, userEmail: r.user_email, action: r.action, details: r.details, createdAt: r.created_at });
function hashPassword(password, existingSalt) {
  const salt = existingSalt || import_crypto.default.randomBytes(16).toString("hex");
  return { hash: import_crypto.default.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex"), salt };
}
function verifyPassword(password, hash, salt) {
  try {
    if (!password || !hash || !salt) return false;
    const calc = import_crypto.default.pbkdf2Sync(password, salt, 1e4, 64, "sha512").toString("hex");
    const a = Buffer.from(calc, "hex"), b = Buffer.from(hash, "hex");
    return a.length === b.length && import_crypto.default.timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
var roleFallbackId = (role, roleId) => roleId || (role === "ADMIN" ? "role_admin" : role === "JEFE" ? "role_jefe" : role === "FINANZAS" ? "role_finanzas" : role === "SOLO_LECTURA_APROBADAS" ? "role_solo_lectura" : "role_solicitante");
async function getUserRoleIds(userId, fallbackRoleId) {
  const { data, error } = await supabase.from("user_roles").select("role_id").eq("user_id", userId);
  if (error) throw error;
  const ids = (data || []).map((r) => String(r.role_id)).filter(Boolean);
  return ids.length ? Array.from(new Set(ids)) : fallbackRoleId ? [fallbackRoleId] : [];
}
async function getRolesByIds(ids) {
  if (!ids.length) return [];
  const { data, error } = await supabase.from("roles").select("*").in("id", ids);
  if (error) throw error;
  return (data || []).map(toRole);
}
async function resolveUserRoles(u) {
  const primaryRoleId = roleFallbackId(u.role, u.roleId);
  const roleIds = await getUserRoleIds(u.id, primaryRoleId);
  const roles = await getRolesByIds(roleIds);
  const activeRoles = roles.filter((r) => r.active);
  const hasAdmin = u.role === "ADMIN" || activeRoles.some((r) => r.id === "role_admin" || r.name === "ADMIN");
  const permissions = hasAdmin ? ALL_SYSTEM_PERMISSIONS.map((p) => p.id) : Array.from(new Set(activeRoles.flatMap((r) => r.permissions)));
  return { roleIds, roles, permissions, primaryRoleId, hasAdmin };
}
function sanitizeUser(u, role) {
  const primaryRoleId = roleFallbackId(u.role, u.roleId);
  const perms = role?.permissions || [];
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    department: u.department || "",
    role: u.role,
    roleId: primaryRoleId,
    roleIds: u.roleIds || [primaryRoleId],
    roles: u.roles || (role ? [role] : []),
    permissions: u.permissions || (u.role === "ADMIN" ? ALL_SYSTEM_PERMISSIONS.map((p) => p.id) : perms),
    status: u.status,
    isVerified: u.isVerified ?? true,
    avatar: u.avatar,
    createdAt: u.createdAt
  };
}
async function sanitizeUserFromRecord(u) {
  const resolved = await resolveUserRoles(u);
  return sanitizeUser({ ...u, roleIds: resolved.roleIds, roles: resolved.roles, permissions: resolved.permissions }, resolved.roles.find((r) => r.id === resolved.primaryRoleId) || resolved.roles[0]);
}
async function getUserById(id) {
  const { data, error } = await supabase.from("users").select("*").eq("id", id).maybeSingle();
  if (error) throw error;
  return data ? await sanitizeUserFromRecord(toUser(data)) : null;
}
async function getUserByEmail(email) {
  const { data, error } = await supabase.from("users").select("*").eq("email", email.trim().toLowerCase()).maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const raw = toUser(data);
  const sanitized = await sanitizeUserFromRecord(raw);
  return Object.assign(sanitized, { passwordHash: raw.passwordHash, salt: raw.salt });
}
async function listUsers() {
  const { data, error } = await supabase.from("users").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return Promise.all((data || []).map((r) => sanitizeUserFromRecord(toUser(r))));
}
async function insertUser(u) {
  const { data, error } = await supabase.from("users").insert({ id: u.id, name: u.name, email: u.email.toLowerCase(), role: u.role, role_id: u.roleId || "role_solicitante", department: u.department || "General", status: u.status, is_verified: u.isVerified ?? true, password_hash: u.passwordHash || "", salt: u.salt || "", created_at: u.createdAt || (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (error) throw error;
  const user = toUser(data);
  const roleId = user.roleId || "role_solicitante";
  await supabase.from("user_roles").upsert({ user_id: user.id, role_id: roleId }, { onConflict: "user_id,role_id" });
  return sanitizeUserFromRecord(user);
}
async function updateUser(id, p) {
  const row = {};
  for (const [k, v] of Object.entries(p)) {
    const m = { name: "name", email: "email", role: "role", roleId: "role_id", department: "department", status: "status", isVerified: "is_verified", passwordHash: "password_hash", salt: "salt" };
    if (m[k] !== void 0 && v !== void 0) row[m[k]] = k === "email" ? String(v).toLowerCase() : v;
  }
  const { data, error } = await supabase.from("users").update(row).eq("id", id).select("*").single();
  if (error) throw error;
  return sanitizeUserFromRecord(toUser(data));
}
async function deleteUser(id) {
  const { error } = await supabase.from("users").delete().eq("id", id);
  if (error) throw error;
}
async function listDepartments() {
  const { data, error } = await supabase.from("departments").select("*").order("name");
  if (error) throw error;
  return (data || []).map(toDept);
}
async function getOrCreateDepartment(name) {
  const clean = name.trim() || "General";
  const { data, error } = await supabase.from("departments").select("*").ilike("name", clean).maybeSingle();
  if (error) throw error;
  if (data) return toDept(data);
  const { data: created, error: e } = await supabase.from("departments").insert({ id: `dept_${Date.now()}_${import_crypto.default.randomBytes(4).toString("hex")}`, name: clean, description: "Departamento registrado autom\xE1ticamente", active: true, created_at: (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (e) throw e;
  return toDept(created);
}
async function createDepartment(name, description) {
  return getOrCreateDepartment(name).then(async (d) => {
    if (d.description === "Departamento registrado autom\xE1ticamente" && description) {
      const { data, error } = await supabase.from("departments").update({ description }).eq("id", d.id).select("*").single();
      if (error) throw error;
      return toDept(data);
    }
    return d;
  });
}
async function updateDepartment(id, p) {
  const { data, error } = await supabase.from("departments").update({ name: p.name, description: p.description, active: p.active }).eq("id", id).select("*").single();
  if (error) throw error;
  return toDept(data);
}
async function listBosses() {
  const { data, error } = await supabase.from("bosses").select("*").order("name");
  if (error) throw error;
  return (data || []).map(toBoss);
}
async function createBoss(name, email, department) {
  const { data, error } = await supabase.from("bosses").insert({ id: `boss_${Date.now()}_${import_crypto.default.randomBytes(4).toString("hex")}`, name: name.trim(), email: email.trim().toLowerCase(), department: department.trim(), active: true, created_at: (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (error) throw error;
  return toBoss(data);
}
async function updateBoss(id, p) {
  const row = {};
  if (p.name !== void 0) row.name = p.name;
  if (p.email !== void 0) row.email = p.email.toLowerCase();
  if (p.department !== void 0) row.department = p.department;
  if (p.active !== void 0) row.active = Boolean(p.active);
  const { data, error } = await supabase.from("bosses").update(row).eq("id", id).select("*").single();
  if (error) throw error;
  return toBoss(data);
}
async function deleteBoss(id) {
  const { error } = await supabase.from("bosses").delete().eq("id", id);
  if (error) throw error;
}
async function listRoles() {
  const { data, error } = await supabase.from("roles").select("*").order("name");
  if (error) throw error;
  return (data || []).map(toRole);
}
async function createRole(p) {
  const { data, error } = await supabase.from("roles").insert({ id: `role_${Date.now()}_${import_crypto.default.randomBytes(4).toString("hex")}`, name: p.name.trim(), description: p.description?.trim() || null, permissions: Array.isArray(p.permissions) ? p.permissions : ["ver_solicitudes"], active: true, is_system: false, created_at: (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (error) throw error;
  return toRole(data);
}
async function updateRole(id, p) {
  const { data, error } = await supabase.from("roles").update({ name: p.name, description: p.description, permissions: p.permissions, active: p.active }).eq("id", id).select("*").single();
  if (error) throw error;
  return toRole(data);
}
async function listRequests() {
  const { data, error } = await supabase.from("travel_requests").select("*").order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(toReq);
}
async function getRequest(idOrFolio) {
  const { data, error } = await supabase.from("travel_requests").select("*").or(`id.eq.${idOrFolio},folio.eq.${idOrFolio}`).maybeSingle();
  if (error) throw error;
  return data ? toReq(data) : null;
}
async function getPopulatedRequests() {
  const rs = await listRequests();
  const ids = [...new Set(rs.map((r) => r.userId).filter(Boolean))];
  if (!ids.length) return rs;
  const { data, error } = await supabase.from("users").select("*").in("id", ids);
  if (error) throw error;
  const users = await Promise.all((data || []).map((r) => sanitizeUserFromRecord(toUser(r))));
  const usersMap = new Map(users.map((u) => [u.id, u]));
  return rs.map((r) => ({ ...r, user: usersMap.get(r.userId) }));
}
async function insertRequest(r) {
  const { data, error } = await supabase.from("travel_requests").insert({ id: r.id, folio: r.folio, status: r.status, user_id: r.userId, requester_name: r.requesterName || null, department: r.department || null, request_type: r.requestType || null, detail: r.detail || null, request_date: r.requestDate || null, urgency: r.urgency || null, boss_id: r.bossId || null, boss_email: r.bossEmail || null, boss_name: r.bossName || null, deposit_date: r.depositDate || null, start_date: r.startDate || null, end_date: r.endDate || null, destination: r.destination || null, reason: r.reason || null, amount_requested: r.amountRequested, amount_authorized: r.amountAuthorized ?? null, transport_cost: r.transportCost ?? 0, hotel_cost: r.hotelCost ?? 0, food_cost: r.foodCost ?? 0, misc_cost: r.miscCost ?? 0, comments: r.comments ?? null, approved_by: r.approvedBy || null, approved_at: r.approvedAt || null, created_at: r.createdAt || (/* @__PURE__ */ new Date()).toISOString(), approval_token: r.approvalToken || null, rejected_by: r.rejectedBy || null, rejected_at: r.rejectedAt || null, rejection_reason: r.rejectionReason || null, updated_at: r.updatedAt || null }).select("*").single();
  if (error) throw error;
  return toReq(data);
}
async function updateRequest(id, p) {
  const map = { requesterName: "requester_name", department: "department", requestType: "request_type", detail: "detail", requestDate: "request_date", urgency: "urgency", bossId: "boss_id", bossEmail: "boss_email", bossName: "boss_name", depositDate: "deposit_date", startDate: "start_date", endDate: "end_date", destination: "destination", reason: "reason", amountRequested: "amount_requested", amountAuthorized: "amount_authorized", transportCost: "transport_cost", hotelCost: "hotel_cost", foodCost: "food_cost", miscCost: "misc_cost", comments: "comments", approvedBy: "approved_by", approvedAt: "approved_at", rejectedBy: "rejected_by", rejectedAt: "rejected_at", rejectionReason: "rejection_reason", approvalToken: "approval_token", status: "status", updatedAt: "updated_at" };
  const row = {};
  for (const k of Object.keys(map)) if (p[k] !== void 0) row[map[k]] = p[k];
  const { data, error } = await supabase.from("travel_requests").update(row).eq("id", id).select("*").single();
  if (error) throw error;
  return toReq(data);
}
async function deleteRequest(id) {
  const { error } = await supabase.from("travel_requests").delete().eq("id", id);
  if (error) throw error;
}
async function generateNextFolio() {
  const { data, error } = await supabase.rpc("generate_next_travel_folio", { target_year: (/* @__PURE__ */ new Date()).getFullYear() });
  if (error || typeof data !== "string") throw new Error(`Error generando folio PostgreSQL: ${error?.message || "RPC no disponible"}`);
  return data;
}
async function createApprovalToken(requestId, bossEmail, bossId) {
  const { data, error } = await supabase.from("approval_tokens").insert({ id: `apptok_${Date.now()}_${import_crypto.default.randomBytes(8).toString("hex")}`, token: `tok_${import_crypto.default.randomBytes(32).toString("hex")}`, request_id: requestId, boss_id: bossId || null, boss_email: bossEmail.trim().toLowerCase(), expires_at: new Date(Date.now() + 7 * 864e5).toISOString(), used: false, created_at: (/* @__PURE__ */ new Date()).toISOString(), used_at: null, action: null }).select("*").single();
  if (error) throw error;
  return toToken(data);
}
async function validateApprovalToken(token) {
  const { data, error } = await supabase.from("approval_tokens").select("*").eq("token", token.trim()).maybeSingle();
  if (error) throw error;
  if (!data) return { valid: false, error: "Token inv\xE1lido o no encontrado" };
  const t = toToken(data);
  if (t.used) return { valid: false, error: `Este enlace ya fue utilizado previamente para ${t.action || "procesar"} la solicitud.`, tokenRecord: t };
  if (t.expiresAt && new Date(t.expiresAt).getTime() < Date.now()) return { valid: false, error: "Este enlace de autorizaci\xF3n ha expirado.", tokenRecord: t };
  const request = await getRequest(t.requestId);
  if (!request) return { valid: false, error: "No se encontr\xF3 la solicitud asociada al token", tokenRecord: t };
  return { valid: true, tokenRecord: t, request };
}
async function processApprovalTokenAction(token, action, amountAuthorized, comments) {
  const { data, error } = await supabase.rpc("process_approval_token_action", { p_token: token, p_action: action, p_amount_authorized: amountAuthorized ?? null, p_comments: comments ?? null });
  if (error) throw error;
  if (!data || data.success !== true) throw new Error("PostgreSQL no confirm\xF3 la autorizaci\xF3n");
  return data;
}
async function recordAuditLog(p) {
  const user = await getUserById(p.userId);
  const { data, error } = await supabase.from("audit_logs").insert({ id: `aud_${Date.now()}_${import_crypto.default.randomBytes(5).toString("hex")}`, request_id: p.requestId || null, user_id: p.userId, user_name: user?.name || null, user_email: user?.email || null, action: p.action, details: p.details || null, created_at: (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (error) throw error;
  return toAudit(data);
}
async function listAuditLogs(requestId) {
  let query = supabase.from("audit_logs").select("*").order("created_at", { ascending: false });
  if (requestId) query = query.eq("request_id", requestId);
  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(toAudit);
}
async function createVerificationCode(p) {
  const code = import_crypto.default.randomInt(1e5, 1e6).toString();
  const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
  const { error } = await supabase.from("verification_codes").upsert({ email: p.email.toLowerCase(), code, name: p.name, department: p.department, role_id: p.roleId, password_hash: p.passwordHash, salt: p.salt, expires_at: expiresAt, attempts: 0, created_at: (/* @__PURE__ */ new Date()).toISOString() }, { onConflict: "email" });
  if (error) throw error;
  return { code, expiresAt };
}
async function verifyCodeAndActivateUser(email, code) {
  const clean = email.trim().toLowerCase();
  const { data, error } = await supabase.from("verification_codes").select("*").eq("email", clean).maybeSingle();
  if (error) throw error;
  if (!data) return { success: false, error: "No hay un c\xF3digo pendiente para este correo." };
  if (new Date(data.expires_at).getTime() < Date.now()) return { success: false, error: "El c\xF3digo ha expirado." };
  if (Number(data.attempts || 0) >= 5) return { success: false, error: "Demasiados intentos. Solicita un nuevo c\xF3digo." };
  if (String(data.code) !== code.trim()) {
    await supabase.from("verification_codes").update({ attempts: Number(data.attempts || 0) + 1 }).eq("email", clean);
    return { success: false, error: "C\xF3digo de verificaci\xF3n incorrecto." };
  }
  const id = `usr_${Date.now()}_${import_crypto.default.randomBytes(5).toString("hex")}`;
  const { data: user, error: e } = await supabase.from("users").insert({ id, name: data.name, email: clean, role: "SOLICITANTE", role_id: data.role_id || "role_solicitante", department: data.department, status: "ACTIVO", is_verified: true, password_hash: data.password_hash, salt: data.salt, created_at: (/* @__PURE__ */ new Date()).toISOString() }).select("*").single();
  if (e) throw e;
  await supabase.from("user_roles").upsert({ user_id: id, role_id: data.role_id || "role_solicitante" }, { onConflict: "user_id,role_id" });
  await supabase.from("verification_codes").delete().eq("email", clean);
  return { success: true, user: await sanitizeUserFromRecord(toUser(user)) };
}
function hasPermission(u, p) {
  return !!u && u.status === "ACTIVO" && (u.role === "ADMIN" || u.permissions?.includes(p));
}

// server/mailService.ts
var import_nodemailer = __toESM(require("nodemailer"), 1);

// server/emailIdempotency.ts
async function reserveEmailDelivery(p) {
  const key = p.key.trim();
  if (!key) return true;
  const { error } = await supabase.from("email_delivery_keys").insert({
    id: key,
    request_id: p.requestId || null,
    folio: p.folio || null,
    recipient: p.recipient.trim().toLowerCase(),
    subject: p.subject,
    status: "sending",
    created_at: (/* @__PURE__ */ new Date()).toISOString(),
    updated_at: (/* @__PURE__ */ new Date()).toISOString()
  });
  if (!error) return true;
  if (error.code === "23505") return false;
  console.error("[EMAIL-IDEMPOTENCY] No se pudo reservar la entrega:", error);
  return true;
}
async function markEmailDeliverySent(key) {
  const { error } = await supabase.from("email_delivery_keys").update({ status: "sent", sent_at: (/* @__PURE__ */ new Date()).toISOString(), updated_at: (/* @__PURE__ */ new Date()).toISOString() }).eq("id", key);
  if (error) console.error("[EMAIL-IDEMPOTENCY] No se pudo marcar como enviado:", error);
}
async function releaseEmailDelivery(key) {
  const { error } = await supabase.from("email_delivery_keys").delete().eq("id", key);
  if (error) console.error("[EMAIL-IDEMPOTENCY] No se pudo liberar la reserva:", error);
}
function buildEmailDeliveryKey(requestId, recipient, subject) {
  const raw = `${requestId || "no-request"}|${recipient.trim().toLowerCase()}|${subject.trim()}`;
  let h1 = 2166136261;
  for (let i = 0; i < raw.length; i++) {
    h1 ^= raw.charCodeAt(i);
    h1 = Math.imul(h1, 16777619);
  }
  return `mail_${(h1 >>> 0).toString(16)}_${raw.length}`;
}

// server/mailService.ts
var outboxLogs = [];
var recentEmailKeys = /* @__PURE__ */ new Map();
function credentials() {
  const host = (process.env.SMTP_HOST || process.env.EMAIL_HOST || "smtp.gmail.com").trim();
  const port = parseInt(process.env.SMTP_PORT || process.env.EMAIL_PORT || "465", 10);
  const user = (process.env.DIMER_SMTP_USER || process.env.SMTP_USER || process.env.GMAIL_USER || process.env.EMAIL_USER || "sistemas@dimer.com.mx").trim().replace(/^["']|["']$/g, "");
  const pass = (process.env.DIMER_SMTP_APP_PASSWORD || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || process.env.GMAIL_APP_PASSWORD || process.env.EMAIL_PASS || "").trim().replace(/^["']|["']$/g, "").replace(/\s+/g, "");
  const secure = (process.env.SMTP_SECURE || "").trim().toLowerCase() === "true" || port === 465;
  return { host, port, user, pass, secure };
}
function getMailTransporter() {
  const c = credentials();
  if (!c.user || !c.pass) return null;
  return import_nodemailer.default.createTransport({
    host: c.host,
    port: c.port,
    secure: c.secure,
    auth: { user: c.user, pass: c.pass },
    tls: { rejectUnauthorized: false },
    connectionTimeout: 15e3,
    greetingTimeout: 15e3,
    socketTimeout: 2e4
  });
}
function getFromAddress(customFrom) {
  const c = credentials();
  const rawFrom = customFrom?.trim() || process.env.SMTP_FROM?.trim() || "Dimer Notificaciones";
  let displayName = "Dimer Notificaciones";
  let fromEmail = c.user || "sistemas@dimer.com.mx";
  const bracketMatch = rawFrom.match(/^(.*?)\s*<([^>]+)>$/);
  if (bracketMatch) {
    const candidateEmail = bracketMatch[2]?.trim();
    if (candidateEmail?.includes("@")) fromEmail = candidateEmail;
    if (bracketMatch[1]?.trim()) {
      displayName = bracketMatch[1].trim().replace(/^["']|["']$/g, "");
    }
  } else if (rawFrom.includes("@")) {
    fromEmail = rawFrom.replace(/^["']|["']$/g, "").trim();
    const localPart = fromEmail.split("@")[0]?.trim();
    if (localPart) displayName = localPart;
  } else {
    displayName = rawFrom.replace(/^["']|["']$/g, "");
  }
  return `"${displayName}" <${fromEmail}>`;
}
var esc = (v) => String(v ?? "").replace(/[&<>\"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[m]);
var formatCurrency = (amount) => new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN" }).format(Number(amount || 0));
function buildBossApprovalEmailHtml(params) {
  const { request, user, approveUrl, rejectUrl, token } = params;
  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || "Operaciones";
  const requestType = request.requestType || "Vi\xE1ticos y Gastos de Viaje";
  const detail = request.detail || request.reason;
  const requestDate = request.requestDate || (request.createdAt ? new Date(request.createdAt).toLocaleDateString("es-MX") : (/* @__PURE__ */ new Date()).toLocaleDateString("es-MX"));
  const depositDate = request.depositDate ? (/* @__PURE__ */ new Date(request.depositDate + "T00:00:00")).toLocaleDateString("es-MX") : "";
  const urgency = (request.urgency || "media").toLowerCase();
  const urgencyBadgeStyle = urgency === "alta" ? "background:#fef2f2;color:#dc2626;border:1px solid #f87171;" : urgency === "baja" ? "background:#f0fdf4;color:#16a34a;border:1px solid #86efac;" : "background:#fffbeb;color:#d97706;border:1px solid #fcd34d;";
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#0f172a;color:#fff;padding:24px 32px;border-bottom:3px solid #3b82f6}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.amount{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:14px;text-align:center;margin:20px 0}.btn{display:inline-block;color:#fff!important;text-decoration:none;font-weight:700;padding:12px 24px;border-radius:6px;font-size:14px;margin:4px}.approve{background:#059669}.reject{background:#dc2626}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#2563eb;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD POR AUTORIZAR - ${esc(requestType)}</div><h1>Revisi\xF3n y Dictamen del Supervisor</h1><p>Folio Oficial: <strong>${esc(request.folio)}</strong></p></div><div class="content"><p>Estimado/a L\xEDder, <strong>${esc(requesterName)}</strong> (${esc(user.email)}) ha generado una solicitud para su autorizaci\xF3n formal.</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${esc(requestType)}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${esc(requestDate)}</td></tr>${depositDate ? `<tr><td class="label">Fecha requerida de dep\xF3sito</td><td class="value"><strong>${esc(depositDate)}</strong></td></tr>` : ``}<tr><td class="label">Urgencia</td><td class="value"><span style="${urgencyBadgeStyle}">${esc(urgency.toUpperCase())}</span></td></tr><tr><td class="label">Detalle</td><td class="value">${esc(detail)}</td></tr>${request.destination ? `<tr><td class="label">Destino</td><td class="value"><strong>${esc(request.destination)}</strong></td></tr>` : ""}${request.startDate && request.endDate ? `<tr><td class="label">Periodo</td><td class="value">${new Date(request.startDate).toLocaleDateString("es-MX")} al ${new Date(request.endDate).toLocaleDateString("es-MX")}</td></tr>` : ""}${request.comments ? `<tr><td class="label">Observaciones</td><td class="value">${esc(request.comments)}</td></tr>` : ""}</table><div class="amount"><div>Monto Total Solicitado</div><strong style="font-size:24px;color:#047857">${formatCurrency(request.amountRequested)} MXN</strong></div><div style="text-align:center"><a href="${approveUrl}" class="btn approve">\u2713 APROBAR SOLICITUD</a><a href="${rejectUrl}" class="btn reject">\u2715 RECHAZAR SOLICITUD</a></div><p style="font-size:11px;color:#64748b">Token de un solo uso: ${esc(token)}</p></div><div class="footer">Solicitud de Vi\xE1ticos \xA9 2026 \u2022 Dimer Corporativo</div></div></body></html>`;
}
function buildSystemsApprovedEmailHtml(params) {
  const { request, user, approverName, approverEmail, approvedAt } = params;
  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || "Operaciones";
  const requestType = request.requestType || "Vi\xE1ticos y Gastos de Viaje";
  const detail = request.detail || request.reason;
  const requestDate = request.requestDate || (request.createdAt ? new Date(request.createdAt).toLocaleDateString("es-MX") : (/* @__PURE__ */ new Date()).toLocaleDateString("es-MX"));
  const depositDate = request.depositDate ? (/* @__PURE__ */ new Date(request.depositDate + "T00:00:00")).toLocaleDateString("es-MX") : "";
  const urgency = (request.urgency || "media").toLowerCase();
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#064e3b;color:#fff;padding:24px 32px;border-bottom:3px solid #10b981}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.authorized{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;text-align:center;margin:20px 0}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#10b981;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD APROBADA - ${esc(requestType)}</div><h1>SOLICITUD APROBADA - ${esc(request.folio)}</h1><p>Notificaci\xF3n oficial a Finanzas y Solicitante</p></div><div class="content"><p>Se ha registrado la autorizaci\xF3n formal de la siguiente solicitud:</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${esc(requestType)}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${esc(requestDate)}</td></tr>${depositDate ? `<tr><td class="label">Fecha requerida de dep\xF3sito</td><td class="value"><strong>${esc(depositDate)}</strong></td></tr>` : ``}<tr><td class="label">Urgencia</td><td class="value">${esc(urgency.toUpperCase())}</td></tr><tr><td class="label">Supervisor que Aprob\xF3</td><td class="value"><strong>${esc(approverName)}</strong> (${esc(approverEmail)})</td></tr><tr><td class="label">Fecha/Hora Aprobaci\xF3n</td><td class="value">${esc(new Date(approvedAt).toLocaleString("es-MX"))}</td></tr><tr><td class="label">Detalle</td><td class="value">${esc(detail)}</td></tr>${request.destination ? `<tr><td class="label">Destino</td><td class="value">${esc(request.destination)}</td></tr>` : ""}<tr><td class="label">Monto Solicitado</td><td class="value">${formatCurrency(request.amountRequested)} MXN</td></tr>${request.comments ? `<tr><td class="label">Observaciones</td><td class="value">${esc(request.comments)}</td></tr>` : ""}</table><div class="authorized"><div>Monto Total Autorizado</div><strong style="font-size:26px;color:#047857">${formatCurrency(request.amountAuthorized || request.amountRequested)} MXN</strong></div></div><div class="footer">Sistema de Gesti\xF3n de Solicitudes \xA9 2026 \u2022 Dimer Corporativo</div></div></body></html>`;
}
function buildRequesterConfirmationEmailHtml(params) {
  const { request, user, bossName, bossEmail } = params;
  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || "Operaciones";
  const requestType = request.requestType || "Vi\xE1ticos y Gastos de Viaje";
  const detail = request.detail || request.reason;
  const requestDate = request.requestDate || (request.createdAt ? new Date(request.createdAt).toLocaleDateString("es-MX") : (/* @__PURE__ */ new Date()).toLocaleDateString("es-MX"));
  const depositDate = request.depositDate ? (/* @__PURE__ */ new Date(request.depositDate + "T00:00:00")).toLocaleDateString("es-MX") : "";
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#0f172a;color:#fff;padding:24px 32px;border-bottom:3px solid #3b82f6}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.amount{background:#f8fafc;border:1px solid #cbd5e1;border-radius:8px;padding:14px;text-align:center;margin:20px 0}.status-banner{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:16px 0;color:#1e40af;font-size:13px}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#2563eb;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD REGISTRADA - ${esc(requestType)}</div><h1>Confirmaci\xF3n de Solicitud de Vi\xE1ticos</h1><p>Folio Oficial: <strong>${esc(request.folio)}</strong></p></div><div class="content"><p>Hola <strong>${esc(requesterName)}</strong>, tu solicitud ha sido registrada en el sistema y enviada para dictamen de tu supervisor/a.</p><div class="status-banner"><strong>Estatus actual:</strong> Pendiente de Autorizaci\xF3n<br><strong>Aprobador asignado:</strong> ${esc(bossName)} (${esc(bossEmail)})</div><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Tipo</td><td class="value"><strong>${esc(requestType)}</strong></td></tr><tr><td class="label">Fecha</td><td class="value">${esc(requestDate)}</td></tr>${depositDate ? `<tr><td class="label">Fecha requerida de dep\xF3sito</td><td class="value"><strong>${esc(depositDate)}</strong></td></tr>` : ``}<tr><td class="label">Detalle</td><td class="value">${esc(detail)}</td></tr>${request.destination ? `<tr><td class="label">Destino</td><td class="value"><strong>${esc(request.destination)}</strong></td></tr>` : ""}${request.startDate && request.endDate ? `<tr><td class="label">Periodo</td><td class="value">${new Date(request.startDate).toLocaleDateString("es-MX")} al ${new Date(request.endDate).toLocaleDateString("es-MX")}</td></tr>` : ""}</table><div class="amount"><div>Monto Solicitado</div><strong style="font-size:24px;color:#0f172a">${formatCurrency(request.amountRequested)} MXN</strong></div><p style="font-size:12px;color:#64748b">Recibir\xE1s una notificaci\xF3n por este medio en cuanto tu solicitud sea dictaminada.</p></div><div class="footer">Sistema de Gesti\xF3n de Vi\xE1ticos \xA9 2026 \u2022 Dimer Corporativo</div></div></body></html>`;
}
function buildRejectionEmailHtml(params) {
  const { request, user, rejectorName, rejectorEmail, reason } = params;
  const requesterName = request.requesterName || user.name;
  const department = request.department || user.department || "Operaciones";
  const requestType = request.requestType || "Vi\xE1ticos y Gastos de Viaje";
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1}.header{background:#991b1b;color:#fff;padding:24px 32px;border-bottom:3px solid #dc2626}.content{padding:28px 32px}.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}.label{font-weight:700;color:#64748b;width:35%;text-transform:uppercase;font-size:11px}.value{color:#0f172a;font-weight:500}.reason-box{background:#fef2f2;border:1px solid #fecaca;border-radius:8px;padding:16px;margin:20px 0;color:#991b1b}.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center}</style></head><body><div class="card"><div class="header"><div style="display:inline-block;background:#dc2626;color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px">SOLICITUD NO AUTORIZADA - ${esc(requestType)}</div><h1>SOLICITUD RECHAZADA - ${esc(request.folio)}</h1><p>Notificaci\xF3n oficial de dictamen</p></div><div class="content"><p>Estimado/a <strong>${esc(requesterName)}</strong>, te informamos que la siguiente solicitud de vi\xE1ticos no fue autorizada:</p><table class="info-table"><tr><td class="label">Folio</td><td class="value"><strong>${esc(request.folio)}</strong></td></tr><tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr><tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr><tr><td class="label">Dictaminado por</td><td class="value"><strong>${esc(rejectorName)}</strong> (${esc(rejectorEmail)})</td></tr><tr><td class="label">Monto Solicitado</td><td class="value">${formatCurrency(request.amountRequested)} MXN</td></tr></table><div class="reason-box"><strong>Motivo del rechazo / observaciones:</strong><div style="margin-top:6px;font-size:14px">${esc(reason || "No se especific\xF3 motivo")}</div></div><p style="font-size:12px;color:#64748b">Si tienes dudas sobre este dictamen, contacta directamente a tu l\xEDder o al departamento correspondiente.</p></div><div class="footer">Sistema de Gesti\xF3n de Vi\xE1ticos \xA9 2026 \u2022 Dimer Corporativo</div></div></body></html>`;
}
function buildPaymentRegisteredEmailHtml(params) {
  const { request: r, user, paymentMethod, reference, notes, paidBy = "Tesorer\xEDa & Finanzas", paidAt = (/* @__PURE__ */ new Date()).toISOString() } = params;
  const requesterName = r.requesterName || user.name;
  const department = r.department || user.department || "Operaciones";
  const requestType = r.requestType || "Vi\xE1ticos y Gastos de Viaje";
  const isSpei = String(paymentMethod).toUpperCase() === "SPEI";
  const methodLabel = isSpei ? "Transferencia Bancaria SPEI" : "Pago en Efectivo";
  const badgeBg = isSpei ? "#2563eb" : "#059669";
  const amountDisbursed = r.amountAuthorized || r.amountRequested;
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><style>
body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#1e293b}
.card{max-width:620px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #cbd5e1;box-shadow:0 4px 12px rgba(0,0,0,0.06)}
.header{background:#0f172a;color:#fff;padding:24px 32px;border-bottom:4px solid ${badgeBg}}
.brand-pill{display:inline-block;background:${badgeBg};color:#fff;font-size:11px;font-weight:800;padding:4px 10px;border-radius:4px;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.header h1{margin:0;font-size:22px;font-weight:800;color:#fff}
.header p{margin:4px 0 0 0;font-size:13px;color:#94a3b8}
.content{padding:28px 32px}
.highlight-banner{background:#ecfdf5;border:1px solid #a7f3d0;border-radius:8px;padding:16px;margin:0 0 20px 0;color:#065f46;text-align:center}
.highlight-banner .amount-label{font-size:11px;text-transform:uppercase;font-weight:700;color:#047857}
.highlight-banner .amount-val{font-size:26px;font-weight:900;color:#065f46;margin-top:4px}
.info-table{width:100%;border-collapse:collapse;margin:16px 0;font-size:13px}
.info-table td{padding:8px 10px;border-bottom:1px solid #f1f5f9}
.label{font-weight:700;color:#64748b;width:38%;text-transform:uppercase;font-size:11px}
.value{color:#0f172a;font-weight:500}
.notes-box{background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px;margin:16px 0;font-size:13px;color:#334155}
.reminder-box{background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px;padding:14px;margin:20px 0;color:#1e40af;font-size:12px;line-height:1.5}
.footer{background:#f8fafc;padding:16px 32px;font-size:11px;color:#94a3b8;text-align:center;border-top:1px solid #e2e8f0}
</style></head><body>
<div class="card">
  <div class="header">
    <div class="brand-pill">PAGO DISPERSADO - ${esc(paymentMethod.toUpperCase())}</div>
    <h1>\xA1Tu Solicitud ha sido Pagada!</h1>
    <p>Folio Oficial: <strong>${esc(r.folio)}</strong> &bull; Notificaci\xF3n Oficial de Tesorer\xEDa</p>
  </div>
  <div class="content">
    <p>Estimado/a <strong>${esc(requesterName)}</strong>,</p>
    <p>Te informamos que el departamento de Finanzas / Tesorer\xEDa ha registrado exitosamente la <strong>dispersi\xF3n de pago</strong> correspondiente a tu solicitud de vi\xE1ticos.</p>
    
    <div class="highlight-banner">
      <div class="amount-label">Monto Total Dispersado</div>
      <div class="amount-val">${formatCurrency(amountDisbursed)} MXN</div>
    </div>

    <table class="info-table">
      <tr><td class="label">Folio Oficial</td><td class="value"><strong>${esc(r.folio)}</strong></td></tr>
      <tr><td class="label">Solicitante</td><td class="value"><strong>${esc(requesterName)}</strong> (${esc(user.email)})</td></tr>
      <tr><td class="label">Departamento</td><td class="value">${esc(department)}</td></tr>
      <tr><td class="label">Tipo de Solicitud</td><td class="value">${esc(requestType)}</td></tr>
      <tr><td class="label">M\xE9todo de Pago</td><td class="value"><strong style="color:${badgeBg}">${esc(methodLabel)}</strong></td></tr>
      ${reference ? `<tr><td class="label">Referencia / Folio SPEI</td><td class="value"><span style="font-family:monospace;font-weight:700;color:#0f172a">${esc(reference)}</span></td></tr>` : ""}
      <tr><td class="label">Fecha y Hora de Pago</td><td class="value">${esc(new Date(paidAt).toLocaleString("es-MX"))}</td></tr>
      <tr><td class="label">Registrado por</td><td class="value">${esc(paidBy)}</td></tr>
      ${r.destination ? `<tr><td class="label">Destino</td><td class="value">${esc(r.destination)}</td></tr>` : ""}
    </table>

    ${notes ? `
    <div class="notes-box">
      <strong>Notas de Tesorer\xEDa:</strong>
      <div style="margin-top:4px">${esc(notes)}</div>
    </div>` : ""}

    <div class="reminder-box">
      <strong>Recordatorio de Comprobaci\xF3n:</strong>
      <div style="margin-top:4px">
        Recuerda solicitar facturas electr\xF3nicas v\xE1lidas (CFDI en XML y PDF) a nombre de la empresa por todos los gastos realizados y presentarlas a trav\xE9s del sistema para cerrar tu comprobaci\xF3n en tiempo y forma.
      </div>
    </div>
  </div>
  <div class="footer">
    Sistema de Gesti\xF3n de Vi\xE1ticos \xA9 2026 \u2022 Dimer Corporativo \u2022 Tesorer\xEDa y Finanzas
  </div>
</div>
</body></html>`;
}
function buildVerificationEmailHtml(p) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><title>C\xF3digo de Verificaci\xF3n - Vi\xE1ticos Dimer</title><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px;color:#1e293b}.card{max-width:540px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0}.header{background:#0f172a;color:#fff;padding:28px 24px;text-align:center}.body{padding:32px 28px;text-align:center}.code-box{background:#f8fafc;border:2px dashed #6366f1;border-radius:12px;padding:24px;margin:24px 0}.code-digits{font-family:monospace;font-size:36px;font-weight:900;letter-spacing:.25em;color:#0f172a}.footer{background:#f8fafc;padding:18px 24px;text-align:center;font-size:11px;color:#94a3b8}</style></head><body><div class="card"><div class="header"><h1>Vi\xE1ticos Dimer</h1><p>Verificaci\xF3n de Seguridad de Cuenta</p></div><div class="body"><p>Hola <strong>${esc(p.name)}</strong>,</p><p>Has solicitado registrar tu cuenta con el correo <strong>${esc(p.email)}</strong>.</p><div class="code-box"><div>Tu C\xF3digo de Verificaci\xF3n</div><div class="code-digits">${esc(p.code)}</div><div>V\xE1lido por <strong>${p.expiresMinutes || 15} minutos</strong></div></div><p style="font-size:12px;color:#64748b">Si t\xFA no solicitaste este c\xF3digo, ignora este mensaje.</p></div><div class="footer">Sistema de Gesti\xF3n de Vi\xE1ticos \xA9 2026 \u2022 Dimer Corporativo</div></div></body></html>`;
}
function buildNewAccountAdminEmailHtml(p) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="UTF-8"><style>body{font-family:Arial,sans-serif;background:#f1f5f9;margin:0;padding:20px;color:#1e293b}.card{max-width:540px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0}.header{background:#0f172a;color:#fff;padding:24px;text-align:center}.body{padding:28px}.footer{background:#f8fafc;padding:16px;text-align:center;font-size:11px;color:#94a3b8}</style></head><body><div class="card"><div class="header"><h1>Nueva cuenta registrada</h1></div><div class="body"><p><strong>${esc(p.user.name)}</strong> registr\xF3 ${esc(p.user.email)}.</p><p>Departamento: ${esc(p.user.department)}<br>Rol inicial: ${esc(p.user.role)}<br>Fecha: ${esc(p.registeredAt)}</p></div><div class="footer">Sistema de Gesti\xF3n de Vi\xE1ticos \xA9 2026 \u2022 Dimer Corporativo</div></div></body></html>`;
}
function buildTokenApprovalDecisionPageHtml(p) {
  const r = p.request;
  const isApprove = p.initialAction === "approve";
  const detail = r.detail || r.reason;
  const requesterName = r.requesterName || p.user.name || "Colaborador";
  const requesterEmail = p.user.email || r.requesterEmail || "";
  const department = r.department || p.user.department || "General";
  const requestType = r.requestType || "Vi\xE1ticos y Gastos de Viaje";
  const requestDate = r.requestDate || (r.createdAt ? new Date(r.createdAt).toLocaleDateString("es-MX") : (/* @__PURE__ */ new Date()).toLocaleDateString("es-MX"));
  const urgency = (r.urgency || "media").toLowerCase();
  const urgencyBadgeStyle = urgency === "alta" ? "background:#fef2f2;color:#dc2626;border:1px solid #f87171;" : urgency === "baja" ? "background:#f0fdf4;color:#16a34a;border:1px solid #86efac;" : "background:#fffbeb;color:#d97706;border:1px solid #fcd34d;";
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Dictamen de Solicitud ${esc(r.folio)} - Dimer</title>
  <style>
    *, *:before, *:after { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; margin: 0; padding: 20px 12px; color: #0f172a; line-height: 1.5; }
    .container { max-width: 680px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px -2px rgba(0,0,0,0.08), 0 2px 6px -1px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; }
    .header { background: #0f172a; color: #ffffff; padding: 24px 28px; border-bottom: 4px solid #2563eb; }
    .brand-badge { display: inline-block; background: #2563eb; color: #ffffff; font-size: 11px; font-weight: 800; letter-spacing: 0.05em; padding: 4px 10px; border-radius: 6px; text-transform: uppercase; margin-bottom: 8px; }
    .header h1 { font-size: 22px; margin: 4px 0; font-weight: 800; color: #ffffff; }
    .header p { margin: 2px 0 0 0; font-size: 13px; color: #94a3b8; }
    .content { padding: 28px; }
    .error-alert { background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 14px 18px; border-radius: 10px; margin-bottom: 20px; font-size: 14px; }
    .section-title { font-size: 12px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 12px; }
    .info-grid { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 18px; margin-bottom: 24px; }
    .info-row { display: flex; justify-content: space-between; padding: 7px 0; border-bottom: 1px solid #edf2f7; font-size: 13px; }
    .info-row:last-child { border-bottom: none; }
    .info-label { color: #64748b; font-weight: 600; width: 38%; }
    .info-val { color: #0f172a; font-weight: 600; width: 62%; text-align: right; word-break: break-word; }
    .breakdown-box { background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 14px; margin-top: 14px; }
    .breakdown-row { display: flex; justify-content: space-between; font-size: 12px; color: #1e40af; padding: 3px 0; }
    .total-row { display: flex; justify-content: space-between; font-size: 16px; font-weight: 800; color: #1e3a8a; border-top: 1px dashed #93c5fd; padding-top: 8px; margin-top: 6px; }
    
    .tab-buttons { display: flex; gap: 8px; margin-bottom: 20px; }
    .tab-btn { flex: 1; padding: 14px; border: 2px solid #e2e8f0; border-radius: 10px; font-weight: 800; font-size: 14px; cursor: pointer; text-align: center; background: #f8fafc; color: #64748b; transition: all 0.2s; }
    .tab-btn.active-approve { background: #ecfdf5; border-color: #059669; color: #065f46; box-shadow: 0 0 0 1px #059669; }
    .tab-btn.active-reject { background: #fef2f2; border-color: #dc2626; color: #991b1b; box-shadow: 0 0 0 1px #dc2626; }
    
    .form-group { margin-bottom: 18px; }
    .form-label { display: block; font-size: 13px; font-weight: 700; color: #334155; margin-bottom: 6px; }
    .form-control { width: 100%; padding: 12px 14px; font-size: 14px; border: 1.5px solid #cbd5e1; border-radius: 8px; background: #fff; color: #0f172a; transition: border 0.2s; }
    .form-control:focus { outline: none; border-color: #2563eb; box-shadow: 0 0 0 3px rgba(37,99,235,0.15); }
    textarea.form-control { min-height: 95px; resize: vertical; }
    
    .submit-btn { width: 100%; padding: 15px 20px; font-size: 16px; font-weight: 800; color: #ffffff; border: none; border-radius: 10px; cursor: pointer; transition: background 0.2s, transform 0.1s; }
    .submit-btn:active { transform: scale(0.99); }
    .btn-approve { background: #059669; }
    .btn-approve:hover { background: #047857; }
    .btn-reject { background: #dc2626; }
    .btn-reject:hover { background: #b91c1c; }

    .warning-box { background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 14px; border-radius: 10px; font-size: 13px; margin-bottom: 18px; }
    .footer { background: #f8fafc; padding: 18px 28px; font-size: 12px; color: #94a3b8; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand-badge">Dimer \u2022 Autorizaciones</div>
      <h1>Dictamen de Solicitud de Vi\xE1ticos</h1>
      <p>Folio Oficial: <strong style="color:#ffffff">${esc(r.folio)}</strong></p>
    </div>
    
    <div class="content">
      ${p.errorMessage ? `<div class="error-alert"><strong>Atenci\xF3n:</strong> ${esc(p.errorMessage)}</div>` : ""}

      <div class="section-title">Resumen de la Solicitud</div>
      <div class="info-grid">
        <div class="info-row">
          <span class="info-label">Folio</span>
          <span class="info-val" style="font-size:14px;color:#2563eb;"><strong>${esc(r.folio)}</strong></span>
        </div>
        <div class="info-row">
          <span class="info-label">Solicitante</span>
          <span class="info-val">${esc(requesterName)}${requesterEmail ? ` <span style="font-weight:400;color:#64748b">(${esc(requesterEmail)})</span>` : ""}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Departamento</span>
          <span class="info-val">${esc(department)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Tipo</span>
          <span class="info-val">${esc(requestType)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Fecha Solicitud</span>
          <span class="info-val">${esc(requestDate)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Urgencia</span>
          <span class="info-val"><span style="padding:2px 8px;border-radius:4px;font-size:11px;${urgencyBadgeStyle}">${esc(urgency.toUpperCase())}</span></span>
        </div>
        ${r.destination ? `
        <div class="info-row">
          <span class="info-label">Destino</span>
          <span class="info-val">${esc(r.destination)}</span>
        </div>` : ""}
        ${r.startDate && r.endDate ? `
        <div class="info-row">
          <span class="info-label">Periodo</span>
          <span class="info-val">${new Date(r.startDate).toLocaleDateString("es-MX")} al ${new Date(r.endDate).toLocaleDateString("es-MX")}</span>
        </div>` : ""}
        <div class="info-row">
          <span class="info-label">Motivo / Detalle</span>
          <span class="info-val">${esc(detail)}</span>
        </div>

        <div class="breakdown-box">
          ${r.transportCost ? `<div class="breakdown-row"><span>Transporte / Combustible:</span><span>${formatCurrency(r.transportCost)} MXN</span></div>` : ""}
          ${r.hotelCost ? `<div class="breakdown-row"><span>Hospedaje:</span><span>${formatCurrency(r.hotelCost)} MXN</span></div>` : ""}
          ${r.foodCost ? `<div class="breakdown-row"><span>Alimentos:</span><span>${formatCurrency(r.foodCost)} MXN</span></div>` : ""}
          ${r.miscCost ? `<div class="breakdown-row"><span>Varios / Casetas:</span><span>${formatCurrency(r.miscCost)} MXN</span></div>` : ""}
          <div class="total-row">
            <span>Monto Total Solicitado:</span>
            <span>${formatCurrency(r.amountRequested)} MXN</span>
          </div>
        </div>
      </div>

      <div class="section-title">Selecciona tu Dictamen</div>
      
      <div class="tab-buttons">
        <div id="btnTabApprove" class="tab-btn ${isApprove ? "active-approve" : ""}" onclick="selectDecision('approve')">
          \u2713 Aprobar Solicitud
        </div>
        <div id="btnTabReject" class="tab-btn ${!isApprove ? "active-reject" : ""}" onclick="selectDecision('reject')">
          \u2715 Rechazar Solicitud
        </div>
      </div>

      <!-- FORMULARIO DE APROBACI\xD3N -->
      <form id="formApprove" method="POST" action="/api/approval/submit-decision?token=${encodeURIComponent(p.token)}&action=approve" style="${isApprove ? "display:block;" : "display:none;"}">
        <input type="hidden" name="token" value="${esc(p.token)}">
        <input type="hidden" name="decision" value="APROBADA">

        <div class="form-group">
          <label class="form-label" for="amountAuthorized">Monto a Autorizar (MXN) *</label>
          <input type="number" step="0.01" min="0" id="amountAuthorized" name="amountAuthorized" class="form-control" value="${esc(r.amountAuthorized || r.amountRequested)}" required>
          <span style="font-size:11px;color:#64748b;margin-top:3px;display:block">Puedes ajustar el monto final autorizado si corresponde.</span>
        </div>

        <div class="form-group">
          <label class="form-label" for="approveComments">Observaciones de Autorizaci\xF3n (Opcional)</label>
          <textarea id="approveComments" name="comments" class="form-control" placeholder="Instrucciones o notas adicionales para Finanzas y el solicitante...">${esc(r.comments || "")}</textarea>
        </div>

        <button type="submit" class="submit-btn btn-approve">
          \u2713 Confirmar y Autorizar Solicitud
        </button>
      </form>

      <!-- FORMULARIO DE RECHAZO -->
      <form id="formReject" method="POST" action="/api/approval/submit-decision?token=${encodeURIComponent(p.token)}&action=reject" style="${!isApprove ? "display:block;" : "display:none;"}">
        <input type="hidden" name="token" value="${esc(p.token)}">
        <input type="hidden" name="decision" value="RECHAZADA">

        <div class="warning-box">
          <strong>Confirmaci\xF3n requerida:</strong> Est\xE1s a punto de no autorizar esta solicitud. Se enviar\xE1 una notificaci\xF3n por correo al colaborador y a Sistemas con el motivo detallado.
        </div>

        <div class="form-group">
          <label class="form-label" for="rejectReason">Motivo del Rechazo (Obligatorio) *</label>
          <textarea id="rejectReason" name="comments" class="form-control" placeholder="Escribe aqu\xED de forma clara y detallada el motivo por el cual no se autoriza esta solicitud..." required minlength="3"></textarea>
        </div>

        <button type="submit" class="submit-btn btn-reject">
          \u2715 Confirmar Rechazo de Solicitud
        </button>
      </form>
    </div>

    <div class="footer">
      Sistema de Gesti\xF3n de Vi\xE1ticos \xA9 2026 \u2022 Dimer Corporativo
    </div>
  </div>

  <script>
    function selectDecision(type) {
      var tabApprove = document.getElementById('btnTabApprove');
      var tabReject = document.getElementById('btnTabReject');
      var formApprove = document.getElementById('formApprove');
      var formReject = document.getElementById('formReject');
      var rejectReason = document.getElementById('rejectReason');

      if (type === 'approve') {
        tabApprove.className = 'tab-btn active-approve';
        tabReject.className = 'tab-btn';
        formApprove.style.display = 'block';
        formReject.style.display = 'none';
        if (rejectReason) rejectReason.removeAttribute('required');
      } else {
        tabApprove.className = 'tab-btn';
        tabReject.className = 'tab-btn active-reject';
        formApprove.style.display = 'none';
        formReject.style.display = 'block';
        if (rejectReason) rejectReason.setAttribute('required', 'required');
      }
    }
  </script>
</body>
</html>`;
}
function buildTokenApprovalResultPageHtml(p) {
  const r = p.request;
  const isApproved = p.status === "APROBADA";
  const isRejected = p.status === "RECHAZADA";
  const isInvalid = p.status === "INVALIDA" || !p.status;
  const headerBg = isApproved ? "#059669" : isRejected ? "#dc2626" : "#0f172a";
  const title = isApproved ? "\xA1Solicitud Autorizada Exitosamente!" : isRejected ? "Solicitud No Autorizada / Rechazada" : p.errorMessage || "Dictamen de Solicitud";
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${esc(title)} - Dimer</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background: #f1f5f9; padding: 24px 12px; margin: 0; color: #0f172a; }
    .card { max-width: 620px; margin: 20px auto; background: #fff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06); }
    .head { background: ${headerBg}; color: #fff; padding: 28px 32px; text-align: center; }
    .head h1 { margin: 0; font-size: 22px; font-weight: 800; }
    .head p { margin: 6px 0 0 0; font-size: 13px; color: rgba(255,255,255,0.85); }
    .body { padding: 28px 32px; }
    .status-badge { display: inline-block; padding: 6px 14px; border-radius: 20px; font-weight: 800; font-size: 13px; margin-bottom: 16px; ${isApproved ? "background:#ecfdf5;color:#065f46;border:1px solid #a7f3d0;" : isRejected ? "background:#fef2f2;color:#991b1b;border:1px solid #fecaca;" : "background:#eff6ff;color:#1e40af;"} }
    .table { width: 100%; border-collapse: collapse; margin: 16px 0; font-size: 13px; }
    .table td { padding: 8px 10px; border-bottom: 1px solid #f1f5f9; }
    .label { font-weight: 700; color: #64748b; width: 35%; }
    .value { color: #0f172a; font-weight: 600; }
    .note-box { background: ${isApproved ? "#ecfdf5" : "#fef2f2"}; border: 1px solid ${isApproved ? "#a7f3d0" : "#fecaca"}; color: ${isApproved ? "#065f46" : "#991b1b"}; border-radius: 10px; padding: 14px; margin: 16px 0; font-size: 13px; }
    .foot { padding: 16px; background: #f8fafc; color: #94a3b8; font-size: 11px; text-align: center; border-top: 1px solid #e2e8f0; }
  </style>
</head>
<body>
  <div class="card">
    <div class="head">
      <h1>${esc(title)}</h1>
      <p>Sistema de Gesti\xF3n de Vi\xE1ticos \u2022 Dimer Corporativo</p>
    </div>
    <div class="body">
      ${isInvalid ? `
        <div class="note-box" style="background:#fffbeb;border-color:#fde68a;color:#92400e">
          <strong>Aviso:</strong> ${esc(p.errorMessage || "El enlace no es v\xE1lido o la solicitud ya fue dictaminada con anterioridad.")}
        </div>
      ` : ""}

      ${r ? `
        <div style="text-align:center;">
          <div class="status-badge">${esc(p.status)}</div>
        </div>
        <table class="table">
          <tr><td class="label">Folio Oficial</td><td class="value"><strong>${esc(r.folio)}</strong></td></tr>
          <tr><td class="label">Solicitante</td><td class="value">${esc(r.requesterName)}</td></tr>
          <tr><td class="label">Departamento</td><td class="value">${esc(r.department)}</td></tr>
          <tr><td class="label">Monto Solicitado</td><td class="value">${formatCurrency(r.amountRequested)} MXN</td></tr>
          ${isApproved ? `<tr><td class="label">Monto Autorizado</td><td class="value"><strong style="color:#059669;font-size:16px">${formatCurrency(r.amountAuthorized || r.amountRequested)} MXN</strong></td></tr>` : ""}
          <tr><td class="label">Dictaminado por</td><td class="value">${esc(p.processedBy || r.bossEmail)}</td></tr>
          <tr><td class="label">Fecha y Hora</td><td class="value">${esc(new Date(p.processedAt || Date.now()).toLocaleString("es-MX"))}</td></tr>
          ${r.comments ? `<tr><td class="label">${isRejected ? "Motivo de Rechazo" : "Observaciones"}</td><td class="value">${esc(r.comments)}</td></tr>` : ""}
        </table>
        
        <div class="note-box">
          ${isApproved ? "\u2713 Se ha notificado formalmente al colaborador y la orden fue enviada al \xE1rea de Finanzas y Sistemas." : "\u2713 Se ha registrado el rechazo formal y se notific\xF3 al colaborador con el motivo ingresado."}
        </div>
      ` : ""}
    </div>
    <div class="foot">
      Sistema de Vi\xE1ticos Dimer \xA9 2026 \u2022 Dimer Corporativo
    </div>
  </div>
</body>
</html>`;
}
async function sendEmail(p) {
  const emailKey = `${String(p.requestId || p.folio || "")}|${String(p.to || "").trim().toLowerCase()}|${String(p.subject || "")}`;
  const now = Date.now();
  const previous = recentEmailKeys.get(emailKey);
  if (previous && now - previous < 12e4) {
    const logId2 = `MAIL-DEDUPE-${now}-${Math.floor(Math.random() * 1e5)}`;
    console.warn(`[SMTP-DEDUPE] Correo duplicado suprimido: ${p.to} | ${p.subject}`);
    return { success: true, logId: logId2, status: "ENVIADO" };
  }
  recentEmailKeys.set(emailKey, now);
  for (const [key, ts] of recentEmailKeys) {
    if (now - ts > 3e5) recentEmailKeys.delete(key);
  }
  const logId = `MAIL-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
  const timestamp = (/* @__PURE__ */ new Date()).toISOString();
  const transporter = getMailTransporter();
  let status = "ENVIADO";
  let errorMsg;
  let emailDeliveryKey = "";
  if (!transporter) {
    errorMsg = "Faltan credenciales SMTP: se requieren SMTP_USER y SMTP_PASS";
    status = process.env.VERCEL || process.env.NODE_ENV === "production" ? "FALLIDO" : "SIMULADO";
  } else {
    try {
      const c = credentials();
      const rawUserVar = process.env.DIMER_SMTP_USER ? "DIMER_SMTP_USER" : process.env.SMTP_USER ? "SMTP_USER" : process.env.GMAIL_USER ? "GMAIL_USER" : "DEFAULT";
      const rawPass = process.env.DIMER_SMTP_APP_PASSWORD || process.env.SMTP_PASS || process.env.SMTP_PASSWORD || "";
      const hasLeadingTrailingWhitespace = rawPass !== rawPass.trim();
      const fromFormatted = getFromAddress(p.from);
      console.log(`[SMTP-DEBUG] Enviando correo a ${p.to} usando variable_usuario=${rawUserVar} (${c.user}), pass_length=${c.pass.length}, pass_prefix="${c.pass.slice(0, 2)}***", pass_has_spaces_at_edges=${hasLeadingTrailingWhitespace}, from="${fromFormatted}"`);
      emailDeliveryKey = buildEmailDeliveryKey(p.requestId, p.to, p.subject);
      let emailDeliveryReserved = false;
      try {
        emailDeliveryReserved = await reserveEmailDelivery({ key: emailDeliveryKey, requestId: p.requestId, folio: p.folio, recipient: p.to, subject: p.subject });
      } catch (idempotencyErr) {
        console.error("[EMAIL-IDEMPOTENCY] Error reservando correo:", idempotencyErr);
        status = "FALLIDO";
        errorMsg = idempotencyErr?.message || "No se pudo reservar la entrega del correo";
        emailDeliveryReserved = false;
      }
      if (!emailDeliveryReserved) {
        const duplicateLogId = `MAIL-DEDUPE-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;
        console.warn(`[EMAIL-IDEMPOTENCY] Correo duplicado suprimido: ${p.to} | ${p.subject}`);
        return { success: true, logId: duplicateLogId, status: "ENVIADO" };
      }
      const sendResult = await transporter.sendMail({
        from: fromFormatted,
        replyTo: p.replyTo,
        to: p.to,
        subject: p.subject,
        html: p.html
      });
      status = "ENVIADO";
      console.log(`[SMTP-DEBUG] Correo enviado exitosamente a ${p.to} (${logId}): ${sendResult.response || sendResult.messageId}`);
      await markEmailDeliverySent(emailDeliveryKey);
    } catch (e) {
      status = "FALLIDO";
      errorMsg = e?.message || "Error SMTP";
      console.error(`[SMTP-DEBUG-ERROR] Fall\xF3 env\xEDo a ${p.to}: message="${e?.message}", code="${e?.code}", response="${e?.response}", responseCode="${e?.responseCode}"`);
      await releaseEmailDelivery(emailDeliveryKey);
    }
  }
  const log = {
    id: logId,
    requestId: p.requestId,
    folio: p.folio,
    to: p.to,
    subject: p.subject,
    html: p.html,
    status,
    error: errorMsg,
    createdAt: timestamp
  };
  outboxLogs.unshift(log);
  if (outboxLogs.length > 200) outboxLogs.pop();
  try {
    const isTest = p.subject.includes("[PRUEBA]");
    await recordAuditLog({
      requestId: p.requestId || null,
      userId: null,
      action: isTest ? "PRUEBA_SMTP" : "ENVIO_CORREO_SMTP",
      details: {
        logId,
        to: p.to,
        subject: p.subject,
        html: p.html,
        status,
        error: errorMsg || null,
        requestId: p.requestId || null,
        folio: p.folio || null,
        userEmail: p.to,
        userName: isTest ? "Prueba Diagn\xF3stico SMTP" : "Sistema de Notificaciones",
        timestamp
      }
    });
  } catch (auditErr) {
    console.error("[SMTP-OUTBOX-PERSISTENCE-WARNING] No se pudo registrar correo en audit_logs:", auditErr);
  }
  return { success: status === "ENVIADO" || status === "SIMULADO", logId, status, error: errorMsg };
}

// server/requestNotificationRoute.ts
async function requestNotificationHandler(_req, res) {
  return res.status(200).json({
    success: true,
    deprecated: true,
    skipped: true,
    message: "La notificaci\xF3n inicial ya fue procesada al crear la solicitud. No se reenvi\xF3 ning\xFAn correo."
  });
}

// server/baseUrl.ts
var INVALID_DOMAINS = [
  "viaticos.dimer.mx",
  "ai.studio",
  "aistudio.google.com",
  "localhost",
  "127.0.0.1"
];
function isInvalidDomain(urlOrHost) {
  if (!urlOrHost) return true;
  const lower = urlOrHost.toLowerCase();
  return INVALID_DOMAINS.some((bad) => lower.includes(bad));
}
function resolveBaseUrl(req) {
  if (req) {
    const origin = String(req.headers.origin || "").trim().replace(/\/+$/, "");
    if (origin && origin.startsWith("http") && !isInvalidDomain(origin)) {
      return origin;
    }
    const referer = String(req.headers.referer || "").trim();
    if (referer && referer.startsWith("http")) {
      try {
        const refUrl = new URL(referer);
        if (!isInvalidDomain(refUrl.hostname)) {
          return `${refUrl.protocol}//${refUrl.host}`;
        }
      } catch {
      }
    }
    const rawHost = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim();
    if (rawHost && !isInvalidDomain(rawHost)) {
      const isHttps = Boolean(
        rawHost.includes("run.app") || rawHost.includes("vercel.app") || req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production" || process.env.VERCEL
      );
      const proto = isHttps ? "https" : req.headers["x-forwarded-proto"] || "http";
      return `${proto}://${rawHost}`;
    }
    if (rawHost && rawHost.includes("run.app")) {
      return `https://${rawHost}`;
    }
  }
  const configured = (process.env.PUBLIC_APP_URL || process.env.APP_URL || "").trim().replace(/\/+$/, "");
  if (configured && !isInvalidDomain(configured)) {
    return configured.startsWith("http") ? configured : `https://${configured}`;
  }
  const vercelProd = (process.env.VERCEL_PROJECT_PRODUCTION_URL || "").trim().replace(/\/+$/, "");
  if (vercelProd && !isInvalidDomain(vercelProd)) {
    return `https://${vercelProd}`;
  }
  const vercelUrl = (process.env.VERCEL_URL || "").trim().replace(/\/+$/, "");
  if (vercelUrl && !isInvalidDomain(vercelUrl)) {
    return `https://${vercelUrl}`;
  }
  return "https://viaticos-dimer.vercel.app";
}

// server/app.ts
async function resolveRequesterUser(r) {
  let userRecord = r.userId ? await getUserById(r.userId) : null;
  if (!userRecord && r.requesterName) {
    const all = await listUsers();
    userRecord = all.find((u) => u.id === r.userId || u.name?.toLowerCase() === r.requesterName?.toLowerCase()) || null;
  }
  const email = (userRecord?.email || r.requesterEmail || r.userEmail || "").trim().toLowerCase();
  return userRecord ? sanitizeUser(userRecord) : {
    id: r.userId || "usr_solicitante",
    name: r.requesterName || "Colaborador",
    email,
    department: r.department || "General",
    role: "SOLICITANTE",
    status: "ACTIVO"
  };
}
async function notifyRequestApproval(params) {
  const { request: r, approverName, approverEmail, approvedAt = (/* @__PURE__ */ new Date()).toISOString() } = params;
  const user = await resolveRequesterUser(r);
  const finanzasEmail = (process.env.FINANZAS_EMAIL || "finanzas@dimer.com.mx").trim().toLowerCase();
  const requesterEmail = (user.email || "").trim().toLowerCase();
  const html = buildSystemsApprovedEmailHtml({ request: r, user, approverName, approverEmail, approvedAt });
  const targets = [];
  if (requesterEmail) targets.push({ to: requesterEmail, subject: `SOLICITUD DE VI\xC1TICOS APROBADA - Folio ${r.folio}`, role: "Solicitante" });
  else console.warn(`[NOTIFY-APPROVAL-WARN] No se encontr\xF3 correo para el solicitante de la solicitud ${r.folio} (userId: ${r.userId})`);
  if (finanzasEmail && finanzasEmail !== requesterEmail) targets.push({ to: finanzasEmail, subject: `SOLICITUD DE VI\xC1TICOS APROBADA - Folio ${r.folio} [FINANZAS]`, role: "Finanzas" });
  for (const t of targets) {
    try {
      const res = await sendEmail({ to: t.to, subject: t.subject, html, requestId: r.id, folio: r.folio });
      console.log(`[APPROVAL-NOTIFICATION] Notificaci\xF3n enviada a ${t.role} (${t.to}) para folio ${r.folio}: ${res.status}`);
    } catch (mErr) {
      console.error(`[APPROVAL-NOTIFICATION-ERROR] Error enviando a ${t.role} (${t.to}):`, mErr);
    }
  }
}
async function notifyRequestPayment(params) {
  const { request: r, paymentMethod, reference, notes, payerUser } = params;
  const user = await resolveRequesterUser(r);
  const requesterEmail = (user.email || "").trim().toLowerCase();
  const html = buildPaymentRegisteredEmailHtml({
    request: r,
    user,
    paymentMethod,
    reference,
    notes,
    paidBy: payerUser ? `${payerUser.name} (${payerUser.email})` : "Tesorer\xEDa & Finanzas",
    paidAt: (/* @__PURE__ */ new Date()).toISOString()
  });
  const targets = [];
  if (requesterEmail) {
    targets.push({
      to: requesterEmail,
      subject: `PAGO REGISTRADO - Vi\xE1ticos Folio ${r.folio} (${paymentMethod.toUpperCase()})`,
      role: "Solicitante"
    });
  }
  for (const t of targets) {
    try {
      await sendEmail({ to: t.to, subject: t.subject, html, requestId: r.id, folio: r.folio });
    } catch (mErr) {
      console.error(`[PAYMENT-NOTIFICATION-ERROR] Error enviando a ${t.role} (${t.to}):`, mErr);
    }
  }
}
async function notifyRequestRejection(params) {
  const { request: r, rejectorName, rejectorEmail, reason } = params;
  const user = await resolveRequesterUser(r);
  const requesterEmail = (user.email || "").trim().toLowerCase();
  const html = buildRejectionEmailHtml({ request: r, user, rejectorName, rejectorEmail, reason });
  const targets = [];
  if (requesterEmail) targets.push({ to: requesterEmail, subject: `SOLICITUD DE VI\xC1TICOS NO AUTORIZADA - Folio ${r.folio}`, role: "Solicitante" });
  for (const t of targets) {
    try {
      await sendEmail({ to: t.to, subject: t.subject, html, requestId: r.id, folio: r.folio });
    } catch (mErr) {
      console.error(`[REJECTION-NOTIFICATION-ERROR] Error enviando a ${t.role} (${t.to}):`, mErr);
    }
  }
}
function baseUrl(req) {
  return resolveBaseUrl(req);
}
function parseCookies(req) {
  const raw = req.headers.cookie || "";
  return Object.fromEntries(raw.split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.indexOf("=");
    return i < 0 ? [x, ""] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}
function jwtSign(payload) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET");
  const enc = (v) => Buffer.from(v).toString("base64url");
  const head = enc(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = enc(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1e3), exp: Math.floor(Date.now() / 1e3) + 8 * 60 * 60 }));
  const sig = import_crypto2.default.createHmac("sha256", secret).update(`${head}.${body}`).digest("base64url");
  return `${head}.${body}.${sig}`;
}
function jwtVerify(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET");
  const p = token.split(".");
  if (p.length !== 3) throw new Error("JWT inv\xE1lido");
  const expected = import_crypto2.default.createHmac("sha256", secret).update(`${p[0]}.${p[1]}`).digest("base64url");
  if (!import_crypto2.default.timingSafeEqual(Buffer.from(expected), Buffer.from(p[2]))) throw new Error("JWT inv\xE1lido");
  const payload = JSON.parse(Buffer.from(p[1], "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1e3)) throw new Error("Sesi\xF3n expirada");
  return payload;
}
function setSessionCookie(res, req, token) {
  const isHttps = req.secure || req.headers["x-forwarded-proto"] === "https" || process.env.NODE_ENV === "production" || Boolean(process.env.VERCEL);
  res.cookie("dimer_session", token, { httpOnly: true, secure: isHttps, sameSite: isHttps ? "none" : "lax", path: "/", maxAge: 8 * 60 * 60 * 1e3 });
}
async function auth(req) {
  const cookies = parseCookies(req);
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const token = bearer || cookies.dimer_session;
  if (!token) return null;
  try {
    const p = jwtVerify(token);
    const u = await getUserById(p.sub);
    if (!u || u.status !== "ACTIVO") return null;
    return u;
  } catch {
    return null;
  }
}
function requireAuth(req, res, next) {
  void auth(req).then((u) => {
    if (!u) return res.status(401).json({ error: "Autenticaci\xF3n requerida" });
    req.dimerUser = u;
    next();
  }).catch(() => res.status(503).json({ error: "Base de datos no disponible" }));
}
function requirePermission(permission) {
  return (req, res, next) => {
    const u = req.dimerUser;
    if (!hasPermission(u, permission)) return res.status(403).json({ error: "No tienes permiso para esta operaci\xF3n" });
    next();
  };
}
var isAdminUser = (u) => Boolean(u && (u.role === "ADMIN" || u.role === "ADMINISTRADOR" || u.roleId === "role_admin" || Array.isArray(u.roleIds) && u.roleIds.includes("role_admin") || hasPermission(u, "administrar_usuarios")));
function err(res, e) {
  const msg = e instanceof Error ? e.message : typeof e === "string" ? e : e && typeof e === "object" ? String(e.message || e.error_description || e.error || e.details || e.hint || "Error interno") : "Error interno";
  console.error("[API-ERROR]", e);
  const status = /JWT|autentic|token inválido|no se encontró/i.test(msg) ? 400 : 503;
  return res.status(status).json({ success: false, error: msg });
}
function createApp() {
  const app2 = (0, import_express.default)();
  app2.set("trust proxy", 1);
  app2.use((0, import_cors.default)({ origin: true, credentials: true }));
  app2.use(import_express.default.json({ limit: "10mb" }));
  app2.use(import_express.default.urlencoded({ extended: true, limit: "10mb" }));
  app2.get(["/api/health", "/health"], async (_req, res) => {
    try {
      const { error } = await supabase.from("users").select("id", { head: true, count: "exact" });
      if (error) throw error;
      res.json({ ok: true, service: "viaticos-dimer-api", database: "supabase", runtime: process.env.VERCEL ? "vercel-serverless" : "node", timestamp: (/* @__PURE__ */ new Date()).toISOString() });
    } catch (e) {
      res.status(503).json({ ok: false, database: "supabase", error: "Database unavailable" });
    }
  });
  app2.get(["/api/diagnostic", "/diagnostic"], async (_req, res) => {
    try {
      const c = credentials();
      const [u, r] = await Promise.all([supabase.from("users").select("id", { head: true, count: "exact" }), supabase.from("travel_requests").select("id", { head: true, count: "exact" })]);
      if (u.error) throw u.error;
      if (r.error) throw r.error;
      res.json({ status: "operational", runtime: process.env.VERCEL ? "vercel-serverless" : "node", database: { type: "supabase", usersCount: u.count || 0, requestsCount: r.count || 0, persistenceType: "supabase-postgresql" }, environmentChecks: { isVercel: Boolean(process.env.VERCEL), hasAppUrl: Boolean(process.env.APP_URL), hasJwtSecret: Boolean(process.env.JWT_SECRET), hasSmtpHost: Boolean(c.host), hasSmtpUser: Boolean(c.user), hasSmtpPass: Boolean(c.pass), finanzasEmailConfigured: Boolean(process.env.FINANZAS_EMAIL) } });
    } catch (e) {
      res.status(503).json({ status: "unavailable", database: { type: "supabase" }, error: e instanceof Error ? e.message : "Database unavailable" });
    }
  });
  app2.get(["/api/me", "/me"], async (req, res) => {
    try {
      const u = await auth(req);
      const allUsers = await listUsers();
      res.json({ user: u, allUsers, appUrl: baseUrl(req), finanzasEmail: process.env.FINANZAS_EMAIL || "finanzas@dimer.com.mx", systemsEmail: "sistemas@dimer.com.mx" });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post(["/api/auth/login", "/auth/login", "/api/login", "/login"], async (req, res) => {
    try {
      const email = String(req.body?.email || "").trim().toLowerCase(), password = String(req.body?.password || "");
      if (!email || !password) return res.status(400).json({ success: false, error: "Correo electr\xF3nico y contrase\xF1a requeridos" });
      const u = await getUserByEmail(email);
      if (!u) return res.status(401).json({ success: false, error: "No existe una cuenta registrada con este correo." });
      if (u.status !== "ACTIVO") return res.status(403).json({ success: false, error: "Esta cuenta est\xE1 inactiva." });
      if (!verifyPassword(password, u.passwordHash, u.salt)) return res.status(401).json({ success: false, error: "Contrase\xF1a incorrecta." });
      const token = jwtSign({ sub: u.id, email: u.email, role: u.role });
      setSessionCookie(res, req, token);
      await recordAuditLog({ userId: u.id, action: "INICIO_SESION", details: { email: u.email, role: u.role } });
      res.json({ success: true, user: u, token });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/auth/logout", async (req, res) => {
    try {
      const u = await auth(req);
      if (u) await recordAuditLog({ userId: u.id, action: "CIERRE_SESION", details: { email: u.email } });
      res.setHeader("Set-Cookie", "dimer_session=; Max-Age=0; Path=/; HttpOnly; SameSite=Lax");
      res.json({ success: true });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/switch-user", async (req, res) => {
    try {
      const { emailOrId } = req.body || {};
      if (!emailOrId) return res.status(400).json({ error: "emailOrId es requerido" });
      let u = await getUserByEmail(String(emailOrId));
      if (!u) u = await getUserById(String(emailOrId));
      if (!u) return res.status(404).json({ error: "Usuario no encontrado" });
      const token = jwtSign({ sub: u.id, email: u.email, role: u.role });
      setSessionCookie(res, req, token);
      const allUsers = await listUsers();
      res.json({ success: true, user: u, token, allUsers });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/auth/register-init", async (req, res) => {
    try {
      const { name, email, password, department } = req.body || {};
      const clean = String(email || "").trim().toLowerCase();
      if (!name || !clean || !password) return res.status(400).json({ error: "Nombre, correo y contrase\xF1a son obligatorios" });
      if (await getUserByEmail(clean)) return res.status(400).json({ error: "Ya existe una cuenta registrada con este correo." });
      const dept = await getOrCreateDepartment(String(department || "General"));
      const { hash, salt } = hashPassword(String(password));
      const { code, expiresAt } = await createVerificationCode({ email: clean, name: String(name), department: dept.name, roleId: "role_solicitante", passwordHash: hash, salt });
      const mail = await sendEmail({ to: clean, subject: `C\xF3digo de Verificaci\xF3n Dimer: ${code}`, html: buildVerificationEmailHtml({ name: String(name), email: clean, code, expiresMinutes: 15 }) });
      if (mail.status === "FALLIDO") return res.status(500).json({ error: `Error SMTP: ${mail.error || "fallo de env\xEDo"}` });
      res.json({ success: true, email: clean, expiresAt, simulatedCode: mail.status === "SIMULADO" ? code : void 0 });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/auth/verify-code", async (req, res) => {
    try {
      const result = await verifyCodeAndActivateUser(String(req.body?.email || ""), String(req.body?.code || ""));
      if (!result.success || !result.user) return res.status(400).json({ error: result.error });
      const token = jwtSign({ sub: result.user.id, email: result.user.email, role: result.user.role });
      setSessionCookie(res, req, token);
      await recordAuditLog({ userId: result.user.id, action: "VERIFICACION_Y_ACTIVACION_CUENTA", details: { email: result.user.email } });
      try {
        await sendEmail({ to: "sistemas@dimer.com.mx", subject: `NUEVA CUENTA REGISTRADA - ${result.user.name}`, html: buildNewAccountAdminEmailHtml({ user: result.user, registeredAt: (/* @__PURE__ */ new Date()).toISOString() }) });
      } catch {
      }
      res.json({ success: true, user: result.user, token, message: "Cuenta verificada y activada con \xE9xito." });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/auth/resend-code", async (req, res) => {
    try {
      const clean = String(req.body?.email || "").trim().toLowerCase();
      const { data, error } = await supabase.from("verification_codes").select("*").eq("email", clean).maybeSingle();
      if (error) throw error;
      if (!data) return res.status(404).json({ error: "No hay un registro pendiente para este correo." });
      const code = import_crypto2.default.randomInt(1e5, 1e6).toString();
      const expiresAt = new Date(Date.now() + 15 * 60 * 1e3).toISOString();
      const { error: updateError } = await supabase.from("verification_codes").update({ code, expires_at: expiresAt, attempts: 0 }).eq("email", clean);
      if (updateError) throw updateError;
      const mail = await sendEmail({ to: clean, subject: `Nuevo c\xF3digo de Verificaci\xF3n Dimer: ${code}`, html: buildVerificationEmailHtml({ name: data.name, email: clean, code, expiresMinutes: 15 }) });
      if (mail.status === "FALLIDO") return res.status(500).json({ error: `Error SMTP: ${mail.error || "fallo de env\xEDo"}` });
      res.json({ success: true, expiresAt, simulatedCode: mail.status === "SIMULADO" ? code : void 0 });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/users", requireAuth, requirePermission("administrar_usuarios"), async (_req, res) => {
    try {
      res.json(await listUsers());
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/users", requireAuth, requirePermission("administrar_usuarios"), async (req, res) => {
    try {
      const { name, email, password, department, roleId, roleIds, status } = req.body || {};
      if (!name || !email || !password) return res.status(400).json({ error: "Nombre, correo y contrase\xF1a son obligatorios" });
      const clean = String(email).trim().toLowerCase();
      if (await getUserByEmail(clean)) return res.status(400).json({ error: "El correo ya est\xE1 registrado" });
      const { hash, salt } = hashPassword(String(password));
      const effectiveRoleIds = Array.isArray(roleIds) && roleIds.length ? roleIds : [roleId || "role_solicitante"];
      const primaryRole = effectiveRoleIds[0];
      const roles = await listRoles();
      const rr = roles.find((x) => x.id === primaryRole);
      const roleName = rr?.name?.toUpperCase() || "SOLICITANTE";
      const rec = { id: `usr_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`, name: String(name).trim(), email: clean, department: String(department || "General").trim(), role: roleName, roleId: primaryRole, roleIds: effectiveRoleIds, status: status === "INACTIVO" ? "INACTIVO" : "ACTIVO", isVerified: true, passwordHash: hash, salt, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
      const u = await insertUser(rec);
      res.json({ success: true, user: u });
    } catch (e) {
      err(res, e);
    }
  });
  app2.put("/api/users/:id", requireAuth, requirePermission("administrar_usuarios"), async (req, res) => {
    try {
      const p = { ...req.body };
      if (p.password) {
        const { hash, salt } = hashPassword(String(p.password));
        p.passwordHash = hash;
        p.salt = salt;
        delete p.password;
      }
      if (Array.isArray(p.roleIds) && p.roleIds.length) {
        p.roleId = p.roleIds[0];
        const roles = await listRoles();
        const rr = roles.find((x) => x.id === p.roleId);
        if (rr) p.role = rr.name.toUpperCase();
      } else if (p.roleId !== void 0 && !p.role) {
        const roles = await listRoles();
        const rr = roles.find((x) => x.id === p.roleId);
        if (rr) p.role = rr.name.toUpperCase();
      }
      const u = await updateUser(String(req.params.id), p);
      res.json({ success: true, user: u });
    } catch (e) {
      err(res, e);
    }
  });
  app2.delete("/api/users/:id", requireAuth, requirePermission("administrar_usuarios"), async (req, res) => {
    try {
      const u = req.dimerUser;
      const target = await getUserById(String(req.params.id));
      if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
      if (target.email.toLowerCase() === "sistemas@dimer.com.mx") return res.status(400).json({ error: "No se puede eliminar la cuenta principal de administraci\xF3n." });
      await deleteUser(target.id);
      await recordAuditLog({ userId: u.id, action: "ELIMINACION_USUARIO", details: { targetUserId: target.id, targetEmail: target.email, targetName: target.name } });
      res.json({ success: true });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/departments", async (_req, res) => {
    try {
      res.json(await listDepartments());
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/departments", requireAuth, requirePermission("administrar_departamentos"), async (req, res) => {
    try {
      const d = await createDepartment(String(req.body?.name || ""), String(req.body?.description || ""));
      res.json({ success: true, department: d });
    } catch (e) {
      err(res, e);
    }
  });
  app2.put("/api/departments/:id", requireAuth, requirePermission("administrar_departamentos"), async (req, res) => {
    try {
      res.json({ success: true, department: await updateDepartment(String(req.params.id), req.body || {}) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/bosses", async (_req, res) => {
    try {
      res.json(await listBosses());
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/bosses", requireAuth, requirePermission("administrar_jefes"), async (req, res) => {
    try {
      const b = await createBoss(String(req.body?.name || ""), String(req.body?.email || ""), String(req.body?.department || ""));
      res.json({ success: true, boss: b });
    } catch (e) {
      err(res, e);
    }
  });
  app2.put("/api/bosses/:id", requireAuth, requirePermission("administrar_jefes"), async (req, res) => {
    try {
      res.json({ success: true, boss: await updateBoss(String(req.params.id), req.body || {}) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.delete("/api/bosses/:id", requireAuth, requirePermission("administrar_jefes"), async (req, res) => {
    try {
      await deleteBoss(String(req.params.id));
      res.json({ success: true });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/roles", requireAuth, requirePermission("administrar_roles"), async (_req, res) => {
    try {
      res.json(await listRoles());
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/permissions", requireAuth, requirePermission("administrar_roles"), async (_req, res) => {
    try {
      res.json(ALL_SYSTEM_PERMISSIONS);
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/roles", requireAuth, requirePermission("administrar_roles"), async (req, res) => {
    try {
      res.json({ success: true, role: await createRole(req.body || {}) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.put("/api/roles/:id", requireAuth, requirePermission("administrar_roles"), async (req, res) => {
    try {
      res.json({ success: true, role: await updateRole(String(req.params.id), req.body || {}) });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/requests", async (req, res) => {
    try {
      const u = await auth(req);
      const rs = await getPopulatedRequests();
      if (!u) return res.json(rs);
      if (u.role === "ADMIN" || u.role === "FINANZAS" || u.role === "JEFE" || hasPermission(u, "ver_todas_solicitudes")) return res.json(rs);
      res.json(rs.filter((r) => r.userId === u.id));
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/requests/:id", requireAuth, async (req, res) => {
    try {
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      const u = req.dimerUser;
      if (u.role !== "ADMIN" && u.role !== "FINANZAS" && u.role !== "JEFE" && r.userId !== u.id) return res.status(403).json({ error: "No autorizado" });
      res.json(r);
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      const body = req.body || {};
      if (!body.bossEmail || !String(body.bossEmail).trim()) return res.status(400).json({ error: "El Responsable de Autorizaci\xF3n es obligatorio" });
      const id = `req_${Date.now()}_${import_crypto2.default.randomBytes(4).toString("hex")}`;
      const folio = await generateNextFolio();
      const request = { ...body, id, folio, status: "PENDIENTE_APROBACION", userId: u.id, requesterName: u.name, department: u.department, createdAt: (/* @__PURE__ */ new Date()).toISOString(), updatedAt: (/* @__PURE__ */ new Date()).toISOString() };
      const created = await insertRequest(request);
      if (!created.approvalToken) {
        const approvalToken = await createApprovalToken(created.id, String(created.bossEmail || ""), created.bossId);
        await updateRequest(created.id, { approvalToken: approvalToken.token, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
        created.approvalToken = approvalToken.token;
      }
      await recordAuditLog({ requestId: created.id, userId: u.id, action: "CREACION_SOLICITUD", details: { folio: created.folio, destination: created.destination, amountRequested: created.amountRequested } });
      const notifications = { approval: null, requester: null };
      const notificationErrors = [];
      const approverEmail = String(created.bossEmail || "").trim().toLowerCase();
      if (!created.approvalToken) {
        notificationErrors.push("La solicitud fue creada pero no tiene token de aprobaci\xF3n.");
      } else {
        const approveUrl = `${baseUrl(req)}/api/approval/token-action?token=${encodeURIComponent(created.approvalToken)}&action=approve`;
        const rejectUrl = `${baseUrl(req)}/api/approval/token-action?token=${encodeURIComponent(created.approvalToken)}&action=reject`;
        try {
          notifications.approval = await sendEmail({ to: created.bossEmail, subject: `AUTORIZACI\xD3N DE VI\xC1TICOS - Folio ${created.folio}`, html: buildBossApprovalEmailHtml({ request: created, user: u, approveUrl, rejectUrl, token: created.approvalToken }) });
          if (notifications.approval?.status === "FALLIDO") notificationErrors.push(`Correo al aprobador: ${notifications.approval.error || "fallo de env\xEDo SMTP"}`);
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          notificationErrors.push(`Correo al aprobador: ${m}`);
          console.error("[REQUEST-CREATE-APPROVAL-EMAIL]", e);
        }
      }
      const requesterEmail = String(u.email || "").trim().toLowerCase();
      if (!requesterEmail) {
        notificationErrors.push("No se encontr\xF3 correo electr\xF3nico del solicitante.");
      } else {
        try {
          notifications.requester = await sendEmail({ to: requesterEmail, subject: `SOLICITUD DE VI\xC1TICOS REGISTRADA - Folio ${created.folio}`, html: buildRequesterConfirmationEmailHtml({ request: created, user: u, bossName: String(created.bossName || created.bossEmail || "Supervisor"), bossEmail: String(created.bossEmail || "") }) });
          if (notifications.requester?.status === "FALLIDO") notificationErrors.push(`Correo al solicitante: ${notifications.requester.error || "fallo de env\xEDo SMTP"}`);
        } catch (e) {
          const m = e instanceof Error ? e.message : String(e);
          notificationErrors.push(`Correo al solicitante: ${m}`);
          console.error("[REQUEST-CREATE-REQUESTER-EMAIL]", e);
        }
      }
      const emailOk = notificationErrors.length === 0;
      res.status(emailOk ? 200 : 207).json({ ...created, notification: { ok: emailOk, errors: notificationErrors, approval: notifications.approval, requester: notifications.requester } });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/notify", requestNotificationHandler);
  app2.delete("/api/requests/:id", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      if (!isAdminUser(u)) return res.status(403).json({ error: "Solo el administrador puede eliminar solicitudes." });
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (["APROBADA", "PAGADA", "FINALIZADA", "CANCELADA"].includes(r.status)) return res.status(400).json({ error: `La solicitud ${r.folio} ya est\xE1 en estado ${r.status} y no puede eliminarse.` });
      await deleteRequest(r.id);
      await recordAuditLog({ requestId: r.id, userId: u.id, action: "ELIMINACION_SOLICITUD", details: { folio: r.folio, previousStatus: r.status, requesterName: r.requesterName, reason: "Eliminaci\xF3n administrativa de solicitud no aprobada" } });
      res.json({ success: true, folio: r.folio });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/cancel", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      if (!isAdminUser(u)) return res.status(403).json({ error: "Solo el administrador puede cancelar solicitudes aprobadas." });
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (r.status !== "APROBADA") return res.status(400).json({ error: `Solo se pueden cancelar solicitudes APROBADAS. Estado actual: ${r.status}.` });
      const reason = String(req.body?.reason || "Viaje no realizado").trim() || "Viaje no realizado";
      const updated = await updateRequest(r.id, { status: "CANCELADA", comments: `Cancelada por administrador: ${reason}`, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      await recordAuditLog({ requestId: r.id, userId: u.id, action: "CANCELACION_SOLICITUD_APROBADA", details: { folio: r.folio, reason, previousStatus: r.status, amountAuthorized: r.amountAuthorized } });
      res.json({ success: true, request: updated });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/approval-tokens/:token", async (req, res) => {
    try {
      const v = await validateApprovalToken(String(req.params.token));
      if (!v.valid) return res.status(400).json({ valid: false, error: v.error });
      const user = await getUserById(v.request.userId);
      res.json({ valid: true, tokenRecord: v.tokenRecord, request: { ...v.request, user: user ? sanitizeUser(user) : void 0 } });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/approve", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (u.role !== "ADMIN" && u.email.toLowerCase() !== r.bossEmail.toLowerCase()) return res.status(403).json({ error: "No autorizado" });
      if (!r.approvalToken) return res.status(400).json({ error: "La solicitud no tiene token de aprobaci\xF3n" });
      const result = await processApprovalTokenAction(r.approvalToken, "APROBADA", Number(req.body?.amountAuthorized ?? r.amountRequested), req.body?.comments || null);
      const updated = await getRequest(r.id);
      if (!updated) throw new Error("Solicitud no encontrada despu\xE9s de aprobar");
      await notifyRequestApproval({ request: updated, approverName: u.name, approverEmail: u.email, approvedAt: updated.approvedAt || (/* @__PURE__ */ new Date()).toISOString() });
      res.json({ success: true, request: updated, result });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/reject", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (u.role !== "ADMIN" && u.email.toLowerCase() !== r.bossEmail.toLowerCase()) return res.status(403).json({ error: "No autorizado" });
      const reason = String(req.body?.comments || "").trim();
      if (!reason) return res.status(400).json({ error: "El motivo del rechazo es obligatorio" });
      if (!r.approvalToken) return res.status(400).json({ error: "La solicitud no tiene token de aprobaci\xF3n" });
      const result = await processApprovalTokenAction(r.approvalToken, "RECHAZADA", null, reason);
      const updated = await getRequest(r.id);
      if (!updated) throw new Error("Solicitud no encontrada");
      await notifyRequestRejection({ request: updated, rejectorName: u.name, rejectorEmail: u.email, reason });
      res.json({ success: true, request: updated, result });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/request-correction", requireAuth, async (req, res) => {
    try {
      const u = req.dimerUser;
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (u.role !== "ADMIN" && u.email.toLowerCase() !== r.bossEmail.toLowerCase()) return res.status(403).json({ error: "No autorizado" });
      const updated = await updateRequest(r.id, { status: "CORRECCION_SOLICITADA", comments: req.body?.comments || r.comments, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      await recordAuditLog({ requestId: r.id, userId: u.id, action: "SOLICITUD_CORRECCION", details: { notes: req.body?.comments || "" } });
      res.json({ success: true, request: updated });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/pay", requireAuth, requirePermission("ver_reportes"), async (req, res) => {
    try {
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (r.status !== "APROBADA") return res.status(400).json({ error: `Solo se puede pagar una solicitud APROBADA. Estado actual: ${r.status}.` });
      const paymentMethod = String(req.body?.paymentMethod || "SPEI").toUpperCase();
      const reference = String(req.body?.reference || (paymentMethod === "EFECTIVO" ? "PAGO-EN-EFECTIVO" : "SPEI-DIRECTO")).trim();
      const notes = String(req.body?.notes || "").trim();
      const payerUser = req.dimerUser;
      const updated = await updateRequest(r.id, { status: "PAGADA", updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      await recordAuditLog({ requestId: r.id, userId: payerUser.id, action: "DISPERSION_PAGO", details: { paymentMethod, reference, notes, payerName: payerUser.name, payerEmail: payerUser.email } });
      await notifyRequestPayment({ request: updated, paymentMethod, reference, notes, payerUser });
      res.json({ success: true, request: updated });
    } catch (e) {
      err(res, e);
    }
  });
  app2.post("/api/requests/:id/finalize", requireAuth, requirePermission("ver_reportes"), async (req, res) => {
    try {
      const r = await getRequest(String(req.params.id));
      if (!r) return res.status(404).json({ error: "Solicitud no encontrada" });
      if (r.status !== "PAGADA") return res.status(400).json({ error: `Solo se puede finalizar una solicitud PAGADA. Estado actual: ${r.status}.` });
      const updated = await updateRequest(r.id, { status: "FINALIZADA", updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      await recordAuditLog({ requestId: r.id, userId: req.dimerUser.id, action: "FINALIZACION_COMPROBACION", details: { notes: req.body?.notes || "" } });
      res.json({ success: true, request: updated });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/audit-logs", requireAuth, requirePermission("administrar_configuracion"), async (req, res) => {
    try {
      res.json(await listAuditLogs(typeof req.query.requestId === "string" ? req.query.requestId : void 0));
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/outbox", requireAuth, async (_req, res) => {
    try {
      const persisted = (await listAuditLogs()).filter((l) => l.action === "ENVIO_CORREO_SMTP" || l.action === "PRUEBA_SMTP").map((l) => {
        const d = l.details || {};
        return { id: String(d.logId || l.id), requestId: d.requestId ?? l.requestId ?? void 0, folio: d.folio ?? void 0, to: String(d.to || l.userEmail || ""), subject: String(d.subject || ""), html: String(d.html || ""), status: d.status === "FALLIDO" || d.status === "SIMULADO" ? "FALLIDO" === d.status ? "FALLIDO" : "SIMULADO" : "ENVIADO", error: d.error || void 0, createdAt: String(d.timestamp || l.createdAt) };
      });
      const seen = /* @__PURE__ */ new Set();
      const merged = [...persisted, ...outboxLogs].filter((x) => {
        if (seen.has(x.id)) return false;
        seen.add(x.id);
        return true;
      }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
      res.json(merged);
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/smtp/status", requireAuth, async (_req, res) => {
    const c = credentials();
    const configured = Boolean(c.user && c.pass);
    res.json({ configured, details: { host: c.host, port: String(c.port), user: c.user ? `${c.user.slice(0, 3)}***@${c.user.split("@")[1] || ""}` : "No configurado", hasPassword: Boolean(c.pass), passwordLength: c.pass.length, secure: c.secure, from: getFromAddress() }, instructions: configured ? `SMTP configurado y listo para salida de correos (${c.user}).` : "Faltan credenciales SMTP (SMTP_USER y SMTP_PASS / DIMER_SMTP_APP_PASSWORD) en el entorno del servidor." });
  });
  app2.post("/api/smtp/test", requireAuth, requirePermission("administrar_configuracion"), async (req, res) => {
    try {
      const to = String(req.body?.targetEmail || "sistemas@dimer.com.mx");
      const result = await sendEmail({ to, subject: `[PRUEBA] SMTP Dimer ${(/* @__PURE__ */ new Date()).toISOString()}`, html: `<p>Prueba SMTP Dimer exitosa.</p><p>${(/* @__PURE__ */ new Date()).toLocaleString("es-MX")}</p>` });
      res.json({ ...result, targetEmail: to });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/stats", requireAuth, async (_req, res) => {
    try {
      const rs = await getPopulatedRequests();
      const total = (s) => rs.filter((r) => r.status === s).length;
      res.json({ totalRequests: rs.length, pendingApproval: total("PENDIENTE_APROBACION"), approved: total("APROBADA"), paid: total("PAGADA"), rejected: total("RECHAZADA"), correctionRequested: total("CORRECCION_SOLICITADA"), totalAmountRequested: rs.reduce((a, r) => a + r.amountRequested, 0), totalAmountAuthorized: rs.reduce((a, r) => a + (r.amountAuthorized || 0), 0), totalUsers: (await listUsers()).length, totalDepartments: (await listDepartments()).length, totalBosses: (await listBosses()).length, totalRoles: (await listRoles()).length });
    } catch (e) {
      err(res, e);
    }
  });
  app2.get("/api/code-artifacts", async (_req, res) => {
    try {
      const { NEXTJS_CODE_ARTIFACTS: NEXTJS_CODE_ARTIFACTS2 } = await Promise.resolve().then(() => (init_nextjsArtifacts(), nextjsArtifacts_exports));
      res.json(NEXTJS_CODE_ARTIFACTS2);
    } catch (e) {
      err(res, e);
    }
  });
  app2.all("/api/*", (_req, res) => res.status(404).json({ error: "Ruta API no encontrada" }));
  app2.use((e, _req, res, _next) => {
    console.error("[DIMER]", e);
    if (!res.headersSent) res.status(500).json({ success: false, error: "Error interno del servidor" });
  });
  return app2;
}

// server/approvalRoutes.ts
async function resolveUser(request) {
  const raw = request.userId ? await getUserById(request.userId) : null;
  if (raw) return sanitizeUser(raw);
  return { id: request.userId || "usr_solicitante", name: request.requesterName || "Colaborador", email: "", department: request.department || "General", role: "SOLICITANTE", status: "ACTIVO" };
}
function registerApprovalRoutes(app2) {
  const getDecision = async (req, res) => {
    try {
      const token = String(req.query?.token || req.params?.token || "").trim();
      if (!token) return res.status(400).send(buildTokenApprovalResultPageHtml({ status: "INVALIDA", errorMessage: "Token no proporcionado." }));
      const validation = await validateApprovalToken(token);
      if (!validation.valid || !validation.request) return res.status(400).send(buildTokenApprovalResultPageHtml({ status: "INVALIDA", errorMessage: validation.error || "Este enlace ya no es v\xE1lido." }));
      const user = await resolveUser(validation.request);
      return res.send(buildTokenApprovalDecisionPageHtml({ request: validation.request, user, token, initialAction: "approve", approverEmail: validation.tokenRecord?.bossEmail || validation.request.bossEmail }));
    } catch (e) {
      return res.status(500).send(buildTokenApprovalResultPageHtml({ status: "INVALIDA", errorMessage: e instanceof Error ? e.message : "Error procesando autorizaci\xF3n." }));
    }
  };
  const submitDecision = async (req, res) => {
    try {
      const token = String(req.body?.token || req.query?.token || "").trim();
      const rawDecision = String(req.body?.decision || req.body?.action || req.query?.decision || req.query?.action || "").trim().toLowerCase();
      let decision = null;
      if (["approve", "aprobar", "aprobada", "aprobado", "autorizar", "autorizada"].includes(rawDecision)) decision = "APROBADA";
      else if (["reject", "rechazar", "rechazada", "rechazado", "denegar"].includes(rawDecision)) decision = "RECHAZADA";
      if (!token || !decision) return res.status(400).send(buildTokenApprovalResultPageHtml({ status: "INVALIDA", errorMessage: "Token o decisi\xF3n inv\xE1lidos." }));
      const validation = await validateApprovalToken(token);
      if (!validation.valid || !validation.request) return res.status(400).send(buildTokenApprovalResultPageHtml({ status: "INVALIDA", errorMessage: validation.error || "Este enlace ya no es v\xE1lido." }));
      const comments = String(req.body?.comments || req.body?.reason || "").trim();
      if (decision === "RECHAZADA" && !comments) {
        const user2 = await resolveUser(validation.request);
        return res.status(400).send(buildTokenApprovalDecisionPageHtml({ request: validation.request, user: user2, token, initialAction: "reject", approverEmail: validation.tokenRecord?.bossEmail || validation.request.bossEmail, errorMessage: "Debes indicar obligatoriamente el motivo por el cual se rechaza la solicitud." }));
      }
      const amount = req.body?.amountAuthorized !== void 0 && req.body?.amountAuthorized !== "" ? Number(req.body.amountAuthorized) : void 0;
      const result = await processApprovalTokenAction(token, decision, decision === "APROBADA" ? amount : void 0, comments || void 0);
      const requestId = String(result?.requestId || result?.request_id || validation.request.id);
      const request = await getRequest(requestId) || validation.request;
      const approverEmail = String(result?.bossEmail || validation.tokenRecord?.bossEmail || request.bossEmail || "");
      const approverName = String(result?.bossName || validation.tokenRecord?.bossEmail || request.bossName || request.bossEmail || "Jefe Aprobador");
      const user = await resolveUser(request);
      if (decision === "APROBADA") {
        const baseHtml = buildSystemsApprovedEmailHtml({ request, user, approverName, approverEmail, approvedAt: request.approvedAt || (/* @__PURE__ */ new Date()).toISOString() });
        const requesterEmail = user.email.trim().toLowerCase();
        const finanzasEmail = (process.env.FINANZAS_EMAIL || "finanzas@dimer.com.mx").trim().toLowerCase();
        const recipientCopies = [];
        if (requesterEmail) recipientCopies.push({ to: requesterEmail, label: "SOLICITANTE", subjectSuffix: "SOLICITANTE" });
        if (finanzasEmail) recipientCopies.push({ to: finanzasEmail, label: "FINANZAS", subjectSuffix: "FINANZAS" });
        for (const recipient of recipientCopies) {
          const html = `<div style="font-family:Arial,sans-serif;font-size:11px;color:#666;margin:0 0 8px 0;text-transform:uppercase;letter-spacing:.4px;">Notificaci\xF3n para: <strong>${recipient.label}</strong></div>${baseHtml}`;
          try {
            await sendEmail({
              to: recipient.to,
              subject: `SOLICITUD DE VI\xC1TICOS APROBADA - Folio ${request.folio} - ${recipient.subjectSuffix}`,
              html,
              requestId: request.id,
              folio: request.folio
            });
          } catch {
          }
        }
      } else {
        const html = buildRejectionEmailHtml({ request, user, rejectorName: approverName, rejectorEmail: approverEmail, reason: request.comments || comments || "Solicitud no autorizada" });
        const targets = [user.email.trim().toLowerCase()].filter((v, i, a) => Boolean(v) && a.indexOf(v) === i);
        for (const to of targets) {
          try {
            await sendEmail({ to, subject: `SOLICITUD DE VI\xC1TICOS NO AUTORIZADA - Folio ${request.folio}`, html, requestId: request.id, folio: request.folio });
          } catch {
          }
        }
      }
      await recordAuditLog({ requestId: request.id, userId: validation.tokenRecord?.bossId || "token_auth", action: decision === "APROBADA" ? "APROBACION_VIA_TOKEN" : "RECHAZO_VIA_TOKEN", details: { folio: request.folio, decision, approverEmail, comments } });
      return res.send(buildTokenApprovalResultPageHtml({ status: decision, request, actionTaken: decision, processedBy: approverEmail, processedAt: String(result?.processedAt || (/* @__PURE__ */ new Date()).toISOString()) }));
    } catch (e) {
      return res.status(500).send(buildTokenApprovalResultPageHtml({ status: "INVALIDA", errorMessage: e instanceof Error ? e.message : "Error procesando autorizaci\xF3n." }));
    }
  };
  app2.get(["/api/approval/decision", "/api/approval/token-action", "/approval-response/:token/:decision", "/api/approval-response/:token/:decision"], getDecision);
  app2.post(["/api/approval/submit-decision", "/api/approval/token-action", "/api/approval/decision"], submitDecision);
}

// server/adminRequestRoutes.ts
var import_crypto3 = __toESM(require("crypto"), 1);

// src/types.ts
var LEGACY_ROLE_IDS = { ADMIN: "role_admin", ADMINISTRADOR: "role_admin", JEFE: "role_jefe", FINANZAS: "role_finanzas", SOLO_LECTURA_APROBADAS: "role_solo_lectura", SOLICITANTE: "role_solicitante", EMPLEADO: "role_empleado" };
function getUserRoleIds2(user) {
  if (!user) return [];
  const ids = [...Array.isArray(user.roleIds) ? user.roleIds : [], ...Array.isArray(user.roles) ? user.roles.map((role) => role.id) : [], user.roleId, LEGACY_ROLE_IDS[String(user.role || "").toUpperCase()]];
  return Array.from(new Set(ids.map((id) => String(id || "").trim()).filter(Boolean)));
}
function userHasRole(user, role) {
  if (!user) return false;
  const wantedName = String(role || "").trim().toUpperCase();
  const wantedId = LEGACY_ROLE_IDS[wantedName] || String(role || "").trim();
  const currentRole = String(user.role || "").toUpperCase();
  if (currentRole === wantedName) return true;
  if ((wantedName === "ADMIN" || wantedName === "ADMINISTRADOR") && (currentRole === "ADMIN" || currentRole === "ADMINISTRADOR")) return true;
  if (getUserRoleIds2(user).includes(wantedId)) return true;
  return Boolean(user.roles?.some((r) => String(r.name || "").trim().toUpperCase() === wantedName || r.id === wantedId));
}

// server/adminRequestRoutes.ts
function parseCookies2(req) {
  const raw = String(req.headers.cookie || "");
  return Object.fromEntries(
    raw.split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
      const i = x.indexOf("=");
      return i < 0 ? [x, ""] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
    })
  );
}
function verifyJwt(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("JWT inv\xE1lido");
  const expected = import_crypto3.default.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  if (!import_crypto3.default.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) throw new Error("JWT inv\xE1lido");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1e3)) throw new Error("Sesi\xF3n expirada");
  return payload;
}
async function getAuthenticatedUser(req) {
  const cookies = parseCookies2(req);
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const token = bearer || String(cookies.dimer_session || "");
  if (!token) return null;
  try {
    const payload = verifyJwt(token);
    const stored = await getUserById(payload.sub);
    if (!stored || stored.status !== "ACTIVO") return null;
    const roles = await listRoles();
    return sanitizeUser(stored, roles.find((r) => r.id === stored.roleId));
  } catch {
    return null;
  }
}
function requireAdmin(req, res, next) {
  void getAuthenticatedUser(req).then((user) => {
    if (!user) return res.status(401).json({ success: false, error: "Autenticaci\xF3n requerida" });
    if (!userHasRole(user, "ADMIN")) return res.status(403).json({ success: false, error: "Solo el administrador puede realizar esta operaci\xF3n." });
    req.dimerUser = user;
    next();
  }).catch(() => res.status(503).json({ success: false, error: "Base de datos no disponible" }));
}
function routeError(res, error) {
  console.error("[ADMIN-REQUEST-ERROR]", error);
  const message = error instanceof Error ? error.message : "Error interno al procesar la solicitud";
  return res.status(500).json({ success: false, error: message });
}
function baseUrl2(req) {
  return resolveBaseUrl(req);
}
function registerAdminRequestRoutes(app2) {
  app2.delete("/api/requests/:id", requireAdmin, async (req, res) => {
    try {
      const admin = req.dimerUser;
      const requestId = String(req.params.id || "").trim();
      const request = await getRequest(requestId);
      if (!request) return res.status(404).json({ success: false, error: "Solicitud no encontrada" });
      const protectedStatuses = /* @__PURE__ */ new Set(["APROBADA", "PAGADA", "FINALIZADA", "CANCELADA"]);
      if (protectedStatuses.has(request.status)) {
        return res.status(400).json({
          success: false,
          error: `La solicitud ${request.folio} est\xE1 en estado ${request.status} y no puede eliminarse.`
        });
      }
      await recordAuditLog({
        requestId: request.id,
        userId: admin.id,
        action: "ELIMINACION_SOLICITUD",
        details: {
          folio: request.folio,
          previousStatus: request.status,
          requesterName: request.requesterName,
          reason: "Eliminaci\xF3n administrativa de solicitud no aprobada"
        }
      });
      await deleteRequest(request.id);
      return res.json({ success: true, folio: request.folio });
    } catch (error) {
      return routeError(res, error);
    }
  });
  app2.post("/api/requests/:id/cancel", requireAdmin, async (req, res) => {
    try {
      const admin = req.dimerUser;
      const requestId = String(req.params.id || "").trim();
      const request = await getRequest(requestId);
      if (!request) return res.status(404).json({ success: false, error: "Solicitud no encontrada" });
      if (request.status !== "APROBADA") {
        return res.status(400).json({
          success: false,
          error: `Solo se pueden cancelar solicitudes APROBADAS. Estado actual: ${request.status}.`
        });
      }
      const reason = String(req.body?.reason || "Viaje no realizado").trim() || "Viaje no realizado";
      const updated = await updateRequest(request.id, {
        status: "CANCELADA",
        comments: `Cancelada por administrador: ${reason}`,
        updatedAt: (/* @__PURE__ */ new Date()).toISOString()
      });
      await recordAuditLog({
        requestId: request.id,
        userId: admin.id,
        action: "CANCELACION_SOLICITUD_APROBADA",
        details: {
          folio: request.folio,
          reason,
          previousStatus: request.status,
          amountAuthorized: request.amountAuthorized
        }
      });
      return res.json({ success: true, request: updated });
    } catch (error) {
      return routeError(res, error);
    }
  });
  app2.post("/api/requests/:id/notify", async (req, res) => {
    try {
      const user = await getAuthenticatedUser(req);
      if (!user) return res.status(401).json({ success: false, error: "Autenticaci\xF3n requerida" });
      const requestId = String(req.params.id || "").trim();
      const request = await getRequest(requestId);
      if (!request) return res.status(404).json({ success: false, error: "Solicitud no encontrada" });
      if (!userHasRole(user, "ADMIN") && request.userId !== user.id) {
        return res.status(403).json({ success: false, error: "No autorizado para notificar esta solicitud" });
      }
      if (request.status !== "PENDIENTE_APROBACION") {
        return res.status(400).json({ success: false, error: `La solicitud est\xE1 en estado ${request.status} y no requiere notificaci\xF3n inicial.` });
      }
      if (!request.bossEmail) {
        return res.status(400).json({ success: false, error: "La solicitud no tiene correo de aprobador asignado." });
      }
      let current = request;
      let token = current.approvalToken || "";
      if (!token) {
        const tokenRecord = await createApprovalToken(current.id, current.bossEmail, current.bossId);
        token = tokenRecord.token;
        current = await updateRequest(current.id, {
          approvalToken: token,
          updatedAt: (/* @__PURE__ */ new Date()).toISOString()
        });
      }
      const approveUrl = `${baseUrl2(req)}/api/approval/token-action?token=${encodeURIComponent(token)}&action=approve`;
      const rejectUrl = `${baseUrl2(req)}/api/approval/token-action?token=${encodeURIComponent(token)}&action=reject`;
      const requester = await getUserById(current.userId);
      const requesterUser = requester ? sanitizeUser(requester) : {
        id: current.userId,
        name: current.requesterName || "Colaborador",
        email: "",
        department: current.department || "General",
        role: "SOLICITANTE",
        status: "ACTIVO"
      };
      const bossHtml = buildBossApprovalEmailHtml({
        request: current,
        user: requesterUser,
        approveUrl,
        rejectUrl,
        token
      });
      const bossMail = await sendEmail({
        to: current.bossEmail,
        subject: `AUTORIZACI\xD3N DE VI\xC1TICOS - Folio ${current.folio}`,
        html: bossHtml,
        requestId: current.id,
        folio: current.folio
      });
      const confirmationHtml = buildRequesterConfirmationEmailHtml({
        request: current,
        user: requesterUser,
        bossName: current.bossName || current.bossEmail,
        bossEmail: current.bossEmail
      });
      const requesterMail = requesterUser.email ? await sendEmail({
        to: requesterUser.email,
        subject: `SOLICITUD DE VI\xC1TICOS REGISTRADA - Folio ${current.folio}`,
        html: confirmationHtml,
        requestId: current.id,
        folio: current.folio
      }) : { status: "FALLIDO", error: "No se encontr\xF3 correo del solicitante" };
      await recordAuditLog({
        requestId: current.id,
        userId: user.id,
        action: "NOTIFICACION_CREACION_SOLICITUD",
        details: {
          folio: current.folio,
          approvalTokenCreated: !request.approvalToken,
          bossEmail: current.bossEmail,
          requesterEmail: requesterUser.email,
          bossMailStatus: bossMail.status,
          requesterMailStatus: requesterMail.status,
          bossMailError: bossMail.error || null,
          requesterMailError: requesterMail.error || null
        }
      });
      const ok = bossMail.status === "ENVIADO" && requesterMail.status === "ENVIADO";
      return res.status(ok ? 200 : 502).json({
        success: ok,
        request: current,
        notifications: {
          approver: bossMail.status,
          requester: requesterMail.status,
          approverError: bossMail.error,
          requesterError: requesterMail.error
        }
      });
    } catch (error) {
      return routeError(res, error);
    }
  });
}

// server/requestCreationRoutes.ts
var import_crypto4 = __toESM(require("crypto"), 1);
function parseCookies3(req) {
  const raw = String(req.headers.cookie || "");
  return Object.fromEntries(raw.split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.indexOf("=");
    return i < 0 ? [x, ""] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}
function verifyJwt2(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("JWT inv\xE1lido");
  const expected = import_crypto4.default.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  if (!import_crypto4.default.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) throw new Error("JWT inv\xE1lido");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1e3)) throw new Error("Sesi\xF3n expirada");
  return payload;
}
async function auth2(req) {
  const cookies = parseCookies3(req);
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const token = bearer || String(cookies.dimer_session || "");
  if (!token) return null;
  try {
    const payload = verifyJwt2(token);
    const stored = await getUserById(payload.sub);
    if (!stored || stored.status !== "ACTIVO") return null;
    const roles = await listRoles();
    return sanitizeUser(stored, roles.find((r) => r.id === stored.roleId));
  } catch {
    return null;
  }
}
function baseUrl3(req) {
  return resolveBaseUrl(req);
}
function errorResponse(res, error) {
  console.error("[REQUEST-CREATE]", error);
  return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Error al procesar la solicitud" });
}
function registerRequestCreationRoutes(app2) {
  app2.post("/api/requests/create", async (req, res) => {
    try {
      const user = await auth2(req);
      if (!user) return res.status(401).json({ success: false, error: "Autenticaci\xF3n requerida" });
      const b = req.body || {};
      const bossId = String(b.bossId || "").trim();
      const bossEmailInput = String(b.bossEmail || "").trim().toLowerCase();
      if (!bossEmailInput) return res.status(400).json({ success: false, error: "Correo del jefe/aprobador requerido" });
      const bosses = await listBosses();
      const boss = bosses.find((x) => bossId && x.id === bossId || x.email?.trim().toLowerCase() === bossEmailInput);
      if (!boss) return res.status(400).json({ success: false, error: "No se encontr\xF3 el jefe/aprobador seleccionado en el cat\xE1logo." });
      const folio = await generateNextFolio();
      const id = `req_${Date.now()}_${import_crypto4.default.randomBytes(6).toString("hex")}`;
      const now = (/* @__PURE__ */ new Date()).toISOString();
      const created = await insertRequest({
        id,
        folio,
        status: "PENDIENTE_APROBACION",
        userId: user.id,
        requesterName: String(b.requesterName || user.name || "").trim(),
        department: String(b.department || user.department || "").trim(),
        requestType: String(b.requestType || "").trim(),
        detail: String(b.detail || "").trim(),
        requestDate: String(b.requestDate || now.slice(0, 10)).slice(0, 10),
        depositDate: String(b.depositDate || "").slice(0, 10) || void 0,
        urgency: String(b.urgency || "media").trim().toLowerCase(),
        bossId: boss.id,
        bossEmail: boss.email,
        bossName: boss.name || String(b.bossName || "").trim() || boss.email,
        startDate: b.startDate || null,
        endDate: b.endDate || null,
        destination: String(b.destination || "").trim(),
        reason: String(b.reason || b.detail || "").trim(),
        amountRequested: Number(b.amountRequested || 0),
        amountAuthorized: null,
        transportCost: Number(b.transportCost || 0),
        hotelCost: Number(b.hotelCost || 0),
        foodCost: Number(b.foodCost || 0),
        miscCost: Number(b.miscCost || 0),
        comments: String(b.comments || "").trim() || null,
        approvedBy: null,
        approvedAt: null,
        rejectedBy: null,
        rejectedAt: null,
        rejectionReason: null,
        approvalToken: null,
        createdAt: now,
        updatedAt: now
      });
      const tokenRecord = await createApprovalToken(created.id, created.bossEmail, created.bossId);
      const request = await updateRequest(created.id, { approvalToken: tokenRecord.token, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
      const requesterRecord = await getUserById(request.userId);
      const requester = requesterRecord ? sanitizeUser(requesterRecord) : { ...user, id: request.userId, name: request.requesterName || user.name, department: request.department || user.department };
      const approveUrl = `${baseUrl3(req)}/api/approval/token-action?token=${encodeURIComponent(tokenRecord.token)}&action=approve`;
      const rejectUrl = `${baseUrl3(req)}/api/approval/token-action?token=${encodeURIComponent(tokenRecord.token)}&action=reject`;
      const bossMail = await sendEmail({
        to: request.bossEmail,
        subject: `AUTORIZACI\xD3N DE VI\xC1TICOS - Folio ${request.folio}`,
        html: buildBossApprovalEmailHtml({ request, user: requester, approveUrl, rejectUrl, token: tokenRecord.token }),
        requestId: request.id,
        folio: request.folio
      });
      const requesterMail = requester.email ? await sendEmail({
        to: requester.email,
        subject: `SOLICITUD DE VI\xC1TICOS REGISTRADA - Folio ${request.folio}`,
        html: buildRequesterConfirmationEmailHtml({ request, user: requester, bossName: request.bossName || request.bossEmail, bossEmail: request.bossEmail }),
        requestId: request.id,
        folio: request.folio
      }) : { status: "FALLIDO", error: "No se encontr\xF3 correo del solicitante" };
      await recordAuditLog({
        requestId: request.id,
        userId: user.id,
        action: "CREACION_SOLICITUD",
        details: {
          folio: request.folio,
          approverEmail: request.bossEmail,
          requesterEmail: requester.email,
          approvalTokenCreated: true,
          approverMailStatus: bossMail.status,
          approverMailError: bossMail.error || null,
          requesterMailStatus: requesterMail.status,
          requesterMailError: requesterMail.error || null
        }
      });
      return res.json({
        success: true,
        request,
        notifications: {
          approver: bossMail.status,
          approverError: bossMail.error,
          requester: requesterMail.status,
          requesterError: requesterMail.error
        }
      });
    } catch (error) {
      return errorResponse(res, error);
    }
  });
}

// server/multiRoleUserRoutes.ts
var import_crypto5 = __toESM(require("crypto"), 1);
function parseCookies4(req) {
  const raw = String(req.headers.cookie || "");
  return Object.fromEntries(raw.split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.indexOf("=");
    return i < 0 ? [x, ""] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
}
function verifyJwt3(token) {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("Falta JWT_SECRET");
  const parts = token.split(".");
  if (parts.length !== 3) throw new Error("JWT inv\xE1lido");
  const expected = import_crypto5.default.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest("base64url");
  if (!import_crypto5.default.timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) throw new Error("JWT inv\xE1lido");
  const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1e3)) throw new Error("Sesi\xF3n expirada");
  return payload;
}
async function getAuthenticatedUser2(req) {
  const cookies = parseCookies4(req);
  const bearer = String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim();
  const token = bearer || String(cookies.dimer_session || "");
  if (!token) return null;
  try {
    const payload = verifyJwt3(token);
    const stored = await getUserById(payload.sub);
    if (!stored || stored.status !== "ACTIVO") return null;
    return stored;
  } catch {
    return null;
  }
}
function requireUserAdmin(req, res, next) {
  void getAuthenticatedUser2(req).then((user) => {
    if (!user) return res.status(401).json({ error: "Autenticaci\xF3n requerida" });
    if (!hasPermission(user, "administrar_usuarios")) return res.status(403).json({ error: "No tienes permiso para esta operaci\xF3n" });
    req.dimerUser = user;
    next();
  }).catch(() => res.status(503).json({ error: "Base de datos no disponible" }));
}
function requireSameOriginMutation(req, res, next) {
  if (req.method === "GET" || req.method === "HEAD" || req.method === "OPTIONS") return next();
  const site = String(req.headers["sec-fetch-site"] || "").trim().toLowerCase();
  if (site === "cross-site") return res.status(403).json({ error: "Origen no permitido" });
  next();
}
async function resolveRoleSelection(body, currentRoleIds) {
  const hasRoleIds = Array.isArray(body?.roleIds);
  const hasRoleId = body?.roleId !== void 0 && body?.roleId !== null && String(body.roleId).trim() !== "";
  if (!hasRoleIds && !hasRoleId) return currentRoleIds;
  const rawIds = hasRoleIds ? body.roleIds : [body.roleId];
  const roleIds = Array.from(new Set(rawIds.map((id) => String(id || "").trim()).filter(Boolean)));
  if (!roleIds.length) throw new Error("Debe asignarse al menos un rol al usuario.");
  const roles = await listRoles();
  const invalid = roleIds.filter((id) => !roles.some((r) => r.id === id));
  if (invalid.length) throw new Error(`Rol(es) no encontrado(s): ${invalid.join(", ")}`);
  return roleIds;
}
async function syncUserRoles(userId, roleIds) {
  if (!roleIds.length) throw new Error("Debe existir al menos un rol asignado.");
  const { error: deleteError } = await supabase.from("user_roles").delete().eq("user_id", userId);
  if (deleteError) throw deleteError;
  const rows = roleIds.map((roleId) => ({ user_id: userId, role_id: roleId }));
  const { error: insertError } = await supabase.from("user_roles").insert(rows);
  if (insertError) throw insertError;
}
function registerMultiRoleUserRoutes(app2) {
  app2.get("/api/users", requireUserAdmin, async (_req, res) => {
    try {
      return res.json(await listUsers());
    } catch (error) {
      return res.status(503).json({ error: error instanceof Error ? error.message : "Error interno" });
    }
  });
  app2.post("/api/users", requireSameOriginMutation, requireUserAdmin, async (req, res) => {
    try {
      const { name, email, password, department, status } = req.body || {};
      if (!name || !email || !password) return res.status(400).json({ error: "Nombre, correo y contrase\xF1a son obligatorios" });
      const clean = String(email).trim().toLowerCase();
      if (await getUserByEmail(clean)) return res.status(400).json({ error: "El correo ya est\xE1 registrado" });
      const roleIds = await resolveRoleSelection(req.body, ["role_solicitante"]);
      if (!roleIds?.length) return res.status(400).json({ error: "Debe asignarse al menos un rol al usuario." });
      const roles = await listRoles();
      const primaryRole = roles.find((r) => r.id === roleIds[0]);
      if (!primaryRole) return res.status(400).json({ error: "El rol principal seleccionado no existe." });
      const { hash, salt } = hashPassword(String(password));
      const rec = { id: `usr_${Date.now()}_${import_crypto5.default.randomBytes(4).toString("hex")}`, name: String(name).trim(), email: clean, department: String(department || "General").trim(), role: primaryRole.name.toUpperCase(), roleId: primaryRole.id, roleIds, status: status === "INACTIVO" ? "INACTIVO" : "ACTIVO", isVerified: true, passwordHash: hash, salt, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
      const created = await insertUser(rec);
      await syncUserRoles(created.id, roleIds);
      const user = await getUserById(created.id);
      if (!user) throw new Error("No fue posible recuperar el usuario creado.");
      await recordAuditLog({ userId: req.dimerUser.id, action: "ROLES_ACTUALIZADOS", details: { targetUserId: user.id, targetEmail: user.email, previousRoleIds: [], newRoleIds: roleIds } });
      return res.json({ success: true, user });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Error interno" });
    }
  });
  app2.put("/api/users/:id", requireSameOriginMutation, requireUserAdmin, async (req, res) => {
    try {
      const id = String(req.params.id);
      const target = await getUserById(id);
      if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
      const previousRoleIds = target.roleIds?.length ? [...target.roleIds] : target.roleId ? [target.roleId] : [];
      const roleIds = await resolveRoleSelection(req.body, previousRoleIds);
      const p = { ...req.body };
      if (roleIds?.length) {
        const roles = await listRoles();
        const primaryRole = roles.find((r) => r.id === roleIds[0]);
        if (!primaryRole) return res.status(400).json({ error: "El rol principal seleccionado no existe." });
        p.roleIds = roleIds;
        p.roleId = primaryRole.id;
        p.role = primaryRole.name.toUpperCase();
      }
      if (p.password) {
        const { hash, salt } = hashPassword(String(p.password));
        p.passwordHash = hash;
        p.salt = salt;
        delete p.password;
      }
      const updated = await updateUser(id, p);
      if (roleIds?.length) await syncUserRoles(id, roleIds);
      const user = await getUserById(id);
      if (!user) throw new Error("No fue posible recuperar el usuario actualizado.");
      if (roleIds?.join("|") !== previousRoleIds.join("|")) await recordAuditLog({ userId: req.dimerUser.id, action: "ROLES_ACTUALIZADOS", details: { targetUserId: id, targetEmail: user.email, previousRoleIds, newRoleIds: roleIds } });
      return res.json({ success: true, user: user || sanitizeUser(updated) });
    } catch (error) {
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Error interno" });
    }
  });
  app2.delete("/api/users/:id", requireSameOriginMutation, requireUserAdmin, async (req, res) => {
    try {
      const target = await getUserById(String(req.params.id));
      if (!target) return res.status(404).json({ error: "Usuario no encontrado" });
      const targetIsAdmin = String(target.role || "").trim().toUpperCase() === "ADMIN" || String(target.roleId || "").trim().toLowerCase() === "role_admin" || Array.isArray(target.roleIds) && target.roleIds.some((id) => String(id).trim().toLowerCase() === "role_admin") || Array.isArray(target.roles) && target.roles.some((role) => String(role?.name || "").trim().toUpperCase() === "ADMIN" || String(role?.id || "").trim().toLowerCase() === "role_admin");
      if (targetIsAdmin) return res.status(403).json({ error: "Por seguridad, una cuenta con rol ADMIN no puede ser eliminada." });
      await deleteUser(target.id);
      await recordAuditLog({ userId: req.dimerUser.id, action: "ELIMINACION_USUARIO", details: { targetUserId: target.id, targetEmail: target.email, targetName: target.name } });
      return res.json({ success: true });
    } catch (error) {
      console.error("[USER_MGMT] Error al eliminar usuario:", error);
      return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Error interno" });
    }
  });
}

// server/errorLogger.ts
function serializeError(error) {
  if (error instanceof Error) {
    return { name: error.name, message: error.message, stack: error.stack };
  }
  return { name: "UnknownError", message: String(error), stack: void 0 };
}
function sanitizeHeaders(req) {
  const headers = { ...req.headers };
  delete headers.authorization;
  delete headers.cookie;
  delete headers["x-api-key"];
  return headers;
}
function logSystemError(error, req, context = {}) {
  const serialized = serializeError(error);
  const user = req ? req.dimerUser : void 0;
  const entry = {
    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
    level: "ERROR",
    source: context.source || "server",
    message: serialized.message,
    errorName: serialized.name,
    stack: serialized.stack,
    statusCode: context.statusCode,
    requestId: context.requestId,
    folio: context.folio,
    userId: context.userId || user?.id,
    userEmail: user?.email,
    method: req?.method,
    path: req?.originalUrl || req?.url,
    ip: req?.ip,
    userAgent: req?.get("user-agent"),
    headers: req ? sanitizeHeaders(req) : void 0,
    extra: context.extra,
    runtime: process.env.VERCEL ? "vercel-serverless" : "node",
    vercelRequestId: req?.get("x-vercel-id")
  };
  try {
    console.error("[DIMER-SYSTEM-ERROR]", JSON.stringify(entry));
  } catch {
    console.error("[DIMER-SYSTEM-ERROR]", serialized.message);
  }
}
function registerProcessErrorLogging() {
  process.on("uncaughtException", (error) => {
    logSystemError(error, void 0, { source: "uncaughtException" });
  });
  process.on("unhandledRejection", (reason) => {
    logSystemError(reason, void 0, { source: "unhandledRejection" });
  });
}

// api/index.ts
var app = (0, import_express2.default)();
function parseSessionCookie(req) {
  const raw = String(req.headers.cookie || "");
  const cookies = Object.fromEntries(raw.split(";").map((x) => x.trim()).filter(Boolean).map((x) => {
    const i = x.indexOf("=");
    return i < 0 ? [x, ""] : [x.slice(0, i), decodeURIComponent(x.slice(i + 1))];
  }));
  return String(req.headers.authorization || "").replace(/^Bearer\s+/i, "").trim() || String(cookies.dimer_session || "");
}
async function getAuthenticatedUser3(req) {
  const token = parseSessionCookie(req);
  if (!token) return null;
  try {
    const secret = process.env.JWT_SECRET;
    if (!secret) return null;
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    const expected = import_crypto6.default.createHmac("sha256", secret).update(`${parts[0]}.${parts[1]}`).digest("base64url");
    const actual = Buffer.from(parts[2]);
    const expectedBuffer = Buffer.from(expected);
    if (actual.length !== expectedBuffer.length || !import_crypto6.default.timingSafeEqual(actual, expectedBuffer)) return null;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    if (!payload.sub || !payload.exp || payload.exp < Math.floor(Date.now() / 1e3)) return null;
    const user = await getUserById(payload.sub);
    return user && user.status === "ACTIVO" ? user : null;
  } catch {
    return null;
  }
}
async function isAuthenticated(req) {
  return Boolean(await getAuthenticatedUser3(req));
}
registerProcessErrorLogging();
app.use((req, res, next) => {
  res.on("finish", () => {
    if (res.statusCode >= 500) {
      logSystemError(new Error(`HTTP ${res.statusCode}`), req, { source: "http-response", statusCode: res.statusCode });
    }
  });
  next();
});
app.use(import_express2.default.json());
app.use(import_express2.default.urlencoded({ extended: true }));
app.use("/api/requests", (req, _res, next) => {
  if (req.method === "POST" && req.body && typeof req.body === "object") {
    const comments = String(req.body.comments || "");
    const calculatorUsed = /Desglose estimado:/i.test(comments);
    if (!calculatorUsed) {
      req.body.transportCost = 0;
      req.body.hotelCost = 0;
      req.body.foodCost = 0;
      req.body.miscCost = 0;
    }
  }
  next();
});
app.get("/api/bosses", async (req, res) => {
  try {
    if (!await isAuthenticated(req)) return res.status(401).json({ error: "Autenticaci\xF3n requerida" });
    return res.json((await listBosses()).filter((boss) => boss.active));
  } catch (error) {
    logSystemError(error, req, { source: "bosses-read", statusCode: 503 });
    return res.status(503).json({ error: "Base de datos no disponible" });
  }
});
app.post("/api/requests/:id/cancel", async (req, res) => {
  try {
    const user = await getAuthenticatedUser3(req);
    if (!user) return res.status(401).json({ success: false, error: "Autenticaci\xF3n requerida" });
    const requestId = String(req.params.id || "").trim();
    const request = await getRequest(requestId);
    if (!request) return res.status(404).json({ success: false, error: "Solicitud no encontrada" });
    const isOwner = request.userId === user.id;
    const isAdmin = String(user.role || "").toUpperCase() === "ADMIN" || Boolean(user.roles?.some((r) => String(r.name || "").toUpperCase() === "ADMIN"));
    if (!isOwner && !isAdmin) return res.status(403).json({ success: false, error: "Solo el solicitante puede cancelar esta solicitud." });
    if (request.status !== "PENDIENTE_APROBACION") return res.status(400).json({ success: false, error: `Solo se puede cancelar antes de la aprobaci\xF3n. Estado actual: ${request.status}.` });
    const reason = String(req.body?.reason || "Cancelada por el solicitante").trim() || "Cancelada por el solicitante";
    const updated = await updateRequest(request.id, { status: "CANCELADA", comments: `${request.comments ? `${request.comments}
` : ""}Cancelada: ${reason}`, updatedAt: (/* @__PURE__ */ new Date()).toISOString() });
    await recordAuditLog({ requestId: request.id, userId: user.id, action: isAdmin ? "CANCELACION_ADMIN_SOLICITUD_PENDIENTE" : "CANCELACION_SOLICITUD_PENDIENTE", details: { folio: request.folio, reason, previousStatus: request.status } });
    return res.json({ success: true, request: updated });
  } catch (error) {
    logSystemError(error, req, { source: "request-cancel", statusCode: 500 });
    return res.status(500).json({ success: false, error: error instanceof Error ? error.message : "Error al cancelar la solicitud." });
  }
});
registerApprovalRoutes(app);
registerMultiRoleUserRoutes(app);
var mainApp = createApp();
registerAdminRequestRoutes(mainApp);
registerRequestCreationRoutes(mainApp);
app.use(mainApp);
app.use((error, req, res, next) => {
  logSystemError(error, req, { source: "express-error", statusCode: 500 });
  if (res.headersSent) return next(error);
  return res.status(500).json({ success: false, error: "Error interno del servidor." });
});
var index_default = app;
