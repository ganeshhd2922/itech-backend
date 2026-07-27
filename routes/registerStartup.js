const express = require("express");
const multer = require("multer");
const { Resend } = require("resend");

const router = express.Router();

// ✅ Uses the same RESEND_API_KEY you already have configured
const resend = new Resend(process.env.RESEND_API_KEY);

/* =========================================================
   MULTER CONFIG — parses multipart/form-data (needed because
   the frontend sends files via FormData: pitch_file, logo_file)
   ---------------------------------------------------------
   Using memoryStorage so files stay in RAM as buffers
   (req.files.pitch_file[0].buffer) — good for small files /
   forwarding to email or cloud storage. Switch to diskStorage
   if you want them saved to disk instead.
========================================================= */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB per file
});

/* =========================================================
   IN-MEMORY STORE (placeholder)
   ---------------------------------------------------------
   Replace this with a real database (MongoDB/Postgres/etc.)
   so registrations survive a server restart / redeploy.
========================================================= */
const registrations = [];

/* =========================================================
   Helper: generate a registration ID like ISP-2026-4F82K1
========================================================= */
function generateRegistrationId() {
  const year = new Date().getFullYear();
  const random = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `ISP-${year}-${random}`;
}

/* =========================================================
   POST /register-startup
   ---------------------------------------------------------
   Accepts the registration form data (multipart/form-data,
   including pitch_file / logo_file uploads), generates a
   unique Registration ID, stores it, emails it to the user
   via Resend, and returns it to the frontend.
========================================================= */
router.post(
  "/register-startup",
  // ✅ multer parses the multipart form — text fields land in req.body,
  //    uploaded files land in req.files.pitch_file / req.files.logo_file
  upload.fields([
    { name: "pitch_file", maxCount: 1 },
    { name: "logo_file", maxCount: 1 },
  ]),
  async (req, res) => {
    try {
      const formData = req.body || {};
      const files = req.files || {};

      // 🔍 Debug logs — remove/comment out once everything works
      console.log("📥 Body received:", formData);
      console.log(
        "📎 Files received:",
        Object.keys(files).map((k) => `${k}: ${files[k][0]?.originalname}`)
      );

      const { startup_name, founder_name, email, mobile } = formData;

      if (!startup_name || !founder_name || !email || !mobile) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields (startup_name, founder_name, email, mobile)",
        });
      }

      if (!process.env.RESEND_API_KEY) {
        console.error("❌ RESEND_API_KEY missing");
        return res.status(500).json({
          success: false,
          message: "Email service is not configured",
        });
      }

      // Generate a unique registration ID (retry on the rare collision)
      let registrationId;
      do {
        registrationId = generateRegistrationId();
      } while (registrations.some((r) => r.id === registrationId));

      // ✅ "looking_for" arrives as a JSON string from the frontend
      //    (payload.append("looking_for", JSON.stringify(value))) — parse it back
      let lookingFor = [];
      if (formData.looking_for) {
        try {
          lookingFor = JSON.parse(formData.looking_for);
        } catch {
          lookingFor = [];
        }
      }

      // ✅ Basic file info saved with the record (buffers themselves are
      //    NOT stored here — swap in real file storage / DB for that)
      const pitchFile = files.pitch_file ? files.pitch_file[0] : null;
      const logoFile = files.logo_file ? files.logo_file[0] : null;

      const record = {
        id: registrationId,
        ...formData,
        looking_for: lookingFor,
        pitch_file_name: pitchFile ? pitchFile.originalname : null,
        logo_file_name: logoFile ? logoFile.originalname : null,
        createdAt: new Date().toISOString(),
      };
      registrations.push(record); // 🔁 replace with a real DB insert

      console.log("📝 New registration:", registrationId, "-", startup_name);

      // ── Send the Registration ID to the user's email via Resend ──
      const { data, error } = await resend.emails.send({
        from: process.env.RESEND_FROM_EMAIL || "Startup Submit Pool 2026 <onboarding@resend.dev>",
        to: email,
        subject: "Your Startup Registration ID – Startup Submit Pool 2026",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto; padding: 24px; border: 1px solid #e5e7eb; border-radius: 12px;">
            <h2 style="color: #059669;">Registration Received ✅</h2>
            <p>Hi ${founder_name},</p>
            <p>Thanks for registering <strong>${startup_name}</strong> for Startup Submit Pool 2026.</p>
            <p style="margin: 20px 0;">
              Your Startup Registration ID is:
              <br />
              <span style="display:inline-block; margin-top:8px; font-size: 20px; font-weight: bold; letter-spacing: 1px; background:#ecfdf5; color:#065f46; padding: 8px 16px; border-radius: 8px;">
                ${registrationId}
              </span>
            </p>
            <p>Please keep this ID safe — you'll need it on the payment page to complete your registration.</p>
            <p style="margin-top: 24px; color:#6b7280; font-size: 13px;">If you didn't request this, you can ignore this email.</p>
          </div>
        `,
      });

      if (error) {
        console.error("❌ RESEND EMAIL ERROR:", error);
        // Registration is still saved even if the email fails — don't lose the data.
        return res.status(200).json({
          success: true,
          registrationId,
          message: "Registered, but the confirmation email couldn't be sent. Please note your ID.",
        });
      }

      console.log("📨 Registration email sent:", data && data.id);

      return res.status(200).json({
        success: true,
        registrationId,
        message: "Registration successful. Check your email for your Registration ID.",
      });
    } catch (err) {
      console.error("❌ REGISTER STARTUP ERROR:", err.message);
      return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again.",
      });
    }
  }
);

module.exports = router;