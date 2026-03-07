interface StatsCardProps {
  label: string;
  value: number | string;
  icon: string;
  href?: string;
}

export function StatsCard({ label, value, icon, href }: StatsCardProps) {
  const Wrapper = href ? "a" : "div";
  const wrapperProps = href ? { href } : {};

  return (
    <Wrapper
      {...wrapperProps}
      className="rounded-xl border border-border bg-surface p-5 transition-colors hover:border-border/80"
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted">{label}</p>
          <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green/10">
          <i className={`fas ${icon} text-green`} />
        </div>
      </div>
    </Wrapper>
  );
}
