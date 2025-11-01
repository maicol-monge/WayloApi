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

  const subject = 'Restablecimiento de contraseña - EcoPoints';
  const plain = `Hola ${displayName || ''}\n\n` +
    `Recibimos una solicitud para restablecer tu contraseña de ${tipo}.\n` +
    `Usa el siguiente enlace para continuar (válido por 1 hora):\n\n${link}\n\n` +
    `Si no solicitaste este cambio, puedes ignorar este correo.`;

  const html = `
    <div style="font-family:Arial,sans-serif;line-height:1.5;color:#111">
      <h2>Restablecimiento de contraseña</h2>
      <p>Hola ${displayName || ''},</p>
      <p>Recibimos una solicitud para restablecer tu contraseña de <strong>${tipo}</strong>.</p>
      <p>Usa el siguiente botón para continuar (válido por 1 hora):</p>
      <p>
        <a href="${link}" style="background:#16a34a;color:#fff;padding:10px 16px;border-radius:6px;text-decoration:none">
          Restablecer contraseña
        </a>
      </p>
      <p>Si el botón no funciona, copia y pega este enlace en tu navegador:</p>
      <p><a href="${link}">${link}</a></p>
      <hr/>
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

module.exports = { sendPasswordResetEmail };
