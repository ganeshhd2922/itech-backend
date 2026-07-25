const express = require("express");
const { Resend } = require("resend");

const router = express.Router();

/* =========================================================
   RESEND CONFIG
========================================================= */

if (!process.env.RESEND_API_KEY) {
  console.error("❌ RESEND_API_KEY missing");
}

const resend = new Resend(process.env.RESEND_API_KEY);

const ADMIN_EMAIL =
  process.env.ADMIN_EMAIL || "itechnebula@gmail.com";

/*
 IMPORTANT:
 Agar itechnebula.com Resend me verified hai:
   iTechnebula <noreply@itechnebula.com>

 Testing ke liye:
   iTechnebula <onboarding@resend.dev>
*/

const FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL ||
  "iTechnebula <noreply@itechnebula.com>";

/* =========================================================
   REPORT LINKS
========================================================= */

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

  strategy: {
    link: process.env.EBOOK_LINK_EBOOK,
    title: "Strategy Consultation",
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

/* =========================================================
   SEND EBOOK / REPORT / STRATEGY
========================================================= */

router.post("/send-ebook", async (req, res) => {
  try {
    let {
      name,
      email,
      phone,
      businessName,
      nature,
      stateName,
      city,
      website,
      revenue,
      adSpend,
      description,
      obstacle,
      timeline,
      heardFrom,
      formType,
    } = req.body;

    // Trim basic string fields defensively
    name = typeof name === "string" ? name.trim() : name;
    email = typeof email === "string" ? email.trim() : email;
    phone = typeof phone === "string" ? phone.trim() : phone;
    formType = typeof formType === "string" ? formType.trim() : formType;

    console.log("========================================");
    console.log("📩 Incoming Form Request");
    console.log("Name:", name);
    console.log("Email:", email);
    console.log("Form Type:", formType);
    console.log("========================================");

    /* =====================================================
       VALIDATION
    ===================================================== */

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

    if (!formType) {
      return res.status(400).json({
        success: false,
        message: "Form type is required",
      });
    }

    const ebook = EBOOK_LINKS[formType];

    if (!ebook) {
      console.error("❌ Invalid formType:", formType);

      return res.status(400).json({
        success: false,
        message: `Invalid form type: ${formType}`,
      });
    }

    /*
      Strategy form ko report ki zarurat nahi.
      Baaki 3 forms ke liye link required hai.
    */

    if (formType !== "strategy" && !ebook.link) {
      console.error(
        `❌ Report link missing for: ${formType}`
      );

      return res.status(500).json({
        success: false,
        message: `Report link not configured for ${formType}`,
      });
    }

    // Escaped copies for safe HTML interpolation
    const safe = {
      name: escapeHtml(name),
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
      email: escapeHtml(email),
    };

    /* =====================================================
       USER EMAIL HTML
    ===================================================== */

    let userEmailSubject;
    let userEmailHtml;

    if (formType === "strategy") {
      userEmailSubject =
        "We Received Your Strategy Request 🚀";

      userEmailHtml = `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: auto;
            padding: 32px;
            background: #ffffff;
          "
        >

          <h2 style="color:#84cc16;">
            Hello ${safe.name} 👋
          </h2>

          <p
            style="
              color:#444;
              font-size:15px;
              line-height:1.7;
            "
          >
            Thank you for submitting your strategy
            consultation request.
          </p>

          <p
            style="
              color:#444;
              font-size:15px;
              line-height:1.7;
            "
          >
            We've received your business details and
            our team will review them shortly.
          </p>

          <p
            style="
              color:#444;
              font-size:15px;
              line-height:1.7;
            "
          >
            Our team will contact you at
            <strong>${safe.phone || "your provided number"}</strong>.
          </p>

          <hr
            style="
              border:none;
              border-top:1px solid #eee;
              margin:24px 0;
            "
          />

          <p
            style="
              color:#999;
              font-size:12px;
            "
          >
            — Team iTechnebula
          </p>

        </div>
      `;
    } else {
      userEmailSubject =
        `Your Free Report: ${ebook.title} 🚀`;

      userEmailHtml = `
        <div
          style="
            font-family: Arial, sans-serif;
            max-width: 600px;
            margin: auto;
            padding: 32px;
            background: #ffffff;
          "
        >

          <h2 style="color:#84cc16;">
            Hello ${safe.name} 👋
          </h2>

          <p
            style="
              color:#444;
              font-size:15px;
              line-height:1.7;
            "
          >
            Thank you for reaching out!
          </p>

          <p
            style="
              color:#444;
              font-size:15px;
              line-height:1.7;
            "
          >
            Your free
            <strong>${escapeHtml(ebook.title)}</strong>
            is ready to download.
          </p>

          <div
            style="
              text-align:center;
              margin:32px 0;
            "
          >

            <a
              href="${ebook.link}"
              style="
                background:#84cc16;
                color:#000;
                padding:14px 36px;
                border-radius:8px;
                text-decoration:none;
                font-weight:bold;
                display:inline-block;
              "
            >
              📥 Download Your Free Report
            </a>

          </div>

          <p
            style="
              color:#444;
              font-size:15px;
              line-height:1.7;
            "
          >
            Our team will contact you shortly at
            <strong>${safe.phone || "your provided number"}</strong>
            to discuss your growth strategy.
          </p>

          <hr
            style="
              border:none;
              border-top:1px solid #eee;
              margin:24px 0;
            "
          />

          <p
            style="
              color:#999;
              font-size:12px;
            "
          >
            — Team iTechnebula
          </p>

        </div>
      `;
    }

    /* =====================================================
       ADMIN EMAIL
    ===================================================== */

    const adminSubject =
      formType === "strategy"
        ? `🔥 New Strategy Lead: ${name} — ${
            businessName || "N/A"
          }`
        : `🔥 New Lead (${ebook.title}): ${name} — ${
            businessName || "N/A"
          }`;

    const adminHtml = `
      <div
        style="
          font-family:Arial,sans-serif;
          max-width:650px;
          margin:auto;
          border:1px solid #eee;
          padding:24px;
          border-radius:8px;
        "
      >

        <h2 style="color:#84cc16;">
          ${
            formType === "strategy"
              ? "New Strategy Form Lead 🚀"
              : `New ${escapeHtml(ebook.title)} Lead 🚀`
          }
        </h2>

        <table
          style="
            width:100%;
            border-collapse:collapse;
            font-size:14px;
          "
        >

          <tr style="background:#f9f9f9;">
            <td style="padding:10px;font-weight:bold;">
              Full Name
            </td>
            <td style="padding:10px;">
              ${safe.name || "—"}
            </td>
          </tr>

          <tr>
            <td style="padding:10px;font-weight:bold;">
              Email
            </td>
            <td style="padding:10px;">
              ${safe.email || "—"}
            </td>
          </tr>

          <tr style="background:#f9f9f9;">
            <td style="padding:10px;font-weight:bold;">
              Phone
            </td>
            <td style="padding:10px;">
              ${safe.phone || "—"}
            </td>
          </tr>

          <tr>
            <td style="padding:10px;font-weight:bold;">
              Company
            </td>
            <td style="padding:10px;">
              ${safe.businessName || "—"}
            </td>
          </tr>

          <tr style="background:#f9f9f9;">
            <td style="padding:10px;font-weight:bold;">
              Website
            </td>
            <td style="padding:10px;">
              ${safe.website || "—"}
            </td>
          </tr>

          <tr>
            <td style="padding:10px;font-weight:bold;">
              Location
            </td>
            <td style="padding:10px;">
              ${safe.city || safe.stateName || "—"}
            </td>
          </tr>

          <tr style="background:#f9f9f9;">
            <td style="padding:10px;font-weight:bold;">
              Business Type
            </td>
            <td style="padding:10px;">
              ${safe.nature || "—"}
            </td>
          </tr>

          <tr>
            <td style="padding:10px;font-weight:bold;">
              Monthly Revenue
            </td>
            <td style="padding:10px;">
              ${safe.revenue || "—"}
            </td>
          </tr>

          <tr style="background:#f9f9f9;">
            <td style="padding:10px;font-weight:bold;">
              Monthly Ad Spend
            </td>
            <td style="padding:10px;">
              ${safe.adSpend || "—"}
            </td>
          </tr>

          <tr>
            <td style="padding:10px;font-weight:bold;">
              Business Description
            </td>
            <td style="padding:10px;">
              ${safe.description || "—"}
            </td>
          </tr>

          <tr style="background:#f9f9f9;">
            <td style="padding:10px;font-weight:bold;">
              Main Obstacle
            </td>
            <td style="padding:10px;">
              ${safe.obstacle || "—"}
            </td>
          </tr>

          <tr>
            <td style="padding:10px;font-weight:bold;">
              Timeline
            </td>
            <td style="padding:10px;">
              ${safe.timeline || "—"}
            </td>
          </tr>

          <tr style="background:#f9f9f9;">
            <td style="padding:10px;font-weight:bold;">
              Heard From
            </td>
            <td style="padding:10px;">
              ${safe.heardFrom || "—"}
            </td>
          </tr>

          <tr>
            <td style="padding:10px;font-weight:bold;">
              Form Type
            </td>
            <td style="padding:10px;">
              ${safe.formType || "—"}
            </td>
          </tr>

        </table>

      </div>
    `;

    /* =====================================================
       SEND BOTH EMAILS USING RESEND
    ===================================================== */

    console.log("📤 Sending emails using Resend...");

    const [userResult, adminResult] =
      await Promise.all([
        resend.emails.send({
          from: FROM_EMAIL,
          to: [email],
          subject: userEmailSubject,
          html: userEmailHtml,
        }),

        resend.emails.send({
          from: FROM_EMAIL,
          to: [ADMIN_EMAIL],
          replyTo: email,
          subject: adminSubject,
          html: adminHtml,
        }),
      ]);

    /* =====================================================
       CHECK RESEND ERRORS
    ===================================================== */

    if (userResult.error) {
      console.error(
        "❌ RESEND USER MAIL ERROR:",
        userResult.error
      );

      return res.status(500).json({
        success: false,
        message:
          userResult.error.message ||
          "Failed to send user email",
      });
    }

    if (adminResult.error) {
      console.error(
        "❌ RESEND ADMIN MAIL ERROR:",
        adminResult.error
      );

      return res.status(500).json({
        success: false,
        message:
          adminResult.error.message ||
          "Failed to send admin email",
      });
    }

    console.log(
      "✅ User email sent:",
      userResult.data?.id
    );

    console.log(
      "✅ Admin email sent:",
      adminResult.data?.id
    );

    console.log(
      `✅ ${formType} form completed successfully`
    );

    return res.status(200).json({
      success: true,
      message:
        formType === "strategy"
          ? "Strategy form submitted successfully"
          : `${ebook.title} sent successfully`,
    });

  } catch (error) {
    console.error(
      "❌ SEND-EBOOK FINAL ERROR:",
      error
    );

    return res.status(500).json({
      success: false,
      message:
        error.message || "Something went wrong",
    });
  }
});

module.exports = router;