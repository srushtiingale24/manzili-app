import React, { useState, useMemo, useEffect, useRef, useCallback } from "react";
import {
  Sparkles,
  Clock,
  Users,
  Plus,
  Minus,
  MapPin,
  Sunrise,
  Sun,
  Moon,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  X,
  Home,
  Shirt,
  SprayCan,
  Building2,
  ShieldCheck,
  LocateFixed,
  PenLine,
  Loader2,
  AlertCircle,
  Search,
  RotateCcw,
  LogOut,
  UserCircle2,
  Banknote,
  CreditCard,
  History,
} from "lucide-react";
import { apiRequest } from "./api";
import PaymentForm from "./PaymentForm";
import OrderHistory from "./OrderHistory";

/* ---------------------------------------------------------
   DESIGN TOKENS
   A palette drawn from Najdi majlis interiors: deep teal
   (trust, water, clean), brass gold (hospitality trim),
   warm sand neutrals. Type pairs Cairo (a bilingual
   Arabic/Latin geometric face) for display with Inter for
   body and numerals.
--------------------------------------------------------- */
const palette = {
  bg: "#F4F6F5",
  surface: "#FFFFFF",
  ink: "#14231F",
  inkMuted: "#5B6B67",
  primary: "#0E5C56",
  primaryDark: "#0A423D",
  primaryTint: "#E3EEEC",
  accent: "#B8862B",
  accentTint: "#F4EAD4",
  sand: "#E7DCC3",
  sandDark: "#C9BC9C",
  danger: "#B3432E",
  success: "#1F8A5F",
  line: "#E3E7E4",
};

const fontDisplay = { fontFamily: "'Cairo', sans-serif" };
const fontBody = { fontFamily: "'Inter', sans-serif" };

const RATE_PER_HOUR = 45;
const ADDONS = [
  { id: "materials", label: "Bring Cleaning Materials", price: 30, icon: SprayCan },
  { id: "ironing", label: "Ironing Service", price: 40, icon: Shirt },
];
// Covers all regions of the Kingdom so the flow isn't limited to a
// short list — used as a datalist so manual entry stays a free-text
// field (any city/town can be typed) while still offering suggestions.
const SAUDI_CITIES = [
  "Riyadh", "Jeddah", "Mecca", "Medina", "Dammam", "Khobar", "Dhahran",
  "Taif", "Tabuk", "Abha", "Khamis Mushait", "Jubail", "Yanbu", "Najran",
  "Hail", "Jazan", "Al Kharj", "Buraidah", "Unaizah", "Qatif", "Al-Ahsa",
  "Arar", "Sakaka", "Baha", "Bisha", "Rabigh", "Duba", "Qurayyat", "Turaif",
  "Wadi ad-Dawasir",
];

// --- Free map loader (OpenStreetMap + Leaflet) ----------------------
// No API key, no billing account, no signup required anywhere below.
// Leaflet renders the map/marker; OpenStreetMap supplies the map tiles;
// Nominatim (also OSM) handles reverse-geocoding and address search.
// Nominatim's public server asks for reasonable use (~1 request/sec,
// no bulk scraping) — fine for a prototype or small site. If traffic
// grows a lot later, self-host Nominatim or move to a paid geocoder.
const LEAFLET_CSS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS_URL = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";

