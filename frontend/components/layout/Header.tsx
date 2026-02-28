"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

const services = [
  { name: "Networking", href: "/services/networking" },
  { name: "Smart Home", href: "/services/smart-home" },
  { name: "Cameras", href: "/services/cameras" },
  { name: "Structured Wiring", href: "/services/wiring" },
];

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [servicesOpen, setServicesOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 50);
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300 ${
        scrolled
          ? "border-border bg-background/90 backdrop-blur-xl shadow-[0_1px_20px_rgba(22,163,74,0.06)]"
          : "border-transparent bg-background/60 backdrop-blur-md"
      }`}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="flex items-center gap-2 font-heading text-xl font-bold text-foreground">
          <i className="fas fa-network-wired text-sm text-green" />
          Action Jackson<span className="text-green"> Installs</span>
        </Link>

        {/* Desktop nav */}
        <div className="hidden items-center gap-8 md:flex">
          <Link href="/" className="text-sm text-muted transition-colors hover:text-foreground">
            Home
          </Link>

          {/* Services dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setServicesOpen(true)}
            onMouseLeave={() => setServicesOpen(false)}
          >
            <button className="flex items-center gap-1 text-sm text-muted transition-colors hover:text-foreground">
              Services
              <svg className={`h-4 w-4 transition-transform ${servicesOpen ? "rotate-180" : ""}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>
            <AnimatePresence>
              {servicesOpen && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, y: -4 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute left-0 top-full pt-2"
                >
                  <div className="w-48 rounded-lg border border-border bg-surface p-2 shadow-lg glass">
                    {services.map((s) => (
                      <Link
                        key={s.href}
                        href={s.href}
                        className="block rounded-md px-3 py-2 text-sm text-muted transition-colors hover:bg-surface-light hover:text-foreground"
                      >
                        {s.name}
                      </Link>
                    ))}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <Link href="/about" className="text-sm text-muted transition-colors hover:text-foreground">
            About
          </Link>

          <Link
            href="/get-started"
            className="rounded-lg bg-gradient-to-r from-green to-green-dark px-4 py-2 text-sm font-semibold text-white shadow-glow transition-all hover:shadow-glow-lg hover:brightness-110 animate-pulse-glow"
          >
            Get Started
          </Link>
        </div>

        {/* Mobile hamburger */}
        <button
          className="md:hidden text-foreground"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="Toggle menu"
        >
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            {mobileOpen ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            )}
          </svg>
        </button>
      </nav>

      {/* Mobile menu */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-border bg-surface md:hidden"
          >
            <div className="flex flex-col gap-3 px-6 py-4">
              <Link href="/" onClick={() => setMobileOpen(false)} className="text-sm text-muted hover:text-foreground">
                Home
              </Link>
              {services.map((s) => (
                <Link key={s.href} href={s.href} onClick={() => setMobileOpen(false)} className="pl-3 text-sm text-muted hover:text-foreground">
                  {s.name}
                </Link>
              ))}
              <Link href="/about" onClick={() => setMobileOpen(false)} className="text-sm text-muted hover:text-foreground">
                About
              </Link>
              <Link
                href="/get-started"
                onClick={() => setMobileOpen(false)}
                className="mt-2 rounded-lg bg-gradient-to-r from-green to-green-dark px-4 py-2 text-center text-sm font-semibold text-white"
              >
                Get Started
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
