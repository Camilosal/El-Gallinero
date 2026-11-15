import net from "node:net";
import tls from "node:tls";
import { LEGAL, RESPONSE_TIME } from "@/lib/legal";
import { formatBugReportPreviewText, type BugReportRecord } from "@/lib/bug-report";

export interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
}

export interface SentNotificationRecord extends EmailMessage {
  mode: "smtp" | "logged";
  sentAt: string;
  error?: string;
}

export interface ContactTicketPayload {
  ticketCode: string;
  reason: "soporte" | "implementacion" | "datos";
  reasonLabel: string;
  name: string;
  farm: string;
  contactInfo: string;
  message: string;
  discoverySource?: string;
  attributionSource?: string;
  createdAt: string;
}

const sentLog: SentNotificationRecord[] = [];

export function getSentNotificationsLog(): ReadonlyArray<SentNotificationRecord> {
  return sentLog;
}

export function clearSentNotificationsLog(): void {
  sentLog.length = 0;
}

function sanitizeHeaderAddr(value: string): string {
  return value.replace(/[\r\n<>]/g, "").trim();
}

function isValidEmail(value: string): boolean {
  return /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(value.trim());
}

function encodeSubjectUtf8(subject: string): string {
  const clean = subject.replace(/[\r\n]+/g, " ").trim();
  return `=?UTF-8?B?${Buffer.from(clean, "utf8").toString("base64")}?=`;
}

function wrapBase64(b64: string): string {
  return b64.match(/.{1,76}/g)?.join("\r\n") ?? b64;
}

interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
  from: string;
  secure: boolean;
}

function getSmtpConfig(): SmtpConfig | null {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim() || "";
  const pass = process.env.SMTP_PASS?.trim() || "";
  if (!host) return null;

  const port = Number(process.env.SMTP_PORT || 587);
  const secureEnv = process.env.SMTP_SECURE?.trim().toLowerCase();
  const secure = secureEnv === "true" || port === 465;
  const from = sanitizeHeaderAddr(
    process.env.SMTP_FROM?.trim() ||
      process.env.SMTP_FROM_EMAIL?.trim() ||
      "info@espaciosplus.com",
  );

  return { host, port, user, pass, from, secure };
}

