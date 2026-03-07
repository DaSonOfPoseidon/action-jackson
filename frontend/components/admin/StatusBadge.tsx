const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  reviewed: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  approved: "bg-green/10 text-green border-green/20",
  rejected: "bg-red-500/10 text-red-400 border-red-500/20",
  completed: "bg-green/10 text-green border-green/20",
  confirmed: "bg-green/10 text-green border-green/20",
  "in-progress": "bg-blue-500/10 text-blue-400 border-blue-500/20",
  cancelled: "bg-red-500/10 text-red-400 border-red-500/20",
  draft: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  sent: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  paid: "bg-green/10 text-green border-green/20",
  overdue: "bg-orange/10 text-orange border-orange/20",
  active: "bg-green/10 text-green border-green/20",
  inactive: "bg-gray-500/10 text-gray-400 border-gray-500/20",
  new: "bg-purple/10 text-purple border-purple/20",
  contacted: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  scheduled: "bg-cyan/10 text-cyan border-cyan/20",
  quoted: "bg-orange/10 text-orange border-orange/20",
};

export function StatusBadge({ status }: { status: string }) {
  const colors =
    statusColors[status.toLowerCase()] ||
    "bg-gray-500/10 text-gray-400 border-gray-500/20";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize ${colors}`}
    >
      {status}
    </span>
  );
}
