require("dotenv").config();

const express = require("express");
const axios = require("axios");
const cors = require("cors");

/* =========================================================
   ROUTES IMPORT
========================================================= */

const sendEbookRoutes = require("./routes/sendEbook");
const razorpayRoutes = require("./routes/razorpay-payment");
const registerStartupRoutes = require("./routes/registerStartup"); // ✅ new

/* =========================================================
   EXPRESS APP
========================================================= */

// ✅ IMPORTANT: app ko app.use() se PEHLE initialize karna hai
const app = express();

/* =========================================================
   MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/*
  ⚠️ IMPORTANT: Razorpay ka /webhook route RAW body maangta hai
  (signature verify karne ke liye), isliye ye express.json() se
  PEHLE mount hona chahiye — warna signature mismatch ho jayega.
*/
app.use("/api/payment/webhook", express.raw({ type: "application/json" }));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   PORT
========================================================= */

const PORT = process.env.PORT || 5000;

/* =========================================================
   TEST ROUTE
========================================================= */

app.get("/", (req, res) => {
  res.status(200).send("🚀 iTechnebula Backend Server Running...");
});

/* =========================================================
   SEND PHONE OTP
========================================================= */

app.post("/send-otp", async (req, res) => {
  try {
    const { phone } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        message: "Phone is required",
      });
    }

    // Remove spaces, +91, -, etc.
    let cleanPhone = String(phone).replace(/\D/g, "");

    // Agar frontend se 91 ke saath number aa gaya
    if (cleanPhone.length === 12 && cleanPhone.startsWith("91")) {
      cleanPhone = cleanPhone.substring(2);
    }

    if (cleanPhone.length !== 10) {
      return res.status(400).json({
        success: false,
        message: "Please enter a valid 10 digit phone number",
      });
    }

    const apiKey = String(process.env.API_KEY || "").trim();

    if (!apiKey) {
      console.error("❌ API_KEY missing");

      return res.status(500).json({
        success: false,
        message: "OTP service is not configured",
      });
    }

    const url =
      `https://2factor.in/API/V1/${apiKey}` +
      `/SMS/91${cleanPhone}/AUTOGEN?route=4`;

    console.log("📱 Sending OTP to:", `91${cleanPhone}`);

    const response = await axios.get(url, {
      timeout: 15000,
    });

    const data = response.data;

    console.log("📩 2Factor Response:", data);

    if (data.Status !== "Success") {
      const details = data.Details || "Failed to send OTP";
      // Friendlier message for common 2Factor misconfig
      if (/invalid api key/i.test(String(details))) {
        throw new Error(
          "OTP service API key is invalid. Check API_KEY on Render (2Factor.in key)."
        );
      }
      throw new Error(details);
    }

    return res.status(200).json({
      success: true,
      message: "OTP sent successfully",
      sessionId: data.Details,
    });

  } catch (err) {
    console.error(
      "❌ SEND OTP ERROR:",
      err.response?.data || err.message
    );

    return res.status(500).json({
      success: false,
      message:
        err.response?.data?.Details ||
        err.message ||
        "Failed to send OTP",
    });
  }
});

/* =========================================================
   VERIFY PHONE OTP
========================================================= */

app.post("/verify-otp", async (req, res) => {
  try {
    const { sessionId, otp } = req.body;

    if (!sessionId || !otp) {
      return res.status(400).json({
        success: false,
        message: "SessionId and OTP are required",
      });
    }

    const apiKey = String(process.env.API_KEY || "").trim();

    if (!apiKey) {
      console.error("❌ API_KEY missing");

      return res.status(500).json({
        success: false,
        message: "OTP service is not configured",
      });
    }

    const url =
      `https://2factor.in/API/V1/${apiKey}` +
      `/SMS/VERIFY/${sessionId}/${otp}`;

    console.log("🔐 Verifying OTP...");

    const response = await axios.get(url, {
      timeout: 15000,
    });

    const data = response.data;

    console.log("🔐 Verify Response:", data);

    if (data.Status === "Success") {
      return res.status(200).json({
        success: true,
        message: "OTP verified successfully",
      });
    }

    return res.status(400).json({
      success: false,
      message: data.Details || "Invalid OTP",
    });

  } catch (err) {
    console.error(
      "❌ VERIFY OTP ERROR:",
      err.response?.data || err.message
    );

    return res.status(500).json({
      success: false,
      message:
        err.response?.data?.Details ||
        err.message ||
        "Verification failed",
    });
  }
});

/* =========================================================
   EMAIL OTP ROUTES
========================================================= */

/*
  emailOtp.js ke routes yahan register honge.

  IMPORTANT:
  emailOtp.js ke andar /send-ebook route nahi hona chahiye.
*/



/* =========================================================
   EBOOK / REPORT / STRATEGY ROUTES
========================================================= */

/*
  sendEbook.js handle karega:

  POST /send-ebook

  formType:
  - ebook
  - facebook
  - google
  - strategy
*/

app.use("/", sendEbookRoutes);

/* =========================================================
   STARTUP REGISTRATION ROUTE
========================================================= */

/*
  registerStartup.js handle karega:

  POST /register-startup
  - Generates a unique Registration ID
  - Emails it to the user via Resend
  - Returns { success, registrationId } to the frontend
*/

app.use("/", registerStartupRoutes); // ✅ new

/* =========================================================
   RAZORPAY PAYMENT ROUTES
========================================================= */

/*
  razorpay-payment.js handle karega:

  POST /api/payment/create-order
  POST /api/payment/verify
  POST /api/payment/webhook
*/

app.use("/api/payment", razorpayRoutes);

/* =========================================================
   404 HANDLER
========================================================= */

app.use((req, res) => {
  console.log(
    `⚠️ Route not found: ${req.method} ${req.originalUrl}`
  );

  return res.status(404).json({
    success: false,
    message: "API route not found",
  });
});

/* =========================================================
   GLOBAL ERROR HANDLER
========================================================= */

app.use((err, req, res, next) => {
  console.error("❌ GLOBAL SERVER ERROR:", err);

  if (res.headersSent) {
    return next(err);
  }

  return res.status(500).json({
    success: false,
    message: "Internal server error",
  });
});

/* =========================================================
   START SERVER
========================================================= */

app.listen(PORT, () => {
  console.log("");
  console.log("==========================================");
  console.log("🚀 iTechnebula Backend Started");
  console.log(`✅ Server running on port ${PORT}`);
  console.log(`📧 Admin: ${process.env.ADMIN_EMAIL || "not configured"}`);
  console.log(
    `📨 Resend: ${
      process.env.RESEND_API_KEY ? "configured" : "NOT configured"
    }`
  );
  console.log(
    `💳 Razorpay: ${
      process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET
        ? "configured"
        : "NOT configured"
    }`
  );
  console.log("==========================================");
  console.log("");
});