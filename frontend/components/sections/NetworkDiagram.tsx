"use client";

import { AnimateIn } from "@/components/AnimateIn";

const steps = [
  { icon: "fa-globe", label: "Internet", desc: "ISP uplink" },
  { icon: "fa-shield-alt", label: "Firewall", desc: "Traffic filtering" },
  { icon: "fa-network-wired", label: "PoE Switch", desc: "Power & data" },
  { icon: "fa-wifi", label: "Access Points", desc: "Wireless coverage" },
  { icon: "fa-video", label: "Cameras", desc: "Local recording" },
  { icon: "fa-home", label: "Smart Devices", desc: "IoT automation" },
];

function Arrow() {
  return (
    <svg className="h-4 w-8 text-green/30 hidden md:block" viewBox="0 0 32 16" fill="none">
      <line
        x1="0" y1="8" x2="28" y2="8"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        className="animate-dash"
      />
      <path d="M24 4l4 4-4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VerticalArrow() {
  return (
    <svg className="h-8 w-4 text-green/30 md:hidden mx-auto" viewBox="0 0 16 32" fill="none">
      <line
        x1="8" y1="0" x2="8" y2="28"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeDasharray="4 3"
        className="animate-dash"
      />
      <path d="M4 24l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function NetworkDiagram() {
  return (
    <div className="glass rounded-2xl p-6 md:p-8">
      {/* Desktop: horizontal */}
      <div className="hidden md:flex items-center justify-center gap-1">
        {steps.map((step, i) => (
          <div key={step.label} className="flex items-center gap-1">
            <AnimateIn variant="scale-in" delay={i * 100}>
              <div className="flex flex-col items-center gap-2">
                <div className="flex h-16 w-16 items-center justify-center rounded-xl glass text-green transition-all duration-300 hover:shadow-glow hover:border-green/40">
                  <i className={`fas ${step.icon} text-xl`} />
                </div>
                <span className="font-mono text-[10px] uppercase tracking-wider text-muted">{step.label}</span>
                <span className="text-[10px] text-muted/60">{step.desc}</span>
              </div>
            </AnimateIn>
            {i < steps.length - 1 && <Arrow />}
          </div>
        ))}
      </div>

      {/* Mobile: vertical */}
      <div className="flex flex-col items-center gap-0 md:hidden">
        {steps.map((step, i) => (
          <div key={step.label}>
            <AnimateIn variant="fade-up" delay={i * 80}>
              <div className="flex items-center gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-xl glass text-green">
                  <i className={`fas ${step.icon} text-lg`} />
                </div>
                <div>
                  <span className="font-mono text-xs uppercase tracking-wider text-foreground">{step.label}</span>
                  <p className="text-xs text-muted/60">{step.desc}</p>
                </div>
              </div>
            </AnimateIn>
            {i < steps.length - 1 && <VerticalArrow />}
          </div>
        ))}
      </div>
    </div>
  );
}
