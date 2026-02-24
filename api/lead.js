"use strict";

const EMAIL_API_URL = "https://api.resend.com/emails";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function parseBody(rawBody) {
  if (!rawBody) {
    return {};
  }

  if (typeof rawBody === "string") {
    try {
      return JSON.parse(rawBody);
    } catch (_error) {
      return {};
    }
  }

  if (typeof rawBody === "object") {
    return rawBody;
  }

  return {};
}

function isValidPayload(payload) {
  const name = String(payload.name || "").trim();
  const email = String(payload.email || "").trim();
  const projectType = String(payload.projectType || "").trim();
  const message = String(payload.message || "").trim();
  const rodoConsent = payload.rodoConsent === true;

  if (!name || !email || !projectType || !message || !rodoConsent) {
    return false;
  }

  return EMAIL_PATTERN.test(email);
}

function getEmailContent(payload) {
  const data = {
    name: escapeHtml(String(payload.name || "").trim()),
    email: escapeHtml(String(payload.email || "").trim()),
    phone: escapeHtml(String(payload.phone || "").trim() || "-"),
    projectType: escapeHtml(String(payload.projectType || "").trim()),
    area: escapeHtml(String(payload.area || "").trim() || "-"),
    message: escapeHtml(String(payload.message || "").trim())
  };

  const subject = `Nowy lead - ${data.name}`;
  const text = [
    "Nowe zapytanie ze strony sternik-squad.vercel.app",
    `Imię i nazwisko: ${data.name}`,
    `E-mail: ${data.email}`,
    `Telefon: ${data.phone}`,
    `Typ inwestycji: ${data.projectType}`,
    `Orientacyjna powierzchnia: ${data.area}`,
    "",
    "Wiadomość:",
    data.message
  ].join("\n");

  const html = `
    <h2>Nowe zapytanie ze strony sternik-squad.vercel.app</h2>
    <p><strong>Imię i nazwisko:</strong> ${data.name}</p>
    <p><strong>E-mail:</strong> ${data.email}</p>
    <p><strong>Telefon:</strong> ${data.phone}</p>
    <p><strong>Typ inwestycji:</strong> ${data.projectType}</p>
    <p><strong>Orientacyjna powierzchnia:</strong> ${data.area}</p>
    <p><strong>Wiadomość:</strong><br>${data.message.replace(/\n/g, "<br>")}</p>
  `.trim();

  return { subject, text, html };
}

module.exports = async (req, res) => {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ ok: false, error: "validation_error" });
  }

  const payload = parseBody(req.body);

  if (!isValidPayload(payload)) {
    return res.status(400).json({ ok: false, error: "validation_error" });
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const leadToEmail = process.env.LEAD_TO_EMAIL;
  const leadFromEmail = process.env.LEAD_FROM_EMAIL;

  if (!resendApiKey || !leadToEmail || !leadFromEmail) {
    return res.status(500).json({ ok: false, error: "server_error" });
  }

  const { subject, text, html } = getEmailContent(payload);

  try {
    const response = await fetch(EMAIL_API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        from: leadFromEmail,
        to: leadToEmail,
        subject,
        text,
        html
      })
    });

    if (!response.ok) {
      return res.status(500).json({ ok: false, error: "server_error" });
    }

    return res.status(200).json({ ok: true });
  } catch (_error) {
    return res.status(500).json({ ok: false, error: "server_error" });
  }
};
