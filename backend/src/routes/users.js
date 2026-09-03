import { Router } from "express";
import db from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();

// Admin: every registered account (customers + admins), most recent
// first — powers the "Accounts" tab on the dashboard.
router.get("/", requireAuth, requireRole("admin"), (req, res) => {
  const rows = db
    .prepare("SELECT id, name, email, phone, role, created_at FROM users ORDER BY created_at DESC")
    .all();
  res.json(rows);
});

export default router;
