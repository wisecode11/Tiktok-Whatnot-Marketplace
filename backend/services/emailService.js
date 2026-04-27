const nodemailer = require("nodemailer");

let transporterPromise = null;

function isSmtpConfigured() {
  return Boolean(
    process.env.SMTP_HOST &&
    process.env.SMTP_PORT &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS,
  );
}

function getNormalizedSmtpAuth() {
  return {
    user: (process.env.SMTP_USER || "").trim(),
    // Gmail app passwords are sometimes pasted with spaces; normalize safely.
    pass: (process.env.SMTP_PASS || "").replace(/\s+/g, ""),
  };
}

function getTransporter() {
  if (!isSmtpConfigured()) {
    return null;
  }

  const smtpAuth = getNormalizedSmtpAuth();

  if (!transporterPromise) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: Number(process.env.SMTP_PORT) === 465,
        auth: smtpAuth,
      }),
    );
  }

  return transporterPromise;
}

async function sendStaffWelcomeEmail({ to, password, loginUrl, streamerName }) {
  const transporter = await getTransporter();

  if (!transporter) {
    throw new Error("SMTP is not configured.");
  }

  // Ensure we can reach/authenticate with the SMTP server before attempting to send.
  // This satisfies the "check SMTP is connected successfully" requirement.
  try {
    await transporter.verify();
  } catch (error) {
    const message = error && error.message ? error.message : "Unable to connect to SMTP server.";
    throw new Error(`SMTP connection failed: ${message}`);
  }

  const subjectStreamerName = (typeof streamerName === "string" && streamerName.trim())
    ? streamerName.trim()
    : "Streamer";

  return transporter.sendMail({
    from: process.env.EMAIL_FROM_NAME
      ? `"${process.env.EMAIL_FROM_NAME}" <${process.env.EMAIL_FROM}>`
      : process.env.EMAIL_FROM,
    replyTo: process.env.EMAIL_REPLY_TO || process.env.EMAIL_FROM,
    to,
    subject: `You're Invited to Marketplace Hub ${subjectStreamerName} as Staff`,
    text: [
      "Marketplace Hub invited you to join the Staff Dashboard.",
      `Email: ${to}`,
      `Password: ${password}`,
      `Login URL: ${loginUrl}`,
    ].join("\n"),
    html: [
      "<p>Marketplace Hub invited you to join the <strong>Staff Dashboard</strong>.</p>",
      `<p><strong>Email:</strong> ${to}</p>`,
      `<p><strong>Password:</strong> ${password}</p>`,
      `<p><strong>Login URL:</strong> <a href=\"${loginUrl}\">${loginUrl}</a></p>`,
    ].join(""),
  });
}

function getEmailDeliveryErrorMessage(error) {
  if (!error) {
    return "Unable to send the welcome email."
  }

  if (error.code === "EAUTH") {
    return "SMTP login failed. Check SMTP_USER and SMTP_PASS in backend .env."
  }

  if (error.responseCode === 535) {
    return "SMTP credentials were rejected by Gmail. Check the Gmail app password in backend .env."
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return "Unable to send the welcome email."
}

module.exports = {
  getEmailDeliveryErrorMessage,
  sendStaffWelcomeEmail,
};