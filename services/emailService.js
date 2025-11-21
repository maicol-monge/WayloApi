const nodemailer = require('nodemailer');

function canUseResend() {
  // Allow forcing SMTP with FORCE_SMTP=true
  if (String(process.env.FORCE_SMTP).toLowerCase() === 'true') return false;
  return !!process.env.RESEND_API_KEY;
}

function canUseSendGrid() {
  // Allow forcing SMTP even if SendGrid present via FORCE_SMTP
  if (String(process.env.FORCE_SMTP).toLowerCase() === 'true') return false;
  return !!process.env.SENDGRID_API_KEY;
}

async function sendViaSendGrid({ to, subject, text, html }) {
  let sgMail;
  try {
    sgMail = require('@sendgrid/mail');
  } catch (e) {
    throw new Error('Paquete "@sendgrid/mail" no instalado. Agrega a dependencies o desactiva SENDGRID_API_KEY');
  }
  sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  const from = process.env.SENDGRID_FROM || process.env.EMAIL_FROM || process.env.EMAIL_USER;
  // Normalize from if needed
  const finalFrom = String(from || '').trim();
  console.info('[email] SendGrid send from:', finalFrom);
  const msg = {
    to,
    from: finalFrom,
    subject,
    text,
    html,
  };
  try {
    const result = await sgMail.send(msg);
    return result;
  } catch (err) {
    // Log detailed SendGrid error body if available
    if (err && err.response && err.response.body) {
      console.error('[email][sendgrid] response body:', JSON.stringify(err.response.body));
    }
    throw err;
  }
}

async function sendViaResend({ to, subject, text, html }) {
  // Carga perezosa para no romper si no está instalado localmente
  let Resend;
  try {
    Resend = require('resend').Resend;
  } catch (e) {
    throw new Error('Paquete "resend" no instalado. Agrega a dependencies o desactiva RESEND_API_KEY');
  }
  const resend = new Resend(process.env.RESEND_API_KEY);
  const from = process.env.RESEND_FROM || process.env.EMAIL_FROM || 'onboarding@resend.dev';
  // Normalizar 'from' si el usuario puso: Name email@domain (sin < >)
  let finalFrom = String(from || '').trim();
  // Si contiene un espacio y contiene un email, y no tiene < >, intentar envolver
  const emailMatch = finalFrom.match(/([\w.+-]+@[\w.-]+\.[\w.-]+)/);
  if (emailMatch && !/[<>]/.test(finalFrom)) {
    // Extraer posible nombre
    const possibleName = finalFrom.replace(emailMatch[0], '').trim();
    if (possibleName) {
      finalFrom = `${possibleName} <${emailMatch[0]}>`;
    } else {
      finalFrom = emailMatch[0];
    }
  }

  console.info('[email] Resend send from:', finalFrom);
  const result = await resend.emails.send({ from: finalFrom, to, subject, text, html });
  if (result.error) {
    throw result.error;
  }
}

function createTransporter() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT || 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  // Fallback a Gmail si no se configuró SMTP_*
  const gmailUser = process.env.EMAIL_USER;
  const gmailPass = process.env.EMAIL_PASS;

  if (host && user && pass) {
    const secure = port === 465; // true for 465, false for other ports
    const opts = {
      host,
      port,
      secure,
      auth: { user, pass },
      // timeouts (ms)
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    };
    if (String(process.env.DEBUG_EMAIL).toLowerCase() === 'true') {
      opts.logger = true;
      opts.debug = true;
      // opcional: evitar errores TLS en entornos de prueba (NO recomendado en producción)
      opts.tls = opts.tls || {};
      opts.tls.rejectUnauthorized = false;
      console.info('[email] DEBUG_EMAIL=true - transporter options:', { host, port, secure, user: user ? user.replace(/.(?=.{2})/g, '*') : null });
    }
    return nodemailer.createTransport(opts);
  }

  if (gmailUser && gmailPass) {
    // Requiere App Password en cuentas Gmail (ya proporcionado en .env)
    const opts = {
      service: 'gmail',
      auth: { user: gmailUser, pass: gmailPass },
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 15000,
    };
    if (String(process.env.DEBUG_EMAIL).toLowerCase() === 'true') {
      opts.logger = true;
      opts.debug = true;
      opts.tls = opts.tls || {};
      opts.tls.rejectUnauthorized = false;
      console.info('[email] DEBUG_EMAIL=true - Gmail transporter options for user:', gmailUser.replace(/.(?=.{2})/g, '*'));
    }
    return nodemailer.createTransport(opts);
  }

  throw new Error('Email configuration missing: set SMTP_* or EMAIL_USER/EMAIL_PASS');
}

