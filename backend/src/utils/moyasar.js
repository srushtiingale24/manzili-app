const MOYASAR_API = "https://api.moyasar.com/v1";

function authHeader() {
  const key = process.env.MOYASAR_SECRET_KEY;
  return "Basic " + Buffer.from(`${key}:`).toString("base64");
}

// Looks a payment up directly on Moyasar's servers using our secret key.
// This is the authoritative source of truth — we NEVER trust a payment
// status reported by the browser, since that could be forged.
export async function fetchMoyasarPayment(paymentId) {
  const res = await fetch(`${MOYASAR_API}/payments/${paymentId}`, {
    headers: { Authorization: authHeader() },
  });
  if (!res.ok) throw new Error(`Moyasar lookup failed (${res.status})`);
  return res.json();
}
