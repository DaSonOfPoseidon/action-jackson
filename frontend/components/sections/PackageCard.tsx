import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { AnimateIn } from "@/components/AnimateIn";

interface PackageCardProps {
  name: string;
  priceRange: string;
  idealFor: string;
  includes: string[];
  accent?: "green" | "purple" | "orange" | "cyan";
  featured?: boolean;
}

const accentColors = {
  green: "from-green/40 to-transparent",
  purple: "from-purple/40 to-transparent",
  orange: "from-orange/40 to-transparent",
  cyan: "from-cyan/40 to-transparent",
};

export function PackageCard({
  name,
  priceRange,
  idealFor,
  includes,
  accent = "green",
  featured = false,
}: PackageCardProps) {
  return (
    <Card
      hover
      glass={featured}
      className={`flex flex-col ${
        featured
          ? "gradient-border shadow-glow-lg md:scale-[1.02]"
          : ""
      }`}
    >
      {/* Top gradient accent */}
      <div className={`absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r ${accentColors[accent]}`} />

      {featured && (
        <Badge variant="glow" className="mb-4 self-start -rotate-2">
          Most Popular
        </Badge>
      )}
      <h3 className="font-heading text-xl font-bold text-foreground">{name}</h3>
      <p className="mt-1 font-mono text-3xl font-bold text-orange glow-text">{priceRange}</p>
      <p className="mt-3 text-sm text-muted">{idealFor}</p>

      <ul className="mt-6 flex-1 space-y-2">
        {includes.map((item, i) => (
          <AnimateIn key={i} variant="fade-up" delay={i * 50}>
            <li className="flex items-start gap-2 text-sm text-foreground">
              <svg className="mt-0.5 h-4 w-4 flex-shrink-0 text-green" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
              {item}
            </li>
          </AnimateIn>
        ))}
      </ul>

      <Link href="/get-started" className="mt-8 block">
        <Button variant={featured ? "primary" : "outline"} className="w-full">
          Schedule Consultation
        </Button>
      </Link>
    </Card>
  );
}