async function sendSmtpRaw(cfg: SmtpConfig, msg: EmailMessage): Promise<void> {
  return new Promise((resolve, reject) => {
    let socket: net.Socket | tls.TLSSocket = cfg.secure
      ? tls.connect({ host: cfg.host, port: cfg.port, servername: cfg.host })
      : net.connect({ host: cfg.host, port: cfg.port });

    let settled = false;
    let buffer = "";
    let waitResolve: ((line: { code: number; lines: string[] }) => void) | null = null;
    let waitReject: ((err: Error) => void) | null = null;

    const timer = setTimeout(() => {
      fail(new Error("SMTP timeout"));
    }, 15000);

    const cleanup = () => {
      clearTimeout(timer);
      socket.removeAllListeners();
      socket.destroy();
    };

    const fail = (err: Error) => {
      if (settled) return;
      settled = true;
      cleanup();
      if (waitReject) {
        const rej = waitReject;
        waitReject = null;
        waitResolve = null;
        rej(err);
      }
      reject(err);
    };

    const consumeBuffer = () => {
      if (!waitResolve) return;
      const lines = buffer.split("\r\n");
      const completeLines: string[] = [];
      for (let i = 0; i < lines.length - 1; i++) {
        completeLines.push(lines[i]);
      }
      const collected: string[] = [];
      for (let i = 0; i < completeLines.length; i++) {
        const line = completeLines[i];
        collected.push(line);
        const match = /^(\d{3})([ -])/.exec(line);
        if (match && match[2] === " ") {
          // Consumed up to index i
          buffer = lines.slice(i + 1).join("\r\n");
          const code = Number(match[1]);
          if (waitResolve) {
            const res = waitResolve;
            waitResolve = null;
            waitReject = null;
            res({ code, lines: collected });
          }
          return;
        }
      }
    };

    const attachSocketListeners = (sock: net.Socket | tls.TLSSocket) => {
      sock.on("data", (chunk) => {
        buffer += chunk.toString("utf8");
        consumeBuffer();
      });
      sock.on("error", (err) => fail(err));
      sock.on("close", () => {
        if (!settled) {
          fail(new Error("SMTP connection closed unexpectedly"));
        }
      });
    };

    const nextResponse = (): Promise<{ code: number; lines: string[] }> =>
      new Promise((res, rej) => {
        waitResolve = res;
        waitReject = rej;
        consumeBuffer();
      });

    const command = async (cmd: string, expectedCodes: number[]) => {
      const wait = nextResponse();
      socket.write(`${cmd}\r\n`);
      const resp = await wait;
      if (!expectedCodes.includes(resp.code)) {
        throw new Error(`SMTP error (${resp.code}) for ${cmd.split(" ")[0]}: ${resp.lines.join(" | ")}`);
      }
      return resp;
    };

    attachSocketListeners(socket);

    (async () => {
      const greeting = await nextResponse();
      if (greeting.code !== 220) {
        throw new Error(`Unexpected SMTP greeting: ${greeting.code}`);
      }

      const ehlo = await command(`EHLO ${sanitizeHeaderAddr(LEGAL.sitio) || "localhost"}`, [250]);
      const supportsStartTls = ehlo.lines.some((l) => /STARTTLS/i.test(l));

      if (!cfg.secure && supportsStartTls) {
        await command("STARTTLS", [220]);
        socket.removeAllListeners("data");
        socket.removeAllListeners("error");
        socket.removeAllListeners("close");
        buffer = "";

        const upgraded = tls.connect({
          socket,
          host: cfg.host,
          servername: cfg.host,
        });
        await new Promise<void>((res, rej) => {
          upgraded.once("secureConnect", () => res());
          upgraded.once("error", rej);
        });
        socket = upgraded;
        attachSocketListeners(socket);
        await command(`EHLO ${sanitizeHeaderAddr(LEGAL.sitio) || "localhost"}`, [250]);
      }

      if (cfg.user && cfg.pass) {
        await command("AUTH LOGIN", [334]);
        await command(Buffer.from(cfg.user, "utf8").toString("base64"), [334]);
        await command(Buffer.from(cfg.pass, "utf8").toString("base64"), [235]);
      }

      const fromAddr = sanitizeHeaderAddr(cfg.from);
      const toAddr = sanitizeHeaderAddr(msg.to);

      await command(`MAIL FROM:<${fromAddr}>`, [250]);
      await command(`RCPT TO:<${toAddr}>`, [250, 251]);
      await command("DATA", [354]);

      const headers = [
        `From: "${LEGAL.marca}" <${fromAddr}>`,
        `To: <${toAddr}>`,
        msg.replyTo && isValidEmail(msg.replyTo) ? `Reply-To: <${sanitizeHeaderAddr(msg.replyTo)}>` : null,
        `Subject: ${encodeSubjectUtf8(msg.subject)}`,
        `Date: ${new Date().toUTCString()}`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
      ]
        .filter(Boolean)
        .join("\r\n");

      const encodedBody = wrapBase64(Buffer.from(msg.text, "utf8").toString("base64"));
      const dotStuffed = encodedBody.replace(/^\./gm, "..");

      const dataDone = nextResponse();
      socket.write(`${headers}\r\n\r\n${dotStuffed}\r\n.\r\n`);
      const dataResp = await dataDone;
      if (dataResp.code !== 250) {
        throw new Error(`SMTP DATA rejected: ${dataResp.code}`);
      }

      await command("QUIT", [221]).catch(() => undefined);
      settled = true;
      cleanup();
      resolve();
    })().catch(fail);
  });
}

/**
 * Envía un correo transaccional de forma segura (no lanza excepción si SMTP falla o no está configurado).
 */
