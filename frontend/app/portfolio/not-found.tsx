import Link from "next/link";

export default function PortfolioNotFound() {
  return (
    <div className="min-h-[70vh] flex items-center justify-center px-6">
      <div className="text-center">
        <p className="font-mono text-purple text-sm tracking-widest uppercase mb-4">
          404
        </p>
        <h1 className="font-heading text-4xl md:text-5xl font-bold mb-4">
          Page Not Found
        </h1>
        <p className="text-muted text-lg mb-8 max-w-md mx-auto">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-purple/10 border border-purple/30 text-purple hover:bg-purple/20 hover:border-purple/50 transition-all font-medium"
        >
          <svg
            className="w-4 h-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7 16l-4-4m0 0l4-4m-4 4h18"
            />
          </svg>
          Back to Home
        </Link>
      </div>
    </div>
  );
}
