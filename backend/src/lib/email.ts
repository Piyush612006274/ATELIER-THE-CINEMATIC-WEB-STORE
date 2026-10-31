import crypto from "node:crypto";
import net from "node:net";
import tls from "node:tls";
import { prisma } from "../database/prisma.js";

export type OtpPurpose = "REGISTER" | "LOGIN" | "PASSWORD_RESET";

type SmtpReply = { code: number; text: string };
type PendingReply = { resolve: (reply: SmtpReply) => void; reject: (error: Error) => void };

function normalizeEmail(email: string) { return email.trim().toLowerCase(); }
function codeHash(code: string) {
  const pepper = String(process.env.OTP_PEPPER ?? "").trim();
  if (pepper.length < 32 || /^(?:REPLACE|CHANGE_ME|PASTE|YOUR_)/i.test(pepper)) {
    throw new Error("OTP_PEPPER_NOT_CONFIGURED");
  }
  return crypto.createHash("sha256").update(`${code}:${pepper}`).digest("hex");
}
function newCode() { return String(crypto.randomInt(0, 1000000)).padStart(6, "0"); }

/** A small built-in SMTP client, avoiding a runtime dependency solely for SMTP. */
class SmtpChannel {
  private buffer = "";
  private replyCode: number | null = null;
  private replyLines: string[] = [];
  private pendingReplies: SmtpReply[] = [];
  private waiters: PendingReply[] = [];
  private failed: Error | null = null;
  private readonly onData = (chunk: Buffer | string) => {
    this.buffer += Buffer.isBuffer(chunk) ? chunk.toString("utf8") : chunk;
    let newline = this.buffer.indexOf("\r\n");
    while (newline >= 0) {
      const line = this.buffer.slice(0, newline);
      this.buffer = this.buffer.slice(newline + 2);
      const match = /^(\d{3})([ -])(.*)$/.exec(line);
      if (match) {
        const code = Number(match[1]);
        if (this.replyCode === null) this.replyCode = code;
        this.replyLines.push(line);
        if (match[2] !== "-") {
          this.deliver({ code: this.replyCode, text: this.replyLines.join("\n") });
          this.replyCode = null;
          this.replyLines = [];
        }
      }
      newline = this.buffer.indexOf("\r\n");
    }
  };
  private readonly onError = (error: Error) => this.fail(error);
  private readonly onClose = () => this.fail(new Error("SMTP_CONNECTION_CLOSED"));

  constructor(public readonly socket: net.Socket) {
    socket.on("data", this.onData);
    socket.on("error", this.onError);
    socket.on("close", this.onClose);
    socket.setTimeout(45_000, () => socket.destroy(new Error("SMTP_TIMEOUT")));
  }

  private deliver(reply: SmtpReply) {
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve(reply);
    else this.pendingReplies.push(reply);
  }

  private fail(error: Error) {
    if (this.failed) return;
    this.failed = error;
    for (const waiter of this.waiters.splice(0)) waiter.reject(error);
  }

  readReply(): Promise<SmtpReply> {
    if (this.failed) return Promise.reject(this.failed);
    const queued = this.pendingReplies.shift();
    if (queued) return Promise.resolve(queued);
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  async command(value: string): Promise<SmtpReply> {
    const response = this.readReply();
    this.socket.write(`${value}\r\n`);
    return response;
  }

  async writeAndRead(value: string): Promise<SmtpReply> {
    const response = this.readReply();
    this.socket.write(value);
    return response;
  }

  detach() {
    this.socket.off("data", this.onData);
    this.socket.off("error", this.onError);
    this.socket.off("close", this.onClose);
  }
}

function waitForSocketEvent(socket: net.Socket, eventName: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const onSuccess = () => { cleanup(); resolve(); };
    const onError = (error: Error) => { cleanup(); reject(error); };
    const cleanup = () => {
      socket.off(eventName as never, onSuccess as never);
      socket.off("error", onError);
    };
    socket.once(eventName as never, onSuccess as never);
    socket.once("error", onError);
  });
}

