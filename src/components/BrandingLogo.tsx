import { BRAND_LOGO } from "@/lib/branding";

interface BrandingLogoProps {
  variant?: "header" | "auth";
  className?: string;
}

export function BrandingLogo({ variant = "header", className = "" }: BrandingLogoProps) {
  const baseClasses = "object-contain";
  
  const variantClasses = {
    header: "h-11 w-auto",
    auth: "h-16 w-auto mx-auto block"
  };

  return (
    <img 
      src={BRAND_LOGO} 
      alt="Sri Lakshmi Mangalya Malai" 
      className={`${baseClasses} ${variantClasses[variant]} ${className}`}
    />
  );
}

export function RectangularLogo({ height = 48, className = "" }: { height?: number; className?: string }) {
  return (
    <img 
      src={BRAND_LOGO} 
      alt="Sri Lakshmi Mangalya Malai" 
      style={{ height: `${height}px`, width: 'auto' }}
      className={`object-contain ${className}`}
    />
  );
}
