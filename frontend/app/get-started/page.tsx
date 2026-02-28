"use client";

import { useState, FormEvent } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Hero } from "@/components/sections/Hero";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AnimateIn } from "@/components/AnimateIn";
import { submitConsultation } from "@/lib/api";
import { validateName, validateEmail, validatePhone, validateRequired } from "@/lib/validation";

const SQUARE_FOOTAGE_OPTIONS = [
  { value: "Under 1,500", label: "Under 1,500 sq ft" },
  { value: "1,500-2,500", label: "1,500 - 2,500 sq ft" },
  { value: "2,500-3,500", label: "2,500 - 3,500 sq ft" },
  { value: "3,500-5,000", label: "3,500 - 5,000 sq ft" },
  { value: "Over 5,000", label: "Over 5,000 sq ft" },
];

const CURRENT_ISSUES = [
  "Weak WiFi",
  "Dead zones",
  "Slow speeds",
  "Too many devices",
  "No wired connections",
  "Subscription cameras",
  "ISP router only",
  "Smart home issues",
];

const SERVICES = [
  { value: "networking", label: "Networking" },
  { value: "smart-home", label: "Smart Home" },
  { value: "cameras", label: "Cameras" },
  { value: "structured-wiring", label: "Structured Wiring" },
];

const PACKAGES = [
  { value: "foundation", label: "Foundation Network ($799\u2013$1,499)", color: "green" },
  { value: "backbone", label: "Smart Home Backbone ($1,500\u2013$3,500)", color: "purple" },
  { value: "performance", label: "Performance + Protection ($2,500\u2013$6,000)", color: "orange" },
  { value: "standalone", label: "Standalone Services", color: "green" },
  { value: "unsure", label: "Not sure yet", color: "green" },
];

const SECTION_LABELS = ["Contact", "Property", "Issues", "Services", "Package"];

