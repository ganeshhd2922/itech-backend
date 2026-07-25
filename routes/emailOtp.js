const express = require("express");
const nodemailer = require("nodemailer");

const router = express.Router();

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

// ✅ Server start hote hi check kar lo ki Gmail credentials sahi hain ya nahi
transporter.verify((err, success) => {
  if (err) {
    console.error("❌ MAIL TRANSPORTER ERROR — Gmail login check karo:", err.message);
  } else {
    console.log("✅ Mail transporter ready");
  }
});

const ADMIN_EMAIL = process.env.ADMIN_EMAIL || "info@itechnebula.com";

// ✅ Teeno forms ke alag-alag ebook links
const EBOOK_LINKS = {
  ebook: {
    link: process.env.EBOOK_LINK_EBOOK,
    title: "12 Insider Trade-Secrets Report",
  },
  facebook: {
    link: process.env.EBOOK_LINK_FACEBOOK,
    title: "Facebook Ads Secrets Report",
  },
  google: {
    link: process.env.EBOOK_LINK_GOOGLE,
    title: "Google Ads Secrets Report",
  },
};

/* =========================================================
   HELPERS
========================================================= */

// Prevent HTML/XSS injection when echoing user input back into emails
function escapeHtml(value) {
  if (value === undefined || value === null) return "";
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return typeof email === "string" && EMAIL_REGEX.test(email.trim());
}

