import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";
import "./hero-section-4.css";

/** Adds the supplied hero effect without replacing the existing page content. */
export const HeroSection = forwardRef<HTMLElement, HTMLAttributes<HTMLElement>>(
  ({ children, className, ...props }, ref) => (
    <section ref={ref} className={cn("club-image-hero", className)} {...props}>
      <div className="club-image-hero-content">{children}</div>
    </section>
  ),
);
HeroSection.displayName = "HeroSection";
