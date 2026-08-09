import { cn } from "@/lib/utils";

interface GridBayProps {
  children: React.ReactNode;
  /** Drafting annotation pinned above the bay, e.g. "FIG. 01 — STOREFRONT". */
  label?: string;
  /** Measurement note pinned to the right of the label. */
  spec?: string;
  className?: string;
  /** Inner padding that keeps content off the dashed rule. @default true */
  inset?: boolean;
}

/**
 * A single drafted plate on the blueprint: dashed rule, corner crosshairs, and
 * an optional mono annotation. Every generated component sits in one of these
 * so the output reads as an architectural sheet rather than stacked cards.
 */
export function GridBay({
  children,
  label,
  spec,
  className,
  inset = true,
}: GridBayProps) {
  return (
    <figure className={cn("space-y-2", className)}>
      {(label || spec) && (
        <figcaption className="flex items-baseline justify-between gap-3">
          {label && <span className="bay-label">{label}</span>}
          {spec && <span className="bay-label text-mauve/60">{spec}</span>}
        </figcaption>
      )}

      <div className={cn("blueprint-bay", inset && "p-3 md:p-4")}>
        <span className="crosshair tl" aria-hidden="true" />
        <span className="crosshair tr" aria-hidden="true" />
        <span className="crosshair bl" aria-hidden="true" />
        <span className="crosshair br" aria-hidden="true" />
        {children}
      </div>
    </figure>
  );
}
