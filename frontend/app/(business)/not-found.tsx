import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function NotFound() {
  return (
    <div className="relative flex min-h-[70vh] flex-col items-center justify-center bg-background px-6 text-center overflow-hidden">
      {/* Atmospheric background */}
      <div className="absolute inset-0 mesh-gradient opacity-50" />
      <div className="absolute inset-0 dot-grid opacity-[0.03]" />

      {/* Glitch 404 */}
      <div className="relative">
        <p
          className="glitch-text font-mono text-8xl font-bold tracking-tight text-foreground md:text-[12rem] leading-none select-none"
          data-text="404"
        >
          404
        </p>
      </div>

      <h1 className="relative mt-4 font-heading text-2xl font-semibold text-foreground">
        Page not found
      </h1>
      <p className="relative mt-3 max-w-md text-muted">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <Link href="/" className="relative mt-8">
        <Button variant="outline" size="lg">
          Back to Home
        </Button>
      </Link>
    </div>
  );
}
