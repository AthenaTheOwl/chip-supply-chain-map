interface ChokepointScoreBadgeProps {
  score: number;
  size?: "sm" | "md" | "lg";
}

export function ChokepointScoreBadge({
  score,
  size = "md"
}: ChokepointScoreBadgeProps) {
  const tier =
    score >= 80 ? "critical" : score >= 60 ? "high" : score >= 35 ? "medium" : "low";
  const sizeClass =
    size === "lg" ? "px-3 py-2 text-2xl" : size === "sm" ? "px-2 py-1 text-xs" : "px-2.5 py-1.5 text-sm";

  return (
    <span
      className={`score-badge score-badge-${tier} inline-flex min-w-[54px] items-center justify-center rounded border font-semibold tabular-nums ${sizeClass}`}
    >
      {score}
    </span>
  );
}
