// src/utils/email.js
import nodemailer from "nodemailer";

function createTransporter() {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP_USER y SMTP_PASS son requeridos para enviar emails");
  }

  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const port = Number(process.env.SMTP_PORT) || 587;

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT_MS) || 4000,
    greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT_MS) || 4000,
    socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT_MS) || 8000,
  });
}

function buildResetEmailHtml({ resetLink, nombre }) {
  const greeting = nombre
    ? `, <strong style="color:#1e293b;">${nombre}</strong>`
    : "";

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Restablecé tu contraseña — IPT</title>
</head>
<body style="margin:0;padding:0;background-color:#f0f4f0;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f4f0;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.10);">

          <!-- ===== HEADER ===== -->
          <tr>
            <td style="background-color:#166534;padding:36px 40px;text-align:center;">
              <div style="color:#ffffff;font-size:40px;font-weight:800;letter-spacing:3px;line-height:1;">IPT</div>
              <div style="color:#bbf7d0;font-size:13px;margin-top:8px;letter-spacing:0.5px;">Instituto Provincial del Tabaco</div>
              <div style="color:#86efac;font-size:12px;margin-top:2px;">Goya, Corrientes — Argentina</div>
            </td>
          </tr>

          <!-- Accent bar -->
          <tr>
            <td style="height:4px;background:linear-gradient(90deg,#15803d 0%,#4ade80 50%,#15803d 100%);"></td>
          </tr>

          <!-- ===== BODY ===== -->
          <tr>
            <td style="padding:40px 40px 32px;">

              <h1 style="margin:0 0 20px;font-size:22px;font-weight:700;color:#1e293b;">
                Restablecé tu contraseña
              </h1>

              <p style="margin:0 0 6px;font-size:15px;color:#475569;line-height:1.7;">
                Hola${greeting}:
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#475569;line-height:1.7;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta en el
                <strong style="color:#166534;">Panel de Administración del IPT</strong>.
                Si fuiste vos, hacé clic en el botón de abajo para continuar.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" style="margin:0 auto 32px;">
                <tr>
                  <td align="center" style="background-color:#166534;border-radius:10px;box-shadow:0 4px 14px rgba(22,101,52,0.40);">
                    <a href="${resetLink}"
                       target="_blank"
                       style="display:block;padding:16px 48px;color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;letter-spacing:0.3px;white-space:nowrap;">
                      Restablecer contraseña
                    </a>
                  </td>
                </tr>
              </table>

              <!-- Expiry notice -->
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:28px;">
                <tr>
                  <td style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:14px 16px;text-align:center;">
                    <p style="margin:0;font-size:13px;color:#15803d;">
                      ⏱&nbsp; Este enlace vence en <strong>1 hora</strong> por razones de seguridad.
                    </p>
                  </td>
                </tr>
              </table>

              <!-- Security note -->
              <p style="margin:0 0 24px;font-size:13px;color:#94a3b8;text-align:center;line-height:1.7;">
                Si no solicitaste este cambio, podés ignorar este correo.<br />
                Tu contraseña <strong>no se modificará</strong>.
              </p>

              <hr style="border:none;border-top:1px solid #e2e8f0;margin:0 0 20px;" />

              <!-- Fallback link -->
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">
                Si el botón no funciona, copiá y pegá este enlace en tu navegador:
              </p>
              <p style="margin:0;font-size:12px;word-break:break-all;">
                <a href="${resetLink}" style="color:#166534;text-decoration:underline;">${resetLink}</a>
              </p>
            </td>
          </tr>

          <!-- ===== FOOTER ===== -->
          <tr>
            <td style="background:#f8fafc;padding:22px 40px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 4px;font-size:12px;color:#94a3b8;">
                © 2026 Instituto Provincial del Tabaco — Goya, Corrientes
              </p>
              <p style="margin:0;font-size:12px;color:#cbd5e1;">
                Panel de Administración · Sistema de Gestión de Lotes
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function buildResetEmailText({ resetLink, nombre }) {
  return [
    `Hola${nombre ? ` ${nombre}` : ""}:`,
    "",
    "Recibimos una solicitud para restablecer la contraseña de tu cuenta en el Panel de Administración del IPT.",
    "",
    "Para continuar ingresá al siguiente enlace (válido por 1 hora):",
    resetLink,
    "",
    "Si no solicitaste este cambio, podés ignorar este correo. Tu contraseña no se modificará.",
    "",
    "— Instituto Provincial del Tabaco, Goya, Corrientes",
  ].join("\n");
}

export async function sendResetPasswordEmail({ to, resetLink, nombre = null }) {
  const transporter = createTransporter();
  const from =
    process.env.SMTP_FROM ||
    `"IPT Sistema de Lotes" <${process.env.SMTP_USER}>`;

  await transporter.sendMail({
    from,
    to,
    subject: "Restablecé tu contraseña — Panel IPT",
    html: buildResetEmailHtml({ resetLink, nombre }),
    text: buildResetEmailText({ resetLink, nombre }),
  });
}
