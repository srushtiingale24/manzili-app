import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Customer: list my own bookings, most recent first.
router.get("/mine", requireAuth, (req, res) => {
  const rows = db
    .prepare("SELECT * FROM orders WHERE user_id = ? ORDER BY created_at DESC")
    .all(req.user.id);
  res.json(rows);
});

// Admin: every order, most recent first — this is what the live
// dashboard loads on mount (Socket.io then streams new ones in after).
router.get("/", requireAuth, requireRole("admin"), (req, res) => {
  const rows = db.prepare("SELECT * FROM orders ORDER BY created_at DESC").all();
  res.json(rows);
});

// Customer (their own order) or admin (any order): fetch one order,
// e.g. to re-display a receipt.
router.get("/:id", requireAuth, (req, res) => {
  const order = db.prepare("SELECT * FROM orders WHERE id = ?").get(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (req.user.role !== "admin" && order.user_id !== req.user.id) {
    return res.status(403).json({ error: "Forbidden" });
  }
  res.json(order);
});

export default router;