export default function GetStartedPage() {
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    squareFootage: "",
    isp: "",
    currentIssues: [] as string[],
    services: [] as string[],
    package: "",
    honeypot: "",
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  function toggleArrayField(field: "currentIssues" | "services", value: string) {
    setForm((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
  }

  function validate(): boolean {
    const e: Record<string, string> = {};

    const nameErr = validateName(form.name);
    if (nameErr) e.name = nameErr;

    const emailErr = validateEmail(form.email);
    if (emailErr) e.email = emailErr;

    const phoneErr = validatePhone(form.phone);
    if (phoneErr) e.phone = phoneErr;

    const sqftErr = validateRequired(form.squareFootage, "Square footage");
    if (sqftErr) e.squareFootage = sqftErr;

    const svcErr = validateRequired(form.services, "service");
    if (svcErr) e.services = svcErr;

    setErrors(e);
    return Object.keys(e).length === 0;
  }

  async function handleSubmit(ev: FormEvent) {
    ev.preventDefault();
    setSubmitError(null);

    if (!validate()) return;

    setSubmitting(true);

    try {
      const result = await submitConsultation({
        customer: {
          name: form.name,
          email: form.email,
          phone: form.phone || undefined,
        },
        property: {
          squareFootage: form.squareFootage,
          isp: form.isp || undefined,
          currentIssues: form.currentIssues.length > 0 ? form.currentIssues : undefined,
        },
        interestedServices: form.services,
        interestedPackage: form.package || undefined,
        honeypot: form.honeypot || undefined,
      });

      setSuccess(result.message);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  if (success) {
    return (
      <>
        <Hero
          title="Request Received."
          subtitle="We'll review your submission and reach out soon."
        />
        <section className="pb-20">
          <div className="mx-auto max-w-xl px-6">
            <AnimateIn variant="scale-in">
              <Card glass className="text-center">
                {/* Animated checkmark */}
                <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-green-muted/30">
                  <motion.svg
                    className="h-8 w-8 text-green"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <motion.path
                      d="M5 13l4 4L19 7"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 0.5, delay: 0.2 }}
                    />
                  </motion.svg>
                </div>

                {/* Success particles */}
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                  {Array.from({ length: 12 }).map((_, i) => {
                    const angle = (i / 12) * 360;
                    const tx = Math.cos((angle * Math.PI) / 180) * 80;
                    const ty = Math.sin((angle * Math.PI) / 180) * 80;
                    return (
                      <div
                        key={i}
                        className="absolute left-1/2 top-1/3 h-1.5 w-1.5 rounded-full bg-green"
                        style={{
                          ["--tx" as string]: `${tx}px`,
                          ["--ty" as string]: `${ty}px`,
                          animation: `particle-burst 0.8s ease-out ${i * 0.03}s forwards`,
                        }}
                      />
                    );
                  })}
                </div>

                <h2 className="font-heading text-xl font-bold text-foreground">
                  Thank you!
                </h2>
                <p className="mt-3 text-muted">{success}</p>
                <p className="mt-2 text-sm text-muted">
                  Check your inbox for a confirmation.
                </p>
              </Card>
            </AnimateIn>
          </div>
        </section>
      </>
    );
  }

  return (
    <>
      <Hero
        title="Get Started."
        subtitle="Tell us about your home and what you're looking for. We'll send a custom proposal within 24 hours."
      />

      <section className="pb-20">
        <div className="mx-auto max-w-2xl px-6">
          <AnimateIn>
            {/* Progress dots */}
            <div className="mb-8 flex items-center justify-center gap-3">
              {SECTION_LABELS.map((label, i) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className={`h-2 w-2 rounded-full ${i === 0 ? "bg-green shadow-glow" : "bg-border"}`} />
                  <span className="hidden text-[10px] text-muted sm:block">{label}</span>
                </div>
              ))}
            </div>

            <Card glass>
              <form onSubmit={handleSubmit} className="space-y-8">
                {/* Honeypot — hidden from real users */}
                <div className="absolute -left-[9999px]" aria-hidden="true">
                  <input
                    type="text"
                    name="honeypot"
                    tabIndex={-1}
                    autoComplete="off"
                    value={form.honeypot}
                    onChange={(e) => setForm({ ...form, honeypot: e.target.value })}
                  />
                </div>

                {/* Contact info */}
                <div>
                  <h3 className="mb-4 font-heading text-lg font-semibold text-foreground">
                    Contact Information
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="Name *"
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      error={errors.name}
                      placeholder="Your name"
                    />
                    <Input
                      label="Email *"
                      type="email"
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      error={errors.email}
                      placeholder="you@email.com"
                    />
                  </div>
                  <div className="mt-4">
                    <Input
                      label="Phone"
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      error={errors.phone}
                      placeholder="(555) 123-4567"
                    />
                  </div>
                </div>

                {/* Section divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                {/* Property info */}
                <div>
                  <h3 className="mb-4 font-heading text-lg font-semibold text-foreground">
                    Property Details
                  </h3>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Select
                      label="Square Footage *"
                      options={SQUARE_FOOTAGE_OPTIONS}
                      placeholder="Select range"
                      value={form.squareFootage}
                      onChange={(e) => setForm({ ...form, squareFootage: e.target.value })}
                      error={errors.squareFootage}
                    />
                    <Input
                      label="Current ISP"
                      value={form.isp}
                      onChange={(e) => setForm({ ...form, isp: e.target.value })}
                      placeholder="e.g. AT&T, Comcast"
                    />
                  </div>
                </div>

                {/* Section divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                {/* Current issues */}
                <div>
                  <h3 className="mb-4 font-heading text-lg font-semibold text-foreground">
                    Current Issues
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {CURRENT_ISSUES.map((issue) => (
                      <label key={issue} className="flex items-center gap-3 text-sm text-foreground cursor-pointer group">
                        <div className="relative flex h-5 w-5 items-center justify-center">
                          <input
                            type="checkbox"
                            checked={form.currentIssues.includes(issue)}
                            onChange={() => toggleArrayField("currentIssues", issue)}
                            className="peer sr-only"
                          />
                          <div className="h-5 w-5 rounded-md border border-border bg-surface transition-all peer-checked:border-green peer-checked:bg-green peer-focus-visible:ring-2 peer-focus-visible:ring-green/20" />
                          <svg className="absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="group-hover:text-green transition-colors">{issue}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Section divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                {/* Services interested in */}
                <div>
                  <h3 className="mb-4 font-heading text-lg font-semibold text-foreground">
                    Services Interested In *
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {SERVICES.map((svc) => (
                      <label key={svc.value} className="flex items-center gap-3 text-sm text-foreground cursor-pointer group">
                        <div className="relative flex h-5 w-5 items-center justify-center">
                          <input
                            type="checkbox"
                            checked={form.services.includes(svc.value)}
                            onChange={() => toggleArrayField("services", svc.value)}
                            className="peer sr-only"
                          />
                          <div className="h-5 w-5 rounded-md border border-border bg-surface transition-all peer-checked:border-green peer-checked:bg-green peer-focus-visible:ring-2 peer-focus-visible:ring-green/20" />
                          <svg className="absolute h-3 w-3 text-white opacity-0 peer-checked:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        </div>
                        <span className="group-hover:text-green transition-colors">{svc.label}</span>
                      </label>
                    ))}
                  </div>
                  {errors.services && <p className="mt-1 text-xs text-red-400">{errors.services}</p>}
                </div>

                {/* Section divider */}
                <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

                {/* Package interest */}
                <div>
                  <h3 className="mb-4 font-heading text-lg font-semibold text-foreground">
                    Package Interest
                  </h3>
                  <div className="space-y-2">
                    {PACKAGES.map((pkg) => (
                      <label key={pkg.value} className="flex items-center gap-3 text-sm text-foreground cursor-pointer group">
                        <div className="relative flex h-5 w-5 items-center justify-center">
                          <input
                            type="radio"
                            name="package"
                            value={pkg.value}
                            checked={form.package === pkg.value}
                            onChange={(e) => setForm({ ...form, package: e.target.value })}
                            className="peer sr-only"
                          />
                          <div className="h-5 w-5 rounded-full border border-border bg-surface transition-all peer-checked:border-green peer-focus-visible:ring-2 peer-focus-visible:ring-green/20" />
                          <div className="absolute h-2.5 w-2.5 rounded-full bg-green opacity-0 peer-checked:opacity-100 transition-opacity" />
                        </div>
                        <span className="group-hover:text-green transition-colors">{pkg.label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Submit */}
                <AnimatePresence>
                  {submitError && (
                    <motion.div
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400"
                    >
                      {submitError}
                    </motion.div>
                  )}
                </AnimatePresence>

                <Button type="submit" disabled={submitting} size="lg" className="w-full">
                  {submitting ? (
                    <span className="flex items-center gap-2">
                      <motion.span
                        className="inline-block h-4 w-4 rounded-full border-2 border-white/30 border-t-white"
                        animate={{ rotate: 360 }}
                        transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
                      />
                      Submitting...
                    </span>
                  ) : (
                    "Submit Consultation Request"
                  )}
                </Button>

                <p className="text-center text-xs text-muted">
                  No commitment required. We&apos;ll review your info and send a custom proposal.
                </p>
              </form>
            </Card>
          </AnimateIn>
        </div>
      </section>
    </>
  );
}
