import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "reset">("login");
  const [email, setEmail] = useState("m.reyes@dealcenter.io");
  const [pwd, setPwd] = useState("");

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      localStorage.setItem("dc_auth", "1");
      navigate({ to: "/dashboard" });
    } else {
      alert("Recovery link sent.");
      setMode("login");
    }
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex flex-col justify-between w-1/2 bg-charcoal text-white p-12 relative overflow-hidden">
        <div
          aria-hidden
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage:
              "linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)",
            backgroundSize: "32px 32px",
          }}
        />
        <div className="relative flex items-center gap-2.5">
          <div className="size-8 rounded-md bg-primary flex items-center justify-center">
            <div
              className="size-3.5 bg-white"
              style={{
                clipPath: "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)",
              }}
            />
          </div>
          <div className="leading-tight">
            <div className="text-[14px] font-semibold tracking-tight">
              DealCenter
            </div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/55">
              Opportunity Intelligence
            </div>
          </div>
        </div>

        <div className="relative max-w-md space-y-5">
          <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full bg-white/8 text-[10px] uppercase tracking-wider text-white/70">
            <span className="size-1.5 rounded-full bg-[#de422f]" /> Live
            pipeline
          </div>
          <h2 className="text-[26px] leading-[1.2] font-medium tracking-tight">
            Cut through 4,800+ construction signals to the 12 deals worth your
            week.
          </h2>
          <p className="text-[13px] text-white/65 leading-relaxed max-w-sm">
            Continuous ingestion from ConstructConnect and Dodge Construction
            Central, ranked by revenue opportunity and change velocity.
          </p>
        </div>

        <div className="relative grid grid-cols-3 gap-6 text-white/70">
          <Stat label="Projects ingested" value="4,823" />
          <Stat label="Qualified" value="64" />
          <Stat label="Revenue tracked" value="$2.4M" />
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <div className="size-7 rounded-md bg-charcoal flex items-center justify-center">
              <div
                className="size-3 bg-primary"
                style={{
                  clipPath: "polygon(0 0, 100% 0, 100% 70%, 70% 100%, 0 100%)",
                }}
              />
            </div>
            <span className="font-semibold tracking-tight">DealCenter</span>
          </div>

          <h1 className="text-[22px] font-semibold tracking-tight text-charcoal">
            {mode === "login" ? "Sign in to DealCenter" : "Reset your password"}
          </h1>
          <p className="text-[13px] text-muted-foreground mt-1.5">
            {mode === "login"
              ? "Access your team's live opportunity pipeline."
              : "Enter your email and we'll send a recovery link."}
          </p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <Field label="Work email">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-10 w-full rounded-md border border-input bg-surface px-3 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/60"
              />
            </Field>

            {mode === "login" && (
              <Field
                label="Password"
                trailing={
                  <button
                    type="button"
                    onClick={() => setMode("reset")}
                    className="text-[11.5px] text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                }
              >
                <input
                  type="password"
                  required
                  value={pwd}
                  onChange={(e) => setPwd(e.target.value)}
                  placeholder="••••••••"
                  className="h-10 w-full rounded-md border border-input bg-surface px-3 text-[13.5px] focus:outline-none focus:ring-2 focus:ring-ring/40 focus:border-ring/60"
                />
              </Field>
            )}

            <button
              type="submit"
              className="h-10 w-full rounded-md bg-charcoal text-white text-[13px] font-medium hover:bg-black/85 transition-colors"
            >
              {mode === "login" ? "Sign in" : "Send recovery link"}
            </button>

            {mode === "reset" && (
              <button
                type="button"
                onClick={() => setMode("login")}
                className="text-[12px] text-muted-foreground hover:text-foreground w-full text-center"
              >
                ← Back to sign in
              </button>
            )}
          </form>

          <div className="mt-10 pt-5 border-t border-border text-[11px] text-muted-foreground flex justify-between">
            <span>© DealCenter 2026</span>
            <a className="hover:text-foreground" href="#">
              Security
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  trailing,
  children,
}: {
  label: string;
  trailing?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        {trailing}
      </div>
      {children}
    </label>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[18px] font-medium text-white num">{value}</div>
      <div className="text-[10px] uppercase tracking-wider text-white/45 mt-0.5">
        {label}
      </div>
    </div>
  );
}
