import React from "react";
import {
  Sparkles,
  Wind,
  Bug,
  Wrench,
  Zap,
  PaintRoller,
  ChevronRight,
  Clock3,
  Home,
  LogOut,
  UserCircle2,
} from "lucide-react";

const palette = {
  bg: "#F4F6F5",
  surface: "#FFFFFF",
  ink: "#14231F",
  inkMuted: "#5B6B67",
  primary: "#0E5C56",
  primaryTint: "#E3EEEC",
  accent: "#B8862B",
  accentTint: "#F4EAD4",
  sand: "#E7DCC3",
  line: "#E3E7E4",
};

const fontDisplay = { fontFamily: "'Cairo', sans-serif" };
const fontBody = { fontFamily: "'Inter', sans-serif" };

// Only "cleaning" is wired up right now. The rest render — visible, on
// brand, tappable-looking — but are inert, so the catalog reads as "more
// on the way" rather than "half the app is missing".
const SERVICES = [
  {
    id: "cleaning",
    name: "Home Cleaning",
    desc: "Hourly cleaning with vetted professionals",
    icon: Sparkles,
    active: true,
  },
  { id: "ac", name: "AC Service & Repair", desc: "Servicing, gas refill, installation", icon: Wind, active: false },
  { id: "pest", name: "Pest Control", desc: "Cockroach, termite & general treatment", icon: Bug, active: false },
  { id: "plumbing", name: "Plumbing", desc: "Leak fixes, installations & repairs", icon: Wrench, active: false },
  { id: "electrician", name: "Electrician", desc: "Wiring, fixtures & appliance repair", icon: Zap, active: false },
  { id: "painting", name: "Painting", desc: "Interior & exterior wall painting", icon: PaintRoller, active: false },
];

export default function ServiceSelector({ user, onSelect, onLogout }) {
  return (
    <div className="min-h-screen w-full" style={{ backgroundColor: palette.bg, ...fontBody }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');
      `}</style>

      <header className="border-b" style={{ borderColor: palette.line, backgroundColor: palette.surface }}>
        <div className="max-w-5xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: palette.primary }}>
              <Home size={20} color="#fff" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold leading-tight" style={{ ...fontDisplay, color: palette.ink }}>
                Manzili
              </h1>
              <p className="text-[11px] leading-tight" style={{ color: palette.inkMuted }}>
                نظافة منزلك، بثقة · Home services across the Kingdom
              </p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <div className="hidden sm:flex items-center gap-1.5 text-xs font-medium" style={{ color: palette.inkMuted }}>
                <UserCircle2 size={16} />
                {user.name}
              </div>
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
      </header>

      <div className="max-w-5xl mx-auto px-5 py-8 md:py-12">
        <h2 className="text-2xl font-extrabold" style={{ ...fontDisplay, color: palette.ink }}>
          What do you need help with today?
        </h2>
        <p className="text-sm mt-1 mb-8" style={{ color: palette.inkMuted }}>
          More services are on the way — Home Cleaning is live now.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {SERVICES.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                type="button"
                disabled={!s.active}
                onClick={() => s.active && onSelect(s.id)}
                className="relative text-left rounded-2xl p-5 transition"
                style={{
                  backgroundColor: palette.surface,
                  border: `1px solid ${palette.line}`,
                  opacity: s.active ? 1 : 0.55,
                  cursor: s.active ? "pointer" : "not-allowed",
                }}
              >
                {!s.active && (
                  <span
                    className="absolute top-3 right-3 flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full"
                    style={{ backgroundColor: palette.accentTint, color: palette.accent }}
                  >
                    <Clock3 size={10} />
                    Coming Soon
                  </span>
                )}
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center mb-4"
                  style={{ backgroundColor: s.active ? palette.primaryTint : palette.sand }}
                >
                  <Icon size={20} style={{ color: s.active ? palette.primary : palette.inkMuted }} />
                </div>
                <p className="font-bold text-[15px]" style={{ color: palette.ink }}>
                  {s.name}
                </p>
                <p className="text-xs mt-1" style={{ color: palette.inkMuted }}>
                  {s.desc}
                </p>
                {s.active && (
                  <div className="flex items-center gap-1 mt-4 text-xs font-bold" style={{ color: palette.primary }}>
                    Book now
                    <ChevronRight size={14} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