async function sendPasswordResetEmail({ to, link, tipo, displayName }) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@ecopoints.local';
  if (String(process.env.SKIP_EMAIL_SEND).toLowerCase() === 'true') {
    console.warn('[email] SKIP_EMAIL_SEND=true - no se enviará correo. Destinatario:', to);
    return;
  }

  const subject = 'Restablecimiento de contraseña - Waylo';
  const plain = `Hola ${displayName || ''}\n\n` +
    `Recibimos una solicitud para restablecer tu contraseña de ${tipo}.\n` +
    `Usa el siguiente enlace para continuar (válido por 1 hora):\n\n${link}\n\n` +
    `Si no solicitaste este cambio, puedes ignorar este correo.`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="color:#088D7B">Restablecimiento de contraseña</h2>
      <p>Hola ${displayName || ''},</p>
      <p>Recibimos una solicitud para restablecer tu contraseña de <strong>${tipo}</strong>.</p>
      <p>Usa el siguiente botón para continuar (válido por 1 hora):</p>
      <p style="margin: 20px 0;">
        <a href="${link}" style="display:inline-block;background:#088D7B;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:600">Restablecer contraseña</a>
      </p>
      <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
      <p style="word-break:break-all;color:#088D7B"><a href="${link}" style="color:#088D7B">${link}</a></p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#666;font-size:12px">Si no solicitaste este cambio, puedes ignorar este correo.</p>
    </div>
  `;

  // Usar Resend (HTTPS) si hay API key, para evitar bloqueos SMTP en PaaS
  // Prefer SendGrid if available
  if (canUseSendGrid()) {
    console.info('[email] Using SendGrid transport');
    await sendViaSendGrid({ to, subject, text: plain, html });
    return;
  }

  if (canUseResend()) {
    console.info('[email] Using Resend transport');
    await sendViaResend({ to, subject, text: plain, html });
    return;
  }

  // Fallback SMTP
  console.info('[email] Using SMTP/Gmail transport');
  const transporter = createTransporter();
  await transporter.sendMail({ from, to, subject, text: plain, html });
}

async function sendPhotoDeletedEmail({ to, displayName, reason }) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@waylo.local';
  if (String(process.env.SKIP_EMAIL_SEND).toLowerCase() === 'true') {
    console.warn('[email] SKIP_EMAIL_SEND=true - no se enviará correo. Destinatario:', to);
    return;
  }

  const subject = 'Foto eliminada - Waylo';
  const plain = `Hola ${displayName || ''},\n\n` +
    `Una de tus fotos ha sido eliminada por incumplir nuestras políticas de uso.\n\n` +
    `Motivo: ${reason || 'No cumple con las políticas de contenido de Waylo'}\n\n` +
    `Por favor, asegúrate de que todas tus fotos cumplan con nuestras políticas de la plataforma.\n\n` +
    `Si tienes dudas, contáctanos.`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="color:#088D7B">Foto eliminada</h2>
      <p>Hola <strong>${displayName || ''}</strong>,</p>
      <p>Una de tus fotos ha sido eliminada por incumplir nuestras políticas de uso.</p>
      <div style="background:#fff3cd;border-left:4px solid #f39c12;padding:12px;margin:16px 0;border-radius:4px">
        <strong>Motivo:</strong> ${reason || 'No cumple con las políticas de contenido de Waylo'}
      </div>
      <p>Por favor, asegúrate de que todas tus fotos cumplan con nuestras políticas de la plataforma.</p>
      <p>Si tienes dudas sobre nuestras políticas, no dudes en contactarnos.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#666;font-size:12px">Este es un correo automático de Waylo.</p>
    </div>
  `;

  if (canUseSendGrid()) {
    console.info('[email] Using SendGrid transport');
    await sendViaSendGrid({ to, subject, text: plain, html });
    return;
  }

  if (canUseResend()) {
    console.info('[email] Using Resend transport');
    await sendViaResend({ to, subject, text: plain, html });
    return;
  }

  console.info('[email] Using SMTP/Gmail transport');
  const transporter = createTransporter();
  await transporter.sendMail({ from, to, subject, text: plain, html });
}

