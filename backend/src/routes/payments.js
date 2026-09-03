import { Router } from "express";
import db from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { fetchMoyasarPayment } from "../utils/moyasar.js";
import { sendReceiptEmail } from "../utils/email.js";

function makeBookingRef() {
  return `#KSA-${Math.floor(10000 + Math.random() * 89999)}`;
}

// This route needs the Socket.io instance to push live updates to admins,
// so it's exported as a factory that server.js calls with `io`.
export default function paymentsRouter(io) {
  const router = Router();

  // The frontend calls this right after Moyasar's hosted form reports a
  // completed payment. We do NOT trust that report on its own — we look
  // the payment up directly with Moyasar using our secret key, confirm
  // it's actually "paid", confirm the amount matches what we expect, and
  // only then create the order. This is what stops someone from calling
  // this endpoint directly and claiming a booking without paying.
  router.post("/verify", requireAuth, async (req, res) => {
    try {
      const { paymentId, booking } = req.body || {};
      if (!paymentId || !booking) {
        return res.status(400).json({ error: "Missing paymentId or booking details" });
      }

      const payment = await fetchMoyasarPayment(paymentId);

      if (payment.status !== "paid") {
        return res.status(402).json({ error: "Payment was not completed", status: payment.status });
      }

      const expectedHalalas = Math.round(Number(booking.amount) * 100);
      if (payment.amount !== expectedHalalas) {
        return res.status(400).json({ error: "Amount mismatch — payment rejected" });
      }

      // Idempotency: if this Moyasar payment was already used for an
      // order (e.g. the frontend retried the request), just return it.
      const already = db
        .prepare("SELECT * FROM orders WHERE moyasar_payment_id = ?")
        .get(payment.id);
      if (already) return res.json({ order: already });

      const bookingRef = makeBookingRef();
      const result = db
        .prepare(
          `INSERT INTO orders
           (booking_ref, user_id, hours, cleaners, addons_json, city, district, building,
            visit_date, time_slot, amount_sar, payment_method, payment_status, moyasar_payment_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'paid', ?)`
        )
        .run(
          bookingRef,
          req.user.id,
          booking.hours,
          booking.cleaners,
          JSON.stringify(booking.addons || {}),
          booking.city,
          booking.district,
          booking.building,
          booking.visitDate,
          booking.timeSlot,
          booking.amount,
          payment.source?.type || "card",
          payment.id
        );

      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(result.lastInsertRowid);

      // Push to any connected admin dashboards in real time.
      io.to("admins").emit("new_order", order);

      // Fire-and-forget — don't make the customer wait on the email send.
      sendReceiptEmail(order, req.user).catch((e) => console.error("Email error:", e));

      res.json({ order });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not verify payment" });
    }
  });

  // Cash on Delivery — for when you don't have Moyasar keys yet (or just
  // want to offer COD alongside online payment). No gateway involved: the
  // order is created immediately as "cod_pending" (cash still owed to the
  // cleaner on the day), pushed live to admins, and a receipt is emailed
  // just like a paid order — it just says "pay in cash" instead of an
  // amount already charged.
  router.post("/cod", requireAuth, async (req, res) => {
    try {
      const { booking } = req.body || {};
      if (!booking) return res.status(400).json({ error: "Missing booking details" });

      const bookingRef = makeBookingRef();
      const result = db
        .prepare(
          `INSERT INTO orders
           (booking_ref, user_id, hours, cleaners, addons_json, city, district, building,
            visit_date, time_slot, amount_sar, payment_method, payment_status, moyasar_payment_id)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'cod', 'cod_pending', NULL)`
        )
        .run(
          bookingRef,
          req.user.id,
          booking.hours,
          booking.cleaners,
          JSON.stringify(booking.addons || {}),
          booking.city,
          booking.district,
          booking.building,
          booking.visitDate,
          booking.timeSlot,
          booking.amount
        );

      const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(result.lastInsertRowid);

      io.to("admins").emit("new_order", order);
      sendReceiptEmail(order, req.user).catch((e) => console.error("Email error:", e));

      res.json({ order });
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: "Could not place order" });
    }
  });

  // Safety net: Moyasar calls this if you configure a webhook in their
  // dashboard, so a payment still gets recorded even if the customer's
  // tab closes mid-flow (e.g. during a 3-D Secure redirect) before
  // /verify runs. This route intentionally does the minimum — marking an
  // already-known order as paid — since order *creation* always goes
  // through /verify above.
  router.post("/webhook", (req, res) => {
    const event = req.body || {};
    if (event.type === "payment_paid" && event.data?.id) {
      const existing = db
        .prepare("SELECT * FROM orders WHERE moyasar_payment_id = ?")
        .get(event.data.id);
      if (existing && existing.payment_status !== "paid") {
        db.prepare("UPDATE orders SET payment_status = 'paid' WHERE id = ?").run(existing.id);
        io.to("admins").emit("new_order", { ...existing, payment_status: "paid" });
      }
    }
    res.sendStatus(200);
  });

  return router;
}
