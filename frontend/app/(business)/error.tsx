"use client";

import Link from "next/link";
import { Button } from "@/components/ui/Button";

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  return (
    <div className="relative flex min-h-[70vh] flex-col items-center justify-center bg-background px-6 text-center overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      <div className="absolute inset-0 dot-grid opacity-[0.03]" />

      <div className="relative mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full glass">
        <i className="fas fa-exclamation-triangle text-3xl text-orange" />
      </div>
      <h1 className="relative font-heading text-2xl font-semibold text-foreground">
        Something went wrong
      </h1>
      <p className="relative mt-3 max-w-md text-muted">
        An unexpected error occurred. You can try again or head back to the home
        page.
      </p>
      {error.digest && (
        <p className="relative mt-2 font-mono text-xs text-muted/60">
          Error ID: {error.digest}
        </p>
      )}
      <div className="relative mt-8 flex flex-col items-center gap-4 sm:flex-row">
        <Button variant="primary" size="lg" onClick={reset}>
          Try Again
        </Button>
        <Link href="/">
          <Button variant="outline" size="lg">
            Go Home
          </Button>
        </Link>
      </div>
    </div>
  );
}
