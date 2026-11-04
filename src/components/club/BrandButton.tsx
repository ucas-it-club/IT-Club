import type { ButtonHTMLAttributes } from "react";
import {
  brandButtonClass,
  type BrandButtonSize,
  type BrandButtonVariant,
} from "./brand-button-styles";

interface BrandButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BrandButtonVariant;
  size?: BrandButtonSize;
}

export function BrandButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: BrandButtonProps) {
  return <button className={brandButtonClass(variant, size, className)} {...props} />;
}
