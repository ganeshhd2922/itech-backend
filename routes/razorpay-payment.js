const express = require("express");
const crypto = require("crypto");
const Razorpay = require("razorpay");

const router = express.Router();

/* =========================================================
   RAZORPAY CONFIG
========================================================= */

if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
  console.error("❌ RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET missing");
}

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// Optional but strongly recommended for production — set this up in
// Razorpay Dashboard → Settings → Webhooks, and put the same secret here.
const WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET;

/* =========================================================
   HELPERS
========================================================= */

function isValidAmount(amount) {
  const n = Number(amount);
  return Number.isFinite(n) && n > 0 && n <= 500000; // sanity cap: ₹5,00,000
}

/* =========================================================
   1) CREATE ORDER
   Frontend sends the amount (in rupees, from the form field).
   NEVER trust an amount coming from the frontend for anything
   security-critical elsewhere — always re-verify server-side
   before granting access to paid content.
========================================================= */

router.post("/create-order", async (req, res) => {
  try {
    const { amount, notes } = req.body;

    if (!isValidAmount(amount)) {
      return res.status(400).json({
        success: false,
        message: "Invalid amount",
      });
    }

    // Razorpay expects the amount in the smallest currency unit (paise)
    const amountInPaise = Math.round(Number(amount) * 100);

    const order = await razorpay.orders.create({
      amount: amountInPaise,
      currency: "INR",
      receipt: `sp2026_${Date.now()}`,
      notes: notes || { source: "startup-pool-2026" },
    });

    console.log("✅ Razorpay order created:", order.id, "amount:", amountInPaise);

    return res.status(200).json({
      success: true,
      order, // contains order.id, order.amount, order.currency
    });
  } catch (err) {
    console.error("❌ RAZORPAY ORDER ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to create payment order",
    });
  }
});

/* =========================================================
   2) VERIFY PAYMENT (called from the Razorpay checkout
   success handler on the frontend)
========================================================= */

router.post("/verify", async (req, res) => {
  try {
    const {
      razorpay_order_id,
      razorpay_payment_id,
      razorpay_signature,
    } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({
        success: false,
        message: "Missing payment details",
      });
    }

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (!isValid) {
      console.error(
        "❌ Signature mismatch — possible tampering. payment_id:",
        razorpay_payment_id
      );
      return res.status(400).json({
        success: false,
        message: "Payment verification failed",
      });
    }

    console.log("✅ Payment verified:", razorpay_payment_id);

    // TODO: mark this order_id as "paid" in your database here,
    // so /verify can never be replayed to fake a second registration.

    return res.status(200).json({
      success: true,
      message: "Payment verified successfully",
      payment_id: razorpay_payment_id,
    });
  } catch (err) {
    console.error("❌ RAZORPAY VERIFY ERROR:", err);
    return res.status(500).json({
      success: false,
      message: "Payment verification error",
    });
  }
});

/* =========================================================
   3) WEBHOOK (production safety net)

   Why this matters: the frontend "handler" callback above can be
   missed if the user closes the browser tab right after paying.
   The webhook is Razorpay calling YOUR server directly, so it
   fires even if the customer's browser never returns.

   IMPORTANT: this route needs the RAW request body to verify the
   signature, so mount it BEFORE express.json() in your main app,
   e.g.:
     app.use("/api/payment/webhook", express.raw({ type: "application/json" }));
     app.use("/api/payment", razorpayRoutes);
========================================================= */

router.post("/webhook", (req, res) => {
  try {
    if (!WEBHOOK_SECRET) {
      console.error("❌ RAZORPAY_WEBHOOK_SECRET not configured — webhook ignored");
      return res.status(500).json({ success: false, message: "Webhook not configured" });
    }

    const signature = req.headers["x-razorpay-signature"];
    const rawBody = req.body; // must be a Buffer (see express.raw note above)

    const expectedSignature = crypto
      .createHmac("sha256", WEBHOOK_SECRET)
      .update(rawBody)
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("❌ Webhook signature mismatch");
      return res.status(400).json({ success: false, message: "Invalid signature" });
    }

    const event = JSON.parse(rawBody.toString());

    if (event.event === "payment.captured") {
      const payment = event.payload.payment.entity;
      console.log("✅ Webhook: payment captured:", payment.id, payment.order_id);
      // TODO: mark order as paid in your DB (idempotent — this may
      // fire even if /verify already handled it, that's fine)
    }

    if (event.event === "payment.failed") {
      const payment = event.payload.payment.entity;
      console.log("⚠️ Webhook: payment failed:", payment.id, payment.error_description);
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    console.error("❌ WEBHOOK ERROR:", err);
    return res.status(500).json({ success: false, message: "Webhook error" });
  }
});

module.exports = router;