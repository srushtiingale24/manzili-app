# Manzili — Home Cleaning Booking App

A full booking flow for a Saudi home-cleaning service: customer login,
booking configuration, free OpenStreetMap-based location, real payment
via Moyasar (Mada / credit card / Apple Pay / STC Pay), an emailed
receipt via Resend, and a live admin dashboard that receives every paid
order the instant it happens.

```
manzili-app/
  backend/    Node.js + Express + SQLite API, payment verification, email
  frontend/   React + Vite + Tailwind — customer app and admin dashboard
```

Both the backend and frontend have already been built and tested in
isolation (auth, role checks, order creation, and the production build
all pass). What's left is filling in three sets of real credentials —
none of this works with fake/placeholder keys.

---

## 1. What you need to sign up for

| Service | What it's for | Cost |
|---|---|---|
| **Moyasar** | Actually charges Mada / cards / Apple Pay / STC Pay | Free to integrate in test mode; per-transaction fee once live, requires business KYC to receive payouts |
| **Resend** | Sends the booking receipt email | Free tier covers small volume |
| *(nothing for maps)* | Location uses free OpenStreetMap + Nominatim | Free, no signup |

### Get Moyasar keys
1. Sign up at [dashboard.moyasar.com](https://dashboard.moyasar.com).
2. Go to **Developers → API Keys**. You'll see a **test** publishable key
   (`pk_test_...`) and **test** secret key (`sk_test_...`) immediately —
   no business verification needed to start testing.
3. Use Moyasar's [test cards](https://docs.moyasar.com/testing) to run
   through full payments without moving real money.
4. When you're ready to accept real payments, Moyasar will ask for your
   Commercial Registration (CR) and bank IBAN to verify your business and
   switch you to **live** keys (`pk_live_...` / `sk_live_...`).
5. Optional but recommended: under **Developers → Webhooks**, add
   `https://your-backend-url.com/api/payments/webhook` so a payment still
   gets recorded even if a customer's browser closes mid-payment.

### Get a Resend key
1. Sign up at [resend.com](https://resend.com).
2. Either verify your own domain (**Domains → Add Domain**, then add the
   DNS records they give you) or use their shared test domain while
   developing.
3. Go to **API Keys → Create API Key** and copy it.

---

## 2. Where each key goes

**`backend/.env`** (copy from `backend/.env.example`):
```
JWT_SECRET=<any long random string>
MOYASAR_SECRET_KEY=sk_test_...
MOYASAR_PUBLISHABLE_KEY=pk_test_...
RESEND_API_KEY=re_...
RESEND_FROM_EMAIL=Manzili <receipts@yourdomain.com>
```

**`frontend/src/PaymentForm.jsx`** — one line near the top:
```js
const MOYASAR_PUBLISHABLE_KEY = "pk_test_YOUR_MOYASAR_PUBLISHABLE_KEY";
```
This is the *publishable* key — it's meant to be visible in frontend
code, that's how Moyasar's hosted form is designed to work. The
**secret** key only ever goes in `backend/.env`, never in frontend code.

---

## 3. Running it locally

**Backend:**
```bash
cd backend
cp .env.example .env      # then fill in the values above
npm install
npm run dev
```
This starts the API on `http://localhost:4000`, creates a local SQLite
file (`backend/data.db`), and seeds three accounts automatically:

| Role | Email | Password |
|---|---|---|
| Admin | `admin@manzili.sa` | `Admin@12345` |
| Customer | `demo1@manzili.sa` | `Demo@1234` |
| Customer | `demo2@manzili.sa` | `Demo@1234` |

(Admin credentials come from `ADMIN_DEFAULT_EMAIL` / `ADMIN_DEFAULT_PASSWORD`
in `.env` if you set them — change the password after first login.)

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```
Open `http://localhost:5173` for the customer app, or
`http://localhost:5173/admin` for the admin dashboard.

---

## 4. How an order actually flows through the system

1. **Customer logs in or registers** (`/api/auth/register` or
   `/api/auth/login`) — passwords are hashed with bcrypt, sessions are
   signed JWTs stored in the browser.
2. Customer configures the clean, picks a schedule and address (current
   location via the browser's Geolocation permission prompt, or manual
   entry with free OpenStreetMap-based address search), then reaches
   checkout.
3. **Moyasar's hosted form** (embedded via `PaymentForm.jsx`) takes the
   actual card/Mada/Apple Pay/STC Pay details directly into Moyasar's own
   secure iframe — card numbers never touch this app's frontend or
   backend code.
4. Once Moyasar reports the payment as completed, the frontend calls
   **`POST /api/payments/verify`** with the payment id — the backend
   independently re-checks that payment with Moyasar using the *secret*
   key (never trusting the browser's word for it), confirms the amount
   matches, and only then creates the order row in SQLite.
5. The backend immediately:
   - **pushes the new order to any connected admin dashboards** over
     Socket.io (that's the "live" feed — no page refresh needed), and
   - **emails a receipt** to the customer via Resend.
6. The customer sees a success screen with their real booking reference
   and the receipt is in their inbox.

If a customer's connection drops right after paying but before step 4
completes, the optional **Moyasar webhook** (see setup above) acts as a
safety net so the order still gets marked paid.

---

## 5. Additional features

- **Cash on Delivery**: checkout has two tabs — "Cash on Delivery" (works
  immediately, no gateway needed) and "Pay Online" (needs your Moyasar
  keys). COD orders are created instantly with `payment_status:
  "cod_pending"`, pushed live to the admin dashboard the same way paid
  orders are, and still get a receipt email (worded "due in cash"
  instead of "paid").
- **Admin → Accounts tab**: alongside Orders, admins can see every
  registered account (name, email, phone, role, join date). New sign-ups
  appear here live over Socket.io, no refresh needed.
- **Customer → My Orders**: a button in the booking flow's header opens
  a modal listing that customer's own past bookings (`GET
  /api/orders/mine`), each showing status, address, payment method, and
  amount.

## 6. Known limitations of this prototype

- **Admin accounts** can only be created by seeding (`db.js`) or directly
  in the database — there's intentionally no public "become an admin"
  endpoint.
- **SQLite** is used for simplicity. It's fine for a prototype or small
  volume; for production traffic at scale, swap `backend/src/db.js` for
  Postgres/MySQL — the query shapes are simple and port over easily.
- **Apple Pay** requires domain verification with Apple through Moyasar's
  dashboard before it will actually appear as an option on a live
  domain (it won't show up on `localhost`).
- This prototype ships one admin dashboard behind one shared login. If
  you need multiple staff accounts with different permissions later,
  that's a straightforward extension of the existing `role` column.