export async function sendTransactionalEmail(
  msg: EmailMessage,
): Promise<{ sent: boolean; mode: "smtp" | "logged"; error?: string }> {
  const cleanTo = sanitizeHeaderAddr(msg.to);
  if (!isValidEmail(cleanTo)) {
    return { sent: false, mode: "logged", error: "Destinatario sin formato de correo válido" };
  }

  const isLiveTest = process.env.SMTP_LIVE_TEST === "1";
  const cfg = process.env.NODE_ENV === "test" && !isLiveTest ? null : getSmtpConfig();

  if (!cfg) {
    sentLog.push({
      ...msg,
      to: cleanTo,
      mode: "logged",
      sentAt: new Date().toISOString(),
    });
    return { sent: false, mode: "logged" };
  }

  try {
    await sendSmtpRaw(cfg, { ...msg, to: cleanTo });
    sentLog.push({
      ...msg,
      to: cleanTo,
      mode: "smtp",
      sentAt: new Date().toISOString(),
    });
    return { sent: true, mode: "smtp" };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    console.error("[notifications] Error enviando correo SMTP:", errorMsg);
    sentLog.push({
      ...msg,
      to: cleanTo,
      mode: "smtp",
      sentAt: new Date().toISOString(),
      error: errorMsg,
    });
    return { sent: false, mode: "smtp", error: errorMsg };
  }
}

function getAdminRecipients(): string[] {
  const candidates = [LEGAL.email, process.env.NOTIFY_EMAIL?.trim() || ""];
  const unique: string[] = [];
  for (const raw of candidates) {
    const clean = sanitizeHeaderAddr(raw);
    if (isValidEmail(clean) && !unique.includes(clean)) {
      unique.push(clean);
    }
  }
  return unique;
}

/** Notifica al administrador y acusa recibo al solicitante cuando radican /contacto. */
export async function notifyContactTicket(ticket: ContactTicketPayload): Promise<void> {
  const adminRecipients = getAdminRecipients();
  const jevRouting = (
    ticket as ContactTicketPayload & {
      jevRouting?: {
        intentLabel: string;
        estimatedScale: string;
        needsUrgentFollowup: boolean;
      };
    }
  ).jevRouting;

  const replyToUser = isValidEmail(ticket.contactInfo) ? ticket.contactInfo : undefined;
  const adminBody = [
    `Nueva solicitud radicada en ${LEGAL.sitio}/contacto`,
    ``,
    `Radicado: ${ticket.ticketCode}`,
    `Fecha: ${ticket.createdAt}`,
    `Motivo: ${ticket.reasonLabel}`,
    ...(jevRouting
      ? [
          `Clasificación automática: ${jevRouting.intentLabel} · Escala estimada: ${jevRouting.estimatedScale}${jevRouting.needsUrgentFollowup ? " · PRIORIDAD URGENTE" : ""}`,
        ]
      : []),
    `Nombre: ${ticket.name}`,
    `Granja: ${ticket.farm || "No especificada"}`,
    `Contacto del solicitante: ${ticket.contactInfo}`,
    ...(ticket.discoverySource ? [`¿Cómo nos encontró?: ${ticket.discoverySource}`] : []),
    ...(ticket.attributionSource ? [`Origen detectado (referente/UTM): ${ticket.attributionSource}`] : []),
    ``,
    `Mensaje:`,
    ticket.message,
  ].join("\n");

  for (const recipient of adminRecipients) {
    await sendTransactionalEmail({
      to: recipient,
      replyTo: replyToUser,
      subject: `${jevRouting?.needsUrgentFollowup ? "[Urgente] " : ""}[${ticket.ticketCode}] ${ticket.reasonLabel} · ${ticket.farm || ticket.name}`,
      text: adminBody,
    });
  }

  if (isValidEmail(ticket.contactInfo)) {
    await sendTransactionalEmail({
      to: ticket.contactInfo,
      replyTo: isValidEmail(LEGAL.email) ? LEGAL.email : undefined,
      subject: `Recibimos tu solicitud (${ticket.ticketCode}) · ${LEGAL.marca}`,
      text: [
        `Hola ${ticket.name},`,
        ``,
        `Recibimos correctamente tu solicitud en ${LEGAL.marca}.`,
        `Número de radicado: ${ticket.ticketCode}`,
        `Motivo: ${ticket.reasonLabel}`,
        ``,
        `Nuestro compromiso de respuesta es de ${RESPONSE_TIME}. También puedes escribirnos por WhatsApp al ${LEGAL.whatsapp}.`,
        ``,
        `Operado por ${LEGAL.razonSocial} · NIT/RUT ${LEGAL.nit} · ${LEGAL.ciudad}`,
      ].join("\n"),
    });
  }
}

