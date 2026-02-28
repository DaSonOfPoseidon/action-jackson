import Link from "next/link";

export function Footer() {
  return (
    <footer className="relative border-t border-border bg-surface">
      {/* Gradient top border */}
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-green via-purple to-orange" />

      {/* Dot grid background */}
      <div className="absolute inset-0 dot-grid opacity-[0.03] pointer-events-none" />

      <div className="relative mx-auto max-w-7xl px-6 py-16">
        <div className="grid gap-8 md:grid-cols-3">
          <div>
            <h3 className="font-heading text-lg font-bold text-foreground">
              Action Jackson<span className="text-green"> Installs</span>
            </h3>
            <p className="mt-2 text-sm text-muted">
              Engineered home networking &amp; smart infrastructure.
            </p>
            <p className="mt-1 font-mono text-xs text-muted/60">
              Columbia, MO &middot; Precision infrastructure
            </p>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Services
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/services/networking" className="text-muted hover:text-foreground transition-colors">Networking</Link></li>
              <li><Link href="/services/smart-home" className="text-muted hover:text-foreground transition-colors">Smart Home</Link></li>
              <li><Link href="/services/cameras" className="text-muted hover:text-foreground transition-colors">Cameras</Link></li>
              <li><Link href="/services/wiring" className="text-muted hover:text-foreground transition-colors">Structured Wiring</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted">
              Quick Links
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link href="/get-started" className="text-muted hover:text-foreground transition-colors">Schedule Consultation</Link></li>
              <li><Link href="/about" className="text-muted hover:text-foreground transition-colors">About</Link></li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-border pt-6 text-center text-sm text-muted">
          &copy; {new Date().getFullYear()} Action Jackson Installs. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