async function sendGuideApprovedEmail({ to, displayName }) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@waylo.local';
  if (String(process.env.SKIP_EMAIL_SEND).toLowerCase() === 'true') {
    console.warn('[email] SKIP_EMAIL_SEND=true - no se enviará correo. Destinatario:', to);
    return;
  }

  const subject = '¡Cuenta aprobada! - Waylo';
  const plain = `Hola ${displayName || ''},\n\n` +
    `¡Felicitaciones! Tu cuenta de guía ha sido aprobada.\n\n` +
    `Ya puedes acceder a la plataforma Waylo y comenzar a ofrecer tus servicios.\n\n` +
    `¡Bienvenido a Waylo!`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="color:#088D7B">¡Cuenta aprobada!</h2>
      <p>Hola <strong>${displayName || ''}</strong>,</p>
      <div style="background:#d4edda;border-left:4px solid #28a745;padding:12px;margin:16px 0;border-radius:4px">
        <p style="margin:0">¡Felicitaciones! Tu cuenta de guía ha sido <strong>aprobada</strong>.</p>
      </div>
      <p>Ya puedes acceder a la plataforma Waylo y comenzar a ofrecer tus servicios como guía turístico.</p>
      <p>Gracias por unirte a nuestra comunidad. ¡Te deseamos mucho éxito!</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#666;font-size:12px">Este es un correo automático de Waylo.</p>
    </div>
  `;

  if (canUseSendGrid()) {
    console.info('[email] Using SendGrid transport');
    await sendViaSendGrid({ to, subject, text: plain, html });
    return;
  }

  if (canUseResend()) {
    console.info('[email] Using Resend transport');
    await sendViaResend({ to, subject, text: plain, html });
    return;
  }

  console.info('[email] Using SMTP/Gmail transport');
  const transporter = createTransporter();
  await transporter.sendMail({ from, to, subject, text: plain, html });
}

async function sendAccountDeactivatedEmail({ to, displayName, reason }) {
  const from = process.env.EMAIL_FROM || process.env.EMAIL_USER || 'no-reply@waylo.local';
  if (String(process.env.SKIP_EMAIL_SEND).toLowerCase() === 'true') {
    console.warn('[email] SKIP_EMAIL_SEND=true - no se enviará correo. Destinatario:', to);
    return;
  }

  const subject = 'Cuenta desactivada - Waylo';
  const plain = `Hola ${displayName || ''},\n\n` +
    `Tu cuenta ha sido desactivada por el equipo de administración de Waylo.\n\n` +
    `Motivo: ${reason || 'Violación de las políticas de la plataforma'}\n\n` +
    `Si crees que esto es un error o deseas más información, por favor contáctanos.`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2 style="color:#dc3545">Cuenta desactivada</h2>
      <p>Hola <strong>${displayName || ''}</strong>,</p>
      <p>Tu cuenta ha sido desactivada por el equipo de administración de Waylo.</p>
      <div style="background:#f8d7da;border-left:4px solid #dc3545;padding:12px;margin:16px 0;border-radius:4px">
        <strong>Motivo:</strong> ${reason || 'Violación de las políticas de la plataforma'}
      </div>
      <p>Si crees que esto es un error o deseas más información, por favor contáctanos.</p>
      <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
      <p style="color:#666;font-size:12px">Este es un correo automático de Waylo.</p>
    </div>
  `;

  if (canUseSendGrid()) {
    console.info('[email] Using SendGrid transport');
    await sendViaSendGrid({ to, subject, text: plain, html });
    return;
  }

  if (canUseResend()) {
    console.info('[email] Using Resend transport');
    await sendViaResend({ to, subject, text: plain, html });
    return;
  }

  console.info('[email] Using SMTP/Gmail transport');
  const transporter = createTransporter();
  await transporter.sendMail({ from, to, subject, text: plain, html });
}

module.exports = { 
  sendPasswordResetEmail, 
  sendPhotoDeletedEmail, 
  sendGuideApprovedEmail, 
  sendAccountDeactivatedEmail 
};
