const express = require("express");
const multer = require("multer");
const crypto = require("crypto");
const { Resend } = require("resend");

const router = express.Router();

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "contact@itechnebula.com";
const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  "Startup Submit Pool 2026 <onboarding@resend.dev>";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
});

const registrations = [];

function escapeHtml(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function generateRegistrationId() {
  const suffix = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `SPS26-${suffix}`;
}

function parseLookingFor(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function buildAdminEmailHtml(record) {
  const rows = [
    ["Registration ID", record.id],
    ["Startup Name", record.startup_name],
    ["Founder Name", record.founder_name],
    ["Email", record.email],
    ["Mobile", record.mobile],
    ["State", record.state],
    ["District", record.district],
    ["City", record.city],
    ["Stage", record.stage],
    ["Sector", record.sector],
    ["Problem", record.problem],
    ["Target Customers", record.customers],
    ["Team Count", record.team_count],
    ["Co-founders", record.cofounders],
    ["Skills", record.skills],
    ["Registered", record.registered],
    ["Registration Type", record.reg_type],
    ["Registration Number", record.reg_number],
    ["Website", record.website],
    ["LinkedIn", record.linkedin],
    ["Revenue", record.revenue],
    ["Funding", record.funding],
    ["Looking For", (record.looking_for || []).join(", ")],
    ["Investment Needed", record.investment],
    ["Demo Link", record.demo_link],
    ["Pitch Deck", record.pitch_file_name || "Not uploaded"],
    ["Logo", record.logo_file_name || "Not uploaded"],
    ["Submitted At", record.createdAt],
  ];

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border:1px solid #e5e7eb;font-weight:600;background:#f9fafb">${escapeHtml(label)}</td><td style="padding:8px 12px;border:1px solid #e5e7eb">${escapeHtml(value || "-")}</td></tr>`
    )
    .join("");

  return `
    <div style="font-family:Arial,sans-serif;max-width:720px;margin:0 auto;color:#111">
      <h2 style="color:#059669">New Startup Registration — Startup Pool 2026</h2>
      <p>A new startup applied via the <strong>Apply to Pitch</strong> form.</p>
      <table style="width:100%;border-collapse:collapse;margin-top:16px">${tableRows}</table>
    </div>
  `;
}

router.post(
  "/register-startup",
  upload.fields([
    { name: "pitch_file", maxCount: 1 },
    { name: "logo_file", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const formData = req.body || {};
      const files = req.files || {};
      const { startup_name, founder_name, email, mobile } = formData;

      if (!startup_name?.trim() || !founder_name?.trim() || !email?.trim() || !mobile?.trim()) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields (startup_name, founder_name, email, mobile)",
        });
      }

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        return res.status(400).json({ success: false, message: "Valid email is required" });
      }

      if (!/^[6-9]\d{9}$/.test(String(mobile).trim())) {
        return res.status(400).json({ success: false, message: "Valid 10-digit mobile number is required" });
      }

      const pitchFile = files.pitch_file?.[0] || null;
      const logoFile = files.logo_file?.[0] || null;

      if (!pitchFile) {
        return res.status(400).json({ success: false, message: "Pitch deck PDF is required" });
      }

      let registrationId;
      do {
        registrationId = generateRegistrationId();
      } while (registrations.some((r) => r.id === registrationId));

      const record = {
        id: registrationId,
        ...formData,
        looking_for: parseLookingFor(formData.looking_for),
        pitch_file_name: pitchFile.originalname,
        logo_file_name: logoFile?.originalname || null,
        createdAt: new Date().toISOString(),
      };
      registrations.push(record);

      let adminEmailSent = false;
      let userEmailSent = false;

      if (resend) {
        const adminAttachments = [];
        if (pitchFile?.buffer) {
          adminAttachments.push({
            filename: pitchFile.originalname || "pitch-deck.pdf",
            content: pitchFile.buffer,
          });
        }
        if (logoFile?.buffer) {
          adminAttachments.push({
            filename: logoFile.originalname || "logo",
            content: logoFile.buffer,
          });
        }

        const adminResult = await resend.emails.send({
          from: FROM_EMAIL,
          to: ADMIN_EMAIL,
          subject: `New Startup Registration — ${startup_name} (${registrationId})`,
          html: buildAdminEmailHtml(record),
          attachments: adminAttachments.length ? adminAttachments : undefined,
        });

        if (adminResult.error) {
          console.error("❌ Admin email error:", adminResult.error);
        } else {
          adminEmailSent = true;
          console.log("📨 Admin notification sent:", adminResult.data?.id);
        }

        const userResult = await resend.emails.send({
          from: FROM_EMAIL,
          to: email.trim(),
          subject: `Your Startup Registration ID — ${registrationId}`,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #e5e7eb;border-radius:12px">
              <h2 style="color:#059669">Registration Received ✅</h2>
              <p>Hi ${escapeHtml(founder_name)},</p>
              <p>Thanks for registering <strong>${escapeHtml(startup_name)}</strong> for Startup Submit Pool 2026.</p>
              <p style="margin:20px 0">Your Startup Registration ID is:<br/>
                <span style="display:inline-block;margin-top:8px;font-size:20px;font-weight:bold;background:#ecfdf5;color:#065f46;padding:8px 16px;border-radius:8px">${registrationId}</span>
              </p>
              <p>Please save this ID — you'll need it to complete your registration.</p>
            </div>
          `,
        });

        if (userResult.error) {
          console.error("❌ User email error:", userResult.error);
        } else {
          userEmailSent = true;
        }
      } else {
        console.error("❌ RESEND_API_KEY missing — registration saved, emails skipped");
      }

      return res.status(200).json({
        success: true,
        registrationId,
        adminEmailSent,
        emailSent: userEmailSent,
        message: adminEmailSent
          ? "Registration successful."
          : "Registration saved. Admin notification email could not be sent — your ID is shown on screen.",
      });
    } catch (err) {
      console.error("❌ REGISTER STARTUP ERROR:", err);
      return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    }
  }
);

module.exports = router;