router.post("/send-ebook", async (req, res) => {
  try {
    let {
      name, email, phone, businessName, nature,
      stateName, city, website, revenue, adSpend,
      description, obstacle, timeline, heardFrom,
      formType, // ✅ "ebook" | "facebook" | "google"
    } = req.body;

    // Trim basic string fields defensively
    name = typeof name === "string" ? name.trim() : name;
    email = typeof email === "string" ? email.trim() : email;
    phone = typeof phone === "string" ? phone.trim() : phone;
    formType = typeof formType === "string" ? formType.trim() : formType;

    console.log("📩 Incoming Request:", req.body);

    if (!name || !email) {
      return res.status(400).json({
        success: false,
        message: "Name and email are required",
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        success: false,
        message: "Invalid email address",
      });
    }

    const ebook = EBOOK_LINKS[formType];

    if (!ebook || !ebook.link) {
      console.error("❌ Invalid or missing formType:", formType);
      return res.status(400).json({
        success: false,
        message: "Invalid form type or ebook link not configured",
      });
    }

    // Escaped copies for safe HTML interpolation
    const safe = {
      name: escapeHtml(name),
      email: escapeHtml(email),
      phone: escapeHtml(phone),
      businessName: escapeHtml(businessName),
      nature: escapeHtml(nature),
      stateName: escapeHtml(stateName),
      city: escapeHtml(city),
      website: escapeHtml(website),
      revenue: escapeHtml(revenue),
      adSpend: escapeHtml(adSpend),
      description: escapeHtml(description),
      obstacle: escapeHtml(obstacle),
      timeline: escapeHtml(timeline),
      heardFrom: escapeHtml(heardFrom),
      formType: escapeHtml(formType),
    };

    // ✅ Dono emails simultaneously bhejo
    const [userMailResult, adminMailResult] = await Promise.allSettled([

      // USER EMAIL — jo email USER NE FORM MEIN DAALA, usi pe sahi wali PDF ka link
      transporter.sendMail({
        from: `"iTechnebula" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: `Your Free Ebook: ${ebook.title} 🚀`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 32px; background: #ffffff;">

            <h2 style="color: #84cc16; margin-bottom: 8px;">Hello ${safe.name} 👋</h2>
            <p style="color: #444; font-size: 15px;">Thank you for reaching out! Your free ebook is ready to download.</p>

            <div style="text-align: center; margin: 32px 0;">
              <a href="${ebook.link}"
                style="background: #84cc16; color: #000000; padding: 14px 36px;
                border-radius: 8px; text-decoration: none; font-weight: bold;
                font-size: 16px; display: inline-block;">
                📥 Download Your Free Ebook
              </a>
            </div>

            <p style="color: #444; font-size: 15px;">Our team will contact you shortly at <strong>${safe.phone || "your number"}</strong> to discuss your growth strategy.</p>

            <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
            <p style="color: #999; font-size: 12px;">— Team iTechnebula</p>
          </div>
        `,
      }),

      // ADMIN EMAIL — itechnebula.com wale mail pe saari lead details
      transporter.sendMail({
        from: `"iTechnebula Leads" <${process.env.EMAIL_USER}>`,
        to: ADMIN_EMAIL,
        replyTo: email,
        subject: `🔥 New Lead (${ebook.title}): ${name} — ${businessName || "N/A"}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; border: 1px solid #eee; padding: 24px; border-radius: 8px;">
            <h2 style="color: #84cc16;">New Lead — ${escapeHtml(ebook.title)} 🚀</h2>
            <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
              <tr style="background: #f9f9f9;"><td style="padding: 10px; font-weight: bold; width: 40%;">Full Name</td><td style="padding: 10px;">${safe.name || "—"}</td></tr>
              <tr><td style="padding: 10px; font-weight: bold;">Email</td><td style="padding: 10px;">${safe.email || "—"}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 10px; font-weight: bold;">Phone</td><td style="padding: 10px;">${safe.phone || "—"}</td></tr>
              <tr><td style="padding: 10px; font-weight: bold;">Company</td><td style="padding: 10px;">${safe.businessName || "—"}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 10px; font-weight: bold;">Website</td><td style="padding: 10px;">${safe.website || "—"}</td></tr>
              <tr><td style="padding: 10px; font-weight: bold;">Location</td><td style="padding: 10px;">${safe.city || safe.stateName || "—"}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 10px; font-weight: bold;">Business Type</td><td style="padding: 10px;">${safe.nature || "—"}</td></tr>
              <tr><td style="padding: 10px; font-weight: bold;">Monthly Revenue</td><td style="padding: 10px;">${safe.revenue || "—"}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 10px; font-weight: bold;">Monthly Ad Spend</td><td style="padding: 10px;">${safe.adSpend || "—"}</td></tr>
              <tr><td style="padding: 10px; font-weight: bold;">Business Description</td><td style="padding: 10px;">${safe.description || "—"}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 10px; font-weight: bold;">Main Obstacle</td><td style="padding: 10px;">${safe.obstacle || "—"}</td></tr>
              <tr><td style="padding: 10px; font-weight: bold;">Timeline</td><td style="padding: 10px;">${safe.timeline || "—"}</td></tr>
              <tr style="background: #f9f9f9;"><td style="padding: 10px; font-weight: bold;">Heard From</td><td style="padding: 10px;">${safe.heardFrom || "—"}</td></tr>
              <tr><td style="padding: 10px; font-weight: bold;">Form Type</td><td style="padding: 10px;">${safe.formType || "—"}</td></tr>
            </table>
          </div>
        `,
      }),

    ]);

    // ✅ Log results — asli error surface hoga, chhupega nahi
    let userMailFailed = false;

    if (userMailResult.status === "rejected") {
      userMailFailed = true;
      console.error("❌ USER MAIL ERROR:", userMailResult.reason?.message);
    } else {
      console.log("✅ User email sent to:", email);
    }

    if (adminMailResult.status === "rejected") {
      console.error("❌ ADMIN MAIL ERROR:", adminMailResult.reason?.message);
    } else {
      console.log("✅ Admin email sent to:", ADMIN_EMAIL);
    }

    // ✅ Agar user mail fail hui, toh galat "success" nahi bhejenge
    if (userMailFailed) {
      return res.status(500).json({
        success: false,
        message: "Failed to send ebook to your email. Please try again.",
      });
    }

    return res.json({
      success: true,
      message: "Form submitted successfully",
    });

  } catch (err) {
    console.error("❌ FINAL ERROR:", err.message);
    if (!res.headersSent) {
      return res.status(500).json({
        success: false,
        message: err.message || "Server error",
      });
    }
  }
});

module.exports = router;