function expectReply(reply: SmtpReply, expected: number | number[]) {
  const allowed = Array.isArray(expected) ? expected : [expected];
  if (!allowed.includes(reply.code)) throw new Error(`SMTP_UNEXPECTED_RESPONSE_${reply.code}`);
}

function senderDetails(value: string) {
  const clean = value.trim();
  if (!clean || /[\r\n]/.test(clean)) throw new Error("SMTP_EMAIL_FROM_INVALID");
  const match = /^(.*?)\s*<([^<>]+)>$/.exec(clean);
  const address = (match?.[2] || clean).trim();
  if (!/^[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+$/.test(address)) throw new Error("SMTP_EMAIL_FROM_INVALID");
  const displayName = (match?.[1] || "").trim().replace(/^['"]|['"]$/g, "");
  const header = displayName ? `"${displayName.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}" <${address}>` : address;
  return { address, header };
}

function wrapBase64(value: string) {
  const encoded = Buffer.from(value, "utf8").toString("base64");
  return encoded.match(/.{1,76}/g)?.join("\r\n") || "";
}

async function sendViaSmtp(to: string, subject: string, text: string, html: string, from: string) {
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS;
  const port = Number(process.env.SMTP_PORT || 587);
  const implicitTls = process.env.SMTP_SECURE === "true" || port === 465;
  if (!host || !user || !password || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("SMTP_CONFIG_INCOMPLETE");
  }
  if (/[\r\n]/.test(to) || /[\r\n]/.test(subject)) throw new Error("SMTP_INVALID_HEADER");
  const sender = senderDetails(from);
  const ehloName = (process.env.SMTP_EHLO_NAME || "atelier.local").replace(/[^A-Za-z0-9.-]/g, "").slice(0, 120) || "atelier.local";
  let channel: SmtpChannel | null = null;
  try {
    if (implicitTls) {
      const socket = tls.connect({ host, port, servername: host });
      channel = new SmtpChannel(socket);
      await waitForSocketEvent(socket, "secureConnect");
    } else {
      const socket = net.createConnection({ host, port });
      channel = new SmtpChannel(socket);
      await waitForSocketEvent(socket, "connect");
    }

    expectReply(await channel.readReply(), 220);
    let ehlo = await channel.command(`EHLO ${ehloName}`);
    expectReply(ehlo, 250);

    if (!implicitTls) {
      if (!/STARTTLS/i.test(ehlo.text)) throw new Error("SMTP_STARTTLS_UNAVAILABLE");
      expectReply(await channel.command("STARTTLS"), 220);
      const plainSocket = channel.socket;
      channel.detach();
      const securedSocket = tls.connect({ socket: plainSocket, servername: host });
      await waitForSocketEvent(securedSocket, "secureConnect");
      channel = new SmtpChannel(securedSocket);
      ehlo = await channel.command(`EHLO ${ehloName}`);
      expectReply(ehlo, 250);
    }

    expectReply(await channel.command("AUTH LOGIN"), 334);
    expectReply(await channel.command(Buffer.from(user, "utf8").toString("base64")), 334);
    expectReply(await channel.command(Buffer.from(password, "utf8").toString("base64")), 235);
    expectReply(await channel.command(`MAIL FROM:<${sender.address}>`), 250);
    expectReply(await channel.command(`RCPT TO:<${to}>`), [250, 251]);
    expectReply(await channel.command("DATA"), 354);

    const boundary = `atelier_${crypto.randomBytes(18).toString("hex")}`;
    const messageId = crypto.randomUUID();
    const raw = [
      `From: ${sender.header}`,
      `To: ${to}`,
      `Subject: ${subject}`,
      `Date: ${new Date().toUTCString()}`,
      `Message-ID: <${messageId}@${ehloName}>`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(text),
      `--${boundary}`,
      "Content-Type: text/html; charset=utf-8",
      "Content-Transfer-Encoding: base64",
      "",
      wrapBase64(html),
      `--${boundary}--`,
      ""
    ].join("\r\n").replace(/(^|\r\n)\./g, "$1..");
    expectReply(await channel.writeAndRead(`${raw}\r\n.\r\n`), 250);
    try { expectReply(await channel.command("QUIT"), 221); } catch { /* The email has already been accepted. */ }
  } catch (error) {
    if (error instanceof Error && /^SMTP_[A-Z0-9_]+$/.test(error.message)) throw error;
    throw new Error("SMTP_SEND_FAILED");
  } finally {
    if (channel && !channel.socket.destroyed) channel.socket.end();
  }
}

async function sendEmail(to: string, subject: string, text: string, html: string) {
  const from = process.env.EMAIL_FROM?.trim();
  const host = process.env.SMTP_HOST?.trim();
  const user = process.env.SMTP_USER?.trim();
  const password = process.env.SMTP_PASS;

  // OTP delivery is SMTP-only. Do not silently use a different provider or
  // expose verification codes in terminal logs when SMTP is misconfigured.
  if (!host || !user || !password) throw new Error("SMTP_CONFIG_INCOMPLETE");
  if (!from) throw new Error("EMAIL_FROM_NOT_CONFIGURED");
  await sendViaSmtp(to, subject, text, html, from);
}

export async function issueOtp(email:string,purpose:OtpPurpose) {
  const normalized=normalizeEmail(email);
  // Serialize issuance per email/purpose so simultaneous requests cannot create multiple live codes.
  const issued = await prisma.$transaction(async tx=>{
    await tx.$queryRaw`SELECT 1 AS locked FROM (SELECT pg_advisory_xact_lock(hashtext(${normalized}), hashtext(${purpose}))) AS lock_row`;
    const recent=await tx.verificationCode.findFirst({where:{email:normalized,purpose,consumedAt:null,createdAt:{gte:new Date(Date.now()-60_000)}},orderBy:{createdAt:"desc"}});
    if(recent) throw new Error("OTP_TOO_FREQUENT");
    await tx.verificationCode.updateMany({where:{email:normalized,purpose,consumedAt:null},data:{consumedAt:new Date()}});
    const code=newCode(); const expiresAt=new Date(Date.now()+10*60*1000);
    const row=await tx.verificationCode.create({data:{email:normalized,purpose,codeHash:codeHash(code),expiresAt}});
    return {row,code,expiresAt};
  });
  const {row,code,expiresAt}=issued;
  const subject = purpose === "PASSWORD_RESET" ? "ATELIER password reset code" : "Your ATELIER verification code";
  const text = `Your ATELIER code is ${code}. It expires in 10 minutes. If you did not request this, ignore this email.`;
  const html = `<div style="font-family:Arial,sans-serif;padding:24px"><h2>ATELIER</h2><p>Your verification code is:</p><p style="font-size:32px;letter-spacing:8px"><b>${code}</b></p><p>This code expires in 10 minutes.</p></div>`;
  try {
    await sendEmail(normalized,subject,text,html);
  } catch (error) {
    await prisma.verificationCode.updateMany({where:{id:row.id,consumedAt:null},data:{consumedAt:new Date()}});
    throw error;
  }
  return {expiresAt};
}

export async function consumeOtp(email:string,purpose:OtpPurpose,code:string) {
  const normalized=normalizeEmail(email); const row=await prisma.verificationCode.findFirst({where:{email:normalized,purpose,consumedAt:null},orderBy:{createdAt:"desc"}});
  if(!row || row.expiresAt.getTime()<Date.now()) throw new Error("OTP_EXPIRED");
  if(row.attempts>=5) throw new Error("OTP_ATTEMPTS_EXCEEDED");
  if(codeHash(code)!==row.codeHash) {
    const changed = await prisma.verificationCode.updateMany({where:{id:row.id,consumedAt:null,attempts:{lt:5}},data:{attempts:{increment:1}}});
    if(changed.count!==1) throw new Error("OTP_ATTEMPTS_EXCEEDED");
    throw new Error("INVALID_OTP");
  }
  const consumed = await prisma.verificationCode.updateMany({where:{id:row.id,consumedAt:null,attempts:{lt:5},expiresAt:{gt:new Date()}},data:{consumedAt:new Date()}});
  if(consumed.count!==1) throw new Error("OTP_EXPIRED");
  return true;
}
