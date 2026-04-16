import logoImage from "@/assets/sri-lakshmi-logo.png";

export const BRAND_LOGO = logoImage;
export const BRAND_NAME = "Sri Lakshmi Mangalya Malai";
export const BRAND_SHORT_NAME = "Sri Lakshmi";

export const LOGO_SIZES = {
  header: "h-11 w-auto",
  headerSm: "h-9 w-auto", 
  login: "h-20 w-auto",
  loginSm: "h-16 w-auto",
  favicon: "h-12 w-auto",
  icon: "w-10 h-10",
} as const;

export function getLogoClass(size: keyof typeof LOGO_SIZES = "header"): string {
  return `object-contain ${LOGO_SIZES[size]}`;
}
