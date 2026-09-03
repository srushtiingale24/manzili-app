import { buildReceiptHtml } from "./receipt.js";

// Sends the booking receipt via Resend (https://resend.com).
// Needs RESEND_API_KEY and RESEND_FROM_EMAIL set in .env — the "from"
// address must be on a domain you've verified in your Resend dashboard
// (or use their onboarding test domain while developing).
export async function sendReceiptEmail(order, user) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !from || apiKey.includes("xxxx")) {
    console.warn("RESEND_API_KEY / RESEND_FROM_EMAIL not configured — skipping receipt email.");
    return { sent: false, reason: "not_configured" };
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: user.email,
      subject: `Your Manzili booking ${order.booking_ref} is confirmed`,
      html: buildReceiptHtml(order, user),
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    console.error("Resend email failed:", text);
    return { sent: false, reason: "resend_error" };
  }
  return { sent: true };
}