let leafletPromise = null;
function loadLeaflet() {
  if (typeof window === "undefined") return Promise.reject(new Error("no window"));
  if (window.L) return Promise.resolve(window.L);
  if (leafletPromise) return leafletPromise;

  leafletPromise = new Promise((resolve, reject) => {
    if (!document.getElementById("leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = LEAFLET_CSS_URL;
      document.head.appendChild(link);
    }
    const existing = document.getElementById("leaflet-script");
    if (existing) {
      existing.addEventListener("load", () => resolve(window.L));
      existing.addEventListener("error", () => reject(new Error("Leaflet failed to load")));
      return;
    }
    const script = document.createElement("script");
    script.id = "leaflet-script";
    script.src = LEAFLET_JS_URL;
    script.async = true;
    script.onload = () => resolve(window.L);
    script.onerror = () => reject(new Error("Leaflet failed to load"));
    document.head.appendChild(script);
  });
  return leafletPromise;
}

// Reverse geocode lat/lng -> address, via Nominatim (free, no key).
async function reverseGeocodeOSM(lat, lon) {
  const res = await fetch(
    `${NOMINATIM_BASE}/reverse?format=jsonv2&lat=${lat}&lon=${lon}&addressdetails=1`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error("Reverse geocoding failed");
  return res.json();
}

// Forward search for the manual-entry autocomplete, via Nominatim.
async function searchAddressOSM(query) {
  const res = await fetch(
    `${NOMINATIM_BASE}/search?format=jsonv2&addressdetails=1&countrycodes=sa&limit=5&q=${encodeURIComponent(
      query
    )}`,
    { headers: { Accept: "application/json" } }
  );
  if (!res.ok) throw new Error("Address search failed");
  return res.json();
}

const TIME_SLOTS = [
  { id: "morning", label: "Morning", range: "8 AM – 12 PM", icon: Sunrise },
  { id: "afternoon", label: "Afternoon", range: "1 PM – 5 PM", icon: Sun },
  { id: "evening", label: "Evening", range: "6 PM – 10 PM", icon: Moon },
];

const STEPS = [
  { id: 1, label: "Configure" },
  { id: 2, label: "Schedule" },
  { id: 3, label: "Checkout" },
];

function getNext14Days() {
  const days = [];
  const today = new Date();
  for (let i = 0; i < 14; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const DAY_ABBR = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_ABBR = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

/* ---------------------------------------------------------
   SIGNATURE ELEMENT: an 8-point star badge, built from two
   overlaid squares — the classic construction behind the
   Rub el Hizb motif found across the region's geometric
   ornament. Used consistently to mark step progress.
--------------------------------------------------------- */
function StarBadge({ state, size = 34 }) {
  // state: "done" | "active" | "pending"
  const filled = state === "done" || state === "active";
  const color = state === "done" ? palette.primary : state === "active" ? palette.accent : "transparent";
  const borderColor = state === "pending" ? palette.sandDark : "transparent";
  const squareStyle = {
    position: "absolute",
    inset: "18%",
    backgroundColor: filled ? color : "transparent",
    border: filled ? "none" : `2px solid ${borderColor}`,
    transition: "all 200ms ease",
  };
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <div style={{ ...squareStyle, transform: "rotate(0deg)" }} />
      <div style={{ ...squareStyle, transform: "rotate(45deg)" }} />
      {state === "done" && (
        <div className="absolute inset-0 flex items-center justify-center">
          <CheckCircle2 size={size * 0.5} color="#fff" strokeWidth={2.5} />
        </div>
      )}
    </div>
  );
}

function StepRail({ current }) {
  return (
    <div className="flex md:flex-col gap-0 md:gap-1">
      {STEPS.map((s, idx) => {
        const state = s.id < current ? "done" : s.id === current ? "active" : "pending";
        return (
          <div key={s.id} className="flex md:flex-row items-center flex-1 md:flex-none">
            <div className="flex flex-col md:flex-row items-center md:items-center gap-2 md:gap-3 md:py-2">
              <StarBadge state={state} />
              <span
                className="text-[11px] md:text-sm font-semibold whitespace-nowrap"
                style={{
                  ...fontBody,
                  color: state === "pending" ? palette.inkMuted : palette.ink,
                }}
              >
                {s.label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className="flex-1 md:w-0.5 md:h-8 md:ml-4 h-0.5 mx-2 md:mx-0"
                style={{ backgroundColor: s.id < current ? palette.primary : palette.line }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function Counter({ label, sub, icon: Icon, value, setValue, min, max }) {
  return (
    <div className="flex items-center justify-between py-4">
      <div className="flex items-center gap-3">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: palette.primaryTint }}
        >
          <Icon size={19} style={{ color: palette.primary }} />
        </div>
        <div>
          <p className="font-semibold text-[15px]" style={{ ...fontBody, color: palette.ink }}>
            {label}
          </p>
          <p className="text-xs" style={{ ...fontBody, color: palette.inkMuted }}>
            {sub}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => setValue(Math.max(min, value - 1))}
          disabled={value <= min}
          className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30 disabled:active:scale-100"
          style={{ backgroundColor: palette.sand }}
          aria-label={`Decrease ${label}`}
        >
          <Minus size={16} style={{ color: palette.ink }} />
        </button>
        <span
          className="w-7 text-center font-bold text-lg tabular-nums"
          style={{ ...fontBody, color: palette.ink }}
        >
          {value}
        </span>
        <button
          type="button"
          onClick={() => setValue(Math.min(max, value + 1))}
          disabled={value >= max}
          className="w-9 h-9 rounded-full flex items-center justify-center transition active:scale-90 disabled:opacity-30 disabled:active:scale-100"
          style={{ backgroundColor: palette.primary }}
          aria-label={`Increase ${label}`}
        >
          <Plus size={16} color="#fff" />
        </button>
      </div>
    </div>
  );
}

function AddonRow({ addon, checked, onToggle }) {
  const Icon = addon.icon;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="w-full flex items-center justify-between p-4 rounded-xl border transition text-left"
      style={{
        borderColor: checked ? palette.primary : palette.line,
        backgroundColor: checked ? palette.primaryTint : palette.surface,
      }}
    >
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: checked ? palette.primary : palette.sand }}
        >
          <Icon size={17} color={checked ? "#fff" : palette.ink} />
        </div>
        <div>
          <p className="font-semibold text-[14px]" style={{ ...fontBody, color: palette.ink }}>
            {addon.label}
          </p>
          <p className="text-xs" style={{ ...fontBody, color: palette.accent }}>
            +{addon.price} SAR
          </p>
        </div>
      </div>
      <div
        className="w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0"
        style={{
          borderColor: checked ? palette.primary : palette.sandDark,
          backgroundColor: checked ? palette.primary : "transparent",
        }}
      >
        {checked && <CheckCircle2 size={14} color="#fff" fill={palette.primary} />}
      </div>
    </button>
  );
}

/* ---------------------------------------------------------
   Live preview map — renders a small interactive Leaflet map on free
   OpenStreetMap tiles, centered on the detected coordinates with a
   marker. Fails silently (shows a placeholder) if Leaflet hasn't
   loaded yet, e.g. offline.
--------------------------------------------------------- */
function MapPreview({ coords }) {
  const mapDivRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!coords) return;
    loadLeaflet()
      .then((L) => {
        if (cancelled || !mapDivRef.current) return;
        // Re-use the map instance across re-renders instead of recreating it.
        if (!mapInstanceRef.current) {
          mapInstanceRef.current = L.map(mapDivRef.current, {
            zoomControl: true,
            attributionControl: true,
          });
          L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
            maxZoom: 19,
            attribution: "&copy; OpenStreetMap contributors",
          }).addTo(mapInstanceRef.current);
          mapInstanceRef.current._marker = L.marker([coords.lat, coords.lng]).addTo(
            mapInstanceRef.current
          );
        } else {
          mapInstanceRef.current._marker.setLatLng([coords.lat, coords.lng]);
        }
        mapInstanceRef.current.setView([coords.lat, coords.lng], 15);
        setReady(true);
      })
      .catch(() => setReady(false));
    return () => {
      cancelled = true;
    };
  }, [coords]);

  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, []);

  return (
    <div
      className="relative w-full h-40 rounded-xl overflow-hidden"
      style={{ backgroundColor: palette.sand }}
    >
      <div ref={mapDivRef} className="absolute inset-0" />
      {!ready && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-4 text-center pointer-events-none">
          <MapPin size={20} style={{ color: palette.inkMuted }} />
          <p className="text-[11px]" style={{ color: palette.inkMuted }}>
            Loading map…
          </p>
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------
   Debounced address search backed by Nominatim (free, no
   key). Returns suggestions the caller renders as a dropdown;
   picking one fills in city/district/coordinates.
--------------------------------------------------------- */
function useSaudiAddressSearch(query) {
  const [suggestions, setSuggestions] = useState([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!query || query.trim().length < 3) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const handle = setTimeout(() => {
      searchAddressOSM(query)
        .then((results) => {
          if (!cancelled) setSuggestions(results || []);
        })
        .catch(() => {
          if (!cancelled) setSuggestions([]);
        })
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 500); // respects Nominatim's ~1 req/sec usage policy
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [query]);

  return { suggestions, searching };
}

export default function CleaningBooking({ user, onLogout, onBackToServices }) {
  const [step, setStep] = useState(1);
  const [showHistory, setShowHistory] = useState(false);

  // Step 1 state
  const [hours, setHours] = useState(1);
  const [cleaners, setCleaners] = useState(1);
  const [addons, setAddons] = useState({ materials: false, ironing: false });

  // Step 2 state
  const days = useMemo(() => getNext14Days(), []);
  const [selectedDate, setSelectedDate] = useState(days[0]);
  const [slot, setSlot] = useState(null);
  const [city, setCity] = useState("");
  const [district, setDistrict] = useState("");
  const [building, setBuilding] = useState("");
  const [addressSearch, setAddressSearch] = useState("");

  // Location mode: null (not chosen yet) | "current" | "manual"
  const [locationMode, setLocationMode] = useState(null);
  const [geoStatus, setGeoStatus] = useState("idle"); // idle | requesting | success | error
  const [geoError, setGeoError] = useState("");
  const [coords, setCoords] = useState(null);
  const [formattedAddress, setFormattedAddress] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Step 3 state — payment now goes through Moyasar's hosted form, then
  // our backend independently verifies it before the order is created.
  // "cod" (Cash on Delivery) skips the gateway entirely, useful while a
  // Moyasar merchant account (which needs a Saudi phone number) is pending.
  const [paymentMode, setPaymentMode] = useState("cod"); // "cod" | "online"
  const [paymentStatus, setPaymentStatus] = useState("idle"); // idle | processing | error
  const [paymentError, setPaymentError] = useState("");
  const [showSuccess, setShowSuccess] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState(null);

  const { suggestions, searching } = useSaudiAddressSearch(
    locationMode === "manual" && showSuggestions ? addressSearch : ""
  );

  const applyNominatimAddress = (result) => {
    const a = result.address || {};
    const detectedCity = a.city || a.town || a.village || a.county || a.state || "";
    const detectedDistrict = a.suburb || a.neighbourhood || a.city_district || a.quarter || "";
    if (detectedCity) setCity(detectedCity);
    if (detectedDistrict) setDistrict(detectedDistrict);
    setFormattedAddress(result.display_name || "");
  };

  const reverseGeocode = useCallback((c) => {
    reverseGeocodeOSM(c.lat, c.lng)
      .then((result) => {
        if (result) applyNominatimAddress(result);
      })
      .catch(() => {
        // Offline or Nominatim unreachable — coordinates are still
        // captured, user can fill in city/district manually below.
      });
  }, []);

  // Ask the browser for permission and read the device's current
  // location. This is what triggers the native "Allow location
  // access?" prompt. (Browser geolocation is always free — no key.)
  const detectCurrentLocation = () => {
    setLocationMode("current");
    setGeoStatus("requesting");
    setGeoError("");
    if (!("geolocation" in navigator)) {
      setGeoStatus("error");
      setGeoError("Geolocation isn't supported on this device.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const c = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setCoords(c);
        setGeoStatus("success");
        reverseGeocode(c);
      },
      (err) => {
        setGeoStatus("error");
        setGeoError(
          err.code === 1
            ? "Location permission was denied. You can still enter your address manually."
            : "Couldn't detect your location. You can enter your address manually instead."
        );
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const switchToManual = () => {
    setLocationMode("manual");
    setGeoStatus("idle");
    setGeoError("");
  };

  // Called when the user picks a suggestion from the free Nominatim
  // address search dropdown in manual mode.
  const pickSuggestion = (result) => {
    setAddressSearch(result.display_name || "");
    setCoords({ lat: parseFloat(result.lat), lng: parseFloat(result.lon) });
    applyNominatimAddress(result);
    setShowSuggestions(false);
  };

  const addonTotal = (addons.materials ? 30 : 0) + (addons.ironing ? 40 : 0);
  const laborTotal = hours * cleaners * RATE_PER_HOUR;
  const total = laborTotal + addonTotal;

  const locationReady =
    (locationMode === "current" && geoStatus === "success" && city.trim() && district.trim() && building.trim()) ||
    (locationMode === "manual" && city.trim() && district.trim() && building.trim());
  const step2Valid = Boolean(selectedDate && slot && locationReady);

  const toggleAddon = (id) => setAddons((prev) => ({ ...prev, [id]: !prev[id] }));

  const goNext = () => {
    if (step === 2 && !step2Valid) return;
    setStep((s) => Math.min(3, s + 1));
  };
  const goBack = () => setStep((s) => Math.max(1, s - 1));

  // Fires once Moyasar's hosted form reports a completed payment. We still
  // ask our own backend to independently confirm it with Moyasar's secret
  // key before treating the booking as real — see /api/payments/verify.
  const handlePaid = async (moyasarPayment) => {
    setPaymentStatus("processing");
    setPaymentError("");
    try {
      const { order } = await apiRequest("/api/payments/verify", {
        method: "POST",
        auth: true,
        body: {
          paymentId: moyasarPayment.id,
          booking: {
            hours,
            cleaners,
            addons,
            city,
            district,
            building,
            visitDate: selectedDate.toDateString(),
            timeSlot: TIME_SLOTS.find((t) => t.id === slot)?.label || slot,
            amount: total,
          },
        },
      });
      setConfirmedOrder(order);
      setPaymentStatus("idle");
      setShowSuccess(true);
    } catch (err) {
      setPaymentStatus("error");
      setPaymentError(err.message || "We couldn't confirm your payment. You have not been charged twice.");
    }
  };

  const handlePaymentError = (message) => {
    setPaymentStatus("error");
    setPaymentError(message);
  };

  // Places the order immediately with no payment gateway involved — cash
  // is settled directly with the cleaning team on the day of service.
  const handleCodConfirm = async () => {
    setPaymentStatus("processing");
    setPaymentError("");
    try {
      const { order } = await apiRequest("/api/payments/cod", {
        method: "POST",
        auth: true,
        body: {
          booking: {
            hours,
            cleaners,
            addons,
            city,
            district,
            building,
            visitDate: selectedDate.toDateString(),
            timeSlot: TIME_SLOTS.find((t) => t.id === slot)?.label || slot,
            amount: total,
          },
        },
      });
      setConfirmedOrder(order);
      setPaymentStatus("idle");
      setShowSuccess(true);
    } catch (err) {
      setPaymentStatus("error");
      setPaymentError(err.message || "Couldn't place your order. Please try again.");
    }
  };

  const resetAll = () => {
    setShowSuccess(false);
    setStep(1);
    setHours(1);
    setCleaners(1);
    setAddons({ materials: false, ironing: false });
    setSelectedDate(days[0]);
    setSlot(null);
    setCity("");
    setDistrict("");
    setBuilding("");
    setAddressSearch("");
    setLocationMode(null);
    setGeoStatus("idle");
    setGeoError("");
    setCoords(null);
    setFormattedAddress("");
    setShowSuggestions(false);
    setPaymentMode("cod");
    setPaymentStatus("idle");
    setPaymentError("");
    setConfirmedOrder(null);
  };

  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: palette.bg, ...fontBody }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Header */}
      <header className="border-b" style={{ borderColor: palette.line, backgroundColor: palette.surface }}>
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            {onBackToServices && (
              <button
                type="button"
                onClick={onBackToServices}
                className="flex items-center gap-1 text-xs font-semibold shrink-0"
                style={{ color: palette.inkMuted }}
              >
                <ChevronLeft size={14} />
                All services
              </button>
            )}
            <div className="flex items-center gap-3">
              <div
                className="w-10 h-10 rounded-xl flex items-center justify-center"
                style={{ backgroundColor: palette.primary }}
              >
                <Home size={20} color="#fff" />
              </div>
              <div>
                <h1 className="text-lg font-extrabold leading-tight" style={{ ...fontDisplay, color: palette.ink }}>
                  Manzili
                </h1>
                <p className="text-[11px] leading-tight" style={{ color: palette.inkMuted }}>
                  نظافة منزلك، بثقة · Home cleaning across the Kingdom
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full"
              style={{ backgroundColor: palette.accentTint, color: palette.accent }}
            >
              <ShieldCheck size={14} />
              Verified Cleaners
            </div>
            {user && (
              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium" style={{ color: palette.inkMuted }}>
                  <UserCircle2 size={16} />
                  {user.name}
                </div>
                <button
                  type="button"
                  onClick={() => setShowHistory(true)}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full"
                  style={{ backgroundColor: palette.primaryTint, color: palette.primary }}
                >
                  <History size={13} />
                  My Orders
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-full"
                  style={{ backgroundColor: palette.sand, color: palette.ink }}
                >
                  <LogOut size={13} />
                  Log out
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-5 py-6 md:py-10 flex flex-col md:flex-row gap-8 md:gap-12">
        {/* Progress rail */}
        <div className="md:w-48 shrink-0">
          <StepRail current={step} />
        </div>

        {/* Main content */}
        <div className="flex-1 pb-28">
          {step === 1 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold" style={{ ...fontDisplay, color: palette.ink }}>
                  Configure your cleaning
                </h2>
                <p className="text-sm mt-1" style={{ color: palette.inkMuted }}>
                  Set the scope of the visit — pricing updates as you go.
                </p>
              </div>

              {/* Service card */}
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: palette.surface, border: `1px solid ${palette.line}` }}
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: palette.accentTint }}
                    >
                      <Sparkles size={20} style={{ color: palette.accent }} />
                    </div>
                    <div>
                      <p className="font-bold text-[15px]" style={{ ...fontBody, color: palette.ink }}>
                        Hourly Cleaning
                      </p>
                      <p className="text-xs" style={{ color: palette.inkMuted }}>
                        Standard home clean, billed per hour
                      </p>
                    </div>
                  </div>
                  <div
                    className="text-sm font-bold px-3 py-1.5 rounded-full shrink-0"
                    style={{ backgroundColor: palette.primaryTint, color: palette.primary }}
                  >
                    {RATE_PER_HOUR} SAR/hr
                  </div>
                </div>

                <div className="divide-y" style={{ borderColor: palette.line }}>
                  <div style={{ borderTop: `1px solid ${palette.line}` }}>
                    <Counter
                      label="Hours"
                      sub="Duration of the visit"
                      icon={Clock}
                      value={hours}
                      setValue={setHours}
                      min={1}
                      max={8}
                    />
                  </div>
                  <div style={{ borderTop: `1px solid ${palette.line}` }}>
                    <Counter
                      label="Cleaners"
                      sub="Professionals sent to your home"
                      icon={Users}
                      value={cleaners}
                      setValue={setCleaners}
                      min={1}
                      max={4}
                    />
                  </div>
                </div>
              </div>

              {/* Add-ons */}
              <div>
                <p className="font-bold text-sm mb-3" style={{ ...fontBody, color: palette.ink }}>
                  Add-ons
                </p>
                <div className="space-y-3">
                  {ADDONS.map((addon) => (
                    <AddonRow
                      key={addon.id}
                      addon={addon}
                      checked={addons[addon.id]}
                      onToggle={() => toggleAddon(addon.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-extrabold" style={{ ...fontDisplay, color: palette.ink }}>
                  Schedule &amp; location
                </h2>
                <p className="text-sm mt-1" style={{ color: palette.inkMuted }}>
                  Choose when the team should arrive and where.
                </p>
              </div>

              {/* Date strip */}
              <div>
                <p className="font-bold text-sm mb-3" style={{ color: palette.ink }}>
                  Select a date
                </p>
                <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
                  {days.map((d, i) => {
                    const isSelected = d.toDateString() === selectedDate.toDateString();
                    return (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setSelectedDate(d)}
                        className="flex flex-col items-center justify-center rounded-xl px-3.5 py-3 shrink-0 transition"
                        style={{
                          backgroundColor: isSelected ? palette.primary : palette.surface,
                          border: `1px solid ${isSelected ? palette.primary : palette.line}`,
                          minWidth: 60,
                        }}
                      >
                        <span
                          className="text-[10px] font-semibold uppercase"
                          style={{ color: isSelected ? "#fff" : palette.inkMuted }}
                        >
                          {DAY_ABBR[d.getDay()]}
                        </span>
                        <span
                          className="text-lg font-extrabold"
                          style={{ ...fontDisplay, color: isSelected ? "#fff" : palette.ink }}
                        >
                          {d.getDate()}
                        </span>
                        <span
                          className="text-[10px] font-semibold uppercase"
                          style={{ color: isSelected ? "#fff" : palette.inkMuted }}
                        >
                          {MONTH_ABBR[d.getMonth()]}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Time slots */}
              <div>
                <p className="font-bold text-sm mb-3" style={{ color: palette.ink }}>
                  Select a time slot
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {TIME_SLOTS.map((t) => {
                    const Icon = t.icon;
                    const isSelected = slot === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setSlot(t.id)}
                        className="flex sm:flex-col items-center sm:items-start gap-3 sm:gap-2 rounded-xl p-4 transition text-left"
                        style={{
                          backgroundColor: isSelected ? palette.primaryTint : palette.surface,
                          border: `1px solid ${isSelected ? palette.primary : palette.line}`,
                        }}
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: isSelected ? palette.primary : palette.sand }}
                        >
                          <Icon size={16} color={isSelected ? "#fff" : palette.ink} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: palette.ink }}>
                            {t.label}
                          </p>
                          <p className="text-xs" style={{ color: palette.inkMuted }}>
                            {t.range}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Address */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <MapPin size={16} style={{ color: palette.primary }} />
                    <p className="font-bold text-sm" style={{ color: palette.ink }}>
                      Saudi National Address
                    </p>
                  </div>
                  {locationMode && (
                    <button
                      type="button"
                      onClick={() => {
                        setLocationMode(null);
                        setGeoStatus("idle");
                        setGeoError("");
                      }}
                      className="flex items-center gap-1 text-xs font-semibold"
                      style={{ color: palette.primary }}
                    >
                      <RotateCcw size={12} />
                      Change method
                    </button>
                  )}
                </div>

                <div
                  className="rounded-2xl p-5"
                  style={{ backgroundColor: palette.surface, border: `1px solid ${palette.line}` }}
                >
                  {/* Choice: current location vs manual entry */}
                  {locationMode === null && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={detectCurrentLocation}
                        className="flex flex-col items-center text-center gap-2 rounded-xl p-5 transition"
                        style={{ border: `1px solid ${palette.line}`, backgroundColor: palette.primaryTint }}
                      >
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: palette.primary }}
                        >
                          <LocateFixed size={20} color="#fff" />
                        </div>
                        <p className="font-semibold text-sm" style={{ color: palette.ink }}>
                          Use current location
                        </p>
                        <p className="text-xs" style={{ color: palette.inkMuted }}>
                          We'll ask your browser for permission, then fill in your address for you
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={switchToManual}
                        className="flex flex-col items-center text-center gap-2 rounded-xl p-5 transition"
                        style={{ border: `1px solid ${palette.line}`, backgroundColor: palette.bg }}
                      >
                        <div
                          className="w-11 h-11 rounded-full flex items-center justify-center"
                          style={{ backgroundColor: palette.sand }}
                        >
                          <PenLine size={20} style={{ color: palette.ink }} />
                        </div>
                        <p className="font-semibold text-sm" style={{ color: palette.ink }}>
                          Enter address manually
                        </p>
                        <p className="text-xs" style={{ color: palette.inkMuted }}>
                          Type your city, district and building yourself
                        </p>
                      </button>
                    </div>
                  )}

                  {/* Current location flow */}
                  {locationMode === "current" && (
                    <div className="space-y-4">
                      {geoStatus === "requesting" && (
                        <div
                          className="flex items-center gap-3 rounded-xl p-4"
                          style={{ backgroundColor: palette.bg }}
                        >
                          <Loader2 size={18} className="animate-spin" style={{ color: palette.primary }} />
                          <p className="text-sm font-medium" style={{ color: palette.ink }}>
                            Requesting location access — check your browser's permission prompt.
                          </p>
                        </div>
                      )}

                      {geoStatus === "error" && (
                        <div
                          className="flex items-start gap-3 rounded-xl p-4"
                          style={{ backgroundColor: palette.accentTint }}
                        >
                          <AlertCircle size={18} className="shrink-0 mt-0.5" style={{ color: palette.danger }} />
                          <div className="flex-1">
                            <p className="text-sm font-medium" style={{ color: palette.ink }}>
                              {geoError}
                            </p>
                            <div className="flex gap-3 mt-2">
                              <button
                                type="button"
                                onClick={detectCurrentLocation}
                                className="text-xs font-bold"
                                style={{ color: palette.primary }}
                              >
                                Try again
                              </button>
                              <button
                                type="button"
                                onClick={switchToManual}
                                className="text-xs font-bold"
                                style={{ color: palette.primary }}
                              >
                                Enter manually instead
                              </button>
                            </div>
                          </div>
                        </div>
                      )}

                      {geoStatus === "success" && coords && (
                        <>
                          <MapPreview coords={coords} />
                          {formattedAddress && (
                            <p className="text-xs" style={{ color: palette.inkMuted }}>
                              Detected near: <span style={{ color: palette.ink }}>{formattedAddress}</span>
                            </p>
                          )}
                          <p className="text-xs" style={{ color: palette.inkMuted }}>
                            Confirm or edit the details below — they'll be used for your booking.
                          </p>
                          <div>
                            <label className="text-xs font-semibold block mb-1.5" style={{ color: palette.inkMuted }}>
                              City
                            </label>
                            <input
                              list="saudi-cities"
                              type="text"
                              value={city}
                              onChange={(e) => setCity(e.target.value)}
                              placeholder="e.g. Riyadh"
                              className="w-full rounded-lg px-3 py-2.5 text-sm font-medium outline-none"
                              style={{ border: `1px solid ${palette.line}`, color: palette.ink }}
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label
                                className="text-xs font-semibold block mb-1.5"
                                style={{ color: palette.inkMuted }}
                              >
                                District
                              </label>
                              <input
                                type="text"
                                value={district}
                                onChange={(e) => setDistrict(e.target.value)}
                                placeholder="e.g. Al Olaya"
                                className="w-full rounded-lg px-3 py-2.5 text-sm font-medium outline-none"
                                style={{ border: `1px solid ${palette.line}`, color: palette.ink }}
                              />
                            </div>
                            <div>
                              <label
                                className="text-xs font-semibold block mb-1.5"
                                style={{ color: palette.inkMuted }}
                              >
                                Building / Villa #
                              </label>
                              <div className="relative">
                                <Building2
                                  size={15}
                                  className="absolute left-3 top-1/2 -translate-y-1/2"
                                  style={{ color: palette.inkMuted }}
                                />
                                <input
                                  type="text"
                                  value={building}
                                  onChange={(e) => setBuilding(e.target.value)}
                                  placeholder="e.g. Villa 12"
                                  className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium outline-none"
                                  style={{ border: `1px solid ${palette.line}`, color: palette.ink }}
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  {/* Manual entry flow */}
                  {locationMode === "manual" && (
                    <div className="space-y-4">
                      <div className="relative">
                        <label className="text-xs font-semibold block mb-1.5" style={{ color: palette.inkMuted }}>
                          Search address (optional)
                        </label>
                        <div className="relative">
                          <Search
                            size={15}
                            className="absolute left-3 top-1/2 -translate-y-1/2"
                            style={{ color: palette.inkMuted }}
                          />
                          <input
                            type="text"
                            value={addressSearch}
                            onChange={(e) => {
                              setAddressSearch(e.target.value);
                              setShowSuggestions(true);
                            }}
                            onFocus={() => setShowSuggestions(true)}
                            onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                            placeholder="Start typing an address in Saudi Arabia..."
                            className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium outline-none"
                            style={{ border: `1px solid ${palette.line}`, color: palette.ink }}
                          />
                          {searching && (
                            <Loader2
                              size={15}
                              className="absolute right-3 top-1/2 -translate-y-1/2 animate-spin"
                              style={{ color: palette.inkMuted }}
                            />
                          )}
                        </div>
                        <p className="text-[11px] mt-1" style={{ color: palette.inkMuted }}>
                          Picking a suggestion fills in the city and district automatically.
                        </p>

                        {showSuggestions && suggestions.length > 0 && (
                          <div
                            className="absolute z-10 left-0 right-0 mt-1 rounded-xl overflow-hidden shadow-lg"
                            style={{ backgroundColor: palette.surface, border: `1px solid ${palette.line}` }}
                          >
                            {suggestions.map((s) => (
                              <button
                                key={s.place_id}
                                type="button"
                                onClick={() => pickSuggestion(s)}
                                className="w-full text-left px-3 py-2.5 text-sm transition"
                                style={{ color: palette.ink, borderBottom: `1px solid ${palette.line}` }}
                              >
                                {s.display_name}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>

                      <div>
                        <label className="text-xs font-semibold block mb-1.5" style={{ color: palette.inkMuted }}>
                          City
                        </label>
                        <input
                          list="saudi-cities"
                          type="text"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          placeholder="e.g. Riyadh"
                          className="w-full rounded-lg px-3 py-2.5 text-sm font-medium outline-none"
                          style={{ border: `1px solid ${palette.line}`, color: palette.ink }}
                        />
                        <datalist id="saudi-cities">
                          {SAUDI_CITIES.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-semibold block mb-1.5" style={{ color: palette.inkMuted }}>
                            District
                          </label>
                          <input
                            type="text"
                            value={district}
                            onChange={(e) => setDistrict(e.target.value)}
                            placeholder="e.g. Al Olaya"
                            className="w-full rounded-lg px-3 py-2.5 text-sm font-medium outline-none"
                            style={{ border: `1px solid ${palette.line}`, color: palette.ink }}
                          />
                        </div>
                        <div>
                          <label className="text-xs font-semibold block mb-1.5" style={{ color: palette.inkMuted }}>
                            Building / Villa #
                          </label>
                          <div className="relative">
                            <Building2
                              size={15}
                              className="absolute left-3 top-1/2 -translate-y-1/2"
                              style={{ color: palette.inkMuted }}
                            />
                            <input
                              type="text"
                              value={building}
                              onChange={(e) => setBuilding(e.target.value)}
                              placeholder="e.g. Villa 12"
                              className="w-full rounded-lg pl-9 pr-3 py-2.5 text-sm font-medium outline-none"
                              style={{ border: `1px solid ${palette.line}`, color: palette.ink }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6">
              <div>
                <h2 className="text-2xl font-extrabold" style={{ ...fontDisplay, color: palette.ink }}>
                  Checkout
                </h2>
                <p className="text-sm mt-1" style={{ color: palette.inkMuted }}>
                  Review your order and choose how to pay.
                </p>
              </div>

              {/* Order summary */}
              <div
                className="rounded-2xl p-5"
                style={{ backgroundColor: palette.surface, border: `1px solid ${palette.line}` }}
              >
                <p className="font-bold text-sm mb-4" style={{ color: palette.ink }}>
                  Order summary
                </p>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <span style={{ color: palette.inkMuted }}>
                      Duration ({hours} hrs × {cleaners} {cleaners > 1 ? "cleaners" : "cleaner"} × {RATE_PER_HOUR} SAR)
                    </span>
                    <span className="font-semibold tabular-nums" style={{ color: palette.ink }}>
                      {laborTotal} SAR
                    </span>
                  </div>
                  {addons.materials && (
                    <div className="flex justify-between">
                      <span style={{ color: palette.inkMuted }}>Cleaning materials</span>
                      <span className="font-semibold tabular-nums" style={{ color: palette.ink }}>
                        30 SAR
                      </span>
                    </div>
                  )}
                  {addons.ironing && (
                    <div className="flex justify-between">
                      <span style={{ color: palette.inkMuted }}>Ironing service</span>
                      <span className="font-semibold tabular-nums" style={{ color: palette.ink }}>
                        40 SAR
                      </span>
                    </div>
                  )}
                  {!addons.materials && !addons.ironing && (
                    <div className="flex justify-between">
                      <span style={{ color: palette.inkMuted }}>Add-ons</span>
                      <span className="font-semibold" style={{ color: palette.inkMuted }}>
                        None
                      </span>
                    </div>
                  )}
                  <div className="pt-3 flex justify-between items-center" style={{ borderTop: `1px dashed ${palette.line}` }}>
                    <span className="font-bold" style={{ color: palette.ink }}>
                      Total
                    </span>
                    <span className="font-extrabold text-lg tabular-nums" style={{ ...fontDisplay, color: palette.primary }}>
                      {total} SAR
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-4 text-xs space-y-1" style={{ borderTop: `1px solid ${palette.line}`, color: palette.inkMuted }}>
                  <p>
                    {selectedDate.toDateString()} · {TIME_SLOTS.find((t) => t.id === slot)?.label || "No slot selected"}
                  </p>
                  <p>
                    {building}, {district}, {city}
                  </p>
                </div>
              </div>

              {/* Payment */}
              <div>
                <p className="font-bold text-sm mb-3" style={{ color: palette.ink }}>
                  Payment method
                </p>

                <div className="flex gap-2 mb-4">
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("cod");
                      setPaymentStatus("idle");
                      setPaymentError("");
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition"
                    style={{
                      backgroundColor: paymentMode === "cod" ? palette.primary : palette.surface,
                      color: paymentMode === "cod" ? "#fff" : palette.ink,
                      border: `1px solid ${paymentMode === "cod" ? palette.primary : palette.line}`,
                    }}
                  >
                    <Banknote size={16} />
                    Cash on Delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentMode("online");
                      setPaymentStatus("idle");
                      setPaymentError("");
                    }}
                    className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition"
                    style={{
                      backgroundColor: paymentMode === "online" ? palette.primary : palette.surface,
                      color: paymentMode === "online" ? "#fff" : palette.ink,
                      border: `1px solid ${paymentMode === "online" ? palette.primary : palette.line}`,
                    }}
                  >
                    <CreditCard size={16} />
                    Pay Online
                  </button>
                </div>

                <div
                  className="rounded-2xl p-5"
                  style={{ backgroundColor: palette.surface, border: `1px solid ${palette.line}` }}
                >
                  {paymentStatus === "error" && (
                    <div
                      className="flex items-start gap-2 rounded-xl p-3 mb-4 text-sm"
                      style={{ backgroundColor: palette.accentTint, color: palette.danger }}
                    >
                      <AlertCircle size={16} className="shrink-0 mt-0.5" />
                      <span>{paymentError}</span>
                    </div>
                  )}

                  {paymentMode === "cod" ? (
                    <>
                      <div className="flex items-start gap-3 mb-4">
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: palette.primaryTint }}
                        >
                          <Banknote size={18} style={{ color: palette.primary }} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm" style={{ color: palette.ink }}>
                            Pay with cash when the cleaner arrives
                          </p>
                          <p className="text-xs mt-0.5" style={{ color: palette.inkMuted }}>
                            No card needed now — settle {total} SAR directly with the team on the day of service.
                          </p>
                        </div>
                      </div>

                      {paymentStatus === "processing" ? (
                        <div className="flex items-center gap-2 text-sm py-3 justify-center" style={{ color: palette.inkMuted }}>
                          <Loader2 size={18} className="animate-spin" />
                          Placing your order…
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleCodConfirm}
                          className="w-full py-3 rounded-xl font-semibold text-sm"
                          style={{ backgroundColor: palette.primary, color: "#fff" }}
                        >
                          Confirm Booking — Pay {total} SAR in Cash
                        </button>
                      )}
                    </>
                  ) : (
                    <>
                      <p className="text-xs mb-4" style={{ color: palette.inkMuted }}>
                        Enter Mada, credit/debit card, Apple Pay, or STC Pay details below — handled securely by
                        Moyasar, never stored on our servers.
                      </p>

                      {paymentStatus === "processing" ? (
                        <div className="flex items-center gap-2 text-sm py-6 justify-center" style={{ color: palette.inkMuted }}>
                          <Loader2 size={18} className="animate-spin" />
                          Confirming your payment…
                        </div>
                      ) : (
                        <PaymentForm
                          amountSar={total}
                          description={`Manzili — ${hours}h × ${cleaners} cleaner(s)`}
                          onPaid={handlePaid}
                          onError={handlePaymentError}
                        />
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sticky footer bar */}
      <div
        className="fixed bottom-0 left-0 right-0 border-t"
        style={{ backgroundColor: palette.surface, borderColor: palette.line, boxShadow: "0 -4px 20px rgba(20,35,31,0.06)" }}
      >
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: palette.inkMuted }}>
              Total
            </p>
            <p className="text-xl font-extrabold tabular-nums" style={{ ...fontDisplay, color: palette.ink }}>
              {total} <span className="text-sm font-bold" style={{ color: palette.accent }}>SAR</span>
            </p>
          </div>
          <div className="flex items-center gap-3">
            {step > 1 && (
              <button
                type="button"
                onClick={goBack}
                className="flex items-center gap-1 px-4 py-3 rounded-xl font-semibold text-sm transition active:scale-95"
                style={{ backgroundColor: palette.sand, color: palette.ink }}
              >
                <ChevronLeft size={16} />
                Back
              </button>
            )}
            {step < 3 && (
              <button
                type="button"
                onClick={goNext}
                disabled={step === 2 && !step2Valid}
                className="flex items-center gap-1 px-6 py-3 rounded-xl font-semibold text-sm transition active:scale-95 disabled:opacity-40 disabled:active:scale-100"
                style={{ backgroundColor: palette.primary, color: "#fff" }}
              >
                Next
                <ChevronRight size={16} />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Success modal */}
      {showSuccess && confirmedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-5"
          style={{ backgroundColor: "rgba(20,35,31,0.55)" }}
        >
          <div
            className="w-full max-w-sm rounded-2xl p-6 relative animate-[fadeIn_200ms_ease]"
            style={{ backgroundColor: palette.surface }}
          >
            <button
              type="button"
              onClick={resetAll}
              className="absolute top-4 right-4 w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: palette.bg }}
              aria-label="Close"
            >
              <X size={16} style={{ color: palette.ink }} />
            </button>

            <div className="flex flex-col items-center text-center pt-2">
              <div
                className="w-16 h-16 rounded-full flex items-center justify-center mb-4"
                style={{ backgroundColor: palette.primaryTint }}
              >
                <CheckCircle2 size={34} style={{ color: palette.primary }} />
              </div>
              <h3 className="text-xl font-extrabold" style={{ ...fontDisplay, color: palette.ink }}>
                {confirmedOrder.payment_method === "cod" ? "Booking Confirmed" : "Payment Confirmed"}
              </h3>
              <p className="text-sm mt-1" style={{ color: palette.inkMuted }}>
                {confirmedOrder.payment_method === "cod"
                  ? `Your cleaning team is scheduled. Have ${confirmedOrder.amount_sar} SAR ready in cash on arrival. A receipt has been emailed to ${user?.email}.`
                  : `Your cleaning team is scheduled. A receipt has been emailed to ${user?.email}.`}
              </p>

              <div
                className="mt-5 w-full rounded-xl px-4 py-3 flex items-center justify-between"
                style={{ backgroundColor: palette.accentTint }}
              >
                <span className="text-xs font-semibold" style={{ color: palette.inkMuted }}>
                  Booking Reference
                </span>
                <span className="font-extrabold tabular-nums" style={{ ...fontDisplay, color: palette.accent }}>
                  {confirmedOrder.booking_ref}
                </span>
              </div>

              <div className="mt-4 w-full text-sm text-left space-y-1.5 px-1">
                <div className="flex justify-between">
                  <span style={{ color: palette.inkMuted }}>Date &amp; time</span>
                  <span className="font-semibold" style={{ color: palette.ink }}>
                    {confirmedOrder.visit_date} · {confirmedOrder.time_slot}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: palette.inkMuted }}>Location</span>
                  <span className="font-semibold" style={{ color: palette.ink }}>
                    {confirmedOrder.city}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span style={{ color: palette.inkMuted }}>Payment method</span>
                  <span className="font-semibold" style={{ color: palette.ink }}>
                    {confirmedOrder.payment_method === "cod" ? "Cash on Delivery" : confirmedOrder.payment_method}
                  </span>
                </div>
                <div className="flex justify-between pt-1.5" style={{ borderTop: `1px dashed ${palette.line}` }}>
                  <span className="font-bold" style={{ color: palette.ink }}>
                    {confirmedOrder.payment_method === "cod" ? "Amount due in cash" : "Amount paid"}
                  </span>
                  <span className="font-extrabold" style={{ color: palette.primary }}>
                    {confirmedOrder.amount_sar} SAR
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={resetAll}
                className="mt-6 w-full py-3 rounded-xl font-semibold text-sm"
                style={{ backgroundColor: palette.primary, color: "#fff" }}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {showHistory && <OrderHistory onClose={() => setShowHistory(false)} />}
    </div>
  );
}
