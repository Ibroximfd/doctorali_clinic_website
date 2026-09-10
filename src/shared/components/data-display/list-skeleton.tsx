import { Skeleton } from "@/shared/components/ui/skeleton";

/** Placeholder rows while a list loads, sized like the real ones. */
export function ListSkeleton({
  rows = 8,
  height = 56,
}: {
  rows?: number;
  height?: number;
}) {
  return (
    <div className="flex flex-col gap-px p-1" aria-hidden>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} className="rounded-sm" style={{ height }} />
      ))}
    </div>
  );
}
