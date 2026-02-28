import { Card } from "@/components/ui/Card";

interface ServiceCardProps {
  icon: string;
  title: string;
  description: string;
  iconVariant?: "green" | "orange";
}

export function ServiceCard({ icon, title, description, iconVariant = "green" }: ServiceCardProps) {
  const iconBg = iconVariant === "orange"
    ? "bg-gradient-to-br from-orange-muted/40 to-orange-muted/20 text-orange"
    : "bg-gradient-to-br from-green-muted/40 to-purple-muted/20 text-green";

  return (
    <Card hover className="relative overflow-hidden">
      {/* Top accent bar */}
      <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-green/40 via-purple/20 to-transparent" />

      <div className="flex gap-4 text-left">
        <div className={`flex h-14 w-14 flex-shrink-0 items-center justify-center rounded-xl ${iconBg} transition-all duration-300 group-hover:shadow-glow`}>
          <i className={`fas ${icon} text-xl`} />
        </div>
        <div>
          <h3 className="font-heading text-lg font-semibold text-foreground">{title}</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-muted">{description}</p>
        </div>
      </div>
    </Card>
  );
}