/** Envía correo de bienvenida con código de recuperación si el usuario registró un email, y avisa al operador. */
export async function notifyNewFarmRegistration(params: {
  farmName: string;
  ownerName: string;
  username: string;
  recoveryCode: string;
}): Promise<void> {
  if (isValidEmail(params.username)) {
    await sendTransactionalEmail({
      to: params.username,
      replyTo: isValidEmail(LEGAL.email) ? LEGAL.email : undefined,
      subject: `Tu granja "${params.farmName}" ya está lista · ${LEGAL.marca}`,
      text: [
        `Hola ${params.ownerName},`,
        ``,
        `Tu granja "${params.farmName}" quedó creada en ${LEGAL.marca} con 30 días de prueba completa del plan Semilla.`,
        ``,
        `Usuario de acceso: ${params.username}`,
        `Código de recuperación de emergencia (guárdalo en un lugar seguro): ${params.recoveryCode}`,
        ``,
        `Ingresa en: https://${LEGAL.sitio}/login`,
        `Si necesitas ayuda en cualquier momento, escríbenos en https://${LEGAL.sitio}/contacto.`,
      ].join("\n"),
    });
  }

  for (const recipient of getAdminRecipients()) {
    await sendTransactionalEmail({
      to: recipient,
      subject: `Nueva granja registrada: ${params.farmName}`,
      text: [
        `Nueva alta self-service en ${LEGAL.sitio}:`,
        `Granja: ${params.farmName}`,
        `Titular: ${params.ownerName}`,
        `Usuario: ${params.username}`,
      ].join("\n"),
    });
  }
}

/** Envía aviso interno de pago aprobado en Wompi y activación del ciclo. */
export async function notifyPaymentApproved(params: {
  farmId: string;
  farmName: string;
  planName: string;
  amountCop: number;
  externalReference: string;
  periodEnd: string | null;
}): Promise<void> {
  for (const recipient of getAdminRecipients()) {
    await sendTransactionalEmail({
      to: recipient,
      subject: `Pago aprobado (${params.externalReference}) · ${params.farmName}`,
      text: [
        `Se confirmó un pago en Wompi para ${params.farmName} (${params.farmId}):`,
        `Plan: ${params.planName}`,
        `Valor: $${params.amountCop.toLocaleString("es-CO")} COP`,
        `Referencia: ${params.externalReference}`,
        `Vigencia hasta: ${params.periodEnd || "Sin definir"}`,
      ].join("\n"),
    });
  }
}

/** Envía reporte de falla etiquetado por origen hacia el equipo de soporte (correo + Telegram si está configurado). */
export async function notifyBugReport(report: BugReportRecord): Promise<void> {
  const subject = `[${report.reportCode}] [${report.severity.toUpperCase()}] [${report.originModule}] ${report.title}`;
  const body = formatBugReportPreviewText(report);

  for (const recipient of getAdminRecipients()) {
    await sendTransactionalEmail({
      to: recipient,
      subject,
      text: body,
    });
  }

  const tgToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const tgChatId = process.env.TELEGRAM_CHAT_ID?.trim();
  if (tgToken && tgChatId && process.env.NODE_ENV !== "test") {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      await fetch(`https://api.telegram.org/bot${tgToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          chat_id: tgChatId,
          text: body.slice(0, 3900),
          disable_web_page_preview: true,
        }),
      });
    } catch {
      // Never block bug report submission if Telegram is unreachable
    } finally {
      clearTimeout(timer);
    }
  }
}
