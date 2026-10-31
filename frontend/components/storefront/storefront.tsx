"use client";

import {
  type DragEvent as ReactDragEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { ReadonlyURLSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { API_BASE, api, ApiError } from "@/lib/api";
import { siteThemeVariables, sectionDesign } from "@/lib/site-design";
import { VirgoLiveConversation, type VirgoProduct } from "@/lib/virgo-live";
import { virgoGreeting } from "@/lib/virgo-greeting";
import { ReferenceOrb } from "./reference-orb";
import { SiteTextLayer } from "./site-text-layer";
import { streamChat } from "@/lib/ai-stream";
import { imageThumbnail } from "@/lib/image-preview";
const SiteBuilder = dynamic(() => import("../admin/cms-kit").then(m => m.SiteBuilder));
const NavEditor = dynamic(() => import("../admin/cms-kit").then(m => m.NavEditor));
const ImageField = dynamic(() => import("../admin/cms-kit").then(m => m.ImageField));
const ImageListField = dynamic(() => import("../admin/cms-kit").then(m => m.ImageListField));
const RangeControl = dynamic(() => import("../admin/cms-kit").then(m => m.RangeControl));
const AdminDock = dynamic(() => import("../admin/admin-upgrade").then(m => m.AdminDock));
const AdminStatusChip = dynamic(() => import("../admin/admin-upgrade").then(m => m.AdminStatusChip));
const QuickFind = dynamic(() => import("../admin/admin-upgrade").then(m => m.QuickFind));
const AdminWelcome = dynamic(() => import("../admin/admin-upgrade").then(m => m.AdminWelcome));
import {
  CinHero,
  CinTicker,
  CinFilm,
  Cin3DLooks,
  CinEdit,
  CinManifesto,
  CinShop,
  CinLookbook,
  CinLetter,
  ScrollProgress,
  CursorRing,
} from "./cinematic";
const VisualSiteBuilder = dynamic(() => import("../admin/visual-site-builder").then(m => m.VisualSiteBuilder));
const ModelViewer = dynamic(() => import("../3d/model-viewer").then(m => m.ModelViewer), { ssr: false });
const AIProviderStudio = dynamic(() => import("../admin/ai-provider-studio").then(m => m.AIProviderStudio));
const PaymentConfigCard = dynamic(() => import("../admin/admin-extras").then(m => m.PaymentConfigCard));
const DeferredAtmosphere = dynamic(() => import("../cinematic/cinematic-atmosphere").then(m => m.CinematicAtmosphereCanvas), { ssr: false });

function CinematicAtmosphereCanvas() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Decorative WebGL must not compete with the hero or run on touch devices.
    if (!matchMedia("(pointer: fine) and (min-width: 1024px) and (prefers-reduced-motion: no-preference)").matches) return;
    const connection = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    if (connection?.saveData) return;
    if ("requestIdleCallback" in window) {
      const id = window.requestIdleCallback(() => setReady(true), { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(() => setReady(true), 2000);
    return () => clearTimeout(id);
  }, []);
  return ready ? <DeferredAtmosphere /> : null;
}

type Product = {
  id: string;
  sku: string;
  name: string;
  slug: string;
  price: number;
  currency: string;
  gender: string;
  type: string;
  description: string;
  colors: string[];
  sizes: string[];
  images: string[];
  rating: number;
  reviewCount: number;
  stock: number;
  featured: boolean;
  newArrival: boolean;
  bestSeller: boolean;
  status: string;
  collectionType?: "MEN" | "WOMEN_INDO_WESTERN" | "WOMEN_WESTERN";
  category?: { name: string; slug: string };
};
type User = {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: "USER" | "ADMIN";
  blockedAt?: string | null;
};
type CartItem = {
  id: string;
  productId: string;
  quantity: number;
  size: string;
  color: string;
  product: Product;
};
type Address = {
  id?: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
  isDefault?: boolean;
};
type CmsSection = {
  id: string;
  pageId: string;
  type: string;
  sortOrder: number;
  visible: boolean;
  content: Record<string, any>;
};
type CmsPage = {
  id: string;
  slug: string;
  title: string;
  status: string;
  isSystem: boolean;
  seoTitle?: string | null;
  seoDescription?: string | null;
  sections: CmsSection[];
};

type IconName =
  | "search"
  | "user"
  | "heart"
  | "cart"
  | "menu"
  | "close"
  | "arrow"
  | "chevron"
  | "minus"
  | "plus"
  | "truck"
  | "shield"
  | "return"
  | "zoom"
  | "box"
  | "trash"
  | "send"
  | "settings"
  | "grid"
  | "users"
  | "orders"
  | "category"
  | "image"
  | "ai";
function Icon({ name, size = 18 }: { name: IconName; size?: number }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.45,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  switch (name) {
    case "search":
      return (
        <svg {...common}>
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4.5 4.5" />
        </svg>
      );
    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="4" />
          <path d="M4 21c1.2-4.4 4.1-6.5 8-6.5s6.8 2.1 8 6.5" />
        </svg>
      );
    case "heart":
      return (
        <svg {...common}>
          <path d="M20.5 8.8c0 5.6-8.5 10-8.5 10s-8.5-4.4-8.5-10A4.7 4.7 0 0 1 12 6.1a4.7 4.7 0 0 1 8.5 2.7Z" />
        </svg>
      );
    case "cart":
      return (
        <svg {...common}>
          <path d="M4 5h2l2 10h9l2-7H7" />
          <circle cx="10" cy="19" r="1.4" />
          <circle cx="18" cy="19" r="1.4" />
        </svg>
      );
    case "menu":
      return (
        <svg {...common}>
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      );
    case "close":
      return (
        <svg {...common}>
          <path d="m6 6 12 12M18 6 6 18" />
        </svg>
      );
    case "arrow":
      return (
        <svg {...common}>
          <path d="M4 12h15M13 6l6 6-6 6" />
        </svg>
      );
    case "chevron":
      return (
        <svg {...common}>
          <path d="m8 10 4 4 4-4" />
        </svg>
      );
    case "minus":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
        </svg>
      );
    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14M5 12h14" />
        </svg>
      );
    case "truck":
      return (
        <svg {...common}>
          <path d="M3 6h11v10H3zM14 9h4l3 3v4h-7zM7 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4ZM18 19a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
        </svg>
      );
    case "shield":
      return (
        <svg {...common}>
          <path d="M12 3 19 6v5c0 4.6-2.8 8.1-7 10-4.2-1.9-7-5.4-7-10V6l7-3Z" />
          <path d="m9 12 2 2 4-4" />
        </svg>
      );
    case "return":
      return (
        <svg {...common}>
          <path d="M4 11a8 8 0 1 1 2.3 5.6" />
          <path d="M4 5v6h6" />
        </svg>
      );
    case "zoom":
      return (
        <svg {...common}>
          <circle cx="10.5" cy="10.5" r="5.5" />
          <path d="m15 15 5 5M10.5 8v5M8 10.5h5" />
        </svg>
      );
    case "box":
      return (
        <svg {...common}>
          <path d="m4 7 8-4 8 4-8 4-8-4Z" />
          <path d="M4 7v10l8 4 8-4V7M12 11v10" />
        </svg>
      );
    case "trash":
      return (
        <svg {...common}>
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </svg>
      );
    case "send":
      return (
        <svg {...common}>
          <path d="m3 11 18-8-5 18-4-7-9-3Z" />
          <path d="m12 14 5-6" />
        </svg>
      );
    case "settings":
      return (
        <svg {...common}>
          <path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M18.4 5.6l-2.1 2.1M7.7 16.3l-2.1 2.1" />
          <circle cx="12" cy="12" r="4" />
        </svg>
      );
    case "grid":
      return (
        <svg {...common}>
          <rect x="4" y="4" width="6" height="6" />
          <rect x="14" y="4" width="6" height="6" />
          <rect x="4" y="14" width="6" height="6" />
          <rect x="14" y="14" width="6" height="6" />
        </svg>
      );
    case "users":
      return (
        <svg {...common}>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19c.5-3.5 2.3-5 5.5-5s5 1.5 5.5 5M16 6.5a2.5 2.5 0 1 1 0 5M16.5 15c2.2 0 3.6 1.1 4 3.4" />
        </svg>
      );
    case "orders":
      return (
        <svg {...common}>
          <path d="M4 5h16v15H4zM8 9h8M8 13h5" />
        </svg>
      );
    case "category":
      return (
        <svg {...common}>
          <path d="M4 5h7v6H4zM13 13h7v6h-7zM13 5h7M4 19h7" />
        </svg>
      );
    case "ai":
      return (
        <svg {...common}>
          <path d="m12 3 1.25 3.75L17 8l-3.75 1.25L12 13l-1.25-3.75L7 8l3.75-1.25L12 3Z" />
          <path d="m19 14 .7 2.1L22 17l-2.3.9L19 20l-.7-2.1L16 17l2.3-.9L19 14Z" />
          <path d="M5 15l.8 2.2L8 18l-2.2.8L5 21l-.8-2.2L2 18l2.2-.8L5 15Z" />
        </svg>
      );
    default:
      return (
        <svg {...common}>
          <rect x="4" y="4" width="16" height="16" />
        </svg>
      );
  }
}

const PHOTOS = [
  "/images/hero/hero-01.jpg",
  "/images/hero/hero-02.jpg",
  "/images/hero/hero-03.jpg",
  "/images/hero/hero-04-wide.jpg",
];
const FALLBACK = "/images/fallback-fashion.svg";
const isUiRasterImage = (src: string) =>
  /\.(?:jpe?g|png|webp|avif)(?:$|\?)/i.test(src);
const PRODUCT_IMAGE_OVERRIDES: Record<string, string> = {
  "classic-linen-shirt":
    "/images/products/new-catalogue/men/classic-linen-shirt-01.avif",
  "cotton-trousers":
    "/images/products/new-catalogue/men/cotton-trousers-01.avif",
  "dark-denim-jacket":
    "/images/products/new-catalogue/men/dark-denim-jacket-01.avif",
  "essential-knit-polo":
    "/images/products/new-catalogue/men/essential-knit-polo-01.avif",
  "minimal-utility-overshirt":
    "/images/products/new-catalogue/men/minimal-utility-overshirt-01.avif",
  "monochrome-knit-crew":
    "/images/products/new-catalogue/men/monochrome-knit-crew-01.avif",
  "pleated-wide-trousers":
    "/images/products/new-catalogue/men/pleated-wide-trousers-01.avif",
  "mens-pleated-wide-trousers":
    "/images/products/new-catalogue/men/pleated-wide-trousers-01.avif",
  "relaxed-heavyweight-tee":
    "/images/products/new-catalogue/men/relaxed-heavyweight-tee-01.avif",
  "relaxed-oxford-shirt":
    "/images/products/new-catalogue/men/relaxed-oxford-shirt-01.avif",
  "tailored-blazer":
    "/images/products/new-catalogue/men/tailored-blazer-01.avif",
  "mens-tailored-blazer":
    "/images/products/new-catalogue/men/tailored-blazer-01.avif",
  "textured-overshirt":
    "/images/products/new-catalogue/men/textured-overshirt-01.avif",
  "wool-blend-overcoat":
    "/images/products/new-catalogue/men/wool-blend-overcoat-01.avif",
  "mens-wool-blend-overcoat":
    "/images/products/new-catalogue/men/wool-blend-overcoat-01.avif",
  "asymmetric-co-ord-blazer-set":
    "/images/products/new-catalogue/women/asymmetric-co-ord-blazer-set-01.avif",
  "asymmetric-dhoti-trousers":
    "/images/products/new-catalogue/women/asymmetric-dhoti-trousers-01.avif",
  "contemporary-kurta-shirt":
    "/images/products/new-catalogue/women/contemporary-kurta-shirt-01.avif",
  "corset-kurta-top":
    "/images/products/new-catalogue/women/corset-kurta-top-01.avif",
  "cropped-waistcoat-and-trouser-set":
    "/images/products/new-catalogue/women/cropped-waistcoat-trouser-set-01.avif",
  "draped-blazer-dress":
    "/images/products/new-catalogue/women/draped-blazer-dress-01.avif",
  "draped-denim-jacket":
    "/images/products/new-catalogue/women/draped-denim-jacket-01.avif",
  "draped-satin-co-ord-set":
    "/images/products/new-catalogue/women/draped-satin-co-ord-set-01.avif",
  "minimal-ribbed-dress":
    "/images/products/new-catalogue/women/minimal-ribbed-dress-01.avif",
  "one-shoulder-draped-dress":
    "/images/products/new-catalogue/women/one-shoulder-draped-dress-01.avif",
  "pleated-palazzo-co-ord":
    "/images/products/new-catalogue/women/pleated-palazzo-co-ord-01.avif",
  "relaxed-fit-t-shirt":
    "/images/products/new-catalogue/women/relaxed-fit-t-shirt-01.avif",
  "satin-cowl-top-and-wide-trousers":
    "/images/products/new-catalogue/women/satin-cowl-top-wide-trousers-01.avif",
  "sculpted-column-maxi-dress":
    "/images/products/new-catalogue/women/sculpted-column-maxi-dress-01.avif",
  "structured-bandhani-shirt":
    "/images/products/new-catalogue/women/structured-bandhani-shirt-01.avif",
  "structured-wool-coat":
    "/images/products/new-catalogue/women/structured-wool-coat-01.avif",
  "tailored-saree-style-skirt":
    "/images/products/new-catalogue/women/tailored-saree-style-skirt-01.avif",
  "tailored-wool-trousers":
    "/images/products/new-catalogue/women/tailored-wool-trousers-01.avif",
  "wide-leg-trousers":
    "/images/products/new-catalogue/women/wide-leg-trousers-01.avif",
};
const PRODUCT_SECONDARY_OVERRIDES: Record<string, string> = {
  "classic-linen-shirt":
    "/images/products/new-catalogue/men/classic-linen-shirt-02.avif",
  "cotton-trousers":
    "/images/products/new-catalogue/men/cotton-trousers-02.avif",
  "dark-denim-jacket":
    "/images/products/new-catalogue/men/dark-denim-jacket-02.avif",
  "essential-knit-polo":
    "/images/products/new-catalogue/men/essential-knit-polo-02.avif",
  "minimal-utility-overshirt":
    "/images/products/new-catalogue/men/minimal-utility-overshirt-02.avif",
  "monochrome-knit-crew":
    "/images/products/new-catalogue/men/monochrome-knit-crew-02.avif",
  "pleated-wide-trousers":
    "/images/products/new-catalogue/men/pleated-wide-trousers-02.avif",
  "mens-pleated-wide-trousers":
    "/images/products/new-catalogue/men/pleated-wide-trousers-02.avif",
  "relaxed-heavyweight-tee":
    "/images/products/new-catalogue/men/relaxed-heavyweight-tee-02.avif",
  "relaxed-oxford-shirt":
    "/images/products/new-catalogue/men/relaxed-oxford-shirt-02.avif",
  "textured-overshirt":
    "/images/products/new-catalogue/men/textured-overshirt-02.avif",
  "wool-blend-overcoat":
    "/images/products/new-catalogue/men/wool-blend-overcoat-02.avif",
  "mens-wool-blend-overcoat":
    "/images/products/new-catalogue/men/wool-blend-overcoat-02.avif",
  "asymmetric-co-ord-blazer-set":
    "/images/products/new-catalogue/women/asymmetric-co-ord-blazer-set-02.avif",
  "asymmetric-dhoti-trousers":
    "/images/products/new-catalogue/women/asymmetric-dhoti-trousers-03.avif",
  "contemporary-kurta-shirt":
    "/images/products/new-catalogue/women/contemporary-kurta-shirt-02.avif",
  "corset-kurta-top":
    "/images/products/new-catalogue/women/corset-kurta-top-05.avif",
  "cropped-waistcoat-trouser-set":
    "/images/products/new-catalogue/women/cropped-waistcoat-trouser-set-08.avif",
  "draped-blazer-dress":
    "/images/products/new-catalogue/women/draped-blazer-dress-06.avif",
  "draped-denim-jacket":
    "/images/products/new-catalogue/women/draped-denim-jacket-02.avif",
  "draped-satin-co-ord-set":
    "/images/products/new-catalogue/women/draped-satin-co-ord-set-02.avif",
  "minimal-ribbed-dress":
    "/images/products/new-catalogue/women/minimal-ribbed-dress-02.avif",
  "one-shoulder-draped-dress":
    "/images/products/new-catalogue/women/one-shoulder-draped-dress-09.avif",
  "pleated-palazzo-co-ord":
    "/images/products/new-catalogue/women/pleated-palazzo-co-ord-07.avif",
  "relaxed-fit-t-shirt":
    "/images/products/new-catalogue/women/relaxed-fit-t-shirt-02.avif",
  "satin-cowl-top-wide-trousers":
    "/images/products/new-catalogue/women/satin-cowl-top-wide-trousers-02.avif",
  "sculpted-column-maxi-dress":
    "/images/products/new-catalogue/women/sculpted-column-maxi-dress-02.avif",
  "structured-bandhani-shirt":
    "/images/products/new-catalogue/women/structured-bandhani-shirt-04.avif",
  "structured-wool-coat":
    "/images/products/new-catalogue/women/structured-wool-coat-02.avif",
  "tailored-blazer":
    "/images/products/new-catalogue/women/tailored-blazer-02.avif",
  "tailored-saree-style-skirt":
    "/images/products/new-catalogue/women/tailored-saree-style-skirt-10.avif",
  "tailored-wool-trousers":
    "/images/products/new-catalogue/women/tailored-wool-trousers-02.avif",
  "wide-leg-trousers":
    "/images/products/new-catalogue/women/wide-leg-trousers-02.avif",
};
const REFERENCE_WEB_IMAGES: Record<string, string> = {
  classicLinenShirt:
    "/images/products/new-catalogue/men/classic-linen-shirt-01.avif",
  texturedOvershirt:
    "/images/products/new-catalogue/men/textured-overshirt-01.avif",
  relaxedFitTshirt:
    "/images/products/new-catalogue/men/relaxed-heavyweight-tee-01.avif",
  tailoredBlazer: "/images/products/new-catalogue/men/tailored-blazer-01.avif",
  denimJacket: "/images/products/new-catalogue/men/dark-denim-jacket-01.avif",
  cottonTrousers: "/images/products/new-catalogue/men/cotton-trousers-01.avif",
  structuredWoolCoat:
    "/images/products/new-catalogue/women/structured-wool-coat-01.avif",
  essentialKnitPolo:
    "/images/products/new-catalogue/men/essential-knit-polo-01.avif",
  relaxedOxfordShirt:
    "/images/products/new-catalogue/men/relaxed-oxford-shirt-01.avif",
  wideLegTrousers:
    "/images/products/new-catalogue/women/wide-leg-trousers-01.avif",
  minimalRibbedDress:
    "/images/products/new-catalogue/women/minimal-ribbed-dress-01.avif",
  tailoredWoolTrousers:
    "/images/products/new-catalogue/women/tailored-wool-trousers-01.avif",
  heroWomanBlackBlazer:
    "/images/products/new-catalogue/women/asymmetric-co-ord-blazer-set-01.avif",
  heroWomanBlazer:
    "/images/products/new-catalogue/women/draped-blazer-dress-01.avif",
  indoWestern:
    "/images/products/new-catalogue/women/contemporary-kurta-shirt-01.avif",
  womanWhiteSuit:
    "/images/products/new-catalogue/women/cropped-waistcoat-trouser-set-01.avif",
  womanBrownSuit:
    "/images/products/new-catalogue/women/tailored-saree-style-skirt-01.avif",
  womanBlackDress:
    "/images/products/new-catalogue/women/sculpted-column-maxi-dress-01.avif",
  manWhitePolo: "/images/hero/hero-01.jpg",
  manBlackPolo: "/images/hero/hero-03.jpg",
  womanBlackSleeveless:
    "/images/products/new-catalogue/women/one-shoulder-draped-dress-01.avif",
  womanBlackSheer:
    "/images/products/new-catalogue/women/satin-cowl-top-wide-trousers-01.avif",
  womanBlackCouch:
    "/images/products/new-catalogue/women/draped-denim-jacket-01.avif",
  manGreySuit: "/images/products/new-catalogue/men/tailored-blazer-02.avif",
  mensCollection: "/images/collections/mens-collection.jpg",
  womenCollection: "/images/collections/womens-collection.jpg",
};
const CATALOGUE_ASSETS: Record<"men" | "women", Record<string, string[]>> = {
  men: {
    "classic-linen-shirt": [
      "classic-linen-shirt-01.avif",
      "classic-linen-shirt-02.avif",
    ],
    "cotton-trousers": ["cotton-trousers-01.avif", "cotton-trousers-02.avif"],
    "dark-denim-jacket": [
      "dark-denim-jacket-01.avif",
      "dark-denim-jacket-02.avif",
    ],
    "essential-knit-polo": [
      "essential-knit-polo-01.avif",
      "essential-knit-polo-02.avif",
    ],
    "minimal-utility-overshirt": [
      "minimal-utility-overshirt-01.avif",
      "minimal-utility-overshirt-02.avif",
    ],
    "monochrome-knit-crew": [
      "monochrome-knit-crew-01.avif",
      "monochrome-knit-crew-02.avif",
    ],
    "pleated-wide-trousers": [
      "pleated-wide-trousers-01.avif",
      "pleated-wide-trousers-02.avif",
    ],
    "relaxed-heavyweight-tee": [
      "relaxed-heavyweight-tee-01.avif",
      "relaxed-heavyweight-tee-02.avif",
    ],
    "relaxed-oxford-shirt": [
      "relaxed-oxford-shirt-01.avif",
      "relaxed-oxford-shirt-02.avif",
    ],
    "tailored-blazer": ["tailored-blazer-01.avif", "tailored-blazer-02.avif"],
    "textured-overshirt": [
      "textured-overshirt-01.avif",
      "textured-overshirt-02.avif",
    ],
    "wool-blend-overcoat": [
      "wool-blend-overcoat-01.avif",
      "wool-blend-overcoat-02.avif",
    ],
  },
  women: {
    "asymmetric-co-ord-blazer-set": [
      "asymmetric-co-ord-blazer-set-01.avif",
      "asymmetric-co-ord-blazer-set-02.avif",
    ],
    "asymmetric-dhoti-trousers": [
      "asymmetric-dhoti-trousers-01.avif",
      "asymmetric-dhoti-trousers-03.avif",
    ],
    "contemporary-kurta-shirt": [
      "contemporary-kurta-shirt-01.avif",
      "contemporary-kurta-shirt-02.avif",
    ],
    "corset-kurta-top": [
      "corset-kurta-top-01.avif",
      "corset-kurta-top-05.avif",
    ],
    "cropped-waistcoat-trouser-set": [
      "cropped-waistcoat-trouser-set-01.avif",
      "cropped-waistcoat-trouser-set-08.avif",
    ],
    "draped-blazer-dress": [
      "draped-blazer-dress-01.avif",
      "draped-blazer-dress-06.avif",
    ],
    "draped-denim-jacket": [
      "draped-denim-jacket-01.avif",
      "draped-denim-jacket-02.avif",
    ],
    "draped-satin-co-ord-set": [
      "draped-satin-co-ord-set-01.avif",
      "draped-satin-co-ord-set-02.avif",
    ],
    "minimal-ribbed-dress": [
      "minimal-ribbed-dress-01.avif",
      "minimal-ribbed-dress-02.avif",
    ],
    "one-shoulder-draped-dress": [
      "one-shoulder-draped-dress-01.avif",
      "one-shoulder-draped-dress-09.avif",
    ],
    "pleated-palazzo-co-ord": [
      "pleated-palazzo-co-ord-01.avif",
      "pleated-palazzo-co-ord-07.avif",
    ],
    "relaxed-fit-t-shirt": [
      "relaxed-fit-t-shirt-01.avif",
      "relaxed-fit-t-shirt-02.avif",
    ],
    "satin-cowl-top-wide-trousers": [
      "satin-cowl-top-wide-trousers-01.avif",
      "satin-cowl-top-wide-trousers-02.avif",
    ],
    "sculpted-column-maxi-dress": [
      "sculpted-column-maxi-dress-01.avif",
      "sculpted-column-maxi-dress-02.avif",
    ],
    "structured-bandhani-shirt": [
      "structured-bandhani-shirt-01.avif",
      "structured-bandhani-shirt-04.avif",
    ],
    "structured-wool-coat": [
      "structured-wool-coat-01.avif",
      "structured-wool-coat-02.avif",
      "structured-wool-coat-03.avif",
    ],
    "tailored-blazer": [
      "tailored-blazer-01.avif",
      "tailored-blazer-02.avif",
      "tailored-blazer-03.avif",
    ],
    "tailored-saree-style-skirt": [
      "tailored-saree-style-skirt-01.avif",
      "tailored-saree-style-skirt-10.avif",
    ],
    "tailored-wool-trousers": [
      "tailored-wool-trousers-01.avif",
      "tailored-wool-trousers-02.avif",
    ],
    "wide-leg-trousers": [
      "wide-leg-trousers-01.avif",
      "wide-leg-trousers-02.avif",
    ],
  },
};
const CATALOGUE_BASE = "/images/products/new-catalogue";
// Resolve a product to its real catalogue base name. Handles legacy/prefixed slugs
// (mens-/womens- prefixes, bare legacy slugs) and falls back to the product name.
function catalogueBase(
  p: Partial<Product> | any,
): { group: "men" | "women"; base: string } | null {
  const group: "men" | "women" =
    String(p?.gender || "").toLowerCase() === "men" ? "men" : "women";
  const table = CATALOGUE_ASSETS[group];
  const slugify = (v: string) =>
    v
      .toLowerCase()
      .replace(/&/g, " ")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  const candidates = [
    String(p?.slug || ""),
    slugify(String(p?.name || "")),
  ].filter(Boolean);
  for (const raw of candidates) {
    const slug = slugify(raw);
    const stripped = slug.replace(/^(?:mens|womens|men|women)-/, "");
    for (const c of [slug, stripped]) if (table[c]) return { group, base: c };
  }
  return null;
}
function catalogueImages(p: Partial<Product> | any): string[] {
  const hit = catalogueBase(p);
  return hit
    ? CATALOGUE_ASSETS[hit.group][hit.base].map(
        (f) => CATALOGUE_BASE + "/" + hit.group + "/" + f,
      )
    : [];
}
const REFERENCE_BY_SLUG: Record<string, string> = {};

const DISPLAY_IMAGE_OVERRIDES: Record<string, string> = {};

function productColors(p: Partial<Product> | any): string[] {
  return Array.isArray(p?.colors)
    ? p.colors.filter((x: any) => typeof x === "string" && x.trim())
    : [];
}
function productSizes(p: Partial<Product> | any): string[] {
  return Array.isArray(p?.sizes)
    ? p.sizes.filter((x: any) => typeof x === "string" && x.trim())
    : [];
}

function productImage(p: Partial<Product> | any) {
  const cat = catalogueImages(p);
  if (cat[0]) return cat[0];
  const override = p?.slug
    ? DISPLAY_IMAGE_OVERRIDES[String(p.slug)] ||
      PRODUCT_IMAGE_OVERRIDES[String(p.slug)]
    : undefined;
  if (override && isUiRasterImage(override)) return override;
  const usable = Array.isArray(p?.images)
    ? p.images
        .map((x: string) => safeImg(String(x)))
        .filter((x: string) => x !== FALLBACK)
    : [];
  const raster = usable.filter((x: string) => isUiRasterImage(x));
  return raster[0] || usable[0] || FALLBACK;
}
function productSecondaryImage(p: Partial<Product> | any) {
  const cat = catalogueImages(p);
  if (cat[1]) return cat[1];
  const override = PRODUCT_SECONDARY_OVERRIDES[String(p?.slug || "")];
  if (override && isUiRasterImage(override)) return override;
  const usable = Array.isArray(p?.images)
    ? p.images
        .map((x: string) => safeImg(String(x)))
        .filter((x: string) => x !== FALLBACK)
    : [];
  const raster = usable.filter((x: string) => isUiRasterImage(x));
  return raster[1] || usable[1] || undefined;
}
function referenceImageFor(p: Partial<Product> | any) {
  return p?.slug ? REFERENCE_BY_SLUG[String(p.slug)] : undefined;
}
function collectionImageChoices(p: Product) {
  const raster = Array.isArray(p?.images)
    ? p.images
        .map((x: string) => safeImg(String(x)))
        .filter((x: string) => isUiRasterImage(x))
    : [];
  const raw = [productImage(p), ...catalogueImages(p), ...raster];
  return Array.from(
    new Set(
      raw.filter((src) => src && src !== FALLBACK && isUiRasterImage(src)),
    ),
  );
}
const EDITORIAL_IMAGES = {
  indoWestern:
    "/images/products/new-catalogue/women/draped-satin-co-ord-set-01.avif",
  architecture: "/images/hero/hero-04-wide.jpg",
  concrete: "/images/collections/winter-edit.jpg",
  blackBlazer:
    "/images/products/new-catalogue/women/asymmetric-co-ord-blazer-set-01.avif",
  menCollection:
    "/images/products/new-catalogue/men/classic-linen-shirt-01.avif",
  womenCollection:
    "/images/products/new-catalogue/women/draped-blazer-dress-01.avif",
  coupleCollection: "/images/collections/couple-collection.jpg",
};
const EDITORIAL_LOCAL_FALLBACKS = {
  indoWestern:
    "/images/products/new-catalogue/women/draped-blazer-dress-01.avif",
  architecture: "/images/collections/winter-edit.jpg",
  concrete: "/images/collections/summer-collection.jpg",
  blackBlazer: "/images/products/new-catalogue/men/tailored-blazer-01.avif",
  menCollection: "/images/collections/mens-collection.jpg",
  womenCollection: "/images/collections/womens-collection.jpg",
  coupleCollection: "/images/collections/couple-collection.jpg",
};
const ADMIN_ROUTE = (
  process.env.NEXT_PUBLIC_ADMIN_PATH || "/_atelier-console-8f2d6c"
).replace(/\/$/, "");
const colorHex: Record<string, string> = {
  Black: "#171717",
  White: "#efece5",
  Ivory: "#f2eee6",
  Grey: "#8c8a84",
  Beige: "#cbbca5",
  Cream: "#e8ddc8",
  Brown: "#725746",
  Chocolate: "#5a382a",
  Taupe: "#9a8875",
  Olive: "#56604c",
  Navy: "#28364e",
  Burgundy: "#6e1f32",
  Champagne: "#d8c7ae",
  Cobalt: "#3157ff",
  Indigo: "#354f8a",
  "Ice Blue": "#bfd5e8",
  "Washed Black": "#343434",
  Charcoal: "#3a3937",
};
const money = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
const FRIENDLY_ERRORS: Record<string, string> = {
  PAYMENT_NOT_CONFIGURED:
    "Online payment is not available right now. Please contact the store.",
  PAYMENT_SCRIPT_LOAD_FAILED:
    "Could not load the payment window. Check your internet connection and try again.",
  INVALID_PAYMENT_SIGNATURE:
    "We could not verify this payment. If money was deducted, it will be refunded or the order confirmed shortly.",
  PAYMENT_NOT_CAPTURED: "The payment was not completed. No order was created.",
  CHAT_VIDEO_REQUIRES_GEMINI: "VIRGO can’t analyse this video right now. Please try an image or describe what you’d like to know.",
  CHAT_ATTACHMENT_PROVIDER_UNSUPPORTED: "VIRGO can’t read this attachment right now. Please try a text description instead.",
  CHAT_ATTACHMENT_UNSUPPORTED_TYPE: "This file type cannot be read by chat. Try an image, text file, PDF, Office document or ZIP archive.",
  CHAT_ATTACHMENT_TOO_LARGE: "This attachment exceeds the per-file limit for the current mode.",
  CHAT_ATTACHMENT_TOTAL_LIMIT: "Attachments exceed the combined size limit for the current mode.",
  CHAT_ATTACHMENT_COUNT_LIMIT: "You have reached the file count limit for the current mode.",
  CHAT_ATTACHMENT_INVALID_NAME: "That file name can't be used. Rename the file and try again.",
  CHAT_ATTACHMENT_INVALID_DATA: "The file could not be read. Please attach it again.",
  CHAT_ATTACHMENT_MIME_MISMATCH: "The file contents don't match its type (for example a renamed file). Please attach the original file.",
  CHAT_ATTACHMENT_ARCHIVE_LIMIT: "This archive is too large or has too many files to read.",
  CHAT_ATTACHMENT_INVALID_ARCHIVE: "The ZIP archive is damaged or invalid.",
  DEV_WORKSPACE_ARCHIVE_LIMIT: "The development workspace currently imports ZIP files up to 100 MB and extracts up to 500 MB.",
  DEV_WORKSPACE_DOCKER_UNAVAILABLE: "Docker Desktop is not running. Start Docker Desktop to run code in the isolated development sandbox; file editing still works.",
  DEV_WORKSPACE_INVALID_ARCHIVE: "VIRGO could not read this ZIP. Check that it is a standard, unencrypted ZIP archive.",
  INVALID_AI_MESSAGE: "This message is too long for the selected mode. Enable Development mode or attach the code as a file.",
  GEMINI_NOT_CONFIGURED: "VIRGO’s AI provider is not configured. Check the AI provider settings.",
  GEMINI_HTTP_400: "The AI provider rejected this request. The attached content may exceed its context or file limits; try a smaller ZIP or fewer files.",
  GEMINI_HTTP_403: "The AI provider key or project is not authorized for this model.",
  GEMINI_HTTP_429: "The AI provider quota is exhausted or rate limited. Try again later or check the provider quota.",
  AI_PROVIDER_TIMEOUT: "The AI provider took too long to respond. Try a smaller attachment or send fewer files.",
  AI_PROVIDER_NETWORK_ERROR: "VIRGO could not reach the configured AI provider. Check the server connection and provider endpoint.",
  AI_PROVIDER_AUTH_FAILED: "The configured AI provider rejected its API key. Update the key in AI settings.",
  AI_PROVIDER_RATE_LIMITED: "The AI provider quota is exhausted or rate limited. Try again later.",
  SECURITY_REQUEST_DENIED: "This request was stopped by the site's security filter. Please refresh the page; if it continues, contact the store administrator.",
  RATE_LIMIT_EXCEEDED: "The site is handling many requests right now. Please wait a moment and try again.",
};
const errorText = (e: any) => {
  const raw = String(e?.message || e || "Something went wrong");
  const code = String(e?.code || raw).split(":")[0].trim().toUpperCase();
  if (FRIENDLY_ERRORS[code]) return FRIENDLY_ERRORS[code];
  if (/^GEMINI_HTTP_\d+$/.test(code)) return "The AI provider rejected this request. Try fewer or smaller attached files, then check the provider quota and model access if it continues.";
  if (/^AI_PROVIDER_/.test(code) || /^GEMINI_/.test(code)) return "VIRGO could not complete this AI request. Check the AI provider status and try a smaller attachment.";
  if (code === "VALIDATION_ERROR") {
    const issue = Array.isArray(e?.details)
      ? e.details.find((item: any) => typeof item?.message === "string")
      : null;
    if (issue) {
      const field = Array.isArray(issue.path) ? issue.path.filter(Boolean).join(" ") : "details";
      return `Please check ${field}: ${issue.message}`;
    }
    return "Some checkout details are invalid. Please review your shipping information.";
  }
  return FRIENDLY_ERRORS[raw] || raw.replaceAll("_", " ");
};
const authErrorText = (e: any) => {
  const code = String(e?.code || e?.message || e || "UNKNOWN_ERROR")
    .split(":")[0]
    .trim()
    .toUpperCase();
  const messages: Record<string, string> = {
    EMAIL_INVALID: "Enter a valid email address, for example name@example.com.",
    NAME_INVALID: "Enter your full name using at least 2 characters.",
    PHONE_INVALID:
      "Enter a valid Indian mobile number beginning with 6, 7, 8 or 9.",
    INVALID_MOBILE:
      "Enter a valid Indian mobile number beginning with 6, 7, 8 or 9.",
    PASSWORD_POLICY_FAILED:
      "Choose a password with 12–128 characters, including uppercase, lowercase, a number and a symbol.",
    PASSWORD_REQUIRED: "Enter your password to continue.",
    ADDRESS_REQUIRED:
      "Complete your first name, last name, address, city, state, PIN code and country.",
    ADDRESS_LINE_INVALID:
      "Enter a delivery address with at least 5 characters.",
    PIN_INVALID: "Enter a valid 6-digit Indian PIN code.",
    TERMS_REQUIRED:
      "Please accept the Terms of Service and Privacy Policy before creating an account.",
    OTP_MUST_BE_SIX_DIGITS:
      "Enter the complete 6-digit code sent to your email.",
    INVALID_OTP:
      "That verification code is incorrect. Check the email and try again.",
    OTP_EXPIRED:
      "That verification code has expired or was already used. Request a new code.",
    OTP_ATTEMPTS_EXCEEDED:
      "Too many incorrect code attempts. Request a new verification code.",
    OTP_TOO_FREQUENT:
      "A code was requested recently. Wait about 60 seconds before requesting another.",
    OTP_PEPPER_NOT_CONFIGURED:
      "OTP security is not configured. Set a separate random OTP_PEPPER of at least 32 characters in backend/.env and restart the API.",
    EMAIL_PROVIDER_NOT_CONFIGURED:
      "Email delivery is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and EMAIL_FROM in backend/.env, then restart the API.",
    EMAIL_FROM_NOT_CONFIGURED:
      "EMAIL_FROM is missing in backend/.env. Set it to your Gmail address (same as SMTP_USER) and restart the API.",
    SMTP_CONFIG_INCOMPLETE:
      "SMTP is incomplete. Set SMTP_HOST, SMTP_USER, SMTP_PASS and EMAIL_FROM in backend/.env, then restart.",
    SMTP_SEND_FAILED:
      "SMTP rejected the message. For Gmail, use a Google App Password (not your normal password) and ensure 2-Step Verification is on.",
    SMTP_EMAIL_FROM_INVALID:
      "EMAIL_FROM must be a plain email like you@gmail.com (no newlines).",
    SMTP_STARTTLS_UNAVAILABLE:
      "SMTP server did not offer STARTTLS. Use port 587 with SMTP_SECURE=false for Gmail.",
    SMTP_TIMEOUT:
      "Could not reach the SMTP server. Check internet/firewall and SMTP_HOST.",
    SMTP_UNEXPECTED_RESPONSE_535:
      "SMTP authentication failed. Wrong SMTP_USER or App Password — regenerate the Gmail App Password.",
    SMTP_UNEXPECTED_RESPONSE_534:
      "SMTP login blocked. Enable 2-Step Verification and use a Gmail App Password.",

    EMAIL_SEND_FAILED:
      "SMTP could not send your code. Check the SMTP connection, credentials and permitted sender address.",
    EMAIL_RESERVED:
      "This email is reserved for store administration. Use a different email for a customer account.",
    EMAIL_ALREADY_REGISTERED:
      "An account with this email already exists. Sign in or use Forgot password.",
    ALREADY_EXISTS:
      "An account or record with these details already exists. Check the details or sign in.",
    EMAIL_NOT_REGISTERED:
      "No matching customer account was found. Check the email or create an account.",
    EMAIL_NOT_VERIFIED:
      "This email has not been verified. Complete email verification before signing in.",
    INVALID_CREDENTIALS:
      "The email or password is incorrect. Check both and try again.",
    ACCOUNT_BLOCKED:
      "This email or mobile number was previously blocked or removed. Use a different email/phone, or ask an admin to clear the block list.",
    VALIDATION_ERROR:
      "Some details are missing or invalid. Check the highlighted information and try again.",
    API_UNAVAILABLE:
      "ATELIER could not reach the server. Check that the backend is running and try again.",
  };
  const issues = Array.isArray(e?.details) ? e.details : [];
  const firstIssue = issues.find((x: any) => typeof x?.message === "string");
  if (code === "VALIDATION_ERROR" && firstIssue) {
    const path = Array.isArray(firstIssue.path)
      ? firstIssue.path.filter(Boolean).join(" → ")
      : "";
    return path
      ? `Please check ${path}: ${firstIssue.message}`
      : `Please check your details: ${firstIssue.message}`;
  }
  if (messages[code]) return messages[code];
  if (code.startsWith("EMAIL_SEND_FAILED") || code.startsWith("SMTP_"))
    return (
      messages[code] ||
      "Email could not be sent. Check SMTP settings in backend/.env and restart the API."
    );
  if (code === "DATABASE_UNAVAILABLE")
    return "The API cannot reach PostgreSQL. Start PostgreSQL and check DATABASE_URL in backend/.env, then restart the project.";
  if (code === "DATABASE_AUTH_FAILED")
    return "PostgreSQL rejected the configured credentials. Check the username/password in DATABASE_URL in backend/.env.";
  if (code === "DATABASE_SCHEMA_OUTDATED")
    return "The database schema is outdated. Run npm run db:deploy from the project root, then restart the project.";
  if (code === "DATABASE_NOT_FOUND")
    return "The PostgreSQL database in DATABASE_URL does not exist. Create it or correct the database name, then run npm run db:deploy.";
  if (code.startsWith("HTTP_5") || code === "SERVER_ERROR")
    return "The server could not complete this request. Check the API terminal and http://localhost:4000/api/health for the underlying issue.";
  if (firstIssue) return `Please check your details: ${firstIssue.message}`;
  return errorText(e?.message || e || "Something went wrong");
};
function normalizeSearch(v: string) {
  return v
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .trim();
}
function fuzzyMatch(query: string, text: string) {
  const q = normalizeSearch(query),
    t = normalizeSearch(text);
  if (!q) return true;
  if (t.includes(q)) return true;
  const words = t.split(/\s+/);
  return words.some((w) => {
    if (Math.abs(w.length - q.length) > 2) return false;
    let i = 0,
      j = 0,
      m = 0;
    while (i < w.length && j < q.length) {
      if (w[i] === q[j]) j++;
      else m++;
      i++;
    }
    m += q.length - j;
    return m <= 2;
  });
}
function safeImg(src: string) {
  const value = String(src || "").trim();
  return (/^\/(?:images|uploads)\//.test(value) ||
    /^https:\/\/[^\s]+$/i.test(value)) &&
    value !== FALLBACK
    ? value
    : FALLBACK;
}
const AUTH_IMAGES = {
  login: "/images/products/new-catalogue/women/pleated-palazzo-co-ord-01.avif",
  register:
    "/images/products/new-catalogue/men/relaxed-heavyweight-tee-01.avif",
};

function SmartImage({
  src,
  alt,
  priority = false,
  className = "",
  style,
  fallbackSrc = FALLBACK,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className?: string;
  style?: React.CSSProperties;
  fallbackSrc?: string;
}) {
  const initial = safeImg(src);
  const fallback = safeImg(fallbackSrc);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => setAttempt(0), [initial, fallback]);
  const candidates = useMemo(() => {
    const variants = [initial];
    if (/\.svg(?:\?|$)/i.test(initial)) {
      variants.push(
        initial.replace(/\.svg(?:\?|$)/i, ".jpg"),
        initial.replace(/\.svg(?:\?|$)/i, ".png"),
      );
    }
    variants.push(fallback, FALLBACK);
    return Array.from(new Set(variants.filter(Boolean)));
  }, [initial, fallback]);
  const source =
    candidates[Math.min(attempt, candidates.length - 1)] || FALLBACK;
  return (
    <img
      className={`atelier-smart-image ${className}`.trim()}
      style={style}
      src={source}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setAttempt((v) => Math.min(v + 1, candidates.length - 1))}
    />
  );
}

const localKey = "atelier_guest_cart_v2";
function loadGuestCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(localKey) || "[]");
  } catch {
    return [];
  }
}
function saveGuestCart(v: CartItem[]) {
  try {
    localStorage.setItem(localKey, JSON.stringify(v));
  } catch {}
}

function slugForPath(pathname: string) {
  return pathname === "/" || pathname === "/home"
    ? "home"
    : pathname === "/about"
      ? "about"
      : pathname === "/login"
        ? "login"
        : pathname === "/register"
          ? "register"
          : ["/shop", "/women", "/men", "/new"].includes(pathname)
            ? "shop"
            : pathname.startsWith("/collections")
              ? "collections"
              : pathname.startsWith("/product/")
                ? "product"
                : pathname === "/account" || pathname.startsWith("/account/")
                  ? "account"
                  : pathname === "/builder"
                    ? "builder"
                    : pathname === "/stylist"
                      ? "stylist"
                      : pathname === "/indo-western"
                        ? "indo-western"
                        : pathname === "/western"
                          ? "western"
                          : pathname === "/cart"
                            ? "cart"
                            : pathname === "/checkout"
                              ? "checkout"
                              : pathname === "/wishlist"
                                ? "wishlist"
                                : pathname === "/search"
                                  ? "search"
                                  : pathname === "/custom"
                                    ? "custom"
                                    : pathname?.startsWith("/custom-pages/")
                                      ? pathname.slice(14)
                                      : /^\/[a-z0-9][a-z0-9-]*$/.test(
                                            pathname || "",
                                          ) && !(pathname === ADMIN_ROUTE)
                                        ? String(pathname).slice(1)
                                        : "";
}
function StorefrontLoading() {
  return (
    <div
      className="storefront-loading page"
      aria-busy="true"
      aria-label="Loading ATELIER"
    >
      <div className="loading-topbar">
        <span className="loading-brand">ATELIER</span>
        <span className="loading-navs">
          <i />
          <i />
          <i />
          <i />
        </span>
        <span className="loading-actions">
          <i />
          <i />
          <i />
        </span>
      </div>
      <section className="loading-hero">
        <div className="loading-copy">
          <span className="loading-line eyebrow" />
          <span className="loading-title" />
          <span className="loading-title short" />
          <span className="loading-body" />
          <span className="loading-btn" />
        </div>
      </section>
      <section className="loading-collection">
        <span className="loading-section-title" />
        <div className="loading-grid">
          {[0, 1, 2, 3].map((i) => (
            <div className="loading-card" key={i}>
              <span className="loading-card-media" />
              <span className="loading-card-line" />
              <span className="loading-card-line short" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
export default function Storefront() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({
    siteName: "ATELIER",
    tagline: "Exceptional fashion for every moment.",
    footerTagline: "Quiet luxury, considered for modern life.",
  });
  const [user, setUser] = useState<User | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cmsPage, setCmsPage] = useState<CmsPage | null>(null);
  const [wish, setWish] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [searchText, setSearchText] = useState("");
  const [adminMode, setAdminMode] = useState("dashboard");
  const [canvasMode, setCanvasMode] = useState(false);
  const [canvasDraft, setCanvasDraft] = useState<CmsPage | null>(null);
  const [canvasSelected, setCanvasSelected] = useState("");
  const [cmsReload, setCmsReload] = useState(0);
  const [cartOpen, setCartOpen] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);
  const [aiMinimized, setAiMinimized] = useState(false);
  const openAI = useCallback(() => { setAiMinimized(false); setAiOpen(true); }, []);
  const [aiStatus, setAiStatus] = useState<AssistantStatus>("idle");
  const closeAI = useCallback(() => { setAiOpen(false); setAiMinimized(false); setAiStatus("idle"); }, []);
  const [accountOpen, setAccountOpen] = useState(false);

  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(""), 4200);
  }, []);
  useEffect(() => () => {
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
  }, []);
  const pathnameRef = useRef(pathname);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const refreshCore = useCallback(async () => {
    if (refreshInFlight.current) return refreshInFlight.current;
    refreshInFlight.current = (async () => {
    setApiError("");
    const currentPath = pathnameRef.current;
    const isAdminPath =
      currentPath === ADMIN_ROUTE || currentPath.startsWith(`${ADMIN_ROUTE}/`);
    // Start session lookup alongside catalogue reads; handle rejection now so
    // a fast 401 cannot become an unhandled rejection while products load.
    const session = api<{ user: User }>(isAdminPath ? "/auth/admin/me" : "/auth/me")
      .then(value => ({ value, error: null }), error => ({ value: null, error }));
    const [ps, cs, site] = await Promise.allSettled([
      api<Product[]>("/products"),
      api<any[]>("/categories"),
      api<Record<string, any>>("/settings"),
    ]);
    if (ps.status === "rejected") {
      setApiError(errorText(ps.reason));
      setProducts([]);
      setCategories([]);
      return;
    }
    setProducts(ps.value);
    if (cs.status === "fulfilled") setCategories(cs.value);
    if (site.status === "fulfilled") setSettings(site.value);
    // The public catalogue is usable while session/cart data is loading.
    // Admin routes still wait for their authentication check.
    if (!isAdminPath) setLoading(false);
    try {
      const result = await session;
      if (!result.value) throw result.error;
      const me = result.value;
      setUser(me.user);
      if (me.user.role === "ADMIN") {
        setCart([]);
        setWish([]);
        return;
      }
      const [c, w] = await Promise.all([
        api<any>("/cart"),
        api<Product[]>("/wishlist"),
      ]);
      setCart(c.items || []);
      setWish(w);
    } catch (e: any) {
      if (e instanceof ApiError && e.status === 401) {
        setUser(null);
        setCart(loadGuestCart());
      } else if (e?.code !== "API_UNAVAILABLE") {
        console.warn("Session data refresh failed", e);
        setApiError(errorText(e.message));
      }
    }
    })();
    try {
      await refreshInFlight.current;
    } finally {
      refreshInFlight.current = null;
    }
  }, []);
  const retryCore = useCallback(async () => {
    setLoading(true);
    try {
      await refreshCore();
    } finally {
      setLoading(false);
    }
  }, [refreshCore]);
  useEffect(() => {
    refreshCore().finally(() => setLoading(false));
  }, [refreshCore]);
  useEffect(() => {
    const t =
      settings.theme && typeof settings.theme === "object"
        ? settings.theme
        : {};
    const imgSettings =
      settings.imageSettings && typeof settings.imageSettings === "object"
        ? settings.imageSettings
        : {};
    const root = document.documentElement;
    const map: Record<string, string> = {
      "--ref-paper": String(t.paper || "#f5f0e9"),
      "--ref-paper-2": String(t.paper2 || "#eee6dc"),
      "--ref-ink": String(t.ink || "#201914"),
      "--ref-muted": String(t.muted || "#746960"),
      "--ref-peach": String(t.accent || "#e9b8a5"),
      "--ref-brown-dark": String(t.dark || "#19120e"),
      "--ref-brown": String(t.brown || "#3a2920"),
    };
    Object.entries(map).forEach(([k, v]) => root.style.setProperty(k, v));
    Object.entries(siteThemeVariables(t)).forEach(([k, v]) => root.style.setProperty(k, v));
    document.body.dataset.siteTheme = Object.keys(t).length ? "true" : "false";
    root.style.setProperty(
      "--atelier-admin-radius",
      `${Number(t.radius || 0)}px`,
    );
    root.style.setProperty(
      "--atelier-max-width",
      `${Number(t.maxWidth || 1480)}px`,
    );
    root.style.setProperty(
      "--serif",
      t.headingFont
        ? `${String(t.headingFont)}, Georgia, serif`
        : "Georgia, 'Times New Roman', serif",
    );
    root.style.setProperty(
      "--sans",
      t.bodyFont
        ? `${String(t.bodyFont)}, Arial, sans-serif`
        : "Arial, 'Helvetica Neue', sans-serif",
    );

    // Global Image Size, Aspect Ratio, Framing and Grid Density Controls
    const aspect = String(imgSettings.aspectRatio || t.imageAspect || "4/5");
    const fit = String(imgSettings.fit || t.imageFit || "contain");
    const scale = Number(imgSettings.scale ?? t.imageScale ?? 100) / 100;
    const padding = Number(imgSettings.padding ?? t.imagePadding ?? 8);
    const shopCols = Number(imgSettings.shopColumns || t.shopCols || 3);
    const homeCols = Number(imgSettings.homeColumns || t.homeCols || 5);
    const heroH = Number(imgSettings.heroHeight || t.heroHeight || 680);

    root.style.setProperty("--site-img-aspect", aspect);
    root.style.setProperty("--site-img-fit", fit);
    root.style.setProperty("--site-img-scale", String(scale));
    root.style.setProperty("--site-img-padding", `${padding}px`);
    root.style.setProperty("--shop-grid-cols", String(shopCols));
    root.style.setProperty("--home-grid-cols", String(homeCols));
    root.style.setProperty("--hero-min-height", `${heroH}px`);
    const checkoutTheme = settings.checkoutTheme && typeof settings.checkoutTheme === "object" ? settings.checkoutTheme : {};
    const checkoutVars: Record<string, string> = {
      "--checkout-page-background": String(checkoutTheme.pageBackground || "#f5f0e9"),
      "--checkout-card-background": String(checkoutTheme.cardBackground || "#fbf7f1"),
      "--checkout-text-color": String(checkoutTheme.textColor || "#211a16"),
      "--checkout-muted-color": String(checkoutTheme.mutedColor || "#6e655e"),
      "--checkout-input-background": String(checkoutTheme.inputBackground || "#fffdf9"),
      "--checkout-accent-color": String(checkoutTheme.accentColor || "#d7ff55"),
    };
    Object.entries(checkoutVars).forEach(([key, value]) => root.style.setProperty(key, value));
  }, [settings.theme, settings.imageSettings, settings.checkoutTheme]);
  useEffect(() => {
    if (!user) {
      try {
        setWish(JSON.parse(localStorage.getItem("atelier_guest_wish") || "[]"));
      } catch {}
    }
  }, [user]);
  useEffect(() => {
    if (pathname === ADMIN_ROUTE || pathname.startsWith(`${ADMIN_ROUTE}/`))
      setAdminMode(searchParams.get("section") || "dashboard");
  }, [pathname, searchParams]);
  const [cmsTick, setCmsTick] = useState(0);
  useEffect(() => {
    const slug = slugForPath(pathname || "/");
    if (!slug) {
      setCmsPage(null);
      return;
    }
    // Inside the Visual Studio canvas the unsaved draft is pushed in by the builder; do not overwrite it.
    if (canvasMode && canvasDraft) return;
    let cancelled = false;
    api<CmsPage>(`/pages/${encodeURIComponent(slug)}`)
      .then((v) => {
        if (!cancelled) setCmsPage(v);
      })
      .catch((e: any) => {
        if (!cancelled && (cmsTick === 0 || e?.status === 404))
          setCmsPage(null);
      });
    return () => {
      cancelled = true;
    };
  }, [pathname, cmsTick, canvasMode, !!canvasDraft]);
  // Live sync: any admin save (this tab or another tab/window) refreshes the storefront content without a manual reload.
  useEffect(() => {
    const bump = () => setCmsTick((t) => t + 1);
    window.addEventListener("atelier:data-changed", bump);
    let ch: BroadcastChannel | null = null;
    try {
      ch = new BroadcastChannel("atelier-sync");
    } catch {}
    const relay = (e: Event) => {
      if ((e as CustomEvent).detail?.remote) return;
      try {
        ch?.postMessage("changed");
      } catch {}
      try {
        localStorage.setItem("atelier:sync-ping", String(Date.now()));
      } catch {}
    };
    const fromRemote = () =>
      window.dispatchEvent(
        new CustomEvent("atelier:data-changed", { detail: { remote: true } }),
      );
    window.addEventListener("atelier:data-changed", relay);
    if (ch) ch.onmessage = fromRemote;
    const onStorage = (e: StorageEvent) => {
      if (e.key === "atelier:sync-ping") fromRemote();
    };
    window.addEventListener("storage", onStorage);
    let last = 0;
    const onVisible = () => {
      if (document.visibilityState === "visible" && Date.now() - last > 5000) {
        last = Date.now();
        fromRemote();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      window.removeEventListener("atelier:data-changed", bump);
      window.removeEventListener("atelier:data-changed", relay);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
      try {
        ch?.close();
      } catch {}
    };
  }, []);
  useEffect(() => {
    setMobileMenu(false);
  }, [pathname]);
  // Visual Studio canvas: this storefront runs inside the builder iframe and renders the builder's unsaved draft with the real components.
  useEffect(() => {
    const inFrame = typeof window !== "undefined" && window.parent !== window;
    const on = inFrame && searchParams.get("canvas") === "1";
    setCanvasMode(on);
    if (!on) return;
    const origin = window.location.origin;
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== origin || e.source !== window.parent) return;
      const m: any = e.data;
      if (!m || typeof m !== "object") return;
      if (
        m.type === "atelier:canvas-page" &&
        m.page &&
        typeof m.page === "object"
      )
        setCanvasDraft(m.page as CmsPage);
      if (m.type === "atelier:canvas-selected")
        setCanvasSelected(String(m.sectionId || ""));
      if (m.type === "atelier:canvas-scroll-to") {
        const el = document.querySelector(
          `[data-cms-section-id="${CSS.escape(String(m.sectionId || ""))}"]`,
        );
        el?.scrollIntoView({ block: "start", behavior: "smooth" });
      }
      if (m.type === "atelier:canvas-css-var" && m.name && m.value) {
        document.documentElement.style.setProperty(m.name, m.value);
      }
      if (m.type === "atelier:canvas-settings" && m.settings && typeof m.settings === "object") {
        setSettings(current => ({ ...current, ...m.settings }));
      }
    };
    const onClick = (e: MouseEvent) => {
      const t = e.target as HTMLElement | null;
      if (!t || typeof t.closest !== "function") return;
      e.preventDefault();
      e.stopPropagation();
      const sec = t.closest<HTMLElement>("[data-cms-section-id]");
      const el = t.closest<HTMLElement>("[data-cms-element-id]");
      if (sec)
        window.parent.postMessage(
          {
            type: "atelier:canvas-select",
            sectionId: sec.dataset.cmsSectionId,
            elementId: el?.dataset.cmsElementId || "",
          },
          origin,
        );
    };
    const onSubmit = (e: Event) => e.preventDefault();
    window.addEventListener("message", onMessage);
    document.addEventListener("click", onClick, true);
    document.addEventListener("submit", onSubmit, true);
    window.parent.postMessage({ type: "atelier:canvas-ready" }, origin);
    return () => {
      window.removeEventListener("message", onMessage);
      document.removeEventListener("click", onClick, true);
      document.removeEventListener("submit", onSubmit, true);
    };
  }, [searchParams]);
  useEffect(() => {
    const refresh = () => {
      void refreshCore();
    };
    window.addEventListener("atelier:data-changed", refresh);
    return () => window.removeEventListener("atelier:data-changed", refresh);
  }, [refreshCore]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (searchOpen) setSearchOpen(false);
      if (aiOpen && !aiMinimized) setAiMinimized(true);
      if (cartOpen) setCartOpen(false);
      if (mobileMenu) setMobileMenu(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [searchOpen, aiOpen, aiMinimized, cartOpen, mobileMenu]);

  const doNavigate = (to: string) => {
    const t = String(to || "").trim();
    if (/^https?:\/\//i.test(t)) {
      window.location.assign(t);
      return;
    }
    if (t.startsWith("/") && !t.startsWith("//")) router.push(t);
  };
  const cartCount = cart.reduce((s, i) => s + i.quantity, 0);
  const mergeGuestCart = async () => {
    try {
      const guest = loadGuestCart();
      if (!guest.length) return;
      const result = await api<any>("/cart/sync", {
        method: "POST",
        body: JSON.stringify({
          items: guest.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
            size: i.size,
            color: i.color,
          })),
        }),
      });
      const rejectedIds = new Set(
        (result.rejected || []).map((x: any) => String(x.productId)),
      );
      saveGuestCart(guest.filter((i) => rejectedIds.has(String(i.productId))));
      if (rejectedIds.size)
        notify(
          `${rejectedIds.size} bag item(s) could not be restored because the piece or variant is unavailable.`,
        );
      const c = result.cart || (await api<any>("/cart"));
      setCart(c.items || []);
    } catch (e: any) {
      console.warn("Guest cart sync failed", e);
      notify(
        "We could not finish restoring your guest bag. Your items are still saved on this device.",
      );
    }
  };
  const addCart = async (
    product: Product,
    size = product.sizes?.includes("M") ? "M" : product.sizes?.[0] || "M",
    color = product.colors?.[0] || "Black",
    qty = 1,
  ): Promise<boolean> => {
    try {
      if (!size || !color) {
        notify("Select a size and colour first.");
        return false;
      }
      if (Number(product.stock || 0) < 1) {
        notify("This piece is sold out.");
        return false;
      }
      const limit = Math.min(Math.max(1, Number(product.stock || 1)), 20);
      if (user) {
        const r = await api<any>("/cart/items", {
          method: "POST",
          body: JSON.stringify({
            productId: product.id,
            quantity: Math.min(qty, limit),
            size,
            color,
          }),
        });
        const c = await api<any>("/cart");
        setCart(c.items || []);
      } else {
        const old = loadGuestCart();
        const idx = old.findIndex(
          (x) =>
            x.productId === product.id && x.size === size && x.color === color,
        );
        if (idx >= 0) {
          if (old[idx].quantity >= limit) {
            notify(`Only ${limit} available.`);
            return false;
          }
          old[idx].quantity = Math.min(limit, old[idx].quantity + qty);
        } else
          old.push({
            id: `guest-${Date.now()}`,
            productId: product.id,
            quantity: Math.min(qty, limit),
            size,
            color,
            product,
          });
        saveGuestCart(old);
        setCart(old);
      }
      notify(`${product.name} added to your cart.`);
      setCartOpen(true);
      return true;
    } catch (e: any) {
      notify(
        String(e?.message || "Could not add to cart").replaceAll("_", " "),
      );
      return false;
    }
  };
  const changeQty = async (item: CartItem, delta: number) => {
    if (item.quantity + delta <= 0) {
      await removeCart(item);
      return;
    }
    const limit = Math.min(Math.max(1, Number(item.product.stock || 20)), 20);
    const next = Math.min(limit, Math.max(1, item.quantity + delta));
    if (next === item.quantity && delta > 0) {
      notify(`Only ${limit} available.`);
      return;
    }
    try {
      if (user) {
        await api(`/cart/items/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({ quantity: next }),
        });
        const c = await api<any>("/cart");
        setCart(c.items || []);
      } else {
        const c = cart.map((i) =>
          i.id === item.id ? { ...i, quantity: next } : i,
        );
        saveGuestCart(c);
        setCart(c);
      }
    } catch (e: any) {
      notify(
        String(e.message || "Could not update quantity").replaceAll("_", " "),
      );
    }
  };
  const removeCart = async (item: CartItem) => {
    try {
      if (user) {
        await api(`/cart/items/${item.id}`, { method: "DELETE" });
        const c = await api<any>("/cart");
        setCart(c.items || []);
      } else {
        const c = cart.filter((i) => i.id !== item.id);
        saveGuestCart(c);
        setCart(c);
      }
    } catch (e: any) {
      notify(e.message || "Could not remove item");
    }
  };
  const toggleWish = async (p: Product) => {
    try {
      const exists = wish.some((w) => w.id === p.id);
      if (user) {
        if (exists) {
          await api(`/wishlist/${p.id}`, { method: "DELETE" });
          setWish(wish.filter((w) => w.id !== p.id));
        } else {
          await api(`/wishlist/${p.id}`, { method: "POST" });
          setWish([...wish, p]);
        }
      } else {
        const next = exists ? wish.filter((w) => w.id !== p.id) : [...wish, p];
        setWish(next);
        try {
          localStorage.setItem("atelier_guest_wish", JSON.stringify(next));
        } catch {}
      }
      notify(
        exists
          ? `${p.name} removed from your wishlist.`
          : `${p.name} saved to your wishlist.`,
      );
    } catch (e: any) {
      notify(e.message || "Wishlist failed");
    }
  };
  const logout = async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } catch (e) {
      console.warn("Logout request failed", e);
    } finally {
      setUser(null);
      setWish([]);
      setCart(loadGuestCart());
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      notify("Thank you for visiting ATELIER. See you again soon.");
      doNavigate("/");
    }
  };

  useEffect(() => {
    // The AI is a non-modal floating window, so keep the storefront scrollable
    // while it is open. Full overlays continue to lock background scrolling.
    const locked = searchOpen || cartOpen || mobileMenu || accountOpen;
    document.body.style.overflow = locked ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [searchOpen, cartOpen, mobileMenu, accountOpen]);

  const isAdminRoute =
    pathname === ADMIN_ROUTE || pathname?.startsWith(`${ADMIN_ROUTE}/`);
  if (loading) return <StorefrontLoading />;
  const routeProps = {
    pathname: pathname || "/",
    searchParams,
    products,
    categories,
    settings,
    user,
    cart,
    wish,
    cmsPage:
      canvasMode &&
      canvasDraft &&
      canvasDraft.slug === slugForPath(pathname || "/")
        ? canvasDraft
        : cmsPage && cmsPage.slug === slugForPath(pathname || "/")
          ? cmsPage
          : null,
    canvasMode,
    canvasSelected,
    adminMode,
    onNavigate: doNavigate,
    onAddCart: addCart,
    onChangeQty: changeQty,
    onRemoveCart: removeCart,
    onToggleWish: toggleWish,
    onSetUser: (nextUser: User | null) => {
      setUser(nextUser);
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
    },
    onSetCart: setCart,
    onMergeGuestCart: mergeGuestCart,
    onNotify: notify,
    onLogout: logout,
  };
  if (isAdminRoute)
    return (
      <main id="main-content" className="admin-page">
        <RouteView {...routeProps} />
        {user?.role === "ADMIN" && <AIPetControl user={user} onOpen={openAI} isChatOpen={aiOpen && !aiMinimized} chatMinimized={aiOpen && aiMinimized} assistantState={aiStatus} />}
        {aiOpen && <AtelierAIPanel key={user?.id || "guest"} user={user} cart={cart} products={products} onClose={closeAI} onToggleMinimize={() => setAiMinimized((value) => !value)} minimized={aiMinimized} onNavigate={doNavigate} onStatusChange={setAiStatus} />}
        {toast && (
          <div className="toast show" role="status" aria-live="polite">
            {toast}
          </div>
        )}
      </main>
    );
  return (
    <>
      <SiteTextLayer settings={settings} route={pathname || "/"} canvas={canvasMode} />
      {pathname === "/" && <CinematicAtmosphereCanvas />}
      <ScrollProgress />
      <CursorRing />
      <AnnouncementBar settings={settings} />
      <Header
        user={user}
        cartCount={cartCount}
        settings={settings}
        onNavigate={doNavigate}
        onSearch={() => setSearchOpen(true)}
        mobileOpen={() => setMobileMenu(true)}
        onUser={() => user?.role === "USER" ? setAccountOpen(true) : doNavigate(user?.role === "ADMIN" ? ADMIN_ROUTE : "/login")}
        onCart={() => setCartOpen(true)}
        onAI={openAI}
        active={pathname || "/"}
      />
      <main
        id="main-content"
        className={`page ${slugForPath(pathname || "/") === "about" ? "page-about page-about-cms" : `page-${slugForPath(pathname || "/")}`}`}
      >
        <RouteView {...routeProps} />
      </main>
      <Footer settings={settings} onNavigate={doNavigate} />
      <AIPetControl user={user} onOpen={openAI} isChatOpen={aiOpen && !aiMinimized} chatMinimized={aiOpen && aiMinimized} assistantState={aiStatus} />
      {accountOpen && user?.role === "USER" && <AccountQuickDrawer user={user} onClose={() => setAccountOpen(false)} onNavigate={(to) => { setAccountOpen(false); doNavigate(to); }} onLogout={logout} />}
      {mobileMenu && (
        <MobileMenu
          user={user}
          onClose={() => setMobileMenu(false)}
          onNavigate={doNavigate}
          onAI={openAI}
        />
      )}
      {searchOpen && (
        <SearchOverlay
          products={products}
          value={searchText}
          onChange={setSearchText}
          onClose={() => {
            setSearchOpen(false);
            setSearchText("");
          }}
          onNavigate={doNavigate}
        />
      )}
      {cartOpen && (
        <CartDrawer
          cart={cart}
          products={products}
          onClose={() => setCartOpen(false)}
          onNavigate={doNavigate}
          onChangeQty={changeQty}
          onRemoveCart={removeCart}
        />
      )}{" "}
      {aiOpen && (
        <AtelierAIPanel
          key={user?.id || "guest"}
          user={user}
          cart={cart}
          products={products}
          onClose={closeAI}
          onToggleMinimize={() => setAiMinimized((value) => !value)}
          minimized={aiMinimized}
          onNavigate={doNavigate}
          onStatusChange={setAiStatus}
        />
      )}{" "}
      {toast && (
        <div className="toast show" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </>
  );
}

function AnnouncementBar({ settings }: { settings: Record<string, any> }) {
  const raw = String(
    settings.announcement ||
      "ATELIER / Studio notes · Autumn — Winter 2026 · Form in motion",
  );
  const parts = raw.split(/\s*[·|•✳]\s*/).filter(Boolean);
  return (
    <div className="cin-topline" role="status">
      {parts.map((t, i) => (
        <span key={i} className="cin-topline-part">
          {i > 0 && (
            <span className="cin-dot" aria-hidden="true">
              ✳
            </span>
          )}
          <span>{t}</span>
        </span>
      ))}
    </div>
  );
}
function Header({
  user,
  cartCount,
  onSearch,
  mobileOpen,
  onUser,
  onCart,
  onAI,
  active,
  settings,
  onNavigate,
}: {
  user: User | null;
  cartCount: number;
  onSearch: () => void;
  mobileOpen: () => void;
  onUser: () => void;
  onCart: () => void;
  onAI: () => void;
  active: string;
  settings: Record<string, any>;
  onNavigate: (p: string) => void;
}) {
  let customNav: { route: string; label: string }[] = [];
  try {
    const raw = JSON.parse(String(settings.navLinks || "[]"));
    if (Array.isArray(raw))
      customNav = raw.filter(
        (x: any) =>
          x && x.route && x.label &&
          String(x.route).replace(/\/$/, "").toLowerCase() !== "/cinematic" &&
          !/zero\s*3d/i.test(String(x.label)),
      );
  } catch {}
  const isAdmin = user?.role === "ADMIN";
  const nav = customNav.length
    ? customNav
    : [
        { route: "/", label: settings.headerHomeLabel || "Home" },
        { route: "/shop", label: settings.headerShopLabel || "Shop" },
        {
          route: "/collections",
          label: settings.headerCollectionsLabel || "Collections",
        },
        { route: "/indo-western", label: "Indo-Western" },
        { route: "/western", label: "Western" },
        { route: "/about", label: settings.headerAboutLabel || "About" },
      ];
  const link = (x: { route: string; label: string }) => (
    <a
      key={x.route}
      className={
        (
          x.route === "/"
            ? active === "/"
            : active === x.route || active.startsWith(`${x.route}/`)
        )
          ? "active"
          : ""
      }
      href={x.route}
      onClick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault();
        onNavigate(x.route);
      }}
    >
      {x.label}
    </a>
  );
  return (
    <header className="cin-nav">
      <button
        className="cin-menu-toggle"
        onClick={mobileOpen}
        aria-label="Open menu"
      >
        Menu +
      </button>
      <nav className="cin-nav-links" aria-label="Main navigation">
        {nav.map(link)}
      </nav>
      <button
        className="cin-brand"
        onClick={() => onNavigate("/")}
        aria-label={`${settings.siteName || "ATELIER"} home`}
      >
        {settings.siteName || "ATELIER"}
        <small>{settings.brandTagline || "FORM · FUNCTION · FEELING"}</small>
      </button>
      <div className="cin-nav-right">
        <button className="cin-nav-action cin-hide-sm" onClick={onSearch}>
          Search ↗
        </button>
        <button
          className="cin-nav-action cin-hide-sm"
          onClick={onAI}
          aria-label="Open VIRGO"
        >
          AI
        </button>
        <button
          className="cin-nav-action"
          onClick={onUser}
          aria-label={isAdmin ? "Open dashboard" : user ? "Account" : "Sign in"}
        >
          <Icon name="user" size={14} /> {isAdmin ? "Admin" : "Account"}
        </button>
        {!isAdmin && (
          <button
            className="cin-nav-action"
            onClick={onCart}
            aria-label={`Cart${cartCount ? `, ${cartCount} items` : ""}`}
          >
            <Icon name="cart" size={15} /> Cart{" "}
            <span className="cin-bag-count">
              {cartCount > 99 ? "99+" : cartCount}
            </span>
          </button>
        )}
        <button
          className="cin-nav-action cin-show-sm"
          onClick={onSearch}
          aria-label="Search"
        >
          ⌕
        </button>
      </div>
    </header>
  );
}

function AIPetControl({ user, onOpen, assistantState = "idle", isChatOpen = false, chatMinimized = false }: { user: User | null; onOpen: () => void; assistantState?: AssistantStatus; isChatOpen?: boolean; chatMinimized?: boolean }) {
  const petChoices = [
    { id: "owl", emoji: "🦉", label: "Owl" },
    { id: "fox", emoji: "🦊", label: "Fox" },
    { id: "cat", emoji: "🐈", label: "Cat" },
    { id: "butterfly", emoji: "🦋", label: "Butterfly" },
  ];
  const storageKey = `atelier-ai-pet:${user?.id || "guest"}`;
  const [pet, setPet] = useState("owl");
  const [customizing, setCustomizing] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const [pickerPlacement, setPickerPlacement] = useState("picker-above picker-left");
  const petRef = useRef<HTMLDivElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number; moved: boolean } | null>(null);
  const suppressClickRef = useRef(false);
  const lastTapRef = useRef(0);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(storageKey);
      if (petChoices.some((choice) => choice.id === saved)) setPet(saved!);
    } catch {}
  }, [storageKey]);
  useEffect(() => {
    // Position is a device preference (not tied to login state), so the owl never
    // snaps back to its default corner when the user object loads or changes.
    setCustomizing(false);
    try {
      const saved = JSON.parse(window.localStorage.getItem(PET_POSITION_KEY) || "null");
      if (!Number.isFinite(saved?.x) || !Number.isFinite(saved?.y)) return;
      const box = petRef.current?.getBoundingClientRect();
      const width = box?.width || (window.matchMedia("(max-width: 640px)").matches ? 74 : 82);
      const height = box?.height || width;
      const maxX = Math.max(8, window.innerWidth - width);
      const maxY = Math.max(8, window.innerHeight - height);
      setPosition({ x: Math.min(maxX, Math.max(8, saved.x * maxX)), y: Math.min(maxY, Math.max(8, saved.y * maxY)) });
      setPickerPlacement(`${saved.y < .5 ? "picker-below" : "picker-above"} ${saved.x < .5 ? "picker-left" : "picker-right"}`);
    } catch {}
  }, [storageKey]);
  useEffect(() => {
    if (!position) return;
    const clamp = () => setPosition((current) => {
      if (!current) return current;
      const box = petRef.current?.getBoundingClientRect();
      const width = box?.width || (window.matchMedia("(max-width: 640px)").matches ? 74 : 82);
      const height = box?.height || width;
      const x = Math.min(Math.max(8, window.innerWidth - width), current.x);
      const y = Math.min(Math.max(8, window.innerHeight - height), current.y);
      try { window.localStorage.setItem(PET_POSITION_KEY, JSON.stringify({ x: x / Math.max(1, window.innerWidth - width), y: y / Math.max(1, window.innerHeight - height) })); } catch {}
      return { x, y };
    });
    window.addEventListener("resize", clamp);
    window.addEventListener("orientationchange", clamp);
    window.visualViewport?.addEventListener("resize", clamp);
    return () => {
      window.removeEventListener("resize", clamp);
      window.removeEventListener("orientationchange", clamp);
      window.visualViewport?.removeEventListener("resize", clamp);
    };
  }, [position]);
  useEffect(() => {
    const move = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const dx = event.clientX - drag.startX;
      const dy = event.clientY - drag.startY;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      drag.moved = true;
      suppressClickRef.current = true;
      const box = petRef.current?.getBoundingClientRect();
      const width = box?.width || 82;
      const height = box?.height || width;
      const x = Math.min(Math.max(8, window.innerWidth - width), Math.max(8, drag.originX + dx));
      const y = Math.min(Math.max(8, window.innerHeight - height), Math.max(8, drag.originY + dy));
      setPosition({ x, y });
      try { window.localStorage.setItem(PET_POSITION_KEY, JSON.stringify({ x: x / Math.max(1, window.innerWidth - width), y: y / Math.max(1, window.innerHeight - height) })); } catch {}
      setPickerPlacement(`${y > window.innerHeight / 2 ? "picker-above" : "picker-below"} ${x > window.innerWidth / 2 ? "picker-right" : "picker-left"}`);
      setDragging(true);
    };
    const finish = (event: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      if (drag.moved) {
        const box = petRef.current?.getBoundingClientRect();
        const width = box?.width || 82;
        const height = box?.height || width;
        const x = Math.min(Math.max(8, window.innerWidth - width), Math.max(8, drag.originX + event.clientX - drag.startX));
        const y = Math.min(Math.max(8, window.innerHeight - height), Math.max(8, drag.originY + event.clientY - drag.startY));
        setPosition({ x, y });
        try { window.localStorage.setItem(PET_POSITION_KEY, JSON.stringify({ x: x / Math.max(1, window.innerWidth - width), y: y / Math.max(1, window.innerHeight - height) })); } catch {}
        window.setTimeout(() => { suppressClickRef.current = false; }, 180);
      }
      dragRef.current = null;
      setDragging(false);
    };
    window.addEventListener("pointermove", move, { passive: false });
    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    document.addEventListener("pointerup", finish, true);
    document.addEventListener("pointercancel", finish, true);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
      document.removeEventListener("pointerup", finish, true);
      document.removeEventListener("pointercancel", finish, true);
    };
  }, [storageKey]);
  const activePet = petChoices.find((choice) => choice.id === pet) || petChoices[0];
  const selectPet = (id: string) => {
    setPet(id);
    setCustomizing(false);
    try { window.localStorage.setItem(storageKey, id); } catch {}
  };
  const onPetPointerDown = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    try { event.currentTarget.setPointerCapture(event.pointerId); } catch {}
    const rect = event.currentTarget.getBoundingClientRect();
    dragRef.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, originX: rect.left, originY: rect.top, moved: false };
    event.preventDefault();
  };
  const finishPetDrag = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    if (drag.moved) {
      const box = petRef.current?.getBoundingClientRect();
      const width = box?.width || 82;
      const height = box?.height || width;
      const x = Math.min(Math.max(8, window.innerWidth - width), Math.max(8, drag.originX + event.clientX - drag.startX));
      const y = Math.min(Math.max(8, window.innerHeight - height), Math.max(8, drag.originY + event.clientY - drag.startY));
      setPosition({ x, y });
      setPickerPlacement(`${y > window.innerHeight / 2 ? "picker-above" : "picker-below"} ${x > window.innerWidth / 2 ? "picker-right" : "picker-left"}`);
      try { window.localStorage.setItem(PET_POSITION_KEY, JSON.stringify({ x: x / Math.max(1, window.innerWidth - width), y: y / Math.max(1, window.innerHeight - height) })); } catch {}
      window.setTimeout(() => { suppressClickRef.current = false; }, 180);
    }
    dragRef.current = null;
    setDragging(false);
  };
  const movePetByKeyboard = (event: ReactKeyboardEvent<HTMLButtonElement>) => {
    const step = event.shiftKey ? 32 : 12;
    const direction: Record<string, { x: number; y: number }> = { ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 }, ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step } };
    const delta = direction[event.key];
    if (!delta) return;
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    const x = Math.min(Math.max(8, window.innerWidth - rect.width), Math.max(8, rect.left + delta.x));
    const y = Math.min(Math.max(8, window.innerHeight - rect.height), Math.max(8, rect.top + delta.y));
    setPosition({ x, y });
    try { window.localStorage.setItem(PET_POSITION_KEY, JSON.stringify({ x: x / Math.max(1, window.innerWidth - rect.width), y: y / Math.max(1, window.innerHeight - rect.height) })); } catch {}
  };
  if (isChatOpen) return <div className="atelier-pet-chat-hidden" aria-hidden="true" />;
  if (hidden) return <button type="button" className="atelier-pet-restore" onClick={() => setHidden(false)} aria-label="Bring back your ATELIER owl">✦<span>Bring back owl</span></button>;
  return (
    <div ref={petRef} className={`atelier-pet ${position ? "has-custom-position" : ""} ${chatMinimized ? "has-chat" : ""} ${dragging ? "is-dragging" : ""} ${assistantState !== "idle" ? `is-${assistantState}` : ""}`} style={position ? { left: position.x, top: position.y, right: "auto", bottom: "auto" } : undefined} aria-label={`Your VIRGO companion, ${assistantState}`}>
      {customizing && (
        <div className={`atelier-pet-picker ${pickerPlacement}`} role="group" aria-label="Choose your AI companion">
          <span>Choose your companion</span>
          {petChoices.map((choice) => (
            <button key={choice.id} type="button" className={pet === choice.id ? "active" : ""} onClick={() => selectPet(choice.id)} aria-pressed={pet === choice.id}>
              <span aria-hidden="true">{choice.id === "owl" ? <img className="owl-pixel" src="/images/owl-companion-reference.png" alt="" /> : choice.emoji}</span>{choice.label}
            </button>
          ))}
        </div>
      )}
      <button type="button" className={`atelier-pet-open ${dragging ? "is-dragging" : ""}`} onKeyDown={movePetByKeyboard} onPointerDown={onPetPointerDown} onPointerUp={finishPetDrag} onPointerCancel={finishPetDrag} onLostPointerCapture={finishPetDrag} onClick={() => { if (suppressClickRef.current) { suppressClickRef.current = false; return; } onOpen(); }} aria-label={chatMinimized ? "Restore VIRGO chat" : "Open VIRGO chat"} title={chatMinimized ? "Chat in progress · click to restore" : "Chat with VIRGO · drag to move · arrow keys to nudge"}>
        <span className={`atelier-pet-emoji ${activePet.id === "owl" ? "is-owl" : ""}`} aria-hidden="true">{activePet.id === "owl" ? <img className="owl-pixel" src="/images/owl-companion-reference.png" alt="" /> : activePet.emoji}</span>
      </button>
      <button type="button" className="atelier-pet-customize" onClick={() => setCustomizing((value) => !value)} aria-expanded={customizing} aria-label="Customize AI companion">✳</button>
      <button type="button" className="atelier-pet-hide" onClick={() => setHidden(true)} aria-label="Hide owl">×</button>
    </div>
  );
}

function AccountQuickDrawer({ user, onClose, onNavigate, onLogout }: { user: User; onClose: () => void; onNavigate: (path: string) => void; onLogout: () => void }) {
  const links = [
    { path: "/account/profile", number: "01", title: "Profile", note: "Personal details & preferences", icon: "↗" },
    { path: "/account/orders", number: "02", title: "Orders", note: "Track your Atelier pieces", icon: "↗" },
    { path: "/account/wishlist", number: "03", title: "Wishlist", note: "Your saved collection", icon: "↗" },
  ];
  return (
    <div className="account-quick-overlay" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="account-quick-drawer" role="dialog" aria-modal="true" aria-label="Your account">
        <div className="account-quick-head">
          <div><span className="eyebrow">ATELIER / CLIENT FILE</span><h2 className="serif">Your account</h2><p>{user.name || user.email}</p></div>
          <button className="close-btn" onClick={onClose} aria-label="Close account menu"><Icon name="close" /></button>
        </div>
        <nav className="account-quick-links" aria-label="Account sections">
          {links.map((link) => <button key={link.path} onClick={() => onNavigate(link.path)}><span>{link.number}</span><strong>{link.title}</strong><small>{link.note}</small><i>{link.icon}</i></button>)}
        </nav>
        <div className="account-quick-foot"><span>Signed in as<br/><strong>{user.email}</strong></span><button onClick={onLogout}>Sign out ↗</button></div>
      </aside>
    </div>
  );
}

function MobileMenu({
  user,
  onClose,
  onNavigate,
  onAI,
}: {
  user: User | null;
  onClose: () => void;
  onNavigate: (p: string) => void;
  onAI: () => void;
}) {
  const links: [string, string][] = [
    ["/", "Home"],
    ["/new", "New Arrivals"],
    ["/women", "Women"],
    ["/men", "Men"],
    ["/collections", "Collections"],
    ["/indo-western", "Indo-Western Edit"],
    ["/western", "Western Edit"],
    [user ? "/account" : "/login", user ? "Account" : "Sign in"],
  ];
  return (
    <div
      className="overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Mobile menu"
    >
      <div className="mobile-menu-panel">
        <div className="mobile-menu-head">
          <div className="brand">ATELIER</div>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close menu"
          >
            <Icon name="close" />
          </button>
        </div>
        <nav className="mobile-menu-links">
          {links.map(([route, label]) => (
            <button
              key={route + label}
              onClick={() => {
                onNavigate(route);
                onClose();
              }}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="mobile-menu-foot">
          <button
            onClick={() => {
              onNavigate("/wishlist");
              onClose();
            }}
          >
            Wishlist
          </button>
          <button
            onClick={() => {
              onNavigate("/cart");
              onClose();
            }}
          >
            Cart
          </button>
          <button
            onClick={() => {
              onAI();
              onClose();
            }}
          >
            VIRGO
          </button>
        </div>
      </div>
    </div>
  );
}
function MobileBottomNav({
  user,
  cartCount,
  active,
  onNavigate,
}: {
  user: User | null;
  cartCount: number;
  active: string;
  onNavigate: (p: string) => void;
}) {
  const adminItems = [
    ["/", "Home", "home"],
    ["/shop", "Shop", "search"],
    [ADMIN_ROUTE, "Dashboard", "user"],
  ] as const;
  const customerItems = [
    ["/", "Home", "home"],
    ["/shop", "Shop", "search"],
    ["/wishlist", "Wishlist", "heart"],
    ["/cart", "Cart", "cart"],
    [user ? "/account" : "/login", user ? "Account" : "Account", "user"],
  ] as const;
  const items: readonly (readonly [string, string, string])[] =
    user?.role === "ADMIN" ? adminItems : customerItems;
  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile navigation">
      {items.map(([route, label, icon]) => (
        <button
          key={route + label}
          className={
            (
              route === "/"
                ? active === "/"
                : active === route || active.startsWith(route + "/")
            )
              ? "active"
              : ""
          }
          onClick={() => onNavigate(route)}
          aria-label={label}
        >
          <Icon name={icon as IconName} size={14} />
          <span>{label}</span>
          {label === "Cart" && cartCount > 0 ? <b>{cartCount}</b> : null}
        </button>
      ))}
    </nav>
  );
}

const CHAT_FILE_MIME: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain", md: "text/markdown", csv: "text/csv", json: "application/json", xml: "application/xml",
  zip: "application/zip", mp4: "video/mp4", webm: "video/webm",
  ts: "text/plain", tsx: "text/plain", js: "text/plain", jsx: "text/plain", mjs: "text/plain", cjs: "text/plain",
  html: "text/plain", htm: "text/plain", css: "text/plain", scss: "text/plain", yaml: "text/plain", yml: "text/plain",
  toml: "text/plain", ini: "text/plain", log: "text/plain", py: "text/plain", rs: "text/plain", go: "text/plain",
  java: "text/plain", c: "text/plain", h: "text/plain", cpp: "text/plain", hpp: "text/plain", cs: "text/plain",
  php: "text/plain", rb: "text/plain", sh: "text/plain", ps1: "text/plain", sql: "text/plain", graphql: "text/plain",
  vue: "text/plain", svelte: "text/plain", astro: "text/plain", env: "text/plain", properties: "text/plain",
};
function mimeFromExtension(name: string) { return CHAT_FILE_MIME[name.split(".").pop()?.toLowerCase() || ""] || "application/octet-stream"; }
function isSupportedChatFile(file: File) { return Boolean(CHAT_FILE_MIME[file.name.split(".").pop()?.toLowerCase() || ""]); }
function fileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error(`Could not read ${file.name}`));
    reader.onload = () => {
      const result = String(reader.result || "");
      const separator = result.indexOf(",");
      if (separator < 0) reject(new Error(`Could not encode ${file.name}`));
      else resolve(result.slice(separator + 1));
    };
    reader.readAsDataURL(file);
  });
}

type AssistantStatus = "idle" | "listening" | "thinking" | "speaking";
type AiWindowRect = { x: number; y: number; width: number; height: number };
// v4 clears legacy arbitrary coordinates that could leave the draggable pet
// permanently over page content after a reload.
const PET_POSITION_KEY = "atelier-ai-pet:position:v4";
const AI_SIZE_KEY = "atelier-ai-window-size:v2";
const PET_BOX = 82;
const AI_DEFAULT_SIZE = { width: 400, height: 600 };
const AI_MIN_SIZE = { width: 320, height: 420 };
const AI_COMPACT_QUERY = "(max-width: 640px)";
const MAX_CHAT_FILE_BYTES = 100 * 1024 * 1024;
const MAX_CHAT_DEV_FILE_BYTES = 500 * 1024 * 1024;
const MAX_CHAT_TOTAL_BYTES = 500 * 1024 * 1024;
const MAX_CHAT_DEV_TOTAL_BYTES = 2 * 1024 * 1024 * 1024;

function clampAiRect(rect: AiWindowRect): AiWindowRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(vw - 16, Math.max(Math.min(AI_MIN_SIZE.width, vw - 16), rect.width));
  const height = Math.min(vh - 16, Math.max(Math.min(AI_MIN_SIZE.height, vh - 16), rect.height));
  return {
    width,
    height,
    x: Math.min(Math.max(8, rect.x), Math.max(8, vw - width - 8)),
    y: Math.min(Math.max(8, rect.y), Math.max(8, vh - height - 8)),
  };
}
function readAiSize() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(AI_SIZE_KEY) || "null");
    if (Number.isFinite(saved?.width) && Number.isFinite(saved?.height)) return { width: saved.width as number, height: saved.height as number };
  } catch { /* storage can be disabled */ }
  return AI_DEFAULT_SIZE;
}
/** Chat window opens exactly where the owl was sitting, so it never jumps elsewhere. */
function anchoredAiRect(): AiWindowRect {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const size = readAiSize();
  const width = Math.min(size.width, vw - 16);
  const height = Math.min(size.height, vh - 16);
  let owlX = vw - 22 - PET_BOX;
  let owlY = vh - 24 - PET_BOX;
  try {
    const saved = JSON.parse(window.localStorage.getItem(PET_POSITION_KEY) || "null");
    if (Number.isFinite(saved?.x) && Number.isFinite(saved?.y)) {
      const maxX = Math.max(8, vw - PET_BOX);
      const maxY = Math.max(8, vh - PET_BOX);
      owlX = Math.min(maxX, Math.max(8, saved.x * maxX));
      owlY = Math.min(maxY, Math.max(8, saved.y * maxY));
    }
  } catch { /* storage can be disabled */ }
  const alignRight = owlX + PET_BOX / 2 > vw / 2;
  const alignBottom = owlY + PET_BOX / 2 > vh / 2;
  return clampAiRect({
    width,
    height,
    x: alignRight ? owlX + PET_BOX - width : owlX,
    y: alignBottom ? owlY + PET_BOX - height : owlY,
  });
}
function renderChatText(content: string) {
  return content.split("\n").map((raw, index) => {
    if (!raw.trim()) return <span className="aic-gap" key={index} />;
    const line = raw.replace(/^\s*[*-]\s+/, "• ");
    return (
      <span className="aic-line" key={index}>
        {line.split(/(\*\*[^*]+\*\*|\[[^\]]+\]\(\/product\/[A-Za-z0-9%._~-]+\))/g).map((part, i) => {
          const link = /^\[([^\]]+)\]\((\/product\/[A-Za-z0-9%._~-]+)\)$/.exec(part);
          return link ? <a key={i} href={link[2]}>{link[1]}</a> : /^\*\*[^*]+\*\*$/.test(part) ? <strong key={i}>{part.slice(2, -2)}</strong> : part;
        })}
      </span>
    );
  });
}
function nameClipboardFile(file: File): File {
  if (file.name && !/^image\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) return file;
  const ext = (file.type.split("/")[1] || "png").replace("jpeg", "jpg");
  const stamp = new Date().toISOString().replace(/\D/g, "").slice(0, 14);
  return new File([file], `pasted-image-${stamp}.${ext}`, { type: file.type || "image/png" });
}
async function convertImageToPng(file: File): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("IMAGE_DECODE_FAILED"));
      el.src = url;
    });
    const scale = Math.min(1, 2400 / Math.max(img.naturalWidth, img.naturalHeight, 1));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("CANVAS_UNAVAILABLE");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("IMAGE_ENCODE_FAILED");
    return new File([blob], `${file.name.replace(/\.[^.]*$/, "") || "image"}.png`, { type: "image/png" });
  } finally {
    URL.revokeObjectURL(url);
  }
}
function ChatGlyph({ name }: { name: "minimize" | "close" | "reset" | "clip" | "mic" | "stop" | "send" | "down" }) {
  const paths: Record<string, React.ReactNode> = {
    minimize: <path d="M6 12h12" />,
    close: <path d="M6 6l12 12M18 6L6 18" />,
    reset: <><path d="M4 4v6h6" /><path d="M5.6 15a8 8 0 1 0 1.1-8.2L4 10" /></>,
    clip: <path d="M20 11.5l-8.2 8.2a5 5 0 0 1-7.1-7.1l8.5-8.5a3.3 3.3 0 0 1 4.7 4.7l-8.5 8.5a1.7 1.7 0 0 1-2.4-2.4l7.8-7.8" />,
    mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></>,
    stop: <rect x="7" y="7" width="10" height="10" rx="1.5" />,
    send: <path d="M12 19V5M5.5 11.5L12 5l6.5 6.5" />,
    down: <path d="M12 5v14M5.5 12.5L12 19l6.5-6.5" />,
  };
  return <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{paths[name]}</svg>;
}

function AtelierAIPanel({
  user,
  cart,
  products,
  onClose,
  onToggleMinimize,
  minimized,
  onNavigate,
  onStatusChange,
}: {
  user: User | null;
  cart: CartItem[];
  products: Product[];
  onClose: () => void;
  onToggleMinimize?: () => void;
  minimized?: boolean;
  onNavigate: (x: string) => void;
  onStatusChange?: (status: AssistantStatus) => void;
}) {
  const isMinimized = Boolean(minimized);
  type PointerStart = { id: number; x: number; y: number; rect: AiWindowRect; moved: boolean };
  type Message = { role: "user" | "assistant"; content: string; id?: string; images?: { src: string; name: string }[]; recommendedProducts?: VirgoProduct[] };
  type Attachment = { id: string; file: File; preview?: string };
  type Usage = {
    used: number;
    remaining: number;
    limit: number;
    monthlyUsed: number;
    monthlyRemaining: number;
    monthlyLimit: number;
    resetAt: string | null;
  };
  const welcome = virgoGreeting(user?.name, typeof navigator === "undefined" ? "en" : navigator.language);
  const chatStorageKey = `virgo-chat:${user?.id || "guest"}:v3`;
  const [tab, setTab] = useState<"chat" | "tryon" | "image">("chat");
  const [messages, setMessages] = useState<Message[]>(() => {
    try {
      const saved = JSON.parse(window.localStorage.getItem(chatStorageKey) || window.sessionStorage.getItem(`virgo-chat:${user?.id || "guest"}:v2`) || "null");
      if (Array.isArray(saved) && saved.length && saved.every((m) => (m?.role === "user" || m?.role === "assistant") && typeof m.content === "string")) return [{ role: "assistant", id: "welcome", content: welcome }, ...saved.filter((m, index) => m.id !== "welcome" && !(index === 0 && m.role === "assistant" && /VIRGO/.test(m.content))).slice(-59)] as Message[];
    } catch { /* storage can be disabled */ }
    return [{ role: "assistant", id: "welcome", content: welcome }];
  });
  useEffect(() => {
    try {
      const durableMessages = messages.slice(-60).map(({ role, content, id, recommendedProducts }) => ({ role, content: content.slice(0, 20000), id, recommendedProducts }));
      window.localStorage.setItem(chatStorageKey, JSON.stringify(durableMessages));
    } catch { /* storage can be disabled or full */ }
  }, [messages, chatStorageKey]);
  useEffect(() => {
    setMessages(current => {
      const first = current[0];
      if (first?.id === "welcome") return [{ ...first, content: welcome }, ...current.slice(1)];
      return current;
    });
  }, [welcome]);
  const [text, setText] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [developmentMode, setDevelopmentMode] = useState(false);
  const [devWorkspaceId, setDevWorkspaceId] = useState("");
  const [devWorkspaceFiles, setDevWorkspaceFiles] = useState<Array<{ path: string; bytes: number }>>([]);
  const [devSelectedPath, setDevSelectedPath] = useState("");
  const [devFileContent, setDevFileContent] = useState("");
  const [devCommand, setDevCommand] = useState("");
  const [devCommandOutput, setDevCommandOutput] = useState("");
  const [devWorkspaceBusy, setDevWorkspaceBusy] = useState(false);
  const [devWorkspaceSummary, setDevWorkspaceSummary] = useState("");
  const [devWorkspaceInstruction, setDevWorkspaceInstruction] = useState("");
  const [attachmentNotice, setAttachmentNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [photo, setPhoto] = useState("");
  const [photoName, setPhotoName] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [results, setResults] = useState<any[]>([]);
  const [usage, setUsage] = useState<Usage>({
    used: 0,
    remaining: 5,
    limit: 5,
    monthlyUsed: 0,
    monthlyRemaining: 100,
    monthlyLimit: 100,
    resetAt: null,
  });
  const [error, setError] = useState("");
  const [voiceMode, setVoiceMode] = useState(false);
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [voiceView, setVoiceView] = useState<"orb" | "both">(() => {
    try { return window.localStorage.getItem("virgo-voice-view") === "both" ? "both" : "orb"; } catch { return "orb"; }
  });
  const voiceOrbRef = useRef<HTMLDivElement | null>(null);
  const chooseVoiceView = (view: "orb" | "both") => {
    setVoiceView(view);
    try { window.localStorage.setItem("virgo-voice-view", view); } catch { /* optional preference */ }
  };
  const [voiceStatus, setVoiceStatus] = useState("Ready when you are");
  const [speaking, setSpeaking] = useState(false);
  const liveVoiceRef = useRef<VirgoLiveConversation | null>(null);
  const voiceModeRef = useRef(false);
  const [imagePrompt, setImagePrompt] = useState("");
  const [generatedImage, setGeneratedImage] = useState("");
  const [imageBusy, setImageBusy] = useState(false);
  const [imageReference, setImageReference] = useState("");
  const [imageReferenceName, setImageReferenceName] = useState("");
  const [dropActive, setDropActive] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [windowRect, setWindowRect] = useState<AiWindowRect | null>(() => (typeof window === "undefined" ? null : anchoredAiRect()));
  const panelRef = useRef<HTMLElement | null>(null);
  const logRef = useRef<HTMLDivElement | null>(null);
  const innerRef = useRef<HTMLDivElement | null>(null);
  const lastMsgRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const followLatestRef = useRef(true);
  const dragDepthRef = useRef(0);
  const attachmentsRef = useRef<Attachment[]>([]);
  const sendRef = useRef<(message?: string) => Promise<void>>(async () => {});
  const chatRequest = useRef<AbortController | null>(null);
  const chatSending = useRef(false);
  useEffect(() => () => { chatRequest.current?.abort(); }, []);
  const moveStartRef = useRef<PointerStart | null>(null);
  const resizeStartRef = useRef<PointerStart | null>(null);
  const isCompact = () => window.matchMedia(AI_COMPACT_QUERY).matches;

  // ---- Window: opens at the owl, drag by header, resize by corner, always inside the viewport.
  useEffect(() => {
    const onResize = () => setWindowRect((current) => (current ? clampAiRect(current) : current));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);
  const panelRect = (): AiWindowRect => {
    const rect = panelRef.current?.getBoundingClientRect();
    return rect ? { x: rect.left, y: rect.top, width: rect.width, height: rect.height } : windowRect ?? anchoredAiRect();
  };
  const beginWindowPointer = (event: ReactPointerEvent<HTMLElement>, mode: "move" | "resize") => {
    if (event.button !== 0 || isCompact()) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const start = { id: event.pointerId, x: event.clientX, y: event.clientY, rect: panelRect(), moved: false };
    if (mode === "move") moveStartRef.current = start;
    else resizeStartRef.current = start;
  };
  const nextWindowRect = (start: PointerStart, event: ReactPointerEvent<HTMLElement>, mode: "move" | "resize") => {
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    return clampAiRect(mode === "move"
      ? { ...start.rect, x: start.rect.x + dx, y: start.rect.y + dy }
      : { ...start.rect, width: start.rect.width + dx, height: start.rect.height + dy });
  };
  const updateWindowPointer = (event: ReactPointerEvent<HTMLElement>, mode: "move" | "resize") => {
    const start = (mode === "move" ? moveStartRef : resizeStartRef).current;
    if (!start || start.id !== event.pointerId) return;
    if (Math.abs(event.clientX - start.x) + Math.abs(event.clientY - start.y) > 3) start.moved = true;
    if (start.moved) setWindowRect(nextWindowRect(start, event, mode));
  };
  const finishWindowPointer = (event: ReactPointerEvent<HTMLElement>, mode: "move" | "resize") => {
    const ref = mode === "move" ? moveStartRef : resizeStartRef;
    const start = ref.current;
    if (start && start.id === event.pointerId && start.moved) {
      const next = nextWindowRect(start, event, mode);
      setWindowRect(next);
      if (mode === "resize") { try { window.localStorage.setItem(AI_SIZE_KEY, JSON.stringify({ width: next.width, height: next.height })); } catch { /* storage can be disabled */ } }
    }
    ref.current = null;
  };
  const resetWindow = () => {
    try { window.localStorage.removeItem(AI_SIZE_KEY); } catch { /* storage can be disabled */ }
    setWindowRect(anchoredAiRect());
  };

  // ---- Scrolling: always land on the newest message; never fight a user who scrolled up.
  const syncScroll = useCallback((force = false) => {
    const log = logRef.current;
    if (!log || (!force && !followLatestRef.current)) return;
    const last = lastMsgRef.current;
    const tallAnswer = Boolean(last && last.dataset.role === "assistant" && last.offsetHeight > log.clientHeight * 0.85);
    log.scrollTop = tallAnswer && last ? Math.max(0, last.offsetTop - 12) : log.scrollHeight;
  }, []);
  useLayoutEffect(() => {
    if (tab === "chat" && !isMinimized) syncScroll();
  }, [messages, busy, attachments.length, tab, isMinimized, syncScroll]);
  useLayoutEffect(() => {
    if (tab !== "chat" || isMinimized) return;
    followLatestRef.current = true;
    syncScroll(true);
  }, [tab, isMinimized, syncScroll]);
  useEffect(() => {
    if (tab !== "chat" || isMinimized || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => syncScroll());
    if (innerRef.current) observer.observe(innerRef.current);
    if (logRef.current) observer.observe(logRef.current);
    return () => observer.disconnect();
  }, [tab, isMinimized, syncScroll]);
  const onLogScroll = () => {
    const log = logRef.current;
    if (!log) return;
    const distance = log.scrollHeight - log.scrollTop - log.clientHeight;
    followLatestRef.current = distance < 80;
    setShowJump(distance > 160);
  };
  const jumpToLatest = () => {
    followLatestRef.current = true;
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
  };

  // ---- Assistant state, shown on the owl too.
  const status: AssistantStatus = busy ? "thinking" : speaking ? "speaking" : voiceMode ? "listening" : "idle";
  useEffect(() => { onStatusChange?.(status); }, [status, onStatusChange]);
  useEffect(() => () => onStatusChange?.("idle"), [onStatusChange]);
  useEffect(() => {
    if (!isMinimized && !isCompact()) textareaRef.current?.focus({ preventScroll: true });
  }, [isMinimized]);
  useLayoutEffect(() => {
    const field = textareaRef.current;
    if (!field) return;
    field.style.height = "auto";
    field.style.height = `${Math.min(field.scrollHeight, 140)}px`;
  }, [text, tab, isMinimized]);

  // Live audio runs independently of the text response stream.
  const stopVoice = () => {
    liveVoiceRef.current?.stop(); liveVoiceRef.current = null;
    voiceModeRef.current = false; setVoiceMode(false); setSpeaking(false);
    setVoiceMuted(false);
    setVoiceStatus("Ready when you are");
  };
  const toggleVoice = () => {
    if (voiceModeRef.current) { stopVoice(); return; }
    chatRequest.current?.abort(); chatRequest.current = null;
    chatSending.current = false; setBusy(false); setError("");
    voiceModeRef.current = true; setVoiceMode(true);
    setVoiceStatus("Connecting to VIRGO…");
    const conversation = new VirgoLiveConversation({
      status: setVoiceStatus, speaking: setSpeaking,
      level: value => voiceOrbRef.current?.style.setProperty("--virgo-level", value.toFixed(3)),
      transcript: (role, delta, id) => setMessages(current => {
        const existing = current.find(message => message.id === id);
        return existing ? current.map(message => message.id === id ? { ...message, content: message.content + delta } : message)
          : [...current, { role, id, content: delta }];
      }),
      products: (recommendedProducts, id) => setMessages(current => current.some(message => message.id === id)
        ? current.map(message => message.id === id ? { ...message, recommendedProducts } : message)
        : [...current, { role: "assistant", id, content: "", recommendedProducts }]),
      ended: message => { stopVoice(); if (message) setError(message); },
    }, user?.role === "ADMIN" ? "admin" : "customer", developmentMode ? `You are in project development mode. The user's project is loaded in an isolated workspace. On each completed user turn, provide concise spoken progress and clearly mention code changes. For any requested code edit, explain the intended edit and wait for the user's explicit confirmation before changing files; browser confirmation controls are available in text chat only, so when an edit is requested ask them to switch to text chat to apply it. You may inspect project files only when the user has attached them in chat. Never claim to have edited or tested files.` : "");
    liveVoiceRef.current = conversation;
    void conversation.start(messages.slice(-10));
  };
  useEffect(() => () => { liveVoiceRef.current?.stop(); }, []);
  useEffect(() => { if (tab !== "chat" || isMinimized) stopVoice(); }, [tab, isMinimized]);
  const cartProducts = useMemo(
    () =>
      cart
        .map((i) => products.find((p) => p.id === i.productId))
        .filter(Boolean)
        .filter(
          (p, i, a) => a.findIndex((x) => x!.id === p!.id) === i,
        ) as Product[],
    [cart, products],
  );
  const tryOnProducts = useMemo(
    () =>
      Array.from(
        new Map([...cartProducts, ...products].map((p) => [p.id, p])).values(),
      ).slice(0, 40),
    [cartProducts, products],
  );

  const refreshUsage = useCallback(async () => {
    if (!user) return;
    try {
      setUsage(await api<Usage>("/ai/usage"));
    } catch (e: any) {
      setError(errorText(e.message));
    }
  }, [user]);
  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);
  useEffect(() => {
    setSelected((v) =>
      v
        .filter((id) => tryOnProducts.some((p) => p.id === id))
        .slice(0, Math.min(5, usage.remaining)),
    );
  }, [tryOnProducts, usage.remaining]);

  // ---- Chat send
  const send = async (messageInput?: string) => {
    const message = (messageInput ?? text).trim();
    if ((!message && !attachments.length) || busy || chatSending.current) return;
    if (message.length > (developmentMode ? 100000 : 12000)) {
      setAttachmentNotice(developmentMode ? "Message is over the 100,000 character development limit. Attach larger files instead." : "Message is too long. Turn on Development mode or attach a file.");
      return;
    }
    if (voiceModeRef.current) stopVoice();
    chatSending.current = true;
    const controller = new AbortController();
    chatRequest.current = controller;
    const userMessageId = `user-${Date.now()}`;
    const replyId = `reply-${Date.now()}`;
    followLatestRef.current = true;
    setText("");
    setError("");
    setAttachmentNotice("");
    const sending = attachments;
    const attachmentSummary = sending.length ? `\n[Attached: ${sending.map(({ file }) => file.name).join(", ")}]` : "";
    const next = [...messages, { role: "user" as const, id: userMessageId, content: `${message}${attachmentSummary}`.trim(), images: sending.filter(a => a.preview).map(a => ({ src: a.preview!, name: a.file.name })) }];
    setMessages([...next, { role: "assistant", id: replyId, content: "" }]);
    setBusy(true);
    try {
      const encodedAttachments = await Promise.all(sending.map(async ({ file }) => ({
        name: file.name,
        mimeType: file.type || mimeFromExtension(file.name),
        dataBase64: await fileAsBase64(file),
      })));
      const projectZip = developmentMode ? sending.find(({ file }) => /\.zip$/i.test(file.name)) : undefined;
      if (projectZip) {
        if (projectZip.file.size > 100 * 1024 * 1024) throw new Error("DEV_WORKSPACE_ARCHIVE_LIMIT");
        setAttachmentNotice("Importing ZIP into your private development workspace…");
        const imported = await api<{ workspaceId: string; files: Array<{ path: string; bytes: number }> }>("/ai/dev-workspace/import", {
          method: "POST",
          body: JSON.stringify({ dataBase64: await fileAsBase64(projectZip.file) }),
        });
        setDevWorkspaceId(imported.workspaceId);
        setDevWorkspaceFiles(imported.files);
        setAttachmentNotice(`Project imported into your private workspace · ${imported.files.length} files available to edit and run.`);
      }
      const images = await Promise.all(sending.filter(a => a.preview).map(async a => ({ src: await imageThumbnail(a.file), name: a.file.name })));
      if (controller.signal.aborted) return;
      setMessages(v => v.map(m => m.id === userMessageId ? { ...m, images } : m));
      const historyLimit = developmentMode ? 30 : 10;
      const workspaceFiles = developmentMode && devWorkspaceId ? await Promise.all(devWorkspaceFiles.filter(file => file.bytes <= 120_000 && !/(?:^|\/)(?:\.env(?:\.|$)|\.npmrc|credentials?\.json|id_rsa|id_ed25519|[^/]+\.(?:pem|key|p12|pfx|crt|cer))$/i.test(file.path)).slice(0, 20).map(async file => ({ path: file.path, content: (await api<{ content: string }>(`/ai/dev-workspace/${encodeURIComponent(devWorkspaceId)}/file?path=${encodeURIComponent(file.path)}`)).content }))) : [];
      const reply = await streamChat({ message, audience: user?.role === "ADMIN" ? "admin" : "customer", developmentMode, workspaceFiles, history: messages.slice(-historyLimit).map(({ role, content }) => ({ role, content: content.slice(0, developmentMode ? 12000 : 4000) })), attachments: encodedAttachments }, delta => {
        if (!controller.signal.aborted) setMessages(v => v.map(m => m.id === replyId ? { ...m, content: m.content + delta } : m));
      }, AbortSignal.any([controller.signal, AbortSignal.timeout(60_000)]));
      if (controller.signal.aborted) return;
      let displayReply = reply;
      const changeMatch = reply.match(/```json\s*\n([\s\S]*?)\n```\s*$/i);
      if (developmentMode && devWorkspaceId && changeMatch) {
        try {
          const plan = JSON.parse(changeMatch[1]) as { workspaceChanges?: Array<{ path: string; content: string }>; runCommand?: string };
          const changes = Array.isArray(plan.workspaceChanges) ? plan.workspaceChanges : [];
          if (changes.length > 30 || changes.some(change => !change.path || change.path.length > 500 || change.content.length > 2_000_000 || change.path.split("/").some(part => part === ".." || part === "." || !part))) throw new Error("The proposed workspace changes contain an invalid path or exceed the edit limits.");
          const blocked = /(?:^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|\.npmrc|credentials?\.json|id_rsa|id_ed25519|[^/]+\.(?:pem|key|p12|pfx|crt|cer))$/i;
          if (changes.some(change => blocked.test(change.path))) throw new Error("The AI proposed changing a secret or credential file, so no changes were applied.");
          for (const change of changes) await api(`/ai/dev-workspace/${encodeURIComponent(devWorkspaceId)}/file`, { method: "PUT", body: JSON.stringify(change) });
          if (changes.length) {
            const listing = await api<{ files: Array<{ path: string; bytes: number }> }>(`/ai/dev-workspace/${encodeURIComponent(devWorkspaceId)}/files`);
            setDevWorkspaceFiles(listing.files);
            setDevWorkspaceSummary(`Updated ${changes.map(change => change.path).join(", ")}.`);
            if (plan.runCommand && !/(?:^|[&|;\n])\s*(?:rm|del|format|shutdown|git\s+push|npm\s+publish)\b/i.test(plan.runCommand)) {
              const result = await api<{ exitCode: number; output: string; timedOut: boolean }>(`/ai/dev-workspace/${encodeURIComponent(devWorkspaceId)}/run`, { method: "POST", body: JSON.stringify({ command: plan.runCommand }) });
              setDevCommandOutput(`${result.timedOut ? "Timed out" : `Exit code ${result.exitCode}`} · ${plan.runCommand}\n${result.output || "(no output)"}`);
              setDevWorkspaceSummary(`Updated ${changes.map(change => change.path).join(", ")}. ${result.timedOut ? "Verification timed out." : `Sandbox verification exited with code ${result.exitCode}.`}`);
            }
          }
          displayReply = reply.slice(0, changeMatch.index).trim();
        } catch (error: any) { displayReply = `${reply.replace(changeMatch[0], "").trim()}\n\nChanges were not fully applied: ${errorText(error)}`; }
      }
      setMessages(v => v.map(m => m.id === replyId ? { ...m, content: displayReply } : m));
      sending.forEach(({ preview }) => { if (preview) URL.revokeObjectURL(preview); });
      attachmentsRef.current = [];
      setAttachments([]);
    } catch (e: any) {
      if (controller.signal.aborted) return;
      const httpStatus = Number(e?.status || 0);
      const detail = String(e?.message || "");
      const safeDetail = /<!doctype html|<html|YOU DO'NOT EXPLOITE/i.test(detail)
        ? ""
        : errorText(detail);
      const messageText = httpStatus === 429
        ? "VIRGO is receiving many requests. Please try again in a minute."
        : httpStatus === 413
          ? "Your files are too large to send together. Remove some and try again."
          : httpStatus >= 500 || httpStatus === 404
            ? "VIRGO is temporarily unavailable. Please try again shortly."
            : safeDetail
              ? `I couldn't complete that request. ${safeDetail}`
              : "I couldn't reach the VIRGO service right now. Please try again shortly.";
      setMessages(v => v.map(m => m.id === replyId ? { ...m, content: m.content ? `${m.content}\n\n${messageText}` : messageText } : m));
    } finally {
      if (chatRequest.current === controller) { chatRequest.current = null; chatSending.current = false; setBusy(false); }
    }
  };
  sendRef.current = send;
  const newChat = () => {
    chatRequest.current?.abort(); chatRequest.current = null; chatSending.current = false; setBusy(false);
    stopVoice();
    setMessages([{ role: "assistant", content: welcome }]);
    setText("");
    followLatestRef.current = true;
  };

  // ---- Attachments: picker, drag & drop and Ctrl+V all go through here.
  const addAttachments = useCallback(async (files: FileList | File[]) => {
    const incoming = Array.from(files);
    if (!incoming.length) return;
    const accepted: Attachment[] = [];
    const problems: string[] = [];
    let count = attachmentsRef.current.length;
    let total = attachmentsRef.current.reduce((sum, entry) => sum + entry.file.size, 0);
    for (let file of incoming) {
      if (!file.type) file = new File([file], file.name, { type: mimeFromExtension(file.name), lastModified: file.lastModified });
      if (count >= (developmentMode ? 40 : 8)) { problems.push(`You can attach up to ${developmentMode ? 40 : 8} files per message.`); break; }
      if (!isSupportedChatFile(file)) {
        if (file.type.startsWith("image/")) {
          try { file = await convertImageToPng(file); } catch { problems.push(`${file.name || "That image"} could not be read.`); continue; }
        } else {
          problems.push(`${file.name || "That file"} isn’t supported. Use images, PDF, Word, Excel, PowerPoint, text, CSV, JSON, ZIP, MP4 or WebM.`);
          continue;
        }
      }
      if (file.size > (developmentMode ? MAX_CHAT_DEV_FILE_BYTES : MAX_CHAT_FILE_BYTES)) { problems.push(`${file.name} is over the ${developmentMode ? 500 : 100} MB per-file limit.`); continue; }
      if (total + file.size > (developmentMode ? MAX_CHAT_DEV_TOTAL_BYTES : MAX_CHAT_TOTAL_BYTES)) { problems.push(`Attachments must total ${developmentMode ? 2048 : 500} MB or less.`); continue; }
      total += file.size;
      count += 1;
      accepted.push({ id: `${file.name}:${file.size}:${file.lastModified}:${Math.random().toString(36).slice(2)}`, file, preview: file.type.startsWith("image/") ? URL.createObjectURL(file) : undefined });
    }
    if (accepted.length) {
      attachmentsRef.current = [...attachmentsRef.current, ...accepted];
      setAttachments(attachmentsRef.current);
      textareaRef.current?.focus({ preventScroll: true });
    }
    setAttachmentNotice(problems.length ? Array.from(new Set(problems)).join(" ") : "");
  }, [developmentMode]);
  const removeAttachment = (id: string) => {
    const removed = attachmentsRef.current.find((entry) => entry.id === id);
    if (removed?.preview) URL.revokeObjectURL(removed.preview);
    attachmentsRef.current = attachmentsRef.current.filter((entry) => entry.id !== id);
    setAttachments(attachmentsRef.current);
    setAttachmentNotice("");
  };
  const openWorkspaceFile = async (relativePath: string) => {
    if (!devWorkspaceId || !relativePath) return;
    setDevWorkspaceBusy(true);
    try {
      const result = await api<{ content: string }>(`/ai/dev-workspace/${encodeURIComponent(devWorkspaceId)}/file?path=${encodeURIComponent(relativePath)}`);
      setDevSelectedPath(relativePath);
      setDevFileContent(result.content);
      setDevCommandOutput("");
    } catch (e: any) { setAttachmentNotice(errorText(e)); }
    finally { setDevWorkspaceBusy(false); }
  };
  const saveWorkspaceFile = async () => {
    if (!devWorkspaceId || !devSelectedPath) return;
    setDevWorkspaceBusy(true);
    try {
      await api(`/ai/dev-workspace/${encodeURIComponent(devWorkspaceId)}/file`, { method: "PUT", body: JSON.stringify({ path: devSelectedPath, content: devFileContent }) });
      setAttachmentNotice(`Saved ${devSelectedPath} in your private workspace.`);
    } catch (e: any) { setAttachmentNotice(errorText(e)); }
    finally { setDevWorkspaceBusy(false); }
  };
  const attachWorkspaceFileToChat = async () => {
    if (!devSelectedPath) return;
    if (/(?:^|\/)(?:\.env(?:\.(?!example$)[^/]*)?|\.npmrc|credentials?\.json|id_rsa|id_ed25519|[^/]+\.(?:pem|key|p12|pfx|crt|cer))$/i.test(devSelectedPath)) {
      setAttachmentNotice("Credential and private-key files stay in the workspace and cannot be attached to VIRGO.");
      return;
    }
    const file = new File([devFileContent], devSelectedPath.split("/").pop() || "workspace-file.txt", { type: "text/plain" });
    await addAttachments([file]);
    setText(`Please inspect ${devSelectedPath} from my project and help me with the requested changes.`);
  };
  const runWorkspaceCommand = async () => {
    if (!devWorkspaceId || !devCommand.trim()) return;
    setDevWorkspaceBusy(true);
    setDevCommandOutput("Running in isolated container…");
    try {
      const result = await api<{ exitCode: number; output: string; timedOut: boolean }>(`/ai/dev-workspace/${encodeURIComponent(devWorkspaceId)}/run`, { method: "POST", body: JSON.stringify({ command: devCommand }) });
      setDevCommandOutput(`${result.timedOut ? "Timed out" : `Exit code ${result.exitCode}`}\n${result.output || "(no output)"}`);
    } catch (e: any) { setDevCommandOutput(errorText(e)); }
    finally { setDevWorkspaceBusy(false); }
  };
  const exportWorkspace = async () => {
    if (!devWorkspaceId) return;
    setDevWorkspaceBusy(true);
    try {
      const response = await fetch(`${API_BASE}/ai/dev-workspace/${encodeURIComponent(devWorkspaceId)}/export`, { credentials: "include" });
      if (!response.ok) throw new Error(`Project export failed (${response.status}).`);
      const blob = await response.blob(); const url = URL.createObjectURL(blob);
      const link = document.createElement("a"); link.href = url; link.download = "virgo-project-updated.zip"; link.click(); URL.revokeObjectURL(url);
      setAttachmentNotice("Updated project ZIP downloaded. Secret and credential files are excluded.");
    } catch (error: any) { setAttachmentNotice(errorText(error)); }
    finally { setDevWorkspaceBusy(false); }
  };
  useEffect(() => () => { attachmentsRef.current.forEach(({ preview }) => { if (preview) URL.revokeObjectURL(preview); }); }, []);
  useEffect(() => {
    if (isMinimized || tab !== "chat") return;
    const onPaste = (event: ClipboardEvent) => {
      const target = event.target as HTMLElement | null;
      const insidePanel = Boolean(target && panelRef.current?.contains(target));
      if (!insidePanel && target?.closest?.("input, textarea, select, [contenteditable='true']")) return;
      const data = event.clipboardData;
      if (!data) return;
      const direct = Array.from(data.files || []);
      const files = direct.length ? direct : Array.from(data.items || []).filter((item) => item.kind === "file").map((item) => item.getAsFile()).filter((file): file is File => Boolean(file));
      if (!files.length || data.getData("text/plain").trim()) return;
      event.preventDefault();
      void addAttachments(files.map(nameClipboardFile));
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [isMinimized, tab, addAttachments]);
  const dragHasFiles = (event: ReactDragEvent<HTMLElement>) => Array.from(event.dataTransfer?.types || []).includes("Files");
  const onPanelDragEnter = (event: ReactDragEvent<HTMLElement>) => {
    if (tab !== "chat" || !dragHasFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current += 1;
    setDropActive(true);
  };
  const onPanelDragOver = (event: ReactDragEvent<HTMLElement>) => {
    if (!dragHasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = tab === "chat" ? "copy" : "none";
  };
  const onPanelDragLeave = (event: ReactDragEvent<HTMLElement>) => {
    if (!dragHasFiles(event)) return;
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (!dragDepthRef.current) setDropActive(false);
  };
  const onPanelDrop = (event: ReactDragEvent<HTMLElement>) => {
    if (!dragHasFiles(event)) return;
    event.preventDefault();
    dragDepthRef.current = 0;
    setDropActive(false);
    if (tab === "chat") void addAttachments(event.dataTransfer.files);
  };

  const generateConceptImage = async () => {
    if (!imagePrompt.trim() || imageBusy) return;
    setError("");
    setImageBusy(true);
    try {
      const out = await api<{ url: string }>("/admin/ai/generate-image", { method: "POST", body: JSON.stringify({ prompt: imagePrompt.trim(), referenceImage: imageReference || undefined }) });
      setGeneratedImage(out.url);
    } catch (e: any) {
      setError(errorText(e.message));
    } finally {
      setImageBusy(false);
    }
  };

  const preparePhoto = async (file: File) => {
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type))
      throw new Error("Please upload a JPG, PNG or WEBP image.");
    if (file.size > 12 * 1024 * 1024)
      throw new Error("Photo must be 12 MB or smaller.");
    const src = URL.createObjectURL(file);
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const x = new Image();
        x.onload = () => resolve(x);
        x.onerror = () => reject(new Error("PHOTO_READ_FAILED"));
        x.src = src;
      });
      const max = 1600;
      const scale = Math.min(
        1,
        max / Math.max(img.naturalWidth, img.naturalHeight),
      );
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("PHOTO_PREP_FAILED");
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL("image/jpeg", 0.9);
    } finally {
      URL.revokeObjectURL(src);
    }
  };
  const onPhoto = async (file?: File) => {
    if (!file) return;
    setError("");
    try {
      setPhoto(await preparePhoto(file));
      setPhotoName(file.name);
      setResults([]);
    } catch (e: any) {
      setPhoto("");
      setPhotoName("");
      setError(errorText(e.message));
    }
  };
  const toggleProduct = (id: string) => {
    setError("");
    if (selected.includes(id)) {
      setSelected((current) => current.filter((x) => x !== id));
      return;
    }
    if (usage.remaining <= 0) {
      setError(
        "You've reached your free try-on limit. Try again after your allowance resets.",
      );
      return;
    }
    if (selected.length >= Math.min(5, usage.remaining)) {
      setError(
        `Choose up to ${Math.min(5, usage.remaining)} piece${Math.min(5, usage.remaining) === 1 ? "" : "s"} with your remaining allowance.`,
      );
      return;
    }
    setSelected((current) =>
      current.includes(id) ? current : [...current, id],
    );
  };
  const tryOnErrorText = (e: any) => {
    const code = String(e?.code || e?.message || e || "")
      .split(":")[0]
      .trim()
      .toUpperCase();
    const known: Record<string, string> = {
      TRY_ON_NOT_CONFIGURED:
        "Virtual Try-On is not connected yet. Add a valid RAPIDAPI_KEY and confirm the provider subscription in backend/.env.",
      TRY_ON_DAILY_LIMIT:
        "You've reached your free daily try-on allowance. Please try again after it resets.",
      TRY_ON_MONTHLY_LIMIT: "You've reached your monthly try-on allowance.",
      TRY_ON_PRODUCT_NOT_FOUND:
        "One of the selected pieces is no longer available. Refresh the collection and try again.",
      INVALID_IMAGE_DATA:
        "The uploaded photo could not be read. Upload a JPG, PNG or WEBP image and try again.",
      IMAGE_TOO_LARGE:
        "The uploaded photo is too large. Choose an image under 12 MB.",
      PRODUCT_IMAGE_URL_INVALID:
        "This product is missing a usable image URL. Please choose another product or ask ATELIER support.",
      PRODUCT_IMAGE_NOT_SUPPORTED:
        "The selected product image format is not supported by the try-on provider.",
      TRY_ON_NON_IMAGE_RESPONSE:
        "The try-on provider did not return an image. Check its plan, quota and request status.",
      TRY_ON_PROVIDER_QUOTA:
        "The virtual try-on provider has reached its quota or credit limit. Check your RapidAPI plan or try again later.",
      TRY_ON_PROVIDER_AUTH:
        "The virtual try-on provider rejected its credentials or subscription. Verify the RapidAPI key and subscribe to the API if required.",
      TRY_ON_PROVIDER_ERROR:
        "The virtual try-on provider could not complete this request. Try another product or check your RapidAPI subscription and quota.",
      LOCAL_TRY_ON_UNAVAILABLE:
        "The local try-on model is not running. Start it with backend/local-tryon/start-worker.ps1, then try again.",
      LOCAL_TRY_ON_TIMEOUT:
        "The local model is taking too long on this computer. Try a smaller photo or wait for the current preview to finish.",
      LOCAL_TRY_ON_FAILED:
        "The local model could not make this preview. Try a clear, full-body photo and another product image.",
      API_UNAVAILABLE:
        "ATELIER's backend is not reachable. Start the backend service and try again.",
    };
    if (known[code]) return known[code];
    if (
      code.includes("RAPIDAPI") ||
      code.includes("SUBSCRIPTION") ||
      code.includes("QUOTA")
    )
      return "The try-on provider rejected this request. Check the RapidAPI key, subscription and remaining quota.";
    if (code.startsWith("PRODUCT_IMAGE_HTTP_"))
      return "The selected product image URL could not be reached by the provider. Please choose another piece.";
    if (code.startsWith("HTTP_5") || code === "TRY_ON_PROVIDER_ERROR")
      return "The virtual try-on provider is temporarily unavailable. Please try again later.";
    return errorText(e?.message || e);
  };
  const generate = async () => {
    if (busy) return;
    if (!user) {
      onClose();
      onNavigate("/login");
      return;
    }
    if (usage.remaining <= 0)
      return setError(
        "You've reached your free try-on limit. Please try again after your allowance resets.",
      );
    if (!photo)
      return setError(
        "Upload a clear, front-facing photo first (JPG, PNG or WEBP, up to 12 MB).",
      );
    if (!selected.length)
      return setError(
        "Select at least one piece from Your bag & collection before starting Virtual Try-On.",
      );
    if (selected.length > Math.min(5, usage.remaining))
      return setError(
        `You can select at most ${Math.min(5, usage.remaining)} piece${Math.min(5, usage.remaining) === 1 ? "" : "s"} with your remaining allowance.`,
      );
    setBusy(true);
    setError("");
    setResults([]);
    try {
      const out = await api<any>("/ai/try-on", {
        method: "POST",
        body: JSON.stringify({ photoDataUrl: photo, productIds: selected }),
      });
      const generated = Array.isArray(out?.results) ? out.results : [];
      setResults(generated);
      if (out?.usage) setUsage(out.usage);
      else await refreshUsage();
      if (!generated.length)
        setError(
          "The try-on engine returned no image. Start the local model or check the provider settings and selected product images.",
        );
      else if (generated.every((r: any) => !r.image))
        setError(
          tryOnErrorText({
            message:
              generated.find((r: any) => r.error)?.error ||
              "TRY_ON_PROVIDER_ERROR",
          }),
        );
    } catch (e: any) {
      setError(tryOnErrorText(e));
    } finally {
      setBusy(false);
    }
  };
  const resetLabel = usage.resetAt
    ? new Date(usage.resetAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      })
    : "—";

  const statusLabel =
    status === "thinking" ? (tab === "tryon" ? "Creating your preview…" : "Thinking…")
    : status === "speaking" ? "Speaking…"
    : status === "listening" ? "Listening…"
    : "Online";
  const canSend = !busy && (text.trim().length > 0 || attachments.length > 0);
  const hasVideo = attachments.some(({ file }) => file.type.startsWith("video/") || /\.(mp4|webm)$/i.test(file.name));
  const attachmentBytes = attachments.reduce((sum, { file }) => sum + file.size, 0);
  const showSuggestions = messages.length <= 1 && !busy;
  const recommendationsFor = (message: Message): VirgoProduct[] => {
    if (message.role !== "assistant") return [];
    if (message.recommendedProducts?.length) return message.recommendedProducts;
    if (message.id?.startsWith("voice-")) return [];
    return products.filter(product => product.stock > 0 && (message.content.includes(`/product/${encodeURIComponent(product.id)}`) || message.content.toLowerCase().includes(product.name.toLowerCase())))
      .slice(0, 3).map(product => ({ id: product.id, name: product.name, price: Number(product.price), currency: product.currency, stock: product.stock, url: `/product/${encodeURIComponent(product.id)}`, image: productImage(product) }));
  };
  const windowStyle = windowRect
    ? ({ "--aic-x": `${windowRect.x}px`, "--aic-y": `${windowRect.y}px`, "--aic-w": `${windowRect.width}px`, "--aic-h": `${windowRect.height}px` } as React.CSSProperties)
    : undefined;

  return (
    <div className={`aic-shell ${isMinimized ? "is-minimized" : ""}`}>
      <aside
        ref={panelRef}
        className={`aic-panel ${dropActive ? "is-dropping" : ""}`}
        role="dialog"
        aria-modal="false"
        aria-label="VIRGO chat"
        hidden={isMinimized}
        style={windowStyle}
        onDragEnter={onPanelDragEnter}
        onDragOver={onPanelDragOver}
        onDragLeave={onPanelDragLeave}
        onDrop={onPanelDrop}
      >
        <header className="aic-head" onPointerDown={(event) => beginWindowPointer(event, "move")} onPointerMove={(event) => updateWindowPointer(event, "move")} onPointerUp={(event) => finishWindowPointer(event, "move")} onPointerCancel={(event) => finishWindowPointer(event, "move")} onDoubleClick={resetWindow}>
          <span className="aic-mark" aria-hidden="true">✦</span>
          <div className="aic-titles">
            <h2 className="serif">VIRGO</h2>
            <small className={`aic-status is-${status}`} role="status"><i aria-hidden="true" />{statusLabel}</small>
          </div>
          <div className="aic-actions" onPointerDown={(event) => event.stopPropagation()}>
            <button type="button" className="aic-icon-btn" onClick={resetWindow} aria-label="Reset window size and position" title="Reset window size and position"><ChatGlyph name="reset" /></button>
            <button type="button" className="aic-icon-btn" onClick={() => onToggleMinimize?.()} aria-label="Minimize chat" title="Minimize chat"><ChatGlyph name="minimize" /></button>
            <button type="button" className="aic-icon-btn" onClick={onClose} aria-label="Close chat" title="Close chat"><ChatGlyph name="close" /></button>
          </div>
        </header>
        <div className="aic-tabs" role="tablist" aria-label="VIRGO tools">
          <button type="button" className={tab === "chat" ? "active" : ""} onClick={() => setTab("chat")} role="tab" aria-selected={tab === "chat"}>Chat</button>
          <button type="button" className={`aic-dev-toggle ${developmentMode ? "active" : ""}`} onClick={() => setDevelopmentMode(value => !value)} aria-pressed={developmentMode}>Development {developmentMode ? "On" : "Off"}</button>
          <button type="button" className={tab === "tryon" ? "active" : ""} onClick={() => setTab("tryon")} role="tab" aria-selected={tab === "tryon"}>Virtual Try-On</button>
          {user?.role === "ADMIN" && <button type="button" className={tab === "image" ? "active" : ""} onClick={() => setTab("image")} role="tab" aria-selected={tab === "image"}>Create Image</button>}
        </div>
        {tab === "chat" ? (
          <>
            {voiceMode && <section className={`virgo-live-panel is-${voiceView} ${speaking ? "is-speaking" : ""} ${voiceMuted ? "is-muted" : ""} ${voiceStatus.startsWith("Reconnecting") ? "is-reconnecting" : ""}`} aria-label="VIRGO live voice conversation">
              <div className="virgo-view-switch" role="group" aria-label="Voice conversation view">
                <button type="button" aria-pressed={voiceView === "orb"} onClick={() => chooseVoiceView("orb")}>Orb only</button>
                <button type="button" aria-pressed={voiceView === "both"} onClick={() => chooseVoiceView("both")}>Orb + text</button>
              </div>
              <div className="virgo-orb-stage" aria-hidden="true"><div ref={voiceOrbRef} className="virgo-live-orb"><ReferenceOrb /></div></div>
              <div className="virgo-live-copy"><strong>{voiceStatus.startsWith("Reconnecting") ? "Reconnecting…" : voiceMuted ? "Microphone muted" : speaking ? "VIRGO is speaking" : "Talk with VIRGO"}</strong><small role="status">{voiceMuted ? "Unmute when you’re ready" : voiceStatus}</small></div>
              <div className="virgo-live-controls">
                <button type="button" className="aic-icon-btn" aria-label={voiceMuted ? "Unmute microphone" : "Mute microphone"} aria-pressed={voiceMuted} onClick={() => { const muted = !voiceMuted; setVoiceMuted(muted); liveVoiceRef.current?.setMuted(muted); }}><ChatGlyph name="mic" /></button>
                <button type="button" className="virgo-end-call" onClick={stopVoice}>End</button>
              </div>
              {developmentMode && <small className="virgo-dev-note">Voice mode can discuss project work aloud. Switch to text chat to apply edits, run sandbox checks, and download the ZIP.</small>}
              {voiceView === "orb" && messages.some(message => message.recommendedProducts?.length) && <button type="button" className="virgo-end-call" onClick={() => chooseVoiceView("both")}>View product suggestions</button>}
            </section>}
            <div className="aic-log-wrap" hidden={voiceMode && voiceView === "orb"}>
              <div className="aic-log" ref={logRef} role="log" aria-live="polite" aria-label="Conversation" onScroll={onLogScroll}>
                <div className="aic-log-inner" ref={innerRef}>
                  {messages.map((m, i) => (
                    <div className={`aic-msg ${m.role}`} key={i} data-role={m.role} ref={i === messages.length - 1 ? lastMsgRef : undefined}>
                      <span className="aic-who">{m.role === "assistant" ? "VIRGO" : "You"}</span>
                      <div className="aic-bubble">{m.images?.length ? <div className="aic-message-images">{m.images.map((image, index) => <img key={index} src={image.src} alt={image.name} />)}</div> : null}{m.role === "assistant" ? renderChatText(m.content.replace(/gemini/gi, "VIRGO")) : <span className="aic-plain">{m.content}</span>}</div>
                      {recommendationsFor(m).length > 0 && <div className="virgo-products" aria-label="VIRGO product recommendations">
                        {recommendationsFor(m).map(product => <a className="virgo-product" key={product.id} href={`/product/${encodeURIComponent(product.id)}`} onClick={event => { if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) { event.preventDefault(); onNavigate(`/product/${encodeURIComponent(product.id)}`); } }}>
                          {product.image && <img src={product.image} alt={product.name} loading="lazy" />}
                          <span><strong>{product.name}</strong><small>{new Intl.NumberFormat("en-IN", { style: "currency", currency: product.currency || "INR", maximumFractionDigits: 0 }).format(product.price)}</small><b>View piece ↗</b></span>
                        </a>)}
                      </div>}
                    </div>
                  ))}
                  {busy && (
                    <div className="aic-msg assistant" aria-label="VIRGO is thinking">
                      <span className="aic-who">VIRGO</span>
                      <div className="aic-bubble aic-typing"><i /><i /><i /></div>
                    </div>
                  )}
                </div>
              </div>
              {showJump && <button type="button" className="aic-jump" onClick={jumpToLatest}><ChatGlyph name="down" />Latest</button>}
              {dropActive && <div className="aic-drop" aria-hidden="true"><ChatGlyph name="clip" /><strong>Drop files to attach</strong><small>Images, PDF, documents, videos or ZIP</small></div>}
            </div>
            {showSuggestions && !voiceMode && (
              <div className="aic-suggestions">
                {["Show me casual outfits", "Help me choose a dress", "Build a look within my budget", "Style my cart"].map((x) => (
                  <button type="button" key={x} onClick={() => void send(x)}>{x}</button>
                ))}
              </div>
            )}
            <div className="aic-compose">
              {developmentMode && devWorkspaceId && <section className="aic-dev-workspace" aria-label="Development workspace">
                <div className="aic-dev-workspace-head"><strong>Project workspace</strong><span>{devWorkspaceFiles.length} files · isolated runner</span></div>
                <div className="aic-dev-workspace-controls"><input value={devWorkspaceInstruction} onChange={event => setDevWorkspaceInstruction(event.target.value)} onKeyDown={event => { if (event.key === "Enter") { const instruction = devWorkspaceInstruction.trim(); if (instruction) { setDevWorkspaceInstruction(""); void send(instruction); } } }} placeholder="Instruction for this project (e.g. fix the mobile menu)" aria-label="Project edit instruction" /><button type="button" disabled={busy || !devWorkspaceInstruction.trim()} onClick={() => { const instruction = devWorkspaceInstruction.trim(); setDevWorkspaceInstruction(""); void send(instruction); }}>Apply</button><button type="button" disabled={devWorkspaceBusy} onClick={() => void exportWorkspace()}>Download ZIP</button></div>
                {devWorkspaceSummary && <small role="status">{devWorkspaceSummary}</small>}
                <div className="aic-dev-workspace-controls">
                  <select value={devSelectedPath} onChange={event => void openWorkspaceFile(event.target.value)} aria-label="Choose project file">
                    <option value="">Choose a file to edit…</option>
                    {devWorkspaceFiles.filter(file => file.bytes <= 2 * 1024 * 1024 && /\.(?:txt|md|csv|json|xml|ts|tsx|js|jsx|mjs|cjs|html|htm|css|scss|yaml|yml|toml|ini|log|py|rs|go|java|c|h|cpp|hpp|cs|php|rb|sh|ps1|sql|graphql|vue|svelte|astro|env|properties)$/i.test(file.path)).map(file => <option key={file.path} value={file.path}>{file.path}</option>)}
                  </select>
                  <button type="button" disabled={devWorkspaceBusy || !devSelectedPath} onClick={() => void saveWorkspaceFile()}>Save file</button>
                </div>
                {devSelectedPath && <><textarea className="aic-dev-editor" value={devFileContent} onChange={event => setDevFileContent(event.target.value)} aria-label={`Edit ${devSelectedPath}`} spellCheck={false} /><button type="button" className="aic-dev-attach-file" onClick={() => void attachWorkspaceFileToChat()}>Attach selected file to VIRGO chat</button></>}
                <div className="aic-dev-workspace-controls"><input value={devCommand} onChange={event => setDevCommand(event.target.value)} onKeyDown={event => { if (event.key === "Enter") void runWorkspaceCommand(); }} placeholder="Run command (e.g. npm test)" aria-label="Sandbox command" /><button type="button" disabled={devWorkspaceBusy || !devCommand.trim()} onClick={() => void runWorkspaceCommand()}>Run</button></div>
                {devCommandOutput && <pre className="aic-dev-output">{devCommandOutput}</pre>}
              </section>}
              {attachments.length > 0 && (
                <>
                <p className="aic-attachment-total">{attachments.length} file{attachments.length === 1 ? "" : "s"} selected · {(attachmentBytes / (1024 * 1024)).toFixed(1)} MB total</p>
                <ul className="aic-chips" aria-label="Attached files">
                  {attachments.map(({ id, file, preview }) => (
                    <li className="aic-chip" key={id}>
                      {preview ? <img src={preview} alt="" /> : <span className="aic-chip-type">{file.name.split(".").pop()?.slice(0, 4).toUpperCase() || "FILE"}</span>}
                      <span className="aic-chip-name" title={file.name}>{file.name}</span>
                      <button type="button" onClick={() => removeAttachment(id)} aria-label={`Remove ${file.name}`}><ChatGlyph name="close" /></button>
                    </li>
                  ))}
                </ul>
                </>
              )}
              {attachmentNotice && <p className="aic-notice" role="alert">{attachmentNotice}</p>}
              {error && <p className="aic-notice" role="alert">{error}</p>}
              {hasVideo && !attachmentNotice && <p className="aic-hint">VIRGO will analyse the video when this feature is available.</p>}
              <div className="aic-row" hidden={voiceMode && voiceView === "orb"}>
                <input ref={fileInputRef} className="aic-file-input" type="file" multiple tabIndex={-1} aria-hidden="true" accept="image/*,video/mp4,video/webm,application/pdf,application/zip,text/plain,text/markdown,text/csv,application/json,.pdf,.docx,.xlsx,.pptx,.txt,.md,.csv,.json,.xml,.zip,.mp4,.webm,.ts,.tsx,.js,.jsx,.mjs,.cjs,.html,.htm,.css,.scss,.yaml,.yml,.toml,.ini,.log,.py,.rs,.go,.java,.c,.h,.cpp,.hpp,.cs,.php,.rb,.sh,.ps1,.sql,.graphql,.vue,.svelte,.astro,.env,.properties" onChange={(event) => { const picked = event.currentTarget.files; if (picked && picked.length) void addAttachments(Array.from(picked)); event.currentTarget.value = ""; }} />
                <button type="button" className="aic-icon-btn" onClick={() => fileInputRef.current?.click()} aria-label="Attach files" title="Attach images, documents, videos or ZIP files"><ChatGlyph name="clip" /></button>
                <textarea
                  ref={textareaRef}
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  maxLength={developmentMode ? 100000 : 12000}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault();
                      void send();
                    }
                  }}
                  placeholder={developmentMode ? "Describe the code task or paste a large file…" : "Ask VIRGO…"}
                  aria-label="Message VIRGO"
                  rows={1}
                  enterKeyHint="send"
                />
                <button type="button" className={`aic-icon-btn ${voiceMode ? "is-on" : ""}`} onClick={toggleVoice} aria-pressed={voiceMode} aria-label={voiceMode ? "Stop voice conversation" : "Start voice conversation"} title={voiceMode ? "Stop voice conversation" : "Start voice conversation"}><ChatGlyph name={voiceMode ? "stop" : "mic"} /></button>
                {busy ? <button type="button" className="aic-send" onClick={() => { chatRequest.current?.abort(); setBusy(false); chatSending.current = false; }} aria-label="Stop response"><ChatGlyph name="stop" /></button> : <button type="button" className="aic-send" onClick={() => void send()} disabled={!canSend} aria-label="Send message" title="Send (Enter)"><ChatGlyph name="send" /></button>}
              </div>
              <div className="aic-foot" hidden={voiceMode && voiceView === "orb"}>
                <small>{developmentMode ? "Development mode · 500 MB/file · up to 2 GB/message · voice supported" : "Files up to 100 MB · Enter to send · Shift+Enter for a new line"}</small>
                {messages.length > 1 && <button type="button" onClick={newChat}>New chat</button>}
              </div>
              {voiceMode && voiceView === "both" && (
                <div className="aic-voice-row" role="status">
                  <span>{voiceStatus}</span>
                  <small>VIRGO · Female voice · Live audio</small>
                </div>
              )}
            </div>
          </>
        ) : tab === "image" && user?.role === "ADMIN" ? (
          <div className="ai-image-body">
            <div className="eyebrow">ATELIER / CONCEPT LAB</div>
            <h3 className="serif">Create a campaign image.</h3>
            <p>Describe a fashion campaign or visual direction. Generated images use the image provider configured in the admin AI studio.</p>
            <label className="ai-upload">Reference image (optional)<input type="file" accept="image/jpeg,image/png,image/webp" disabled={imageBusy} onChange={async event => { const file = event.currentTarget.files?.[0]; event.currentTarget.value = ""; if (!file) return; try { setImageReference(await preparePhoto(file)); setImageReferenceName(file.name); setError(""); } catch (error: any) { setError(error.message); } }} /></label>
            {imageReference && <figure className="ai-reference-preview"><img src={imageReference} alt={imageReferenceName || "Reference image"} /><figcaption>{imageReferenceName} <button type="button" disabled={imageBusy} onClick={() => { setImageReference(""); setImageReferenceName(""); }}>Remove reference</button></figcaption></figure>}
            <label className="ai-image-prompt"><span>Image direction</span><textarea value={imagePrompt} onChange={(event) => setImagePrompt(event.target.value)} maxLength={1200} rows={5} placeholder="A cinematic autumn campaign, tailored charcoal coat, wet Milan street, soft film grain…" /></label>
            {error && <div className="ai-error" role="alert">{error}</div>}
            <button type="button" className="btn ai-try-btn" onClick={() => void generateConceptImage()} disabled={imageBusy || imagePrompt.trim().length < 5}>{imageBusy ? "Generating image…" : "Generate campaign image"}</button>
            {generatedImage && <figure className="ai-generated-image"><img src={generatedImage} alt="AI generated campaign concept"/><figcaption>Generated concept <a href={generatedImage} target="_blank" rel="noreferrer">Open image ↗</a></figcaption></figure>}
          </div>
        ) : (
          <div className="ai-tryon-body">
            {!user ? (
              <div className="ai-lock">
                <div className="eyebrow">Private feature</div>
                <h3>Sign in to try your pieces on.</h3>
                <p>
                  Virtual Try-On is linked to your account so the free daily
                  limit stays fair.
                </p>
                <button
                  className="btn"
                  onClick={() => {
                    onClose();
                    onNavigate("/login");
                  }}
                >
                  Sign in
                </button>
              </div>
            ) : (
              <>
                <div className="ai-quota">
                  <div>
                    <span>Free previews</span>
                    <strong>
                      {usage.remaining} / {usage.limit}
                    </strong>
                  </div>
                  <small>
                    {usage.resetAt
                      ? `Next reset around ${resetLabel}`
                      : "Rolling 24-hour limit"}
                  </small>
                  <div className="ai-quota-track">
                    <span
                      style={{
                        width: `${Math.min(100, (usage.remaining / Math.max(1, usage.limit)) * 100)}%`,
                      }}
                    />
                  </div>
                </div>
                <label className="ai-upload" aria-disabled={busy}>
                  <input
                    aria-label="Upload a photo for virtual try-on"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={busy}
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      e.currentTarget.value = "";
                      void onPhoto(file);
                    }}
                  />
                  <span>{photo ? "Photo ready" : "Upload your photo"}</span>
                  <small>
                    {photoName ||
                      "Clear, front-facing JPG / PNG / WEBP · max 12 MB"}
                  </small>
                </label>
                <div className="ai-select-head">
                  <div>
                    <div className="eyebrow">Your Bag & Collection</div>
                    <h3>Choose up to 5 pieces</h3>
                  </div>
                  <span>{selected.length} selected</span>
                </div>
                {tryOnProducts.length ? (
                  <div className="ai-cart-picks">
                    {tryOnProducts.slice(0, 24).map((p) => (
                      <button
                        type="button"
                        key={p.id}
                        className={`ai-cart-pick ${selected.includes(p.id) ? "selected" : ""}`}
                        aria-pressed={selected.includes(p.id)}
                        onClick={() => toggleProduct(p.id)}
                        disabled={
                          busy ||
                          (usage.remaining <= 0 && !selected.includes(p.id)) ||
                          (!selected.includes(p.id) &&
                            selected.length >= Math.min(5, usage.remaining))
                        }
                      >
                        <SmartImage src={productImage(p)} alt={p.name} />
                        <span>
                          <b>{p.name}</b>
                          <small>
                            {money(p.price)}
                            {cartProducts.some((c) => c.id === p.id)
                              ? " · In your bag"
                              : ""}
                          </small>
                        </span>
                        <i className="ai-check">
                          {selected.includes(p.id) ? "✓" : ""}
                        </i>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="ai-empty">
                    <p>No active pieces are available right now.</p>
                    <button
                      type="button"
                      className="btn dark"
                      onClick={() => {
                        onClose();
                        onNavigate("/shop");
                      }}
                    >
                      Explore the collection
                    </button>
                  </div>
                )}
                <p className="ai-note">
                  Choose up to 5 pieces. Each selected piece uses one preview
                  from your rolling 24-hour allowance. The current free VTON
                  service produces one preview per request; results are an AI
                  visualisation, not a guarantee of exact fit.
                </p>
                {error && (
                  <div className="ai-error" role="alert" aria-live="assertive">
                    {error}
                  </div>
                )}
                <button
                  type="button"
                  className="btn ai-try-btn"
                  onClick={generate}
                  disabled={busy}
                >
                  {busy ? "Creating your preview…" : "Try on selected pieces"}
                </button>
                {results.length > 0 && (
                  <div className="ai-results">
                    {results.map((r: any) => (
                      <article className="ai-result" key={r.productId}>
                        <div className="ai-result-image">
                          {r.image ? (
                            <img
                              src={r.image}
                              alt={`Virtual try-on preview for ${r.name}`}
                            />
                          ) : (
                            <div className="ai-result-failed">
                              Preview unavailable
                            </div>
                          )}
                        </div>
                        <div>
                          <b>{r.name}</b>
                          {r.price != null && <span>{money(r.price)}</span>}
                          {r.image && (
                            <button
                              className="btn text"
                              onClick={() => {
                                onClose();
                                onNavigate(`/product/${r.productId}`);
                              }}
                            >
                              View piece →
                            </button>
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        )}
        <button className="aic-resize" type="button" tabIndex={-1} aria-label="Resize chat window" title="Drag to resize" onPointerDown={(event) => beginWindowPointer(event, "resize")} onPointerMove={(event) => updateWindowPointer(event, "resize")} onPointerUp={(event) => finishWindowPointer(event, "resize")} onPointerCancel={(event) => finishWindowPointer(event, "resize")} />
      </aside>
    </div>
  );
}

function SearchOverlay({
  products,
  value,
  onChange,
  onClose,
  onNavigate,
}: {
  products: Product[];
  value: string;
  onChange: (v: string) => void;
  onClose: () => void;
  onNavigate: (p: string) => void;
}) {
  const results = useMemo(
    () =>
      products
        .filter((p) =>
          fuzzyMatch(
            value,
            `${p.name} ${p.gender} ${p.type} ${p.category?.name || ""} ${productColors(p).join(" ")}`,
          ),
        )
        .sort((a, b) => Number(b.featured) - Number(a.featured))
        .slice(0, 12),
    [products, value],
  );
  const collections = [
    "New Arrivals",
    "Modern Tailoring",
    "Indo-Western Edit",
    "Western Edit",
    "Women’s Collection",
    "Best Sellers",
  ];
  const cats = Array.from(
    new Set(products.map((p) => p.category?.name || p.type).filter(Boolean)),
  ).slice(0, 6);
  return (
    <div
      className="overlay search-overlay"
      role="dialog"
      aria-modal="true"
      aria-label="Search ATELIER catalogue"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-panel">
        <div className="search-telemetry-bar">
          <div className="search-telemetry-pill">
            <span className="search-dot" />
            <span>TELEMETRY // CATALOGUE INDEX SEARCH</span>
          </div>
          <button
            className="search-esc-hint"
            onClick={onClose}
            aria-label="Close search"
          >
            <span>ESC TO CLOSE</span>
            <span className="search-esc-key">✕</span>
          </button>
        </div>

        <div className="search-top">
          <input
            autoFocus
            className="search-input"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Type to explore the edit…"
            aria-label="Search products by name, category or fabric"
            onKeyDown={(e) => e.key === "Escape" && onClose()}
          />
          {value && (
            <button
              className="search-clear-btn"
              onClick={() => onChange("")}
              aria-label="Clear query"
            >
              CLEAR
            </button>
          )}
        </div>

        <div className="search-suggestions">
          <span className="search-sub-label">QUICK EDITS:</span>
          {collections.map((x) => (
            <button
              key={x}
              className={`suggestion ${value === x ? "active" : ""}`}
              onClick={() => onChange(x)}
            >
              {x}
            </button>
          ))}
        </div>

        <div className="search-discovery">
          <div>
            <span className="eyebrow">CURATED COLLECTIONS</span>
            <div className="discovery-links">
              {collections
                .filter((x) => !value || fuzzyMatch(value, x))
                .slice(0, 3)
                .map((x) => (
                  <button
                    key={x}
                    onClick={() => {
                      onNavigate(
                        x === "Indo-Western Edit"
                          ? "/indo-western"
                          : x === "Western Edit"
                            ? "/western"
                            : x === "Women’s Collection"
                              ? "/shop?gender=Women"
                              : x === "New Arrivals"
                                ? "/shop?filter=new"
                                : x === "Best Sellers"
                                  ? "/shop?filter=best"
                                  : "/collections",
                      );
                      onClose();
                    }}
                  >
                    {x} <span className="arrow">↗</span>
                  </button>
                ))}
            </div>
          </div>
          <div>
            <span className="eyebrow">ACTIVE CATEGORIES</span>
            <div className="discovery-links">
              {cats
                .filter((x) => !value || fuzzyMatch(value, x))
                .slice(0, 4)
                .map((x) => (
                  <button key={x} onClick={() => onChange(x)}>
                    {x} <span className="arrow">↗</span>
                  </button>
                ))}
            </div>
          </div>
        </div>

        <div className="search-results-head">
          <span className="results-count">
            {value
              ? `${results.length} PIECES FOUND FOR “${value}”`
              : "FEATURED PIECES FROM ARCHIVE"}
          </span>
          {results.length > 0 && (
            <span className="results-tag">REALTIME DATABASE REPO</span>
          )}
        </div>

        <div className="search-results">
          {results.map((p, i) => (
            <button
              key={p.id}
              className="live-card"
              onClick={() => {
                onNavigate(`/product/${p.id}`);
                onClose();
              }}
            >
              <div className="live-card-media">
                <SmartImage src={productImage(p)} alt={p.name} />
                <span className="live-card-index">0{i + 1}</span>
                {p.newArrival && <span className="live-card-badge">NEW</span>}
                {p.bestSeller && !p.newArrival && (
                  <span className="live-card-badge best">BEST</span>
                )}
              </div>
              <div className="live-card-info">
                <div className="live-card-title-row">
                  <b>{p.name}</b>
                  <span className="live-card-price">{money(p.price)}</span>
                </div>
                <small>
                  {p.gender} · {p.category?.name || p.type}
                </small>
              </div>
            </button>
          ))}
          {value && results.length === 0 && (
            <div className="search-empty-state">
              <div className="search-empty-dot">✳</div>
              <h3>NO ARCHIVE PIECES FOUND</h3>
              <p>
                Try searching for “blazer”, “overcoat”, “denim”, “satin”, or
                “trouser”.
              </p>
              <div className="search-empty-pills">
                {[
                  "Tailored Blazer",
                  "Dark Denim Jacket",
                  "Wool Blend Overcoat",
                  "Pleated Palazzo",
                ].map((term) => (
                  <button key={term} onClick={() => onChange(term)}>
                    {term} ↗
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
function Footer({
  settings,
  onNavigate,
}: {
  settings: Record<string, any>;
  onNavigate: (p: string) => void;
}) {
  const name = settings.siteName || "ATELIER";
  const links: [string, string][] = [
    ["/shop", "Shop all"],
    ["/about", "Our philosophy"],
    ["/collections", "Collections"],
    ["/shop?filter=new", "New arrivals"],
    ["/shop?filter=best", "Best sellers"],
    ["/indo-western", "Indo-Western edit"],
    ["/western", "Western edit"],
    ["/about", "Shipping & returns"],
    ["/about", "Contact"],
  ];
  const social = [
    [settings.socialInstagram || "Instagram", "Instagram"],
    [settings.socialPinterest || "Pinterest", "Pinterest"],
    [settings.socialFacebook || "Facebook", "Facebook"],
  ].map(([value, label]: any) =>
    /^https:\/\//i.test(String(value)) ? (
      <a key={label} href={String(value)} target="_blank" rel="noreferrer">
        {label}
      </a>
    ) : (
      <span key={label}>{String(value)}</span>
    ),
  );
  return (
    <footer className="cin-footer">
      <div className="cin-footer-top">
        <div className="cin-footer-wordmark">
          {name}
          <small>{settings.footerTagline || "FORM · FUNCTION · FEELING"}</small>
        </div>
        <div className="cin-footer-links">
          {links.map(([r, l], i) => (
            <a
              key={i}
              href={r}
              onClick={(e) => {
                if (e.metaKey || e.ctrlKey) return;
                e.preventDefault();
                onNavigate(r);
              }}
            >
              {l}
            </a>
          ))}
        </div>
      </div>
      <div className="cin-footer-social" aria-label="Social channels">
        {social}
      </div>
      <div className="cin-footer-bottom">
        <span>{settings.copyrightText || "© 2026 ATELIER STUDIO"}</span>
        <span>Made with intention. Worn your way.</span>
        <span>
          <button onClick={() => onNavigate("/about#privacy")}>Privacy</button>{" "}
          · <button onClick={() => onNavigate("/about#terms")}>Terms</button>
        </span>
      </div>
    </footer>
  );
}

function RouteView(props: {
  pathname: string;
  searchParams: ReadonlyURLSearchParams;
  products: Product[];
  categories: any[];
  settings: Record<string, any>;
  user: User | null;
  cmsPage: CmsPage | null;
  cart: CartItem[];
  wish: Product[];
  adminMode: string;
  onNavigate: (p: string) => void;
  onAddCart: (
    p: Product,
    size?: string,
    color?: string,
    qty?: number,
  ) => Promise<boolean>;
  onChangeQty: (i: CartItem, d: number) => void;
  onRemoveCart: (i: CartItem) => void;
  onToggleWish: (p: Product) => void;
  onSetUser: (u: User | null) => void;
  onSetCart: (c: CartItem[]) => void;
  onMergeGuestCart: () => Promise<void>;
  onNotify: (s: string) => void;
  onLogout: () => void;
}) {
  const { pathname } = props;
  // Published CMS pages take precedence for every CMS-backed storefront route.
  // Native application behavior is preserved through NATIVE sections, so content/layout
  // can be edited from Site Builder without bypassing protected commerce logic.
  if (pathname === "/collections" || pathname.startsWith("/collections/")) {
    if (props.cmsPage && props.cmsPage.slug === "collections") {
      return <CmsPageView {...props} />;
    }
    return <Collections {...props} />;
  }
  const cmsBackedRoutes = new Set([
    "home",
    "about",
    "collections",
    "shop",
    "men",
    "women",
    "new",
    "product",
    "account",
    "builder",
    "stylist",
    "indo-western",
    "western",
    "cart",
    "checkout",
    "wishlist",
    "search",
    "custom",
  ]);
  if (props.cmsPage && cmsBackedRoutes.has(props.cmsPage.slug))
    return <CmsPageView {...props} />;
  if (pathname === "/" || pathname === "/home") return <Home {...props} />;
  if (
    pathname === "/shop" ||
    pathname === "/women" ||
    pathname === "/men" ||
    pathname === "/new"
  )
    return <Shop {...props} />;
  if (pathname.startsWith("/product/"))
    return <ProductPage {...props} id={pathname.split("/")[2] || ""} />;
  if (pathname === "/indo-western") return <IndoWesternPage {...props} />;
  if (pathname === "/western") return <WesternPage {...props} />;
  if (pathname === "/about") return <About {...props} />;
  if (pathname === "/login") return <Auth {...props} register={false} />;
  if (pathname === "/register") return <Auth {...props} register />;
  if (pathname === "/cart") return <CartPage {...props} />;
  if (pathname === "/checkout") return <Checkout {...props} />;
  if (pathname === "/wishlist") return <Wishlist {...props} />;
  if (pathname === "/account" || pathname.startsWith("/account/"))
    return (
      <Account
        {...props}
        section={pathname.replace(/^\/account\/?/, "") || "profile"}
      />
    );
  if (pathname === "/search") return <SearchPage {...props} />;
  if (pathname === "/custom") return <CustomFit {...props} />;
  if (pathname === "/builder") return <Builder {...props} />;
  if (pathname === "/stylist") return <Stylist {...props} />;
  if (pathname.startsWith("/custom-pages/") && props.cmsPage)
    return <CmsPageView {...props} />;
  if (pathname === ADMIN_ROUTE || pathname.startsWith(`${ADMIN_ROUTE}/`))
    return <Admin {...props} section={props.adminMode} />;
  if (
    props.cmsPage &&
    props.cmsPage.slug &&
    pathname === "/" + props.cmsPage.slug
  )
    return <CmsPageView {...props} />;
  return <NotFound onNavigate={props.onNavigate} />;
}

function RedirectTo({
  to,
  onNavigate,
}: {
  to: string;
  onNavigate: (x: string) => void;
}) {
  useEffect(() => {
    onNavigate(to);
  }, [to]);
  return null;
}
function CmsImage({
  src,
  alt,
  content = {},
}: {
  src: string;
  alt: string;
  content?: Record<string, any>;
}) {
  const fit = content.fit || content.displayMode || "cover";
  const ratio = content.ratio || content.aspectRatio || "original";
  const pos = content.position || "center";
  const rotation = Array.isArray(content.rotationImages)
    ? content.rotationImages.filter(Boolean)
    : [];
  const images =
    content.autoRotate && rotation.length ? rotation : [src].filter(Boolean);
  const [index, setIndex] = useState(0);
  useEffect(() => setIndex(0), [src, content.autoRotate, images.length]);
  useEffect(() => {
    if (!content.autoRotate || images.length < 2) return;
    const ms = Math.max(
      1000,
      Number(content.intervalMs || content.interval || 2000),
    );
    const id = window.setInterval(
      () => setIndex((v) => (v + 1) % images.length),
      ms,
    );
    return () => window.clearInterval(id);
  }, [content.autoRotate, content.intervalMs, content.interval, images.length]);
  const h = Number(content.height || 0);
  const style: React.CSSProperties = {
    objectFit:
      fit === "contain" ? "contain" : fit === "full" ? "contain" : "cover",
    objectPosition: pos,
    display: "block",
    width: "100%",
    height:
      h > 0
        ? `${h}px`
        : ratio !== "original"
          ? "auto"
          : fit === "full"
            ? "auto"
            : "100%",
    background: "#e8ded3",
  };
  if (ratio !== "original") style.aspectRatio = ratio.replace(":", "/");
  return (
    <SmartImage
      src={images[index] || src}
      alt={alt}
      style={style}
      fallbackSrc={FALLBACK}
    />
  );
}

function CmsPageView({
  canvasMode,
  canvasSelected,
  cmsPage,
  products,
  categories,
  user,
  cart,
  searchParams,
  onNavigate,
  onAddCart,
  onToggleWish,
  wish,
  settings,
  onChangeQty,
  onRemoveCart,
  onSetCart,
  onNotify,
  onLogout,
  pathname,
}: any) {
  if (!cmsPage) return null;
  const wrapCanvas = (s: CmsSection, node: React.ReactNode) => {
    const design = sectionDesign(s.content?.style || {});
    return (
      <div
        key={s.id}
        data-cms-section-id={s.id}
        data-design={design.properties}
        style={design.variables as React.CSSProperties}
        className={`cms-design-section${canvasMode ? " cms-canvas-section" : ""}${canvasMode && canvasSelected === s.id ? " is-selected" : ""}`}
      >
        {node}
      </div>
    );
  };
  return (
    <div className="cms-page">
      {(cmsPage.sections || [])
        .filter((x: CmsSection) => x.visible)
        .sort((a: CmsSection, b: CmsSection) => a.sortOrder - b.sortOrder)
        .map((section: CmsSection) =>
          wrapCanvas(
            section,
            <CmsSectionView
              key={section.id}
              section={section}
              products={products}
              wish={wish}
              onNavigate={onNavigate}
              onAddCart={onAddCart}
              onToggleWish={onToggleWish}
              settings={settings}
              categories={categories}
              searchParams={searchParams}
              user={user}
              cart={cart}
              onChangeQty={onChangeQty}
              onRemoveCart={onRemoveCart}
              onSetCart={onSetCart}
              onNotify={onNotify}
              onLogout={onLogout}
              route={cmsPage.slug}
              pathname={pathname}
            />,
          ),
        )}
    </div>
  );
}
function NativeCmsRoute({
  route,
  products,
  categories = [],
  wish,
  onNavigate,
  onAddCart,
  onToggleWish,
  settings,
  searchParams,
  cart,
  onChangeQty,
  onRemoveCart,
  onSetCart,
  onNotify,
  onLogout,
  user,
  pathname,
}: any) {
  switch (route) {
    case "shop":
      return (
        <Shop
          {...{
            products,
            wish,
            onNavigate,
            onToggleWish,
            onAddCart,
            searchParams,
            categories,
            settings,
          }}
        />
      );
    case "collections":
      return (
        <Collections
          {...{
            products,
            categories,
            wish,
            onNavigate,
            onAddCart,
            onToggleWish,
            settings,
          }}
        />
      );
    case "product":
      return (
        <ProductPage
          {...{
            products,
            wish,
            onNavigate,
            onToggleWish,
            onAddCart,
            searchParams,
            categories,
            settings,
            user,
            onNotify,
          }}
          id={String(pathname || "").split("/")[2] || ""}
        />
      );
    case "account":
      return (
        <Account
          {...{
            products,
            wish,
            onNavigate,
            onToggleWish,
            onAddCart,
            searchParams,
            categories,
            settings,
            user,
            onNotify,
            onLogout,
          }}
          section={
            String(pathname || "").replace(/^\/account\/?/, "") || "wishlist"
          }
        />
      );
    case "builder":
      return <Builder {...{ products, onNavigate, onNotify }} />;
    case "stylist":
      return (
        <Stylist
          {...{ user, cart, products, onNavigate, onNotify, onAddCart }}
        />
      );
    case "indo-western":
      return (
        <IndoWesternPage
          {...{ products, onNavigate, onToggleWish, onAddCart, wish }}
        />
      );
    case "western":
      return (
        <WesternPage
          {...{ products, onNavigate, onToggleWish, onAddCart, wish }}
        />
      );
    case "cart":
      return (
        <CartPage
          cart={cart || []}
          onNavigate={onNavigate}
          onChangeQty={onChangeQty || (() => {})}
          onRemoveCart={onRemoveCart || (() => {})}
        />
      );
    case "checkout":
      return (
        <Checkout
          {...{ cart, user, settings, onNavigate, onNotify, onSetCart }}
        />
      );
    case "wishlist":
      return (
        <Wishlist
          {...{ products, wish, onNavigate, onToggleWish, onAddCart }}
        />
      );
    case "search":
      return (
        <SearchPage
          {...{
            products,
            onNavigate,
            onToggleWish,
            onAddCart,
            wish,
            searchParams,
          }}
        />
      );
    case "custom":
      return <CustomFit {...{ products, onNavigate, onNotify, onAddCart }} />;
    default:
      return null;
  }
}

function HeroSlider({
  c,
  onNavigate,
}: {
  c: Record<string, any>;
  onNavigate: (x: string) => void;
}) {
  const slides: any[] = Array.isArray(c.slides) ? c.slides : [];
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const heroRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (paused || c.autoplay === false || slides.length < 2) return;
    const id = window.setInterval(
      () => setSlide((v) => (v + 1) % slides.length),
      Math.max(2000, Number(c.intervalMs || 6500)),
    );
    return () => window.clearInterval(id);
  }, [paused, c.autoplay, c.intervalMs, slides.length]);
  useEffect(() => {
    const root = document.querySelector(".page-home");
    if (!root) return;
    root.classList.add("cinematic-ready");
    const targets = Array.from(
      root.querySelectorAll<HTMLElement>(
        ".benefit-bar,.cms-grid-section,.reference-banner,.cms-image-text,.editorial-products,.newsletter-section,.cms-rich",
      ),
    );
    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("cinematic-in-view");
            observer.unobserve(entry.target);
          }
        }),
      { threshold: 0.12, rootMargin: "0px 0px -5% 0px" },
    );
    targets.forEach((el) => observer.observe(el));
    return () => {
      observer.disconnect();
      root.classList.remove("cinematic-ready");
    };
  }, []);
  useEffect(() => {
    const el = heroRef.current;
    if (!el || !matchMedia("(pointer: fine) and (prefers-reduced-motion: no-preference)").matches) return;
    let pointerFrame = 0;
    let scrollFrame = 0;
    let pointerX = 0;
    let pointerY = 0;
    const applyPointer = () => {
      pointerFrame = 0;
      const r = el.getBoundingClientRect();
      const x = ((pointerX - r.left) / r.width - 0.5) * 2;
      const y = ((pointerY - r.top) / r.height - 0.5) * 2;
      el.style.setProperty("--pointer-x", String(x));
      el.style.setProperty("--pointer-y", String(y));
      el.style.setProperty("--pointer-tilt-x", `${x * -3}deg`);
      el.style.setProperty("--pointer-tilt-y", `${y * 2}deg`);
      el.style.setProperty("--orbit-tilt", `${x * 7}deg`);
      el.style.setProperty("--copy-shift-x", `${x * -5}px`);
      el.style.setProperty("--copy-shift-y", `${y * -4}px`);
    };
    const move = (event: MouseEvent) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      if (!pointerFrame) pointerFrame = requestAnimationFrame(applyPointer);
    };
    const leave = () => {
      cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      el.style.setProperty("--pointer-x", "0");
      el.style.setProperty("--pointer-y", "0");
      el.style.setProperty("--pointer-tilt-x", "0deg");
      el.style.setProperty("--pointer-tilt-y", "0deg");
      el.style.setProperty("--orbit-tilt", "0deg");
      el.style.setProperty("--copy-shift-x", "0px");
      el.style.setProperty("--copy-shift-y", "0px");
    };
    const applyScroll = () => {
      scrollFrame = 0;
      const r = el.getBoundingClientRect();
      const progress = Math.max(
        0,
        Math.min(1, (0 - r.top) / (Math.max(1, r.height) * 0.85)),
      );
      el.style.setProperty("--scroll-progress", String(progress));
      el.style.setProperty("--scroll-y", `${progress * 36}px`);
      el.style.setProperty("--scroll-scale", String(1 - progress * 0.12));
      el.style.setProperty(
        "--scroll-image-scale",
        String(1.08 + progress * 0.08),
      );
      el.style.setProperty("--scroll-image-y", `${progress * 3}%`);
    };
    const scroll = () => {
      if (!scrollFrame) scrollFrame = requestAnimationFrame(applyScroll);
    };
    el.addEventListener("mousemove", move);
    el.addEventListener("mouseleave", leave);
    window.addEventListener("scroll", scroll, { passive: true });
    scroll();
    return () => {
      cancelAnimationFrame(pointerFrame);
      cancelAnimationFrame(scrollFrame);
      el.removeEventListener("mousemove", move);
      el.removeEventListener("mouseleave", leave);
      window.removeEventListener("scroll", scroll);
    };
  }, []);
  const s = slides[Math.min(slide, Math.max(0, slides.length - 1))];
  if (!s) return null;
  const legacyHomeHero =
    slide === 0 &&
    s.line1 === "TIMELESS STYLE." &&
    s.line2 === "MODERN YOU." &&
    (!s.line3 || s.line3 === "");
  const lines = (
    legacyHomeHero
      ? ["TECHNOLOGY", "ENGINEERED", "TO ENDURE."]
      : [s.line1, s.line2, s.line3]
  ).filter(Boolean);
  const eyebrow = legacyHomeHero ? "THE ATELIER OBJECT SERIES" : s.eyebrow;
  const heroCopy = legacyHomeHero
    ? "Technical outerwear. Considered materials. A modern uniform built for the everyday."
    : s.text;
  const h = Number(c.height || 0);
  return (
    <section
      ref={heroRef}
      className="hero hero-reference hero-reference-board atelier-cinematic-hero"
      style={h > 0 ? { height: `${h}px`, minHeight: 0 } : undefined}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="hero-reference-media">
        <SmartImage
          src={s.image}
          alt="ATELIER editorial campaign"
          priority
          style={{
            objectFit: s.fit === "contain" ? "contain" : "cover",
            objectPosition: s.position || "center",
          }}
        />
      </div>
      <div className="atelier-hero-grain" aria-hidden="true" />
      <div className="hero-reference-overlay" aria-hidden="true" />
      <div className="atelier-hero-gridlines" aria-hidden="true" />
      <div className="atelier-hero-meta atelier-meta-left">
        <span>ATELIER / OBJECTS FOR LIVING</span>
        <span>EST. MMXXIV</span>
      </div>
      <div className="atelier-hero-meta atelier-meta-right">
        <span>COLLECTION 01</span>
        <span>FORM / FUNCTION / FEELING</span>
      </div>
      <div className="wrap hero-reference-content">
        <div className="hero-reference-copy">
          <div className="eyebrow">
            {eyebrow || "THE ATELIER OBJECT SERIES"}
          </div>
          <h1>
            {lines.map((x: string, i: number) => (
              <span key={i}>{x}</span>
            ))}
          </h1>
          <p className="hero-copy">{heroCopy}</p>
          <div className="hero-actions">
            {s.buttonText && (
              <button
                className="btn peach"
                onClick={() => onNavigate(s.buttonLink || "/shop")}
              >
                {s.buttonText} <Icon name="arrow" size={13} />
              </button>
            )}
            {s.button2Text && (
              <button
                className="btn dark hero-secondary-cta"
                onClick={() => onNavigate(s.button2Link || "/shop")}
              >
                {s.button2Text} <Icon name="arrow" size={13} />
              </button>
            )}
          </div>
        </div>
      </div>
      <div
        className="atelier-hero-object"
        aria-label="Featured ATELIER outerwear"
      >
        <div className="atelier-object-orbit orbit-one" />
        <div className="atelier-object-orbit orbit-two" />
        <div className="atelier-object-index">
          <span>FIG. 001</span>
          <span>TACTILE / TECHNICAL</span>
        </div>
        <div className="atelier-object-card object-card-back">
          <span>AT—01</span>
          <i />
        </div>
        <div className="atelier-object-card object-card-front">
          <div className="object-card-top">
            <span>ATELIER / FORM STUDY</span>
            <span>01—04</span>
          </div>
          <ModelViewer src="/models/fashion-look.glb" title="Soft Form" preview />
          <div className="object-card-bottom">
            <span>UTILITY / DENIM</span>
            <span>VIEW OBJECT ↗</span>
          </div>
        </div>
        <div className="atelier-object-caption">
          <span>THE MODERN UNIFORM</span>
          <strong>Designed to endure.</strong>
        </div>
      </div>
      <div className="atelier-hero-bottom">
        <span>
          SCROLL TO EXPLORE <i />
        </span>
        <span>CRAFTED WITH INTENTION</span>
      </div>
      {slides.length > 1 && (
        <div className="hero-reference-foot wrap">
          <div className="hero-reference-caption">
            <span>
              {String(slide + 1).padStart(2, "0")} /{" "}
              {String(slides.length).padStart(2, "0")}
            </span>
            <span>{paused ? "INTERACTION ACTIVE" : "THE EDIT / 2026"}</span>
          </div>
          <div className="hero-rail">
            <div className="dots">
              {slides.map((_, i) => (
                <button
                  className={`dot-btn ${i === slide ? "active" : ""}`}
                  key={i}
                  onClick={() => setSlide(i)}
                  aria-label={`Slide ${i + 1}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </button>
              ))}
            </div>
            <div className="arrow-pair">
              <button
                className="arrow-btn"
                onClick={() =>
                  setSlide((slide + slides.length - 1) % slides.length)
                }
                aria-label="Previous slide"
              >
                ←
              </button>
              <button
                className="arrow-btn"
                onClick={() => setSlide((slide + 1) % slides.length)}
                aria-label="Next slide"
              >
                →
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function cmsInlineStyle(s: any = {}) {
  const v: any = {};
  if (s.background) v.background = s.background;
  if (s.color) v.color = s.color;
  if (s.paddingTop != null) v.paddingTop = `${Number(s.paddingTop) || 0}px`;
  if (s.paddingRight != null)
    v.paddingRight = `${Number(s.paddingRight) || 0}px`;
  if (s.paddingBottom != null)
    v.paddingBottom = `${Number(s.paddingBottom) || 0}px`;
  if (s.paddingLeft != null) v.paddingLeft = `${Number(s.paddingLeft) || 0}px`;
  if (s.borderRadius != null)
    v.borderRadius = `${Number(s.borderRadius) || 0}px`;
  if (s.borderWidth)
    v.border = `${Number(s.borderWidth) || 0}px solid ${s.borderColor || "#d6cbc0"}`;
  if (s.minHeight) v.minHeight = `${Number(s.minHeight) || 0}px`;
  if (s.maxWidth)
    v.maxWidth = String(s.maxWidth).match(/(?:px|%)$/)
      ? String(s.maxWidth)
      : `${Number(s.maxWidth) || 0}px`;
  if (s.align) v.textAlign = s.align;
  return v;
}
function FreeformCms({
  content,
  onNavigate,
}: {
  content: any;
  onNavigate: (x: string) => void;
}) {
  const elements = Array.isArray(content.elements) ? content.elements : [];
  const style = (s: any = {}) => ({
    ...cmsInlineStyle(s),
    position: "relative" as const,
  });
  const render = (e: any): any => {
    const st = style(e.style || {});
    if (e.type === "text")
      return (
        <div key={e.id} data-cms-element-id={e.id} style={st}>
          <div className="eyebrow">{e.content?.eyebrow || ""}</div>
          <h2 className="serif" style={e.content?.titleStyle || undefined}>
            {e.content?.title || ""}
          </h2>
          <div className="cms-copy">
            <p>{e.content?.body || ""}</p>
          </div>
        </div>
      );
    if (e.type === "image")
      return (
        <div key={e.id} data-cms-element-id={e.id} style={st}>
          <CmsImage
            src={e.content?.src || ""}
            alt={e.content?.alt || "ATELIER"}
            content={{ ...e.content, ...e.style }}
          />
        </div>
      );
    if (e.type === "button")
      return (
        <div key={e.id} data-cms-element-id={e.id} style={st}>
          <button
            className="btn dark"
            onClick={() => onNavigate(e.content?.link || "/shop")}
          >
            {e.content?.text || "Button"} →
          </button>
        </div>
      );
    if (e.type === "spacer")
      return (
        <div
          key={e.id}
          data-cms-element-id={e.id}
          style={{
            height: `${Math.max(0, Number(e.content?.height) || 60)}px`,
            ...st,
          }}
        />
      );
    if (e.type === "divider")
      return (
        <div
          key={e.id}
          data-cms-element-id={e.id}
          style={{
            width: "100%",
            height: 1,
            background: e.style?.borderColor || "#d6cbc0",
            ...st,
          }}
        />
      );
    if (e.type === "video")
      return (
        <div
          key={e.id}
          data-cms-element-id={e.id}
          style={{
            minHeight: 240,
            display: "grid",
            placeItems: "center",
            background: "#17120f",
            color: "#fff",
            ...st,
          }}
        >
          {e.content?.src ? (
            <video
              src={e.content.src}
              poster={e.content.poster || undefined}
              controls
              playsInline
              style={{ width: "100%", maxHeight: 700 }}
            />
          ) : (
            <span>Add a video URL in the Visual Studio.</span>
          )}
        </div>
      );
    if (e.type === "columns")
      return (
        <div
          key={e.id}
          data-cms-element-id={e.id}
          style={{
            ...st,
            display: "grid",
            gridTemplateColumns: `repeat(${Math.max(1, Number(e.content?.columns) || 2)},minmax(0,1fr))`,
            gap: `${Number(e.style?.gap) || 16}px`,
          }}
        >
          {(e.children || []).map((x: any) => render(x))}
        </div>
      );
    return null;
  };
  return (
    <section
      className="cms-freeform wrap"
      style={cmsInlineStyle(content.style || {})}
    >
      {elements.map(render)}
    </section>
  );
}

function CmsSectionView({
  section,
  products,
  wish,
  onNavigate,
  onAddCart,
  onToggleWish,
  settings,
  categories,
  user,
  cart,
  searchParams,
  onChangeQty,
  onRemoveCart,
  onSetCart,
  onNotify,
  onLogout,
  route,
  pathname,
}: any) {
  const c = section.content || {};
  const sp: React.CSSProperties = {
    paddingTop: c.spacing ? `${Number(c.spacing)}px` : undefined,
    paddingBottom: c.spacing ? `${Number(c.spacing)}px` : undefined,
    ...cmsInlineStyle(c.style || {}),
  };
  const paras = (t: any, color?: string) =>
    String(t || "")
      .split(/\n+/)
      .filter(Boolean)
      .map((x: string, i: number) => <p key={i} style={color ? { color } : undefined}>{x}</p>);
  const btnGo = (l: string) => onNavigate(l || "/shop");
  if (section.type === "SPACER")
    return (
      <div style={{ height: `${Math.max(0, Number(c.height) || 40)}px` }} />
    );
  if (section.type === "NATIVE")
    return (
      <NativeCmsRoute
        route={c.route || ""}
        {...{
          products,
          wish,
          categories,
          user,
          cart,
          onNavigate,
          onAddCart,
          onToggleWish,
          settings,
          onChangeQty,
          onRemoveCart,
          onSetCart,
          onNotify,
          onLogout,
          searchParams,
          pathname,
        }}
      />
    );
  if (section.type === "FREEFORM")
    return <FreeformCms content={c} onNavigate={onNavigate} />;
  if (section.type === "CIN_HERO")
    return <CinHero c={c} onNavigate={onNavigate} />;
  if (section.type === "CIN_TICKER") return <CinTicker c={c} />;
  if (section.type === "CIN_FILM") return <CinFilm c={c} products={products} user={user} onNavigate={onNavigate} />;
  if (section.type === "CIN_EDIT")
    return <CinEdit c={c} onNavigate={onNavigate} />;
  if (section.type === "CIN_MANIFESTO")
    return <CinManifesto c={c} onNavigate={onNavigate} />;
  if (section.type === "CIN_SHOP")
    return (
      <CinShop
        c={c}
        products={products}
        onNavigate={onNavigate}
        onAddCart={onAddCart}
        productImage={productImage}
        money={money}
      />
    );
  if (section.type === "CIN_LOOKBOOK")
    return <CinLookbook c={c} onNavigate={onNavigate} />;
  if (section.type === "CIN_LETTER") return <CinLetter c={c} />;
  if (section.type === "HERO_SLIDER")
    return <HeroSlider c={c} onNavigate={onNavigate} />;
  if (section.type === "BENEFITS")
    return (
      <div className="benefit-bar">
        {(Array.isArray(c.items) ? c.items : []).map((b: any, i: number) => (
          <Benefit
            key={i}
            icon={
              (["box", "truck", "return"].includes(b.icon)
                ? b.icon
                : "box") as IconName
            }
            title={b.title || ""}
            text={b.text || ""}
          />
        ))}
      </div>
    );
  if (section.type === "RICH_TEXT")
    return (
      <section className="cms-rich wrap" style={sp}>
        <div className="eyebrow">{c.eyebrow}</div>
        <h2 className="serif">{c.title}</h2>
        <div className="cms-copy">{paras(c.body)}</div>
      </section>
    );
  if (section.type === "HERO")
    return (
      <section
        className="cms-hero"
        style={{
          minHeight: Number(c.height) > 0 ? `${Number(c.height)}px` : undefined,
        }}
      >
        <div className="cms-hero-media">
          {c.image && (
            <CmsImage
              src={c.image}
              alt={c.title || "ATELIER"}
              content={{
                ...c,
                height: Number(c.height) > 0 ? Number(c.height) : 0,
                ratio: "original",
              }}
            />
          )}
        </div>
        <div className="cms-hero-overlay" />
        <div className="wrap cms-hero-copy">
          <div className="eyebrow">{c.eyebrow || ""}</div>
          <h1>
            {[c.line1, c.line2, c.line3]
              .filter(Boolean)
              .map((x: string, i: number) => (
                <span key={i}>{x}</span>
              ))}
          </h1>
          <p>{c.text || ""}</p>
          <div className="hero-actions">
            {c.buttonText && (
              <button className="btn peach" onClick={() => btnGo(c.buttonLink)}>
                {c.buttonText}
                <Icon name="arrow" size={13} />
              </button>
            )}
          </div>
        </div>
      </section>
    );
  if (section.type === "IMAGE_TEXT")
    return (
      <section
        className={`cms-image-text ${c.reverse ? "reverse" : ""}`}
        style={sp}
      >
        <div className="cms-image-text-media">
          {(c.image || (c.rotationImages || [])[0]) && (
            <CmsImage
              src={c.image || c.rotationImages[0]}
              alt={c.title || "ATELIER"}
              content={c}
            />
          )}
        </div>
        <div
          className="cms-image-text-copy"
          style={{
            color: (c.style || {}).color || "#211a16",
            background: (c.style || {}).background || "#f8f3ed",
            ["--cms-section-color" as string]: (c.style || {}).color || "#211a16",
            ["--cms-section-background" as string]: (c.style || {}).background || "#f8f3ed",
            ["--cms-button-background" as string]: (c.style || {}).buttonBackground || "#d7ff55",
            ["--cms-button-color" as string]: (c.style || {}).buttonColor || "#080a09",
          }}
        >
          <div className="eyebrow" style={{ color: (c.style || {}).color || undefined }}>{c.eyebrow || ""}</div>
          <h2 className="serif">{c.title || ""}</h2>
          <div className="cms-copy" style={{ color: (c.style || {}).color || undefined }}>{paras(c.body, (c.style || {}).color || "var(--atelier-ink, #211a16)")}</div>
          {c.buttonText && (
            <button className="btn dark" onClick={() => btnGo(c.buttonLink)}>
              {c.buttonText}
            </button>
          )}
        </div>
      </section>
    );
  if (section.type === "BANNER") {
    const h = Number(c.height) || 460;
    return (
      <section className="reference-banner" style={{ height: `${h}px` }}>
        <div className="reference-banner-media" style={{ height: "100%" }}>
          {c.image && (
            <CmsImage
              src={c.image}
              alt={c.title || "ATELIER"}
              content={{ ...c, height: h, ratio: "original" }}
            />
          )}
        </div>
        <div className="reference-banner-overlay">
          <div>
            <div className="eyebrow">{c.eyebrow || ""}</div>
            <h2>{c.title || ""}</h2>
            <p>{c.body || ""}</p>
            {c.buttonText && (
              <button className="btn peach" onClick={() => btnGo(c.buttonLink)}>
                {c.buttonText}
              </button>
            )}
          </div>
        </div>
      </section>
    );
  }
  if (section.type === "IMAGE_GRID" || section.type === "COLLECTION_GRID") {
    const items = Array.isArray(c.items) ? c.items : [];
    const cols = Math.min(
      5,
      Math.max(1, Number(c.columns) || Math.min(4, items.length || 4)),
    );
    return (
      <section className="reference-collections cms-grid-section" style={sp}>
        <div className="wrap">
          {(c.title || c.eyebrow) && (
            <div className="reference-section-head">
              <div>
                <div className="eyebrow">{c.eyebrow}</div>
                <h2>{c.title}</h2>
                <p>{c.body}</p>
              </div>
              {c.viewAllText && (
                <button
                  className="btn text"
                  onClick={() => onNavigate(c.viewAllLink || "/collections")}
                >
                  {c.viewAllText} →
                </button>
              )}
            </div>
          )}
          <div
            className="cms-card-grid"
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${cols},minmax(0,1fr))`,
              gap: 18,
            }}
          >
            {items.map((item: any, i: number) => (
              <button
                className="cms-card"
                key={i}
                onClick={() => onNavigate(item.link || "/shop")}
              >
                <span className="cms-card-media">
                  <CmsImage
                    src={item.image}
                    alt={item.title || "ATELIER"}
                    content={{
                      ...item,
                      ratio: item.ratio || item.aspectRatio || "4:5",
                    }}
                  />
                </span>
                <span className="reference-card-copy">
                  <strong>{item.title}</strong>
                  {item.body && <em className="cms-card-body">{item.body}</em>}
                  <small>{item.buttonText || "Shop Now →"}</small>
                </span>
              </button>
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (section.type === "PRODUCT_GRID") {
    let list = products.filter((p: Product) => p.status === "ACTIVE");
    if (c.gender) list = list.filter((p: Product) => p.gender === c.gender);
    if (c.filter === "new") list = list.filter((p: Product) => p.newArrival);
    if (c.filter === "best") {
      const b = list.filter((p: Product) => p.bestSeller);
      if (b.length) list = b;
    }
    return (
      <section className="editorial-products" style={sp}>
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">{c.eyebrow || "ATELIER"}</div>
              <h2>{c.title || "The Edit"}</h2>
              {c.body && <p>{c.body}</p>}
            </div>
            <button className="btn text" onClick={() => onNavigate("/shop")}>
              View all →
            </button>
          </div>
          <div className="product-grid">
            {list.slice(0, Number(c.limit) || 8).map((p: Product) => (
              <ProductCard
                key={p.id}
                p={p}
                saved={wish.some((w: Product) => w.id === p.id)}
                onNavigate={onNavigate}
                onToggleWish={onToggleWish}
                onAddCart={onAddCart}
              />
            ))}
          </div>
        </div>
      </section>
    );
  }
  if (section.type === "NEWSLETTER")
    return (
      <NewsletterSection eyebrow={c.eyebrow} title={c.title} body={c.body} />
    );
  if (section.type === "FAQ")
    return (
      <section className="cms-rich wrap" style={sp}>
        <div className="eyebrow">{c.eyebrow || "FAQ"}</div>
        <h2 className="serif">{c.title || "Questions"}</h2>
        {(Array.isArray(c.items) ? c.items : []).map((x: any, i: number) => (
          <details key={i} className="cms-faq">
            <summary>{x.question}</summary>
            <p>{x.answer}</p>
          </details>
        ))}
      </section>
    );
  return null;
}

function Home({
  products,
  user,
  wish,
  onNavigate,
  onToggleWish,
  onAddCart,
  settings,
}: any) {
  const [look, setLook] = useState(0);
  const [chapter, setChapter] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);
  const [filter, setFilter] = useState("all");
  const looks = [
    {
      ey: settings.hero1Eyebrow || "THE NEW UNIFORM · CHAPTER 01",
      line1: settings.hero1Line1 || "FORM IN",
      line2: settings.hero1Line2 || "MOTION.",
      copy: settings.hero1Text || "A study in silhouette, texture and movement. Considered clothing made to live beyond the frame.",
      image: settings.hero1Image || REFERENCE_WEB_IMAGES.mensCollection,
      caption: "The winter form.",
      sub: "Look 01 / wool & structure",
    },
    {
      ey: settings.hero2Eyebrow || "TEXTURE · CHAPTER 02",
      line1: settings.hero2Line1 || "DARK",
      line2: settings.hero2Line2 || "DENIM.",
      copy: settings.hero2Text || "A quieter statement. Strong shapes, tactile fabrics and pieces made to move with you.",
      image: settings.hero2Image || REFERENCE_WEB_IMAGES.heroWomanBlackBlazer,
      caption: "Texture in focus.",
      sub: "Look 02 / structured layers",
    },
    {
      ey: settings.hero3Eyebrow || "MOVEMENT · CHAPTER 03",
      line1: settings.hero3Line1 || "A NEW",
      line2: settings.hero3Line2 || "POINT OF VIEW.",
      copy: settings.hero3Text || "Personal style, considered from every angle. Discover the pieces that make the everyday feel exceptional.",
      image: settings.hero3Image || REFERENCE_WEB_IMAGES.womenCollection,
      caption: "Made to move.",
      sub: "Look 03 / the editorial",
    },
  ];
  const s = looks[look];
  const women = products.filter(
    (p: Product) => p.status === "ACTIVE" && p.gender === "Women",
  );
  const men = products.filter(
    (p: Product) => p.status === "ACTIVE" && p.gender === "Men",
  );
  const newArrivals = products.filter(
    (p: Product) => p.status === "ACTIVE" && p.newArrival,
  );
  const best = products.filter(
    (p: Product) => p.status === "ACTIVE" && p.bestSeller,
  );
  const allProducts = (
    newArrivals.length ? newArrivals : [...women, ...men]
  ).slice(0, 6);
  const featured =
    filter === "men"
      ? men.slice(0, 6)
      : filter === "women"
        ? women.slice(0, 6)
        : allProducts;

  const collectionCards = [
    {
      title: settings.homeEditorialCard1Title || "Everyday, reconsidered.",
      label: settings.homeEditorialCard1Label || "Menswear / understated layers",
      src: settings.homeEditorialCard1Image || REFERENCE_WEB_IMAGES.mensCollection,
      route: "/shop?gender=Men",
    },
    {
      title: settings.homeEditorialCard2Title || "Quietly unforgettable.",
      label: settings.homeEditorialCard2Label || "Womenswear / considered shapes",
      src: settings.homeEditorialCard2Image || REFERENCE_WEB_IMAGES.womenCollection,
      route: "/shop?gender=Women",
    },
  ];
  return (
    <div className="cinematic-home">
      <div className="cinematic-topline">
        <span>ATELIER / STUDIO NOTES</span>
        <i>✳</i>
        <span>AUTUMN — WINTER 2026</span>
        <i>✳</i>
        <span>FORM IN MOTION</span>
      </div>
      <section
        className="cinematic-hero"
        onMouseEnter={() => setHeroPaused(true)}
        onMouseLeave={() => setHeroPaused(false)}
      >
        <div className="cinematic-hero-bg">
          <SmartImage
            src={s.image}
            fallbackSrc={PHOTOS[look] || PHOTOS[0]}
            alt=""
            priority
          />
        </div>
        <div className="cinematic-hero-shade" />
        <div className="cinematic-hero-copy">
          <div className="cinematic-eyebrow">{s.ey}</div>
          <h1>
            <span>{s.line1}</span>
            <em>{s.line2}</em>
          </h1>
          <p>{s.copy}</p>
          <div className="cinematic-actions">
            <button
              className="cinematic-button filled"
              onClick={() => onNavigate("/shop")}
            >
              DISCOVER THE EDIT <span>↗</span>
            </button>
            <button
              className="cinematic-button tryon-hero-link"
              onClick={() => onNavigate("/custom")}
            >
              VIRTUAL TRY-ON <Icon name="arrow" size={13} />
            </button>
            <button
              className="cinematic-button"
              onClick={() => onNavigate("/collections")}
            >
              EXPLORE COLLECTIONS <span>↘</span>
            </button>
          </div>
          <div className="cinematic-hero-foot">
            <b>0{look + 1} — 03</b>
            <span />
            {heroPaused ? "PAUSED" : "AN IMAGE-BASED FASHION STORY"}
          </div>
        </div>
        <div className="cinematic-hero-caption">
          <span>ATELIER / CAMPAIGN 2026</span>
          <strong>{s.caption}</strong>
          <small>{s.sub}</small>
        </div>
        <div className="cinematic-look-tabs">
          {looks.map((x: any, i: number) => (
            <button
              key={x.ey}
              className={look === i ? "active" : ""}
              onClick={() => setLook(i)}
            >
              <b>0{i + 1}</b>
              {["WINTER FORM", "DARK DENIM", "THE EDITORIAL"][i]}
            </button>
          ))}
        </div>
        <div className="cinematic-scroll-note">
          SCROLL TO EXPLORE <span>↓</span>
        </div>
      </section>
      <div className="cinematic-ticker">
        <div>
          {settings.homeTicker || (
            <>
              LESS, BUT CONSIDERED <b>✳</b> DESIGNED TO ENDURE <b>✳</b> WEAR YOUR
              OWN STORY <b>✳</b> FORM FOLLOWS FEELING <b>✳</b> LESS, BUT CONSIDERED{" "}
              <b>✳</b> DESIGNED TO ENDURE <b>✳</b>
            </>
          )}
        </div>
      </div>
      <section className="cinematic-film" id="cinematic-film">
        <div className="cinematic-section-intro">
          <div>
            <span className="cinematic-eyebrow">01 / THE POINT OF VIEW</span>
            <h2>
              {settings.homeFilmTitle ? (
                settings.homeFilmTitle
              ) : (
                <>
                  The art of
                  <br />
                  <em>silhouette.</em>
                </>
              )}
            </h2>
          </div>
          <p>
            {settings.homeFilmText ||
              "Different rhythms. Strong forms. A wardrobe built around the pieces you return to, with a little room for the unexpected."}
          </p>
        </div>
        <div className="cinematic-film-layout">
          <div className="cinematic-film-controls">
            <span className="cinematic-eyebrow">
              IMAGE FILM / 0{chapter + 1}
            </span>
            <h3>
              {
                ["Quiet presence.", "Texture in focus.", "Made to move."][
                  chapter
                ]
              }
            </h3>
            <p>
              {
                [
                  "Begin with the full look. Strong silhouettes, thoughtful proportions and quiet confidence.",
                  "Look closer at the material. Tactile layers and considered details define the everyday.",
                  "Clothing that moves with you, built for a life beyond the frame.",
                ][chapter]
              }
            </p>
            <div className="cinematic-chapters">
              {["SILHOUETTE", "TEXTURE", "MOVEMENT"].map((v, i) => (
                <button
                  key={v}
                  className={chapter === i ? "active" : ""}
                  onClick={() => setChapter(i)}
                >
                  <b>0{i + 1}</b>
                  {v}
                </button>
              ))}
            </div>
            <button
              className="cinematic-text-link"
              onClick={() => onNavigate("/collections")}
            >
              EXPLORE THE COLLECTION <span>↗</span>
            </button>
          </div>
          <div className="cinematic-film-image">
            <SmartImage
              src={
                [
                  REFERENCE_WEB_IMAGES.mensCollection,
                  REFERENCE_WEB_IMAGES.heroWomanBlackBlazer,
                  REFERENCE_WEB_IMAGES.womenCollection,
                ][chapter]
              }
              alt={
                [
                  "Quiet luxury winter menswear",
                  "Tailored editorial fashion",
                  "Modern womenswear editorial",
                ][chapter]
              }
              fallbackSrc={FALLBACK}
            />
            <div className="cinematic-image-label">
              <strong>
                {
                  ["Quiet presence.", "Texture in focus.", "Made to move."][
                    chapter
                  ]
                }
              </strong>
              <span>FRAME 0{chapter + 1} / 03</span>
            </div>
          </div>
        </div>
      </section>
      <section className="cinematic-editorial">
        <div className="cinematic-section-intro">
          <div>
            <span className="cinematic-eyebrow">02 / THE EDIT</span>
            <h2>
              Pieces with
              <br />a point of view.
            </h2>
          </div>
          <p>
            Considered shapes and versatile layers for the moments that make up
            your own story.
          </p>
        </div>
        <div className="cinematic-editorial-grid">
          {collectionCards.map((c: any, i: number) => (
            <button
              className={`cinematic-editorial-card card-${i + 1}`}
              key={c.title}
              onClick={() => onNavigate(c.route)}
            >
              <SmartImage src={c.src} alt={c.title} fallbackSrc={FALLBACK} />
              <span className="cinematic-card-index">
                CHAPTER 0{i + 1} · ATELIER EDIT
              </span>
              <span className="cinematic-card-copy">
                <strong>{c.title}</strong>
                <small>{c.label}</small>
              </span>
              <span className="cinematic-card-arrow">↗</span>
            </button>
          ))}
        </div>
      </section>
      <CinManifesto
        c={{
          micro: "02 / A QUIETER KIND OF LUXURY",
          title: settings.homeManifestoTitle || "Not made for\na moment.",
          emphasis: settings.homeManifestoEmphasis || "Made for life.",
          body:
            settings.homeManifestoBody ||
            "Great design is felt before it is noticed. Thoughtful materials, useful details and silhouettes that leave room for you to be yourself.",
          mark: "FORM · FUNCTION · FEELING",
        }}
        onNavigate={onNavigate}
      />
      <section className="cinematic-shop">
        <div className="cinematic-section-intro">
          <div>
            <span className="cinematic-eyebrow">04 / CURATED FOR YOU</span>
            <h2>
              {settings.homeShopTitle ? (
                settings.homeShopTitle
              ) : (
                <>
                  Shop the
                  <br />
                  moving image.
                </>
              )}
            </h2>
          </div>
          <p>
            {settings.homeShopBody ||
              "The film moves into the wardrobe. Explore selected pieces from the ATELIER catalogue."}
          </p>
        </div>
        <div className="cinematic-shop-toolbar">
          <div>
            {[
              ["all", "ALL PIECES"],
              ["men", "MENSWEAR"],
              ["women", "WOMENSWEAR"],
            ].map(([v, label]) => (
              <button
                key={v}
                className={filter === v ? "active" : ""}
                onClick={() => setFilter(v)}
              >
                {label}
              </button>
            ))}
          </div>
          <button
            className="cinematic-text-link"
            onClick={() => onNavigate("/shop")}
          >
            VIEW FULL COLLECTION ↗
          </button>
        </div>
        {featured.length ? (
          <div className="cinematic-products">
            {featured.map((p: Product) => (
              <ProductCard
                key={p.id}
                p={p}
                saved={wish.some((w: Product) => w.id === p.id)}
                onNavigate={onNavigate}
                onToggleWish={onToggleWish}
                onAddCart={onAddCart}
              />
            ))}
          </div>
        ) : (
          <div className="cinematic-empty">
            New pieces are coming soon.{" "}
            <button onClick={() => onNavigate("/shop")}>
              Explore the store ↗
            </button>
          </div>
        )}
      </section>
      <CinLookbook
        c={{
          micro: "04 / THE LOOKBOOK",
          title: "Wear it\nyour way.",
          body: "Move through the looks. A little different in every frame, always unmistakably your own.",
          looks: [
            { label: "Look 01 — The statement", image: REFERENCE_WEB_IMAGES.heroWomanBlackBlazer, link: "/collections" },
            { label: "Look 02 — The layer", image: REFERENCE_WEB_IMAGES.mensCollection, link: "/men" },
            { label: "Look 03 — The structure", image: REFERENCE_WEB_IMAGES.womenCollection, link: "/women" },
            { label: "Look 04 — The everyday", image: REFERENCE_WEB_IMAGES.indoWestern, link: "/indo-western" },
          ],
        }}
        onNavigate={onNavigate}
      />
      <Cin3DLooks products={products} user={user} onNavigate={onNavigate} />
      <section className="cinematic-home-benefits">
        <div>
          <b>01</b>
          <strong>THOUGHTFUL DESIGN</strong>
          <span>Considered fabrics and precise finishes.</span>
        </div>
        <div>
          <b>02</b>
          <strong>MADE TO BE WORN</strong>
          <span>Pieces for real life, beyond a single season.</span>
        </div>
        <div>
          <b>03</b>
          <strong>YOUR ATELIER EDIT</strong>
          <span>Discover a wardrobe that feels like you.</span>
        </div>
      </section>
      <NewsletterSection
        eyebrow="THE ATELIER LETTER"
        title="A little more in your inbox."
        body="First access to new edits, notes from the studio and ideas worth keeping."
      />
    </div>
  );
}
function NewsletterSection({
  eyebrow,
  title,
  body,
}: { eyebrow?: string; title?: string; body?: string } = {}) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const v = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(v)) {
      setStatus("Enter a valid email address.");
      return;
    }
    setBusy(true);
    setStatus("");
    try {
      const r = await api<any>("/newsletter/subscribe", {
        method: "POST",
        body: JSON.stringify({ email: v }),
      });
      setEmail("");
      setStatus(
        r.alreadySubscribed
          ? "You’re already on the list."
          : "You’re on the list. Welcome to ATELIER.",
      );
    } catch (e: any) {
      setStatus(errorText(e.message));
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="reference-newsletter">
      <div className="wrap">
        <div>
          <div className="eyebrow">{eyebrow || "Join Our Community"}</div>
          <h2>{title || "Stay close to the next edit."}</h2>
          <p>
            {body || "Get exclusive updates, new arrivals and special offers."}
          </p>
        </div>
        <form className="reference-newsletter-form" onSubmit={submit}>
          <input
            type="email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setStatus("");
            }}
            placeholder="Your email address"
            aria-label="Your email address"
            autoComplete="email"
          />
          <button className="btn peach" type="submit" disabled={busy}>
            {busy ? "Saving…" : "Subscribe"}
          </button>
        </form>
        {status && (
          <div
            className="newsletter-status home-newsletter-status"
            role="status"
            aria-live="polite"
          >
            {status}
          </div>
        )}
      </div>
    </section>
  );
}
function EditorialProductSection({
  eyebrow,
  title,
  products,
  wish,
  onNavigate,
  onToggleWish,
  onAddCart,
}: {
  eyebrow: string;
  title: string;
  products: Product[];
  wish: Product[];
  onNavigate: (x: string) => void;
  onToggleWish: (p: Product) => void;
  onAddCart: (
    p: Product,
    size?: string,
    color?: string,
    qty?: number,
  ) => Promise<boolean>;
}) {
  return (
    <section className="editorial-products">
      <div className="wrap">
        <div className="section-head">
          <div>
            <div className="eyebrow">{eyebrow}</div>
            <h2>{title}</h2>
          </div>
          <button className="btn text" onClick={() => onNavigate("/shop")}>
            View all →
          </button>
        </div>
        <div className="product-grid">
          {products.slice(0, 5).map((p) => (
            <ProductCard
              key={p.id}
              p={p}
              saved={wish.some((w: Product) => w.id === p.id)}
              onNavigate={onNavigate}
              onToggleWish={onToggleWish}
              onAddCart={onAddCart}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
function Benefit({
  icon,
  title,
  text,
}: {
  icon: IconName;
  title: string;
  text: string;
}) {
  return (
    <div className="benefit">
      <div className="benefit-icon">
        <Icon name={icon} />
      </div>
      <div>
        <strong>{title}</strong>
        <p>{text}</p>
      </div>
    </div>
  );
}
function CollectionCard({
  title,
  src,
  fallbackSrc = FALLBACK,
  onClick,
}: {
  title: string;
  src: string;
  fallbackSrc?: string;
  onClick: () => void;
}) {
  return (
    <button className="collection-card" onClick={onClick}>
      <SmartImage src={src} fallbackSrc={fallbackSrc} alt={title} />
      <span className="collection-copy">
        <span className="eyebrow">ATELIER</span>
        <h3>{title}</h3>
        <span>Shop Now →</span>
      </span>
    </button>
  );
}
function PairEditorialImage({ men, women }: { men: Product; women: Product }) {
  return (
    <div className="pair-editorial-image">
      <div>
        <SmartImage src={productImage(men)} alt={men.name} />
      </div>
      <div>
        <SmartImage src={productImage(women)} alt={women.name} />
      </div>
    </div>
  );
}
function CoupleEdit({
  products,
  onNavigate,
  onToggleWish,
  wish,
  onAddCart,
}: any) {
  const men = (products as Product[])
    .filter((p) => p.gender === "Men")
    .slice(0, 6);
  const women = (products as Product[])
    .filter((p) => p.gender === "Women")
    .slice(0, 6);
  const [mode, setMode] = useState<"twinning" | "contrast">("twinning");
  const pairs = Array.from(
    { length: Math.min(men.length, women.length) },
    (_, i) => ({
      men: men[i],
      women: women[mode === "twinning" ? i : (i + 2) % women.length],
    }),
  );
  const mini = (p: Product) => (
    <div className="couple-mini-product">
      <button
        className="couple-mini-hit"
        onClick={() => onNavigate(`/product/${p.id}`)}
        aria-label={`View ${p.name}`}
      >
        <SmartImage src={productImage(p)} alt={p.name} />
      </button>
      <div className="couple-mini-meta">
        <button onClick={() => onNavigate(`/product/${p.id}`)}>{p.name}</button>
        <span>{money(p.price)}</span>
      </div>
      <button
        className={`couple-mini-wish ${wish.some((x: Product) => x.id === p.id) ? "on" : ""}`}
        onClick={() => onToggleWish(p)}
        aria-label={
          wish.some((x: Product) => x.id === p.id)
            ? `Remove ${p.name} from wishlist`
            : `Add ${p.name} to wishlist`
        }
      >
        <Icon name="heart" size={13} />
      </button>
    </div>
  );
  return (
    <section className="couple-edit">
      <div className="wrap">
        <div className="section-head split">
          <div>
            <div className="eyebrow">For Two</div>
            <h2>
              Couple / <em>Together</em>
            </h2>
            <p>
              Curated pairings with a shared visual language—quiet, considered
              and easy to wear.
            </p>
          </div>
          <div className="couple-mode">
            <button
              className={mode === "twinning" ? "active" : ""}
              onClick={() => setMode("twinning")}
            >
              Twinning
            </button>
            <button
              className={mode === "contrast" ? "active" : ""}
              onClick={() => setMode("contrast")}
            >
              Contrast
            </button>
          </div>
        </div>
        <div className="couple-collection-grid">
          <button
            className={`couple-collection-card ${mode === "twinning" ? "active" : ""}`}
            onClick={() => setMode("twinning")}
          >
            <div className="couple-card-label">
              <span className="eyebrow">Twinning</span>
              <h3>
                One palette.
                <br />
                Two expressions.
              </h3>
              <span>Explore the pairing →</span>
            </div>
            {pairs[0] && (
              <PairEditorialImage men={pairs[0].men} women={pairs[0].women} />
            )}
          </button>
          <button
            className={`couple-collection-card ${mode === "contrast" ? "active" : ""}`}
            onClick={() => setMode("contrast")}
          >
            <div className="couple-card-label">
              <span className="eyebrow">Contrast</span>
              <h3>
                Different silhouettes.
                <br />
                One point of view.
              </h3>
              <span>Explore the pairing →</span>
            </div>
            {pairs[1] && (
              <PairEditorialImage men={pairs[1].men} women={pairs[1].women} />
            )}
          </button>
        </div>
        <div className="couple-look">
          <div className="couple-look-image">
            {pairs[0] && (
              <PairEditorialImage men={pairs[0].men} women={pairs[0].women} />
            )}
          </div>
          <div className="couple-look-copy">
            <div className="eyebrow">
              {mode === "twinning" ? "Twinning edit" : "Contrast edit"}
            </div>
            <h3>
              {mode === "twinning"
                ? "Coordinate without matching exactly."
                : "Let the silhouette do the distinction."}
            </h3>
            <p>
              {mode === "twinning"
                ? "Build a shared wardrobe story through balanced tones, textures and restrained tailoring."
                : "Pair softer proportions with sharper structure for a couple look that still feels individual."}
            </p>
            <div className="couple-product-list">
              {pairs.slice(0, 4).map((pair: any) => (
                <div
                  key={pair.men.id + pair.women.id}
                  className="couple-pair-row"
                >
                  <div>
                    <span className="pair-label">HIS</span>
                    {mini(pair.men)}
                  </div>
                  <div>
                    <span className="pair-label">HERS</span>
                    {mini(pair.women)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function ProductVisual({
  src,
  alt,
  fallbackSrc = FALLBACK,
}: {
  src: string;
  alt: string;
  fallbackSrc?: string;
}) {
  const clean = safeImg(src);
  if (clean === FALLBACK) {
    return (
      <span className="product-missing-visual" role="img" aria-label={alt}>
        <span className="product-missing-kicker">ATELIER</span>
        <strong>Image coming soon</strong>
        <small>Product photography being updated.</small>
      </span>
    );
  }
  return <SmartImage src={clean} alt={alt} fallbackSrc={fallbackSrc} />;
}

function ProductCard({
  p,
  onNavigate,
  onToggleWish,
  onAddCart,
  saved = false,
}: {
  p: Product;
  onNavigate: (x: string) => void;
  onToggleWish: (p: Product) => void;
  onAddCart: (
    p: Product,
    size?: string,
    color?: string,
    qty?: number,
  ) => Promise<boolean>;
  saved?: boolean;
}) {
  const tag = p.newArrival ? "New" : p.bestSeller ? "Best Seller" : "";
  const primary = productImage(p);
  const secondary = productSecondaryImage(p);
  const [pinned, setPinned] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  const [quickSize, setQuickSize] = useState("");
  const [quickColor, setQuickColor] = useState("");
  const openQuick = () => {
    if (p.stock < 1) return;
    setQuickSize(
      productSizes(p).includes("M") ? "M" : productSizes(p)[0] || "",
    );
    setQuickColor(productColors(p)[0] || "");
    setQuickOpen(true);
  };
  const confirmQuick = async () => {
    if (!quickSize || !quickColor) {
      return;
    }
    const ok = await onAddCart(p, quickSize, quickColor, 1);
    if (ok) setQuickOpen(false);
  };
  return (
    <article className="product-card">
      <div
        className={`product-media ${secondary ? "has-flip" : ""} ${pinned ? "is-pinned" : ""}`}
      >
        <button
          className="product-hit"
          aria-label={`View ${p.name}`}
          onClick={() => onNavigate(`/product/${p.id}`)}
        >
          <span className="product-flip">
            <span className="product-face product-front">
              <ProductVisual
                src={primary}
                fallbackSrc={FALLBACK}
                alt={p.name}
              />
            </span>
            {secondary && (
              <span className="product-face product-back">
                <ProductVisual
                  src={secondary}
                  fallbackSrc={primary}
                  alt={`${p.name} back view`}
                />
              </span>
            )}
          </span>
          <span className="product-hover-cue">
            {secondary ? (pinned ? "View front" : "View back") : "View piece"}{" "}
            <Icon name="arrow" size={12} />
          </span>
        </button>
        {secondary && (
          <button
            type="button"
            className="flip-toggle"
            onClick={(e) => {
              e.stopPropagation();
              setPinned((v) => !v);
            }}
            aria-label={`${pinned ? "Show front" : "Show back"} of ${p.name}`}
          >
            {pinned ? "Front" : "Back"}
          </button>
        )}
        <div className="product-top">
          <span>{tag && <span className="tag">{tag}</span>}</span>
          <button
            className={`wish-btn ${saved ? "on" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggleWish(p);
            }}
            aria-label={
              saved
                ? `Remove ${p.name} from wishlist`
                : `Save ${p.name} to wishlist`
            }
          >
            <Icon name="heart" size={16} />
          </button>
        </div>
        <button
          className="quick-add"
          disabled={p.stock < 1}
          onClick={(e) => {
            e.stopPropagation();
            openQuick();
          }}
        >
          {p.stock < 1 ? "Sold Out" : "Quick Add"}
        </button>
        {quickOpen && (
          <div
            className="quick-add-panel"
            role="dialog"
            aria-label={`Choose options for ${p.name}`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="quick-add-head">
              <b>Quick Add</b>
              <button
                type="button"
                className="close-btn"
                onClick={() => setQuickOpen(false)}
                aria-label="Close quick add"
              >
                <Icon name="close" size={14} />
              </button>
            </div>
            <div className="quick-add-label">
              Colour · {quickColor || "Choose"}
            </div>
            <div className="swatches-large quick-add-swatches">
              {productColors(p).map((c: string) => (
                <button
                  type="button"
                  key={c}
                  title={c}
                  className={`swatch ${c === quickColor ? "active" : ""}`}
                  style={{ background: colorHex[c] || c }}
                  onClick={() => setQuickColor(c)}
                  aria-label={c}
                />
              ))}
            </div>
            <div className="quick-add-label">Size</div>
            <div className="selectors quick-add-sizes">
              {productSizes(p).map((z: string) => (
                <button
                  type="button"
                  className={`selector ${z === quickSize ? "active" : ""}`}
                  key={z}
                  onClick={() => setQuickSize(z)}
                >
                  {z}
                </button>
              ))}
            </div>
            <button
              type="button"
              className="btn"
              style={{ width: "100%", marginTop: 14 }}
              disabled={!quickSize || !quickColor}
              onClick={() => void confirmQuick()}
            >
              Add to Bag
            </button>
          </div>
        )}
      </div>
      <div className="product-meta">
        <div className="name">{p.name}</div>
        <div className="sub">
          {p.gender} · {p.category?.name || p.type}
        </div>
        <div className="product-meta-row">
          <div className="price">{money(p.price)}</div>
          {p.reviewCount > 0 && (
            <div className="card-rating">
              ★ {Number(p.rating || 0).toFixed(1)}
            </div>
          )}
        </div>
        <div className="product-swatches">
          {productColors(p)
            .slice(0, 4)
            .map((c) => (
              <span
                key={c}
                className="mini-swatch"
                title={c}
                style={{ background: colorHex[c] || c }}
              />
            ))}
        </div>
        {p.stock > 0 && p.stock < 4 && (
          <div className="stock-note">Only {p.stock} left</div>
        )}
      </div>
    </article>
  );
}
function Shop({
  products,
  categories,
  wish,
  onNavigate,
  onToggleWish,
  onAddCart,
  searchParams,
}: any) {
  const params = searchParams as URLSearchParams;
  const path = usePathname();
  const genderFrom =
    params.get("gender") || { "/women": "Women", "/men": "Men" }[path] || "";
  const collectionType =
    params.get("collectionType") ||
    { "/indo-western": "WOMEN_INDO_WESTERN", "/western": "WOMEN_WESTERN" }[
      path
    ] ||
    "";
  const newOnly = params.get("filter") === "new" || path === "/new";
  const bestOnly = params.get("filter") === "best";
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string[]>([]);
  const [gender, setGender] = useState<string[]>(
    genderFrom ? [genderFrom] : [],
  );
  useEffect(() => {
    setGender(genderFrom ? [genderFrom] : []);
  }, [genderFrom]);
  const [sizes, setSizes] = useState<string[]>([]);
  const [colors, setColors] = useState<string[]>([]);
  const [sort, setSort] = useState("new");
  const [mobileFilter, setMobileFilter] = useState(false);
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [max, setMax] = useState(10000);
  const allCats: Array<{ name: string; slug: string }> = Array.isArray(
    categories,
  )
    ? (categories as Array<{ name: string; slug: string }>).map((category) => ({
        name: category.name,
        slug: category.slug,
      }))
    : [];
  const filtered = useMemo(() => {
    let a = products.filter(
      (p: Product) =>
        p.status === "ACTIVE" &&
        (q
          ? fuzzyMatch(
              q,
              `${p.name} ${p.gender} ${p.type} ${p.category?.name || ""}`,
            )
          : true) &&
        (gender.length ? p.gender && gender.includes(p.gender) : true) &&
        (cat.length ? p.category && cat.includes(p.category.slug) : true) &&
        (colors.length
          ? productColors(p).some((c) => colors.includes(c))
          : true) &&
        p.price <= max &&
        (!sizes.length || sizes.some((s) => productSizes(p).includes(s))) &&
        (!newOnly || p.newArrival) &&
        (!bestOnly || p.bestSeller) &&
        (!collectionType || p.collectionType === collectionType),
    );
    if (sort === "low") a = [...a].sort((x, y) => x.price - y.price);
    if (sort === "high") a = [...a].sort((x, y) => y.price - x.price);
    if (sort === "new")
      a = [...a].sort(
        (x, y) =>
          Number(y.newArrival) - Number(x.newArrival) ||
          Number(y.featured) - Number(x.featured),
      );
    return a;
  }, [
    products,
    q,
    cat,
    gender,
    sizes,
    colors,
    sort,
    max,
    newOnly,
    bestOnly,
    collectionType,
  ]);
  const title = newOnly
    ? "New Arrivals"
    : bestOnly
      ? "Best Sellers"
      : collectionType === "WOMEN_INDO_WESTERN"
        ? "Indo-Western Edit"
        : collectionType === "WOMEN_WESTERN"
          ? "Western Edit"
          : genderFrom
            ? `${genderFrom}'s Collection`
            : "Shop Our Latest Collection";
  const toggle = (arr: string[], v: string, set: (x: string[]) => void) =>
    set(arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const clear = () => {
    setCat([]);
    setGender(genderFrom ? [genderFrom] : []);
    setSizes([]);
    setColors([]);
    setMax(10000);
  };
  const categoryRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!categoryOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (
        categoryRef.current &&
        !categoryRef.current.contains(e.target as Node)
      )
        setCategoryOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setCategoryOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [categoryOpen]);
  const fc = {
    categories: allCats,
    cat,
    setCat,
    gender,
    setGender,
    sizes,
    setSizes,
    colors,
    setColors,
    max,
    setMax,
    toggle,
    onClear: clear,
  };
  const selectedCategoryNames = allCats
    .filter((c) => cat.includes(c.slug))
    .map((c) => c.name);
  const collectionItems = filtered;
  return (
    <>
      <div className="wrap page-hero">
        <div className="breadcrumb">
          Home <span>/</span> Shop
        </div>
        <h1>{title}</h1>
        <p>
          Elevate your style with timeless pieces, considered materials, and a
          distinctly modern point of view.
        </p>
      </div>
      <div className="wrap">
        <div className="shop-layout">
          <aside className="filters">
            <FilterContent {...fc} />
          </aside>
          <section>
            <div className="shop-toolbar">
              <span>Showing {filtered.length} pieces</span>
              <div className="toolbar-right">
                <div className="shop-category-picker" ref={categoryRef}>
                  <button
                    type="button"
                    className={`category-filter-trigger ${categoryOpen || cat.length ? "active" : ""}`}
                    aria-haspopup="menu"
                    aria-expanded={categoryOpen}
                    onClick={() => setCategoryOpen((v) => !v)}
                  >
                    <Icon name="category" size={15} />
                    <span>Categories</span>
                    {cat.length > 0 && <b>{cat.length}</b>}
                    <Icon name="chevron" size={14} />
                  </button>
                  {categoryOpen && (
                    <div
                      className="category-filter-menu"
                      role="menu"
                      aria-label="Shop categories"
                    >
                      {allCats.length ? (
                        allCats.map((c: any) => {
                          const selected = cat.includes(c.slug);
                          return (
                            <button
                              type="button"
                              role="menuitemcheckbox"
                              aria-checked={selected}
                              key={c.slug}
                              className={`category-filter-option ${selected ? "selected" : ""}`}
                              onClick={() => toggle(cat, c.slug, setCat)}
                            >
                              <span>{c.name}</span>
                              <span className="category-filter-check">
                                {selected ? "✓" : ""}
                              </span>
                            </button>
                          );
                        })
                      ) : (
                        <div className="category-filter-empty">
                          No categories available.
                        </div>
                      )}{" "}
                      {cat.length > 0 && (
                        <button
                          type="button"
                          role="menuitem"
                          className="category-filter-clear"
                          onClick={() => setCat([])}
                        >
                          Clear categories
                          {selectedCategoryNames.length
                            ? ` · ${selectedCategoryNames.join(", ")}`
                            : ""}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <button
                  className="btn dark"
                  style={{ minHeight: 40 }}
                  onClick={() => setMobileFilter(true)}
                >
                  Filter
                </button>
                <label>
                  Sort by{" "}
                  <select
                    className="sort"
                    value={sort}
                    onChange={(e) => setSort(e.target.value)}
                  >
                    <option value="new">Newest</option>
                    <option value="low">Price: Low to High</option>
                    <option value="high">Price: High to Low</option>
                  </select>
                </label>
              </div>
            </div>
            {collectionItems.length ? (
              <div className="product-grid">
                {collectionItems.map((p: Product) => (
                  <ProductCard
                    key={p.id}
                    p={p}
                    saved={wish.some((w: Product) => w.id === p.id)}
                    onNavigate={onNavigate}
                    onToggleWish={onToggleWish}
                    onAddCart={onAddCart}
                  />
                ))}
              </div>
            ) : (
              <div className="empty">
                <div className="eyebrow">ATELIER / Edit</div>
                <h2>Nothing matched.</h2>
                <p>Try another filter or remove a selection.</p>
                <button
                  className="btn"
                  style={{ marginTop: 20 }}
                  onClick={clear}
                >
                  Clear filters
                </button>
              </div>
            )}
          </section>
        </div>
      </div>
      {mobileFilter && (
        <div
          className="overlay mobile-filter-overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setMobileFilter(false);
          }}
        >
          <div
            className="mobile-filter-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-filter-title"
          >
            <div className="mobile-filter-head">
              <h2 id="mobile-filter-title" className="serif">
                Filter
              </h2>
              <button
                className="close-btn"
                onClick={() => setMobileFilter(false)}
                aria-label="Close filters"
              >
                <Icon name="close" />
              </button>
            </div>
            <FilterContent {...fc} />
          </div>
        </div>
      )}
    </>
  );
}

function FilterContent({
  categories,
  cat,
  setCat,
  gender,
  setGender,
  sizes,
  setSizes,
  colors,
  setColors,
  max,
  setMax,
  toggle,
  onClear,
}: any) {
  return (
    <>
      <div className="filter-block">
        <div className="filter-title">
          <span>Category</span>
        </div>
        <div className="filter-list">
          {categories.map((c: any) => (
            <label className="check" key={c.slug}>
              <input
                type="checkbox"
                checked={cat.includes(c.slug)}
                onChange={() => toggle(cat, c.slug, setCat)}
              />
              {c.name}
            </label>
          ))}
        </div>
      </div>
      <div className="filter-block">
        <div className="filter-title">Gender</div>
        <div className="filter-list">
          {["Men", "Women"].map((v) => (
            <label className="check" key={v}>
              <input
                type="checkbox"
                checked={gender.includes(v)}
                onChange={() => toggle(gender, v, setGender)}
              />
              {v}
            </label>
          ))}
        </div>
      </div>
      <div className="filter-block">
        <div className="filter-title">Size</div>
        <div className="size-row">
          {["XS", "S", "M", "L", "XL", "XXL"].map((v) => (
            <button
              className={`size-chip ${sizes.includes(v) ? "active" : ""}`}
              key={v}
              onClick={() => toggle(sizes, v, setSizes)}
            >
              {v}
            </button>
          ))}
        </div>
      </div>
      <div className="filter-block">
        <div className="filter-title">Colour</div>
        <div className="swatch-row">
          {Object.keys(colorHex).map((v) => (
            <button
              key={v}
              title={v}
              className={`swatch ${colors.includes(v) ? "active" : ""}`}
              style={{ background: colorHex[v] }}
              onClick={() => toggle(colors, v, setColors)}
            />
          ))}
        </div>
      </div>
      <div className="filter-block">
        <div className="filter-title">
          <span>Price</span>
          <span>{money(max)}</span>
        </div>
        <input
          type="range"
          min="500"
          max="10000"
          step="250"
          value={max}
          onChange={(e) => setMax(Number(e.target.value))}
          style={{ width: "100%" }}
        />
      </div>
      <button className="btn dark" style={{ width: "100%" }} onClick={onClear}>
        Clear All
      </button>
    </>
  );
}

function ProductPage({
  id,
  products,
  wish = [],
  onNavigate,
  onAddCart,
  onToggleWish,
  onNotify,
}: any) {
  const p = products.find((x: Product) => x.id === id || x.slug === id);
  const [active, setActive] = useState(0);
  const [size, setSize] = useState("");
  const [color, setColor] = useState("");
  const [lightbox, setLightbox] = useState(false);
  useEffect(() => {
    if (p) {
      setActive(0);
      setSize(productSizes(p).includes("M") ? "M" : productSizes(p)[0] || "");
      setColor(productColors(p)[0] || "");
      try {
        const old = JSON.parse(
          localStorage.getItem("atelier_recently_viewed") || "[]",
        ).filter((x: string) => x !== p.id);
        localStorage.setItem(
          "atelier_recently_viewed",
          JSON.stringify([p.id, ...old].slice(0, 8)),
        );
      } catch {}
    }
  }, [id, p?.id]);
  if (!p) return <NotFound onNavigate={onNavigate} />;
  const images = Array.from(
    new Set(
      [
        productImage(p),
        ...catalogueImages(p),
        ...(Array.isArray(p?.images)
          ? p.images
              .map((x: string) => safeImg(x))
              .filter((x: string) => isUiRasterImage(x))
          : []),
      ].filter((x) => x && isUiRasterImage(x)),
    ),
  ).slice(0, 6);
  return (
    <div className="wrap pdp">
      <div className="breadcrumb">
        Home <span>/</span> {p.gender} <span>/</span>{" "}
        {p.category?.name || p.type}
      </div>
      <div className="pdp-top">
        <div className="gallery">
          <div className="thumbs">
            {images.slice(0, 6).map((img: string, i: number) => (
              <button
                key={i}
                className={`thumb ${i === active ? "active" : ""}`}
                onClick={() => setActive(i)}
                aria-label={`View image ${i + 1}`}
              >
                <SmartImage
                  src={img}
                  fallbackSrc={productImage(p)}
                  alt={`${p.name} image ${i + 1}`}
                />
              </button>
            ))}
          </div>
          <button
            className="main-image"
            onClick={() => setLightbox(true)}
            aria-label="Open product image viewer"
          >
            <SmartImage
              src={images[active]}
              fallbackSrc={productImage(p)}
              alt={`${p.name} main view`}
            />
            <span className="counter">
              0{active + 1} / 0{Math.min(images.length, 6)}
            </span>
            <span className="zoom-cue">
              <Icon name="zoom" size={15} /> View
            </span>
          </button>
        </div>
        <div className="info">
          <div className="category">
            {p.gender} · {p.category?.name || p.type}
          </div>
          <h1>{p.name}</h1>
          <div className="pdp-price-line">
            <div className="price">{money(p.price)}</div>
            {p.reviewCount > 0 && (
              <div className="rating">
                ★★★★★{" "}
                <span>
                  {Number(p.rating || 0).toFixed(1)} · {p.reviewCount} reviews
                </span>
              </div>
            )}
          </div>
          <p className="desc">{p.description}</p>
          <div className="product-proof">
            <span>
              Available in {productColors(p).length} colour
              {productColors(p).length === 1 ? "" : "s"}
            </span>
            <span>{productSizes(p).length} sizes</span>
            <span>
              {p.stock > 0
                ? p.stock < 4
                  ? `Only ${p.stock} left`
                  : `In stock`
                : "Sold out"}
            </span>
          </div>
          <span className="field-label">Colour · {color}</span>
          <div className="swatches-large">
            {productColors(p).map((c: string) => (
              <button
                key={c}
                title={c}
                className={`swatch ${c === color ? "active" : ""}`}
                style={{ background: colorHex[c] || c }}
                onClick={() => setColor(c)}
                aria-label={c}
              />
            ))}
          </div>
          <span className="field-label">Size</span>
          <div className="selectors">
            {productSizes(p).map((s: string) => (
              <button
                className={`selector ${s === size ? "active" : ""}`}
                key={s}
                onClick={() => setSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <button
            className="btn text size-guide"
            onClick={() =>
              onNotify(
                `Available sizes: ${productSizes(p).join(", ")}. Choose your usual size for a clean fit; size up if you prefer more room.`,
              )
            }
          >
            Size Guide →
          </button>
          <div className="actions-stack">
            <button
              className="btn"
              disabled={!size || p.stock < 1}
              onClick={() => onAddCart(p, size, color, 1)}
            >
              Add to Bag
            </button>
            <button
              className="btn dark"
              disabled={!size || p.stock < 1}
              onClick={async () => {
                const ok = await onAddCart(p, size, color, 1);
                if (ok) onNavigate("/cart");
              }}
            >
              Buy Now
            </button>
          </div>
          <div className="service-list">
            <div className="service-row">
              <Icon name="truck" size={17} /> Complimentary delivery over ₹3,000
            </div>
            <div className="service-row">
              <Icon name="return" size={17} /> Easy 30-day returns on eligible
              pieces
            </div>
            <div className="service-row">
              <Icon name="shield" size={17} /> Secure gateway-verified payment
            </div>
          </div>
          <div className="details-accordion">
            <details className="details-row" open>
              <summary>
                Details <Icon name="chevron" size={15} />
              </summary>
              <div className="details-body">{p.description}</div>
            </details>
            <details className="details-row">
              <summary>
                Materials & Care <Icon name="chevron" size={15} />
              </summary>
              <div className="details-body">
                Refer to the garment label for fibre-specific care. For best
                results, store folded or on a suitable hanger and avoid
                unnecessary high heat.
              </div>
            </details>
            <details className="details-row">
              <summary>
                Shipping & Returns <Icon name="chevron" size={15} />
              </summary>
              <div className="details-body">
                Standard delivery is complimentary over the site threshold.
                Returns are accepted on eligible unworn pieces within 30 days.
              </div>
            </details>
          </div>
        </div>
      </div>
      <ProductRecommendations
        product={p}
        products={products}
        wish={wish}
        onToggleWish={onToggleWish}
        onNavigate={onNavigate}
        onAddCart={onAddCart}
        onNotify={onNotify}
      />
      {lightbox && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLightbox(false);
          }}
        >
          <div
            style={{
              position: "absolute",
              inset: "5vh 5vw",
              display: "grid",
              placeItems: "center",
            }}
          >
            <button
              className="close-btn"
              style={{ position: "absolute", top: 0, right: 0 }}
              onClick={() => setLightbox(false)}
              aria-label="Close viewer"
            >
              <Icon name="close" />
            </button>
            <SmartImage
              src={images[active]}
              fallbackSrc={productImage(p)}
              alt={`${p.name} large view`}
              className="lb-img"
            />
          </div>
        </div>
      )}
    </div>
  );
}

function ProductRecommendations({
  product,
  products,
  wish,
  onToggleWish,
  onNavigate,
  onAddCart,
  onNotify,
}: {
  product: Product;
  products: Product[];
  wish: Product[];
  onToggleWish: (p: Product) => void;
  onNavigate: (x: string) => void;
  onAddCart: (
    p: Product,
    size?: string,
    color?: string,
    qty?: number,
  ) => Promise<boolean>;
  onNotify?: (s: string) => void;
}) {
  const related = products
    .filter(
      (x) =>
        x.id !== product.id &&
        x.status === "ACTIVE" &&
        (x.gender === product.gender ||
          x.category?.slug === product.category?.slug),
    )
    .slice(0, 4);
  const recently =
    typeof window !== "undefined"
      ? (() => {
          try {
            return JSON.parse(
              localStorage.getItem("atelier_recently_viewed") || "[]",
            ) as string[];
          } catch {
            return [];
          }
        })()
      : [];
  const recentProducts = recently
    .map((id) => products.find((x) => x.id === id))
    .filter(Boolean)
    .filter((x) => x!.id !== product.id)
    .slice(0, 4) as Product[];
  return (
    <>
      <section className="pdp-story">
        <div>
          <div className="eyebrow">Complete the Look</div>
          <h2>Build the full silhouette.</h2>
          <p>
            Pair this piece with complementary ATELIER proportions and tones.
          </p>
        </div>
        <div className="look-mini">
          {related.slice(0, 3).map((x) => (
            <button
              key={x.id}
              className="look-row"
              onClick={() => onNavigate(`/product/${x.id}`)}
            >
              <span>{x.name}</span>
              <b>{money(x.price)}</b>
            </button>
          ))}
          {related.length > 1 && (
            <button
              className="btn"
              style={{ marginTop: 16 }}
              onClick={() =>
                related[0] && onNavigate(`/product/${related[0].id}`)
              }
            >
              Build the look
            </button>
          )}
        </div>
      </section>
      {related.length > 0 && (
        <section className="editorial-products">
          <div className="wrap">
            <div className="section-head">
              <div>
                <div className="eyebrow">You may also like</div>
                <h2>Related pieces.</h2>
              </div>
            </div>
            <div className="product-grid">
              {related.map((x) => (
                <ProductCard
                  key={x.id}
                  p={x}
                  saved={wish.some((w) => w.id === x.id)}
                  onNavigate={onNavigate}
                  onToggleWish={onToggleWish}
                  onAddCart={onAddCart}
                />
              ))}
            </div>
          </div>
        </section>
      )}
      {recentProducts.length > 0 && (
        <section className="editorial-products">
          <div className="wrap">
            <div className="section-head">
              <div>
                <div className="eyebrow">Continue exploring</div>
                <h2>Recently viewed.</h2>
              </div>
            </div>
            <div className="product-grid">
              {recentProducts.map((x) => (
                <ProductCard
                  key={x.id}
                  p={x}
                  saved={wish.some((w) => w.id === x.id)}
                  onNavigate={onNavigate}
                  onToggleWish={onToggleWish}
                  onAddCart={onAddCart}
                />
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function CartDrawer({
  cart,
  products,
  onClose,
  onNavigate,
  onChangeQty,
  onRemoveCart,
}: {
  cart: CartItem[];
  products: Product[];
  onClose: () => void;
  onNavigate: (x: string) => void;
  onChangeQty: (i: CartItem, d: number) => void;
  onRemoveCart: (i: CartItem) => void;
}) {
  const subtotal = cart.reduce((s, i) => s + i.product.price * i.quantity, 0);
  const threshold = 3000;
  const remaining = Math.max(0, threshold - subtotal);
  const progress = Math.min(100, Math.round((subtotal / threshold) * 100));
  return (
    <div
      className="overlay cart-drawer-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <aside className="cart-drawer">
        <div className="drawer-head">
          <div>
            <div className="eyebrow">ATELIER / Bag</div>
            <h2 className="serif">Your Bag</h2>
          </div>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close shopping bag"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="drawer-items">
          {cart.length ? (
            cart.map((i) => (
              <div className="drawer-item" key={i.id}>
                <SmartImage
                  src={productImage(i.product)}
                  alt={i.product.name}
                />
                <div>
                  <button
                    className="drawer-name"
                    onClick={() => {
                      onClose();
                      onNavigate(`/product/${i.product.id}`);
                    }}
                  >
                    {i.product.name}
                  </button>
                  <small>
                    {i.color} / {i.size}
                  </small>
                  <div className="quantity">
                    <button
                      onClick={() => onChangeQty(i, -1)}
                      aria-label="Decrease quantity"
                    >
                      <Icon name="minus" size={13} />
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      onClick={() => onChangeQty(i, 1)}
                      aria-label="Increase quantity"
                    >
                      <Icon name="plus" size={13} />
                    </button>
                  </div>
                </div>
                <b>{money(i.product.price * i.quantity)}</b>
                <button
                  className="remove"
                  onClick={() => onRemoveCart(i)}
                  aria-label={`Remove ${i.product.name}`}
                >
                  <Icon name="trash" size={14} />
                </button>
              </div>
            ))
          ) : (
            <div className="empty">
              <div className="eyebrow">THE NEXT SCENE</div>
              <h2>Your next look<br />starts here.</h2>
              <p>Choose a piece and we’ll keep it ready for checkout.</p>
              <button
                className="btn"
                onClick={() => {
                  onClose();
                  onNavigate("/shop");
                }}
              >
                Explore collection
              </button>
              <div className="cart-recommendations" aria-label="Featured pieces">
                {products.slice(0, 2).map((product) => (
                  <button className="cart-recommendation" key={product.id} onClick={() => { onClose(); onNavigate(`/product/${product.id}`); }}>
                    <SmartImage src={productImage(product)} alt={product.name} />
                    <span><b>{product.name}</b><small>{money(product.price)}</small></span>
                    <Icon name="arrow" size={13} />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="drawer-foot">
          {cart.length > 0 && (
            <div className="ship-progress">
              <div className="ship-progress-head">
                <span>
                  {remaining
                    ? `Add ${money(remaining)} more for complimentary shipping.`
                    : "Complimentary shipping unlocked."}
                </span>
                <b>{progress}%</b>
              </div>
              <div className="ship-progress-track">
                <span style={{ width: `${progress}%` }} />
              </div>
            </div>
          )}
          <div className="summary-row total">
            <span>Subtotal</span>
            <b>{money(subtotal)}</b>
          </div>
          <p className="checkout-note">
            Shipping and delivery timing are confirmed at checkout.
          </p>
          <button
            className="btn checkout-cta"
            disabled={!cart.length}
            onClick={() => {
              onClose();
              onNavigate("/checkout");
            }}
          >
            Checkout
          </button>
          <button
            className="btn dark"
            onClick={() => {
              onClose();
              onNavigate("/cart");
            }}
          >
            View full bag
          </button>
        </div>
      </aside>
    </div>
  );
}
function CartPage({ cart, onNavigate, onChangeQty, onRemoveCart }: any) {
  const subtotal = cart.reduce(
    (s: number, i: CartItem) => s + i.product.price * i.quantity,
    0,
  );
  const shipping = subtotal >= 3000 || subtotal === 0 ? 0 : 199;
  return (
    <div className="wrap">
      <div className="page-hero">
        <div className="breadcrumb">
          Home <span>/</span> Cart
        </div>
        <h1>
          Your Cart (
          {cart.reduce((s: number, i: CartItem) => s + i.quantity, 0)})
        </h1>
        <p>Pieces selected for your wardrobe.</p>
      </div>
      {cart.length ? (
        <div className="cart-layout">
          <section className="cart-items">
            {cart.map((i: CartItem) => (
              <div className="cart-item" key={i.id}>
                <div className="cart-thumb">
                  <SmartImage
                    src={productImage(i.product)}
                    alt={i.product.name}
                  />
                </div>
                <div>
                  <button
                    className="btn text"
                    onClick={() => onNavigate(`/product/${i.product.id}`)}
                  >
                    <span className="item-name">{i.product.name}</span>
                  </button>
                  <div className="item-variant">
                    {i.color} / {i.size}
                  </div>
                  <div className="quantity">
                    <button
                      onClick={() => onChangeQty(i, -1)}
                      aria-label="Decrease quantity"
                    >
                      <Icon name="minus" size={14} />
                    </button>
                    <span>{i.quantity}</span>
                    <button
                      onClick={() => onChangeQty(i, 1)}
                      aria-label="Increase quantity"
                    >
                      <Icon name="plus" size={14} />
                    </button>
                  </div>
                </div>
                <div className="item-price">
                  {money(i.product.price * i.quantity)}
                </div>
                <button
                  className="remove"
                  onClick={() => onRemoveCart(i)}
                  aria-label={`Remove ${i.product.name}`}
                >
                  <Icon name="trash" size={15} />
                </button>
              </div>
            ))}
          </section>
          <OrderSummary
            subtotal={subtotal}
            shipping={shipping}
            onNavigate={onNavigate}
          />
        </div>
      ) : (
        <div className="empty">
          <div className="eyebrow">ATELIER / Cart</div>
          <h2>Your cart is waiting.</h2>
          <p>The pieces you add will wait here.</p>
          <button
            className="btn"
            style={{ marginTop: 20 }}
            onClick={() => onNavigate("/shop")}
          >
            Explore Collection
          </button>
        </div>
      )}
    </div>
  );
}
function OrderSummary({
  subtotal,
  shipping,
  onNavigate,
  buttonText = "Proceed to Checkout",
  action = true,
}: {
  subtotal: number;
  shipping: number;
  onNavigate: (x: string) => void;
  buttonText?: string;
  action?: boolean;
}) {
  const total = subtotal + shipping;
  return (
    <aside className="summary">
      <h3>Order Summary</h3>
      <div className="summary-row">
        <span>Subtotal</span>
        <b>{money(subtotal)}</b>
      </div>
      <div className="summary-row">
        <span>Shipping</span>
        <b>{shipping ? money(shipping) : "Free"}</b>
      </div>
      <div className="summary-row total">
        <span>Total</span>
        <b>{money(total)}</b>
      </div>
      {action && (
        <button
          className="btn"
          style={{ width: "100%", marginTop: 18 }}
          onClick={() => onNavigate("/checkout")}
          disabled={!subtotal}
        >
          {buttonText}
        </button>
      )}
      <button
        className="btn dark"
        style={{ width: "100%", marginTop: action ? 8 : 18 }}
        onClick={() => onNavigate("/shop")}
      >
        Continue Shopping
      </button>
      <div className="trust-strip">
        <div className="trust">Secure Payment</div>
        <div className="trust">Fast Delivery</div>
        <div className="trust">Easy Returns</div>
      </div>
    </aside>
  );
}

function Auth({
  register,
  onSetUser,
  onMergeGuestCart,
  onNavigate,
  onNotify,
  cmsPage,
}: any) {
  const returnTo = useMemo(() => {
    if (typeof window === "undefined") return "/";
    const candidate = new URLSearchParams(window.location.search).get("returnTo");
    return candidate && candidate.startsWith("/") && !candidate.startsWith("//") ? candidate : "/";
  }, []);
  const strongPassword =
    /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{12,128}$/;
  const [mode, setMode] = useState<"password" | "otp" | "reset">("password");
  const [step, setStep] = useState<"form" | "verify">("form");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);
  const [authError, setAuthError] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const normalizedEmail = email.trim().toLowerCase();
  const cmsHero =
    (cmsPage?.sections || []).find(
      (x: CmsSection) => x.visible && x.type === "HERO",
    )?.content || {};
  const defaultAuthImages = register
    ? [AUTH_IMAGES.register]
    : [AUTH_IMAGES.login];
  const rotationImages =
    Array.isArray(cmsHero.rotationImages) && cmsHero.rotationImages.length
      ? cmsHero.rotationImages.filter((x: any) => typeof x === "string")
      : defaultAuthImages;
  const [imageIndex, setImageIndex] = useState(0);
  useEffect(() => {
    setImageIndex(0);
  }, [register, cmsPage?.id]);
  useEffect(() => {
    if (!cmsHero.autoRotate || rotationImages.length < 2) return;
    const ms = Math.max(
      1000,
      Number(cmsHero.intervalMs || cmsHero.interval || 2000),
    );
    const id = window.setInterval(
      () => setImageIndex((v) => (v + 1) % rotationImages.length),
      ms,
    );
    return () => window.clearInterval(id);
  }, [
    cmsHero.autoRotate,
    cmsHero.intervalMs,
    cmsHero.interval,
    rotationImages.length,
  ]);
  const [address, setAddress] = useState<any>({
    firstName: "",
    lastName: "",
    phone: "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  });
  const updateAddress = (k: string, v: string) =>
    setAddress((a: any) => ({ ...a, [k]: v }));
  const validEmail = (value: string) =>
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
  const requestOtp = async (purpose: string) => {
    if (!validEmail(normalizedEmail)) throw new Error("EMAIL_INVALID");
    await api("/auth/otp/request", {
      method: "POST",
      body: JSON.stringify({ email: normalizedEmail, purpose }),
    });
    setOtp("");
    setStep("verify");
    onNotify("A verification code was sent to your email.");
  };
  const validateOtp = () => {
    if (!/^\d{6}$/.test(otp)) throw new Error("OTP_MUST_BE_SIX_DIGITS");
  };
  const submit = async (e: any) => {
    e.preventDefault();
    setAuthError("");
    if (busy) return;
    try {
      if (!validEmail(normalizedEmail)) throw new Error("EMAIL_INVALID");
      if (register) {
        if (step === "form") {
          if (name.trim().length < 2) throw new Error("NAME_INVALID");
          if (!/^(?:\+91[- ]?)?[6-9]\d{9}$/.test(phone.trim()))
            throw new Error("PHONE_INVALID");
          if (!strongPassword.test(password))
            throw new Error("PASSWORD_POLICY_FAILED");
          if (
            !address.firstName.trim() ||
            !address.lastName.trim() ||
            address.firstName.trim().length > 80 ||
            address.lastName.trim().length > 80 ||
            !address.city.trim() ||
            address.city.trim().length < 2 ||
            !address.state.trim() ||
            address.state.trim().length < 2 ||
            !address.country.trim()
          )
            throw new Error("ADDRESS_REQUIRED");
          if (address.addressLine1.trim().length < 5)
            throw new Error("ADDRESS_LINE_INVALID");
          if (!/^\d{6}$/.test(address.postalCode))
            throw new Error("PIN_INVALID");
          if (!acceptedTerms) throw new Error("TERMS_REQUIRED");
          setBusy(true);
          const payload = {
            name: name.trim(),
            email: normalizedEmail,
            phone: phone.trim(),
            password,
            acceptedTerms: true,
            address: {
              ...address,
              firstName: address.firstName.trim(),
              lastName: address.lastName.trim(),
              addressLine1: address.addressLine1.trim(),
              city: address.city.trim(),
              state: address.state.trim(),
              postalCode: address.postalCode.trim(),
              country: address.country.trim(),
              phone: address.phone.trim() || phone.trim(),
            },
          };
          await api("/auth/register", {
            method: "POST",
            body: JSON.stringify(payload),
          });
          setOtp("");
          setStep("verify");
          onNotify(
            "Account details accepted. Check your inbox and spam folder for the 6-digit verification code.",
          );
          return;
        }
        validateOtp();
        setBusy(true);
        const r = await api<{ user: User }>("/auth/register/verify", {
          method: "POST",
          body: JSON.stringify({ email: normalizedEmail, code: otp }),
        });
        onSetUser(r.user);
        await onMergeGuestCart?.();
        onNotify("Account verified successfully.");
        onNavigate(returnTo);
        return;
      }
      if (mode === "otp") {
        if (step === "form") {
          setBusy(true);
          await requestOtp("LOGIN");
          return;
        }
        validateOtp();
        setBusy(true);
        const r = await api<{ user: User }>("/auth/otp/login", {
          method: "POST",
          body: JSON.stringify({ email: normalizedEmail, code: otp }),
        });
        if (r.user.role === "ADMIN") throw new Error("INVALID_CREDENTIALS");
        onSetUser(r.user);
        await onMergeGuestCart?.();
        onNotify("Signed in successfully.");
        onNavigate(returnTo);
        return;
      }
      if (mode === "reset") {
        if (step === "form") {
          setBusy(true);
          await api("/auth/password-reset/request", {
            method: "POST",
            body: JSON.stringify({ email: normalizedEmail }),
          });
          setStep("verify");
          setOtp("");
          onNotify(
            "Password reset code sent. Check your inbox and spam folder.",
          );
          return;
        }
        validateOtp();
        if (!strongPassword.test(password))
          throw new Error("PASSWORD_POLICY_FAILED");
        setBusy(true);
        const r = await api<{ user: User }>("/auth/password-reset/confirm", {
          method: "POST",
          body: JSON.stringify({ email: normalizedEmail, code: otp, password }),
        });
        if (r.user.role === "ADMIN") throw new Error("INVALID_CREDENTIALS");
        onSetUser(r.user);
        onNotify("Password changed successfully.");
        onNavigate(returnTo);
        return;
      }
      if (!password) throw new Error("PASSWORD_REQUIRED");
      setBusy(true);
      // The same sign-in form serves both roles. The backend returns ADMIN only after
      // verifying the stored admin password and then sets the separate HttpOnly admin cookie.
      const r = await api<{ user: User }>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email: normalizedEmail, password }),
      });
      if (r.user.role === "ADMIN") {
        onSetUser(r.user);
        onNotify("🎉 Welcome, Admin. Your studio is ready.");
        onNavigate(ADMIN_ROUTE);
        return;
      }
      if (r.user.role !== "USER") throw new Error("INVALID_CREDENTIALS");
      onSetUser(r.user);
      await onMergeGuestCart?.();
      onNotify(`🎉 Welcome${r.user.name ? `, ${r.user.name}` : " to ATELIER"}! Your story continues.`);
      onNavigate(returnTo);
    } catch (e: any) {
      const message = authErrorText(e);
      setAuthError(message);
      onNotify(message);
    } finally {
      setBusy(false);
    }
  };
  const changeMode = (next: "password" | "otp" | "reset") => {
    setMode(next);
    setStep("form");
    setOtp("");
    setAuthError("");
    setPassword("");
  };
  return (
    <div className="auth">
      <div
        className={`auth-image ${register ? "auth-image-register" : ""}`}
        style={
          Number(cmsHero.imageHeight) > 0
            ? {
                height: `${Number(cmsHero.imageHeight)}px`,
                minHeight: 0,
                alignSelf: "start",
              }
            : undefined
        }
      >
        {(rotationImages.length ? rotationImages : defaultAuthImages).map(
          (src: string, i: number) => (
            <SmartImage
              key={src + i}
              className={`auth-slide ${i === imageIndex ? "on" : ""}`}
              src={src}
              alt={
                register
                  ? "ATELIER register editorial"
                  : "ATELIER login editorial"
              }
              priority={i === 0}
              style={{
                objectFit: cmsHero.fit === "contain" ? "contain" : "cover",
                objectPosition: cmsHero.position || "center top",
              }}
            />
          ),
        )}
        <div className="auth-caption">
          <div className="eyebrow">{cmsHero.eyebrow || "ATELIER / 2026"}</div>
          <h2>
            {cmsHero.captionTitle || "A wardrobe with a quieter point of view."}
          </h2>
          {cmsHero.captionText && <p>{cmsHero.captionText}</p>}
        </div>
      </div>
      <section className="auth-panel">
        <div className="auth-inner">
          <div className="eyebrow">
            {register ? "Create your account" : "Private access"}
          </div>
          <h1>
            {cmsHero.panelTitle || (register ? "Join ATELIER" : "Welcome Back")}
          </h1>
          <p className="auth-sub">
            {cmsHero.panelText ||
              (register
                ? "Create a verified ATELIER account with a real email, valid Indian mobile number and delivery location."
                : mode === "reset"
                  ? "Reset your password securely with an email OTP."
                  : "Sign in securely to your ATELIER account.")}
          </p>
          {register && (
            <div className="auth-progress">
              <span className={step === "form" ? "active" : "done"}>
                01 Details
              </span>
              <span className={step === "verify" ? "active" : ""}>
                02 Verify email
              </span>
            </div>
          )}
          {!register && (
            <div className="auth-tabs">
              <button
                type="button"
                className={mode === "password" ? "active" : ""}
                onClick={() => changeMode("password")}
              >
                Password
              </button>
              <button
                type="button"
                className={mode === "otp" ? "active" : ""}
                onClick={() => changeMode("otp")}
              >
                Email OTP
              </button>
            </div>
          )}
          {authError && (
            <div className="auth-error" role="alert" aria-live="assertive">
              <strong>We couldn't complete this step</strong>
              <span>{authError}</span>
            </div>
          )}
          <form
            className="auth-form"
            noValidate
            onChange={() => {
              if (authError) setAuthError("");
            }}
            onSubmit={submit}
          >
            {register && step === "form" && (
              <>
                <div className="auth-group-title">Your details</div>
                <div className="field">
                  <label htmlFor="atelier-auth-name">Full name</label>
                  <input
                    id="atelier-auth-name"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Your full name"
                    autoComplete="name"
                    maxLength={80}
                  />
                </div>
                <div className="field">
                  <label htmlFor="atelier-auth-email">Email address</label>
                  <input
                    id="atelier-auth-email"
                    required
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    autoComplete="email"
                    maxLength={254}
                  />
                </div>
                <div className="field">
                  <label htmlFor="atelier-auth-phone">Mobile number</label>
                  <input
                    id="atelier-auth-phone"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="10-digit Indian mobile"
                    autoComplete="tel"
                    inputMode="tel"
                    maxLength={14}
                  />
                </div>
                <div className="field">
                  <label htmlFor="atelier-auth-password">Password</label>
                  <div className="password-wrap">
                    <input
                      id="atelier-auth-password"
                      required
                      minLength={12}
                      maxLength={128}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value.slice(0, 128))
                      }
                      placeholder="12+ characters"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="password-hint">
                    <span>12+ chars · upper · lower · number · symbol</span>
                    <span
                      className={strongPassword.test(password) ? "ready" : ""}
                    >
                      {strongPassword.test(password)
                        ? "Ready"
                        : "Secure password required"}
                    </span>
                  </div>
                </div>
                <div className="auth-group-title">Delivery address</div>
                <div className="checkout-card compact-auth">
                  <div className="form-grid">
                    <Field
                      label="First Name"
                      value={address.firstName}
                      onChange={(v) => updateAddress("firstName", v)}
                      required
                    />
                    <Field
                      label="Last Name"
                      value={address.lastName}
                      onChange={(v) => updateAddress("lastName", v)}
                      required
                    />
                    <Field
                      label="Address"
                      value={address.addressLine1}
                      onChange={(v) => updateAddress("addressLine1", v)}
                      required
                      full
                    />
                    <Field
                      label="Apartment / Suite (optional)"
                      value={address.addressLine2}
                      onChange={(v) => updateAddress("addressLine2", v)}
                      full
                    />
                    <Field
                      label="City"
                      value={address.city}
                      onChange={(v) => updateAddress("city", v)}
                      required
                    />
                    <Field
                      label="State"
                      value={address.state}
                      onChange={(v) => updateAddress("state", v)}
                      required
                    />
                    <Field
                      label="PIN code (6 digits)"
                      value={address.postalCode}
                      onChange={(v) =>
                        updateAddress(
                          "postalCode",
                          v.replace(/\D/g, "").slice(0, 6),
                        )
                      }
                      required
                    />
                    <Field
                      label="Country"
                      value={address.country}
                      onChange={(v) => updateAddress("country", v)}
                      required
                    />
                  </div>
                </div>
                <label className="auth-consent">
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                  />
                  <span>
                    I agree to the <a href="/about#terms">Terms of Service</a>{" "}
                    and acknowledge the{" "}
                    <a href="/about#privacy">Privacy Policy</a>.
                  </span>
                </label>
              </>
            )}
            {!register && (
              <div className="field">
                <label htmlFor="atelier-login-email">Email address</label>
                <input
                  id="atelier-login-email"
                  required
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  maxLength={254}
                />
              </div>
            )}
            {!register && mode !== "otp" && mode !== "reset" && (
              <div className="field">
                <label htmlFor="atelier-login-password">Password</label>
                <div className="password-wrap">
                  <input
                    id="atelier-login-password"
                    required
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value.slice(0, 128))}
                    placeholder="Your password"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            )}
            {!register && mode === "otp" && step === "verify" && (
              <div className="field">
                <label htmlFor="atelier-login-otp">Email OTP</label>
                <input
                  id="atelier-login-otp"
                  required
                  inputMode="numeric"
                  maxLength={6}
                  value={otp}
                  onChange={(e) =>
                    setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                  }
                  placeholder="6-digit code"
                  autoComplete="one-time-code"
                />
              </div>
            )}
            {!register && mode === "reset" && step === "verify" && (
              <>
                <div className="field">
                  <label htmlFor="atelier-reset-otp">Email OTP</label>
                  <input
                    id="atelier-reset-otp"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6-digit code"
                    autoComplete="one-time-code"
                  />
                </div>
                <div className="field">
                  <label htmlFor="atelier-reset-password">New password</label>
                  <div className="password-wrap">
                    <input
                      id="atelier-reset-password"
                      required
                      minLength={12}
                      maxLength={128}
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) =>
                        setPassword(e.target.value.slice(0, 128))
                      }
                      placeholder="12+ characters"
                      autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? "Hide" : "Show"}
                    </button>
                  </div>
                  <div className="password-hint">
                    <span>12+ chars · upper · lower · number · symbol</span>
                    <span
                      className={strongPassword.test(password) ? "ready" : ""}
                    >
                      {strongPassword.test(password)
                        ? "Ready"
                        : "Secure password required"}
                    </span>
                  </div>
                </div>
              </>
            )}
            {register && step === "verify" && (
              <>
                <p className="auth-verify-note">
                  Enter the 6-digit code sent to{" "}
                  <strong>{normalizedEmail}</strong>. The code expires after 10
                  minutes.
                </p>
                <div className="field">
                  <label htmlFor="atelier-register-otp">
                    Email verification code
                  </label>
                  <input
                    id="atelier-register-otp"
                    required
                    inputMode="numeric"
                    maxLength={6}
                    value={otp}
                    onChange={(e) =>
                      setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="6-digit code"
                    autoComplete="one-time-code"
                  />
                </div>
              </>
            )}
            <button disabled={busy} className="btn" type="submit">
              {busy
                ? "Please wait…"
                : register
                  ? step === "form"
                    ? "Send verification code"
                    : "Verify & Create Account"
                  : mode === "otp"
                    ? step === "form"
                      ? "Send Email OTP"
                      : "Verify & Sign In"
                    : mode === "reset"
                      ? step === "form"
                        ? "Send Reset OTP"
                        : "Reset Password"
                      : "Sign In"}
            </button>
            {!register && mode === "password" && (
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="btn text"
                  onClick={() => changeMode("reset")}
                >
                  Forgot password?
                </button>
              </div>
            )}
            {!register && mode !== "otp" && mode !== "reset" && (
              <button
                type="button"
                className="btn dark"
                onClick={() => changeMode("otp")}
              >
                Use email OTP instead
              </button>
            )}
            {!register && mode === "reset" && (
              <button
                type="button"
                className="btn dark"
                onClick={() => changeMode("password")}
              >
                Back to sign in
              </button>
            )}
            {!register && step === "verify" && (
              <button
                type="button"
                className="btn text"
                onClick={() => {
                  setStep("form");
                  setOtp("");
                  setAuthError("");
                }}
              >
                Change email / start again
              </button>
            )}
          </form>
          <div className="auth-switch">
            {register ? (
              <>
                Already a member?{" "}
                <button
                  type="button"
                  className="btn text"
                  onClick={() => onNavigate("/login")}
                >
                  Sign in
                </button>
              </>
            ) : (
              <>
                Don't have an account?{" "}
                <button
                  type="button"
                  className="btn text"
                  onClick={() => onNavigate("/register")}
                >
                  Create one
                </button>
              </>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}

function Checkout({
  cart,
  user,
  settings,
  onNavigate,
  onNotify,
  onSetCart,
}: any) {
  const [address, setAddress] = useState<Address>({
    firstName: user?.name?.split(" ")[0] || "",
    lastName: user?.name?.split(" ").slice(1).join(" ") || "",
    phone: user?.phone || "",
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
  });
  const [savedAddresses, setSavedAddresses] = useState<Address[]>([]);
  const [method, setMethod] = useState<"qr" | "razorpay">("razorpay");
  const [shippingError, setShippingError] = useState("");
  const [shipping, setShipping] = useState("standard");
  const [qr, setQr] = useState<any>(null);
  const [utr, setUtr] = useState("");
  const [busy, setBusy] = useState(false);
  const subtotal = cart.reduce(
    (s: number, i: CartItem) => s + i.product.price * i.quantity,
    0,
  );
  const shippingCost =
    shipping === "express" ? 499 : subtotal >= 3000 ? 0 : 199;
  const update = (k: keyof Address, v: string) => {
    setAddress((a) => ({ ...a, [k]: v }));
    setShippingError("");
  };
  useEffect(() => {
    if (!user) return;
    (async () => {
      try {
        const saved = await api<Address[]>("/addresses");
        setSavedAddresses(saved);
        const preferred = saved.find((a) => a.isDefault) || saved[0];
        if (preferred) setAddress({ ...preferred });
      } catch (e) {
        console.warn("Saved addresses unavailable", e);
      }
    })();
  }, [user]);
  useEffect(() => {
    if (user?.phone && !address.phone)
      setAddress((a) => ({ ...a, phone: user.phone }));
  }, [user]);
  if (!user)
    return (
      <div className="wrap empty">
        <div className="eyebrow">ATELIER / Checkout</div>
        <h2>Sign in to continue.</h2>
        <p className="checkout-auth-note">
          Your bag is saved in this browser. Sign in or create an account to continue to secure checkout.
        </p>
        <div className="checkout-auth-actions">
          <button
            className="btn"
            onClick={() => onNavigate("/login?returnTo=%2Fcheckout")}
          >
            Sign In
          </button>
          <button
            className="btn secondary"
            onClick={() => onNavigate("/register?returnTo=%2Fcheckout")}
          >
            Create Account
          </button>
          <button className="text-link" onClick={() => onNavigate("/cart")}>
            Return to bag
          </button>
        </div>
      </div>
    );
  if (!cart.length)
    return (
      <div className="wrap empty">
        <div className="eyebrow">ATELIER / Checkout</div>
        <h2>Your cart is empty.</h2>
        <button className="btn" onClick={() => onNavigate("/shop")}>
          Explore Collection
        </button>
      </div>
    );
  const validateShipping = () => {
    const phone = address.phone.replace(/[\s\-()]/g, "");
    const postalCode = address.postalCode.replace(/\s+/g, "");
    const issue = !address.firstName.trim()
      ? "Enter your first name."
      : !address.lastName.trim()
        ? "Enter your last name."
        : !(/^(?:\+?91)?[6-9]\d{9}$/.test(phone) || /^\d{10,12}$/.test(phone))
          ? "Enter a valid 10 digit mobile number."
          : address.addressLine1.trim().length < 3
            ? "Enter a delivery address with at least 3 characters."
            : address.city.trim().length < 2
              ? "Enter your city."
              : address.state.trim().length < 2
                ? "Enter your state."
                : !/^\d{5,8}$/.test(postalCode)
                  ? "Enter a valid PIN or postal code (5–8 digits)."
                  : "";
    setShippingError(issue);
    if (issue) onNotify(issue);
    return !issue;
  };
  const safeAddress = {
    ...address,
    lastName: address.lastName?.trim() || address.firstName?.trim() || "Customer",
    country: address.country || "India",
  };
  const startQr = async () => {
    if (!validateShipping()) return;
    setBusy(true);
    try {
      const r = await api<any>("/payments/qr/create", {
        method: "POST",
        body: JSON.stringify({ address: safeAddress, shippingMethod: shipping }),
      });
      setQr(r);
      onNotify(
        "Secure payment QR created. Complete the payment and verify it here.",
      );
    } catch (e: any) {
      onNotify(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const verifyQr = async () => {
    if (!qr) return;
    if (qr.requiresUtr && !utr.trim())
      return onNotify(
        "Enter the UTR / payment reference so the server can match your payment.",
      );
    setBusy(true);
    try {
      const r = await api<any>("/payments/qr/verify", {
        method: "POST",
        body: JSON.stringify({
          intentId: qr.intentId,
          address: safeAddress,
          utr: utr || undefined,
        }),
      });
      if (r.paid) {
        onSetCart([]);
        try {
          localStorage.removeItem(localKey);
        } catch {}
        onNotify("✨ Payment complete — thank you for your order!");
        onNavigate(`/account/orders/${r.order.id}`);
      } else onNotify(r.message || "Payment not verified yet.");
    } catch (e: any) {
      onNotify(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const startDemoPay = async () => {
    if (!validateShipping()) return;
    setBusy(true);
    try {
      const r = await api<any>("/payments/checkout/order", {
        method: "POST",
        body: JSON.stringify({ address: safeAddress, shippingMethod: shipping }),
      });
      const out = await api<any>("/payments/checkout/demo-pay", {
        method: "POST",
        body: JSON.stringify({ intentId: r.intentId }),
      });
      onSetCart([]);
      try {
        localStorage.removeItem(localKey);
      } catch {}
      onNotify("✨ Demo payment complete — thank you for your order!");
      onNavigate(`/account/orders/${out.order.id}`);
    } catch (e: any) {
      onNotify(errorText(e));
    } finally {
      setBusy(false);
    }
  };
  const startRazorpay = async () => {
    if (!validateShipping()) return;
    setBusy(true);
    try {
      const r = await api<any>("/payments/checkout/order", {
        method: "POST",
        body: JSON.stringify({ address: safeAddress, shippingMethod: shipping }),
      });
      await loadRazorpay();
      const Razorpay = (window as any).Razorpay;
      const rp = new Razorpay({
        key: r.keyId,
        amount: r.amount,
        currency: r.currency,
        name: "ATELIER",
        description: "ATELIER purchase",
        order_id: r.orderId,
        // In test mode, do not attach the customer's phone to Razorpay Checkout:
        // that can silently enter Razorpay's saved-card account flow, which asks
        // for an OTP before the test payment form. Live mode keeps the useful phone prefill.
        prefill: {
          name: user.name,
          email: user.email,
          ...(!String(r.keyId || "").startsWith("rzp_test_")
            ? { contact: user.phone }
            : {}),
        },
        theme: { color: "#050505" },
        handler: async (response: any) => {
          try {
            const out = await api<any>("/payments/checkout/verify", {
              method: "POST",
              body: JSON.stringify({
                intentId: r.intentId,
                razorpayOrderId: response.razorpay_order_id,
                razorpayPaymentId: response.razorpay_payment_id,
                razorpaySignature: response.razorpay_signature,
                address: safeAddress,
              }),
            });
            onSetCart([]);
            try {
              localStorage.removeItem(localKey);
            } catch {}
            onNotify("Payment complete. Your order is confirmed.");
            onNavigate(`/account/orders/${out.order.id}`);
          } catch (e: any) {
            onNotify(errorText(e));
          } finally {
            setBusy(false);
          }
        },
      });
      rp.on("payment.failed", (response: any) => {
        setBusy(false);
        const description = String(response?.error?.description || "");
        const isTestMode = String(r.keyId || "").startsWith("rzp_test_");
        if (isTestMode && /international cards are not supported/i.test(description)) {
          onNotify("This saved card is international and is not enabled for this Razorpay test account. Retry with an Indian domestic test card, UPI, or netbanking.");
          return;
        }
        onNotify(description || "Payment failed. No order was created.");
      });
      rp.open();
    } catch (e: any) {
      setBusy(false);
      onNotify(errorText(e));
    }
  };
  return (
    <div className="wrap">
      <div className="page-hero">
        <div className="checkout-steps">
          <span className="done">01 Cart</span>
          <span className="active">02 Information</span>
          <span>03 Shipping</span>
          <span>04 Payment</span>
        </div>
        <h1>Checkout</h1>
        <p>A quiet, distraction-free purchase experience.</p>
      </div>
      <div className="checkout-layout">
        <section>
          {Array.isArray(savedAddresses) && savedAddresses.length > 0 && (
            <div className="checkout-card saved-address-picker">
              <h3>Use a saved address</h3>
              <select
                className="sort"
                value={address.id || ""}
                onChange={(e) => {
                  const selected = savedAddresses.find(
                    (a) => a.id === e.target.value,
                  );
                  if (selected) setAddress({ ...selected });
                  else if (!e.target.value)
                    setAddress({
                      firstName: user?.name?.split(" ")[0] || "",
                      lastName: user?.name?.split(" ").slice(1).join(" ") || "",
                      phone: user?.phone || "",
                      addressLine1: "",
                      addressLine2: "",
                      city: "",
                      state: "",
                      postalCode: "",
                      country: "India",
                    });
                }}
              >
                <option value="">Enter a new address</option>
                {savedAddresses.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.isDefault ? "Default · " : ""}
                    {a.city} · {a.addressLine1}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div className="checkout-card">
            <h3>Shipping information</h3>
            <div className="form-grid">
              <Field
                label="First Name"
                value={address.firstName}
                onChange={(v) => update("firstName", v)}
                required
              />
              <Field
                label="Last Name"
                value={address.lastName}
                onChange={(v) => update("lastName", v)}
                required
              />
              <Field
                label="Email"
                value={user.email}
                onChange={() => {}}
                disabled
              />
              <Field
                label="Phone"
                value={address.phone}
                onChange={(v) => update("phone", v)}
                required
              />
              <Field
                label="Address"
                value={address.addressLine1}
                onChange={(v) => update("addressLine1", v)}
                required
                full
              />
              <Field
                label="Apartment / Suite"
                value={address.addressLine2 || ""}
                onChange={(v) => update("addressLine2", v)}
                full
              />
              <Field
                label="City"
                value={address.city}
                onChange={(v) => update("city", v)}
                required
              />
              <Field
                label="State"
                value={address.state}
                onChange={(v) => update("state", v)}
                required
              />
              <Field
                label="Postal Code"
                value={address.postalCode}
                onChange={(v) => update("postalCode", v)}
                required
              />
              <Field
                label="Country"
                value={address.country}
                onChange={(v) => update("country", v)}
                required
              />
            </div>
          </div>
          <div className="checkout-card">
            <h3>Shipping method</h3>
            <div
              className="shipping-options"
              role="radiogroup"
              aria-label="Shipping method"
            >
              <button
                className={`option ${shipping === "standard" ? "active" : ""}`}
                role="radio"
                aria-checked={shipping === "standard"}
                onClick={() => {
                  setShipping("standard");
                  setQr(null);
                  setUtr("");
                }}
              >
                <span className="option-left">
                  <span className="option-radio" aria-hidden="true" />
                  Standard Delivery · 3–5 working days
                </span>
                <span>{shippingCost === 0 ? "Free" : money(199)}</span>
              </button>
              <button
                className={`option ${shipping === "express" ? "active" : ""}`}
                role="radio"
                aria-checked={shipping === "express"}
                onClick={() => {
                  setShipping("express");
                  setQr(null);
                  setUtr("");
                }}
              >
                <span className="option-left">
                  <span className="option-radio" aria-hidden="true" />
                  Express Delivery · 1–2 working days
                </span>
                <span>{money(499)}</span>
              </button>
            </div>
          </div>
          <div className="checkout-card">
            {shippingError && (
              <p className="checkout-validation-error" role="alert" aria-live="polite">
                {shippingError}
              </p>
            )}
            <h3>Payment</h3>
            <div className="secure-strip">
              <Icon name="shield" size={16} />
              <div>
                <b>Secure checkout</b>
                <span>
                  Your payment is verified server-side before an order is
                  created.
                </span>
              </div>
            </div>
            <div
              className="payment-options"
              role="radiogroup"
              aria-label="Payment method"
            >
              <button
                className={`option ${method === "razorpay" ? "active" : ""}`}
                role="radio"
                aria-checked={method === "razorpay"}
                onClick={() => setMethod("razorpay")}
              >
                <span className="option-left">
                  <span className="option-radio" aria-hidden="true" />
                  Card · UPI · Net Banking · Wallets
                </span>
              </button>{" "}
              <button
                className={`option ${method === "qr" ? "active" : ""}`}
                role="radio"
                aria-checked={method === "qr"}
                onClick={() => setMethod("qr")}
              >
                <span className="option-left">
                  <span className="option-radio" aria-hidden="true" />
                  Pay securely with UPI QR
                </span>
              </button>
            </div>
            {method === "qr" ? (
              <div className="qr-box">
                {settings?.paymentQrUrl && (
                  <div style={{ marginBottom: 18 }}>
                    <div className="eyebrow">ATELIER Store QR</div>
                    <img
                      src={String(settings.paymentQrUrl)}
                      alt="ATELIER store UPI payment QR"
                      style={{
                        width: 190,
                        height: 190,
                        objectFit: "contain",
                        background: "#fff",
                        padding: 10,
                        margin: "10px auto 0",
                        display: "block",
                      }}
                      onError={(e) => {
                        e.currentTarget.style.display = "none";
                      }}
                    />
                    <div
                      className="checkout-note"
                      style={{ textAlign: "center", marginTop: 8 }}
                    >
                      Store QR is displayed for reference. Order confirmation
                      still requires gateway verification.
                    </div>
                  </div>
                )}
                {qr ? (
                  <>
                    <img
                      src={qr.imageUrl || FALLBACK}
                      alt="ATELIER secure payment QR"
                    />
                    {qr.staticQrUrl && (
                      <div
                        style={{
                          marginTop: 12,
                          fontSize: 11,
                          color: "var(--muted)",
                        }}
                      >
                        Store UPI QR configured in admin.
                      </div>
                    )}
                    <div style={{ fontSize: 12 }}>
                      Amount to pay: <b>{money(qr.amount)}</b>
                    </div>
                    <input
                      className="utr"
                      value={utr}
                      onChange={(e) => setUtr(e.target.value)}
                      placeholder={
                        qr.requiresUtr
                          ? "Enter UTR / payment reference"
                          : "Optional UTR / reference number"
                      }
                      required={Boolean(qr.requiresUtr)}
                    />
                    <button
                      className="btn"
                      style={{ marginTop: 10, width: "100%" }}
                      disabled={busy}
                      onClick={verifyQr}
                    >
                      {busy ? "Checking…" : "I have paid — Verify payment"}
                    </button>
                    <p className="checkout-note">
                      The server checks the gateway payment record. An order is
                      created only after a captured payment is verified.
                    </p>
                  </>
                ) : (
                  <>
                    <div className="eyebrow">Secure UPI QR</div>
                    <p className="checkout-note">
                      A unique QR is generated for this checkout amount. Your
                      store/static QR can also be managed from Admin → Site
                      Settings.
                    </p>
                    <button className="btn" onClick={startQr} disabled={busy}>
                      {busy ? "Creating QR…" : "Show secure payment QR"}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="qr-box">
                <div className="eyebrow">Razorpay Checkout</div>
                <p className="checkout-note">
                  Card, UPI, Net Banking and Wallets are handled inside the
                  secure gateway. The backend verifies the payment signature and
                  captured status before creating the order.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginTop: 12 }}>
                  <button className="btn" onClick={startRazorpay} disabled={busy} style={{ flex: "1 1 200px" }}>
                    {busy ? "Opening secure payment…" : "Pay with Razorpay"}
                  </button>
                  {process.env.NODE_ENV !== "production" && (
                    <button
                      type="button"
                      className="btn text"
                      onClick={startDemoPay}
                      disabled={busy}
                      style={{
                        border: "1px dashed var(--c-line, #666)",
                        color: "var(--c-acid, #d7ff55)",
                        padding: "10px 16px",
                        borderRadius: 2,
                      }}
                      title="Simulate instant payment in local development"
                    >
                      ⚡ Test Payment (Local Demo)
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </section>
        <OrderSummary
          subtotal={subtotal}
          shipping={shippingCost}
          onNavigate={onNavigate}
          action={false}
        />
      </div>
    </div>
  );
}
function Field({
  label,
  value,
  onChange,
  required,
  full,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  full?: boolean;
  disabled?: boolean;
}) {
  const id = useId();
  const fieldKey = label.trim().toLowerCase();
  const autofill: Record<string, { name: string; autoComplete: string }> = {
    "first name": { name: "address-given-name", autoComplete: "given-name" },
    "last name": { name: "address-family-name", autoComplete: "family-name" },
    address: { name: "address-line1", autoComplete: "address-line1" },
    "apartment / suite (optional)": {
      name: "address-line2",
      autoComplete: "address-line2",
    },
    city: { name: "address-level2", autoComplete: "address-level2" },
    state: { name: "address-level1", autoComplete: "address-level1" },
    "pin code (6 digits)": { name: "postal-code", autoComplete: "postal-code" },
    "postal code": { name: "postal-code", autoComplete: "postal-code" },
    country: { name: "country-name", autoComplete: "country-name" },
    phone: { name: "address-tel", autoComplete: "tel" },
  };
  const attrs = autofill[fieldKey] || {
    name: `atelier-${fieldKey.replace(/[^a-z0-9]+/g, "-")}`,
    autoComplete: "off",
  };
  return (
    <div className={`field ${full ? "full" : ""}`}>
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        name={attrs.name}
        autoComplete={attrs.autoComplete}
        type={fieldKey === "email address" ? "email" : fieldKey === "mobile phone" || fieldKey === "phone" ? "tel" : "text"}
        inputMode={fieldKey.includes("pin") || fieldKey.includes("postal") ? "numeric" : undefined}
        autoCapitalize="words"
        spellCheck={false}
        required={required}
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
function loadRazorpay() {
  return new Promise<void>((resolve, reject) => {
    if ((window as any).Razorpay) return resolve();
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("PAYMENT_SCRIPT_LOAD_FAILED"));
    document.body.appendChild(s);
  });
}

declare global {
  interface Window {
    Razorpay: any;
  }
}

function Collections({
  products = [],
  categories = [],
  wish = [],
  onNavigate,
  onAddCart,
  onToggleWish,
}: any) {
  const [filter, setFilter] = useState<
    "all" | "men" | "women" | "indo" | "western"
  >("all");

  const menProducts = useMemo(
    () =>
      products.filter(
        (p: Product) => p.status === "ACTIVE" && p.gender === "Men",
      ),
    [products],
  );
  const womenProducts = useMemo(
    () =>
      products.filter(
        (p: Product) => p.status === "ACTIVE" && p.gender === "Women",
      ),
    [products],
  );
  const indoProducts = useMemo(
    () =>
      products.filter(
        (p: Product) =>
          p.status === "ACTIVE" &&
          (p.collectionType === "WOMEN_INDO_WESTERN" ||
            p.category?.slug === "indo-western" ||
            p.category?.slug === "kurtas"),
      ),
    [products],
  );
  const westernProducts = useMemo(
    () =>
      products.filter(
        (p: Product) =>
          p.status === "ACTIVE" &&
          (p.collectionType === "WOMEN_WESTERN" ||
            p.category?.slug === "dresses"),
      ),
    [products],
  );

  const chapters = [
    {
      id: "01",
      slug: "men",
      code: "CHAPTER 01 // MENSWEAR",
      title: "The Disciplined Cut.",
      subtitle:
        "Sharp wool, heavy jersey, and relaxed city tailoring built to live beyond seasonal trends.",
      route: "/shop?gender=Men",
      image: "/images/cinematic/menCollection.webp",
      tag: "12 PIECES AVAILABLE // AUTUMN-WINTER 2026",
      coords: "35.6762° N / 139.6503° E",
      fabrics: "TECHNICAL WOOL · RAW DENIM · HIGH-TWIST COTTON",
      products: menProducts.slice(0, 4),
    },
    {
      id: "02",
      slug: "women",
      code: "CHAPTER 02 // WOMENSWEAR",
      title: "Fluid Volume & Proportion.",
      subtitle:
        "Tactile weaves, architectural shapes, and garments sculpted to move naturally with human posture.",
      route: "/shop?gender=Women",
      image: "/images/cinematic/womenCollection.webp",
      tag: "20 PIECES AVAILABLE // CORE ANTHOLOGY",
      coords: "48.8566° N / 2.3522° E",
      fabrics: "FLUID SATIN · DOUBLE-FACED CREPE · STRUCTURED SEAMS",
      products: womenProducts.slice(0, 4),
    },
    {
      id: "03",
      slug: "indo",
      code: "CHAPTER 03 // INDO-WESTERN EDIT",
      title: "Tradition, Re-Cut for Now.",
      subtitle:
        "Modern Indian drape, asymmetric dhoti trousers, and clean western tailoring in seamless dialogue.",
      route: "/indo-western",
      image: "/images/cinematic/palazzo.webp",
      tag: "CULTURAL DIALOGUE // HERITAGE REINTERPRETED",
      coords: "28.6139° N / 77.2090° E",
      fabrics: "BANDHANI EMBOSS · ASYMMETRIC DHOTI · TEXTURED KURTA",
      products: indoProducts.slice(0, 4),
    },
    {
      id: "04",
      slug: "western",
      code: "CHAPTER 04 // WESTERN EDIT",
      title: "Contemporary Evening & Form.",
      subtitle:
        "Sculptural column dresses, tailored blazers, and clean separates shaped by modern European restraint.",
      route: "/western",
      image: "/images/cinematic/womenBlazer.webp",
      tag: "EDITORIAL FORM // MONOCHROMATIC LUXURY",
      coords: "40.7128° N / 74.0060° W",
      fabrics: "SCULPTED COLUMN · SATIN COWL · NOTCHED LAPEL",
      products: westernProducts.slice(0, 4),
    },
  ];

  const visibleChapters =
    filter === "all" ? chapters : chapters.filter((c) => c.slug === filter);

  return (
    <div className="cin-collections-page" aria-label="Collections anthology">
      {/* Cinematic Anthology Hero */}
      <section className="cin-collection-hero">
        <div className="cin-collection-topline">
          <span className="cin-topline-pill">
            <span className="cin-pill-dot" /> ATELIER ARCHIVE // 2026.V21
          </span>
          <span className="cin-topline-coords">
            28.6139° N / 77.2090° E · GEO.INDEX
          </span>
        </div>

        <div className="cin-collection-hero-main">
          <div className="cin-micro">THE COMPLETE ANTHOLOGY</div>
          <h1 className="cin-collection-title">
            Disciplined form.
            <br />
            <em>Fluid movement.</em>
          </h1>
          <p className="cin-collection-desc">
            Four distinct chapters bridging modern Indian proportions,
            architectural tailoring, and enduring wardrobe infrastructure. Every
            piece traces to verified workshop craftsmanship.
          </p>

          {/* Interactive Filter Pills */}
          <div
            className="cin-collection-filter-bar"
            role="tablist"
            aria-label="Filter collections"
          >
            <button
              role="tab"
              aria-selected={filter === "all"}
              className={`cin-coll-filter-btn ${filter === "all" ? "active" : ""}`}
              onClick={() => setFilter("all")}
            >
              ALL EDITS <span className="cin-badge-count">04</span>
            </button>
            <button
              role="tab"
              aria-selected={filter === "men"}
              className={`cin-coll-filter-btn ${filter === "men" ? "active" : ""}`}
              onClick={() => setFilter("men")}
            >
              MENSWEAR{" "}
              <span className="cin-badge-count">{menProducts.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={filter === "women"}
              className={`cin-coll-filter-btn ${filter === "women" ? "active" : ""}`}
              onClick={() => setFilter("women")}
            >
              WOMENSWEAR{" "}
              <span className="cin-badge-count">{womenProducts.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={filter === "indo"}
              className={`cin-coll-filter-btn ${filter === "indo" ? "active" : ""}`}
              onClick={() => setFilter("indo")}
            >
              INDO-WESTERN{" "}
              <span className="cin-badge-count">{indoProducts.length}</span>
            </button>
            <button
              role="tab"
              aria-selected={filter === "western"}
              className={`cin-coll-filter-btn ${filter === "western" ? "active" : ""}`}
              onClick={() => setFilter("western")}
            >
              WESTERN EDIT{" "}
              <span className="cin-badge-count">{westernProducts.length}</span>
            </button>
          </div>
        </div>
      </section>

      {/* Chapters Exhibition Showcase */}
      <div className="cin-chapters-container">
        {visibleChapters.map((ch) => (
          <article
            className="cin-chapter-block"
            key={ch.id}
            id={`chapter-${ch.slug}`}
          >
            {/* Split Top Header */}
            <div className="cin-chapter-header">
              <div className="cin-chapter-header-left">
                <span className="cin-chapter-num">{ch.id}</span>
                <div>
                  <span className="cin-chapter-code">{ch.code}</span>
                  <h2 className="cin-chapter-heading">{ch.title}</h2>
                  <p className="cin-chapter-sub">{ch.subtitle}</p>
                </div>
              </div>
              <div className="cin-chapter-header-right">
                <div className="cin-fabrics-tag">
                  <span className="cin-spec-dot">✳</span> {ch.fabrics}
                </div>
                <button
                  className="cin-btn light"
                  onClick={() => onNavigate(ch.route)}
                >
                  EXPLORE {ch.slug.toUpperCase()} ↗
                </button>
              </div>
            </div>

            {/* Split Feature Stage: Editorial Visual + Curated Database Grid */}
            <div className="cin-chapter-stage-split">
              {/* Left Key Visual */}
              <div className="cin-chapter-poster">
                <button
                  className="cin-poster-hit"
                  onClick={() => onNavigate(ch.route)}
                  aria-label={`View full ${ch.title}`}
                >
                  <SmartImage
                    src={ch.image}
                    alt={ch.title}
                    fallbackSrc={FALLBACK}
                  />
                  <div className="cin-poster-overlay">
                    <span className="cin-poster-badge">{ch.tag}</span>
                    <span className="cin-poster-coords">{ch.coords}</span>
                  </div>
                  <span className="cin-poster-action">VIEW EDITORIAL ↗</span>
                </button>
              </div>

              {/* Right Curated Real Products Grid */}
              <div className="cin-chapter-products">
                <div className="cin-products-strip-head">
                  <span className="cin-strip-title">
                    CURATED ARCHIVE PIECES
                  </span>
                  <button
                    className="cin-view-link"
                    onClick={() => onNavigate(ch.route)}
                  >
                    VIEW ALL{" "}
                    {ch.slug === "men"
                      ? menProducts.length
                      : ch.slug === "women"
                        ? womenProducts.length
                        : ch.slug === "indo"
                          ? indoProducts.length
                          : westernProducts.length}{" "}
                    PIECES →
                  </button>
                </div>
                <div className="cin-mini-product-grid">
                  {ch.products.map((p: Product) => (
                    <ProductCard
                      key={p.id}
                      p={p}
                      saved={wish.some((w: Product) => w.id === p.id)}
                      onNavigate={onNavigate}
                      onToggleWish={onToggleWish}
                      onAddCart={onAddCart}
                    />
                  ))}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {/* Bottom Architectural Benefits & Studio Guarantee */}
      <section className="cin-home-benefits cin-collections-footer">
        <div>
          <b>01 // ZERO SLOP</b>
          <strong>VERIFIABLE DATA</strong>
          <span>
            Real inventory and physical fabrics directly connected to our
            atelier archive.
          </span>
        </div>
        <div>
          <b>02 // 3D PROPORTIONS</b>
          <strong>ANATOMICAL BALANCE</strong>
          <span>
            Precision patterns calibrated for unrestricted natural movement
            across life.
          </span>
        </div>
        <div>
          <b>03 // TIMELESS FORM</b>
          <strong>DESIGNED TO ENDURE</strong>
          <span>
            High-density natural fibres crafted for longevity beyond seasonal
            churn.
          </span>
        </div>
      </section>
    </div>
  );
}

function EditorialCollectionPage({
  title,
  kicker,
  description,
  products,
  onNavigate,
  onToggleWish,
  onAddCart,
  wish,
  kind,
}: {
  title: string;
  kicker: string;
  description: string;
  products: Product[];
  onNavigate: (x: string) => void;
  onToggleWish: (p: Product) => void;
  onAddCart: (
    p: Product,
    size?: string,
    color?: string,
    qty?: number,
  ) => Promise<boolean>;
  wish: Product[];
  kind: "indo" | "western";
}) {
  const target = kind === "indo" ? "WOMEN_INDO_WESTERN" : "WOMEN_WESTERN";
  const featured = products.filter(
    (p: Product) =>
      p.status === "ACTIVE" &&
      p.gender === "Women" &&
      p.collectionType === target,
  );
  return (
    <div className={`editorial-collection-page ${kind}`}>
      <section className="editorial-collection-hero">
        <div className="wrap">
          <div className="eyebrow">{kicker}</div>
          <h1>{title}</h1>
          <p>{description}</p>
          <div className="editorial-collection-actions">
            <button
              className="btn peach"
              onClick={() =>
                onNavigate(
                  kind === "indo"
                    ? "/shop?collectionType=WOMEN_INDO_WESTERN"
                    : "/shop?collectionType=WOMEN_WESTERN",
                )
              }
            >
              Shop All Pieces <Icon name="arrow" size={13} />
            </button>
            <button
              className="btn text"
              onClick={() => onNavigate("/collections")}
            >
              Back to Collections
            </button>
          </div>
        </div>
      </section>
      <section className="editorial-collection-intro">
        <div className="wrap">
          <div>
            <div className="eyebrow">The Edit</div>
            <h2>
              {kind === "indo"
                ? "Tradition, re-cut for now."
                : "Modern silhouettes, quietly refined."}
            </h2>
          </div>
          <p>
            {kind === "indo"
              ? "Fluid drapes, Indian craft references and contemporary tailoring brought together without costume or excess."
              : "Clean tailoring, dresses and elevated separates designed around proportion, texture and everyday confidence."}
          </p>
        </div>
      </section>
      <section className="editorial-collection-products">
        <div className="wrap">
          <div className="section-head">
            <div>
              <div className="eyebrow">{featured.length} Pieces</div>
              <h2>Shop the edit.</h2>
            </div>
          </div>
          {featured.length ? (
            <div className="product-grid">
              {featured.map((p: Product) => (
                <ProductCard
                  key={p.id}
                  p={p}
                  saved={wish.some((w: Product) => w.id === p.id)}
                  onNavigate={onNavigate}
                  onToggleWish={onToggleWish}
                  onAddCart={onAddCart}
                />
              ))}
            </div>
          ) : (
            <div className="empty">
              <h2>Coming soon.</h2>
              <p>This edit is being prepared.</p>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

const isIndoWesternProduct = (p: Product) =>
  p.gender === "Women" && p.collectionType === "WOMEN_INDO_WESTERN";

function IndoWesternPage({
  products,
  onNavigate,
  onToggleWish,
  onAddCart,
  wish,
}: any) {
  const filtered = (products as Product[]).filter(isIndoWesternProduct);
  return (
    <EditorialCollectionPage
      title="Indo-Western Edit"
      kicker="ATELIER / CULTURAL EDIT"
      description="Indian proportion meets contemporary tailoring — drape, structure and modern ease in one distinctive wardrobe."
      products={filtered}
      onNavigate={onNavigate}
      onToggleWish={onToggleWish}
      onAddCart={onAddCart}
      wish={wish}
      kind="indo"
    />
  );
}

function WesternPage({
  products,
  onNavigate,
  onToggleWish,
  onAddCart,
  wish,
}: any) {
  const filtered = (products as Product[]).filter(
    (p: Product) =>
      p.gender === "Women" && p.collectionType === "WOMEN_WESTERN",
  );
  return (
    <EditorialCollectionPage
      title="Western Edit"
      kicker="ATELIER / MODERN WARDROBE"
      description="Contemporary dresses, tailoring and clean everyday pieces shaped by a modern European point of view."
      products={filtered}
      onNavigate={onNavigate}
      onToggleWish={onToggleWish}
      onAddCart={onAddCart}
      wish={wish}
      kind="western"
    />
  );
}
function About({ onNavigate }: any) {
  return (
    <div className="wrap cinematic-about-wrap" style={{ paddingBottom: 120 }}>
      {/* 1. Cinematic Billboard Hero */}
      <section className="about-hero cin-about-hero" style={{ padding: "60px 0 40px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--c-line, rgba(255,255,255,0.1))", paddingBottom: 14, marginBottom: 30 }}>
          <div className="eyebrow" style={{ color: "var(--c-acid, #d7ff55)", margin: 0 }}>
            ATELIER ARCHIVE // REEL 24
          </div>
          <span style={{ fontFamily: "monospace", fontSize: 11, color: "var(--muted)", letterSpacing: "0.15em" }}>
            35MM FILM · 2.39:1 CINEMATIC CUT
          </span>
        </div>
        <h1 style={{ font: "clamp(46px, 6.5vw, 86px)/0.95 var(--c-serif, serif)", letterSpacing: "-0.04em", margin: "20px 0" }}>
          The Architecture of Silhouette.
        </h1>
        <p className="about-intro" style={{ maxWidth: 680, fontSize: "clamp(16px, 1.8vw, 20px)", lineHeight: 1.6, color: "var(--c-paper, #f1eee7)", opacity: 0.88, margin: "0 0 34px" }}>
          ATELIER operates as a moving-image fashion house. We create contemporary garments defined by geometric precision, fluid drape, and uncompromising craftsmanship.
        </p>
        <div
          className="about-image cin-film-frame"
          style={{
            position: "relative",
            aspectRatio: "21/9",
            overflow: "hidden",
            borderRadius: 4,
            border: "1px solid var(--c-line, rgba(255,255,255,0.15))",
            boxShadow: "0 25px 60px rgba(0,0,0,0.5)",
          }}
        >
          <SmartImage
            src="/images/hero/hero-04-wide.jpg"
            fallbackSrc={EDITORIAL_LOCAL_FALLBACKS.concrete}
            alt="ATELIER cinematic fashion lookbook"
            priority
            style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "center center" }}
          />
          <div
            style={{
              position: "absolute",
              bottom: 16,
              left: 20,
              display: "flex",
              gap: 16,
              fontFamily: "monospace",
              fontSize: 11,
              letterSpacing: "0.2em",
              color: "#fff",
              background: "rgba(0,0,0,0.6)",
              padding: "4px 10px",
              borderRadius: 2,
              backdropFilter: "blur(4px)",
            }}
          >
            <span>SCENE: AUTUMN NOIR</span>
            <span>TIMECODE 00:14:28:02</span>
          </div>
        </div>
      </section>

      {/* 2. Screenplay Script Excerpt */}
      <section
        style={{
          margin: "60px 0",
          padding: "36px 40px",
          background: "rgba(255,255,255,0.02)",
          borderLeft: "3px solid var(--c-acid, #d7ff55)",
          borderRadius: 2,
        }}
      >
        <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--c-acid, #d7ff55)", marginBottom: 12, letterSpacing: "0.15em" }}>
          EXT. WORKSHOP / RUNWAY — DUSK
        </div>
        <blockquote style={{ margin: 0, font: "italic clamp(20px, 2.5vw, 28px)/1.4 var(--c-serif, Georgia, serif)", color: "var(--c-paper, #f1eee7)" }}>
          “We do not design garments for mannequins. We design garments for the human silhouette in motion — garments that catch light, carry shadow, and tell an enduring story.”
        </blockquote>
        <div style={{ marginTop: 14, fontSize: 12, color: "var(--muted)", letterSpacing: "0.1em" }}>
          — ATELIER DESIGN PHILOSOPHY
        </div>
      </section>

      {/* 3. Four Filmic Chapters */}
      <section style={{ margin: "70px 0" }}>
        <div className="eyebrow" style={{ color: "var(--c-acid, #d7ff55)", marginBottom: 14 }}>
          THE FOUR ACTS
        </div>
        <h2 className="serif" style={{ fontSize: "clamp(32px, 4vw, 48px)", margin: "0 0 36px" }}>
          Four Pillars of Modern Tailoring.
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
            gap: 24,
          }}
        >
          {[
            {
              num: "ACT I",
              title: "The Noir Palette",
              text: "Rooted in deep obsidian, slate graphite, and bone ecru. Colors chosen to absorb atmospheric lighting and eliminate seasonal obsolescence.",
            },
            {
              num: "ACT II",
              title: "Master Cutters",
              text: "Every coat and co-ord set spends upwards of 36 hours in pattern cutting and hand-basting. Structured shoulders meet effortless drape.",
            },
            {
              num: "ACT III",
              title: "Textile Integrity",
              text: "Heavy gauge Japanese denim, superfine Italian worsted wools, and breathable natural linens selected for how they age and soften.",
            },
            {
              num: "ACT IV",
              title: "Zero Waste Ethos",
              text: "Small-batch seasonal drops. No mass deadstock. Every garment is made with intention, longevity, and repairability engineered in.",
            },
          ].map((act) => (
            <div
              key={act.num}
              className="checkout-card"
              style={{
                background: "rgba(255,255,255,0.02)",
                border: "1px solid var(--c-line, rgba(255,255,255,0.08))",
                padding: "30px 24px",
              }}
            >
              <div style={{ fontFamily: "monospace", fontSize: 11, color: "var(--c-acid, #d7ff55)", marginBottom: 10, letterSpacing: "0.15em" }}>
                {act.num}
              </div>
              <h3 style={{ fontSize: 20, margin: "0 0 12px" }}>{act.title}</h3>
              <p className="muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                {act.text}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* 4. Lookbook Stills Reel */}
      <section style={{ margin: "70px 0" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
          <div>
            <div className="eyebrow" style={{ color: "var(--c-acid, #d7ff55)" }}>FILM REEL</div>
            <h2 className="serif" style={{ fontSize: 28, margin: "6px 0 0" }}>Season Archive Stills</h2>
          </div>
          <button className="btn text" onClick={() => onNavigate("/shop")} style={{ color: "var(--c-acid, #d7ff55)" }}>
            Shop Looks ↗
          </button>
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
            gap: 16,
          }}
        >
          {[
            { src: "/images/collections/winter-edit.jpg", caption: "Look 01 · Overcoat Noir" },
            { src: "/images/cinematic/menCollection.webp", caption: "Look 02 · Tailored Silk Blend" },
            { src: "/images/cinematic/womenCollection.webp", caption: "Look 03 · Trench Silhouette" },
            { src: "/images/cinematic/heroCity.webp", caption: "Look 04 · Editorial Evening" },
          ].map((item, idx) => (
            <div
              key={idx}
              style={{
                position: "relative",
                aspectRatio: "3/4",
                overflow: "hidden",
                borderRadius: 2,
                border: "1px solid var(--c-line, rgba(255,255,255,0.08))",
                background: "#181a17",
              }}
            >
              <img
                src={item.src}
                alt={item.caption}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  objectPosition: "center 12%",
                  transition: "transform 0.6s cubic-bezier(0.2, 0.8, 0.2, 1)",
                }}
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = EDITORIAL_IMAGES.concrete;
                }}
              />
              <div
                style={{
                  position: "absolute",
                  bottom: 0,
                  insetInline: 0,
                  background: "linear-gradient(0deg, rgba(0,0,0,0.85) 0%, transparent 100%)",
                  padding: "24px 14px 12px",
                  fontSize: 11,
                  fontFamily: "monospace",
                  letterSpacing: "0.1em",
                  color: "#fff",
                }}
              >
                {item.caption}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 5. Production Credits & Information Grid */}
      <section className="about-info-grid" aria-label="ATELIER information" style={{ marginTop: 60, borderTop: "1px solid var(--c-line, rgba(255,255,255,0.1))", paddingTop: 40 }}>
        <article id="privacy">
          <div className="eyebrow">Privacy & Security</div>
          <h3>Your data, treated with dignity.</h3>
          <p>
            Customer details, order histories, and payment verification records are guarded with industry-standard cryptographic encryption. We never sell your personal data.
          </p>
        </article>
        <article id="terms">
          <div className="eyebrow">Terms of Service</div>
          <h3>Considered service.</h3>
          <p>
            Curated collections are delivered in tamper-evident protective luxury packaging. Returns and exchanges are welcomed within 14 days of delivery in pristine condition.
          </p>
        </article>
        <article id="cookies">
          <div className="eyebrow">Minimalist footprint</div>
          <h3>Light digital footprint.</h3>
          <p>
            ATELIER operates with zero invasive third-party ad trackers. Essential local cookies persist only to preserve your bag, active wishlist, and secure credentials.
          </p>
        </article>
        <article id="help">
          <div className="eyebrow">Concierge & Client Care</div>
          <h3>Private Client Support</h3>
          <p>
            For bespoke styling guidance, order modifications, or private tailoring inquiries, our concierge is available via the AI Stylist or contact concierge desk.
          </p>
        </article>
      </section>
    </div>
  );
}

function Account({
  user,
  section,
  onNavigate,
  onLogout,
  onNotify,
  wish = [],
  onToggleWish,
  onAddCart,
}: any) {
  const initialTab = String(section || "profile").startsWith("orders") ? "orders" : section === "wishlist" ? "wishlist" : section === "logout" ? "logout" : "profile";
  const [tab, setTab] = useState(initialTab);
  const [orders, setOrders] = useState<any[]>([]);
  const [ordersBusy, setOrdersBusy] = useState(false);
  const selectedOrderId = String(section || "").match(/^orders\/([^/]+)/)?.[1] || "";
  const [profile, setProfile] = useState({
    name: user?.name || "",
    phone: user?.phone || "",
  });
  const [busy, setBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (section) setTab(String(section).startsWith("orders") ? "orders" : section);
  }, [section]);
  useEffect(() => {
    if (tab !== "orders" || !user) return;
    let active = true;
    setOrdersBusy(true);
    api<any[]>("/orders").then((result) => { if (active) setOrders(Array.isArray(result) ? result : []); }).catch((e: any) => { if (active) onNotify(errorText(e.message)); }).finally(() => { if (active) setOrdersBusy(false); });
    return () => { active = false; };
  }, [tab, user?.id, onNotify]);
  useEffect(() => {
    setProfile({ name: user?.name || "", phone: user?.phone || "" });
  }, [user?.id, user?.name, user?.phone]);

  if (!user)
    return (
      <div className="wrap empty">
        <div className="eyebrow">CUSTOMER PORTAL</div>
        <h2>Sign in to view your account.</h2>
        <button className="btn" onClick={() => onNavigate("/login")}>
          Sign In
        </button>
      </div>
    );

  const saveProfile = async () => {
    setBusy(true);
    try {
      await api("/auth/me", { method: "PATCH", body: JSON.stringify(profile) });
      onNotify("Profile updated successfully.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setBusy(false);
    }
  };

  const deleteAccount = async () => {
    setBusy(true);
    try {
      await api("/auth/me", { method: "DELETE" });
      onNotify("Your account has been deleted.");
      if (typeof onLogout === "function") {
        onLogout();
      } else {
        onNavigate("/");
      }
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setBusy(false);
      setDeleteConfirmOpen(false);
    }
  };

  return (
    <div className="wrap" style={{ paddingBottom: 100 }}>
      <div className="page-hero">
        <div className="breadcrumb">
          Home <span>/</span> Account
        </div>
        <h1>Customer Portal</h1>
        <p>{user.email}</p>
      </div>
      <div className="account-grid">
        <aside className="filter-block" style={{ position: "static" }}>
          <div style={{ fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--muted)", marginBottom: 12, fontWeight: 600 }}>
            Account Menu
          </div>
          {[
            ["profile", "1. Profile"],
            ["orders", "2. Orders"],
            ["wishlist", "3. Wishlist"],
          ].map(([id, label]) => (
            <button
              key={id}
              className="btn text"
              style={{
                display: "block",
                padding: "12px 14px",
                width: "100%",
                textAlign: "left",
                fontWeight: tab === id ? 600 : 400,
                color: tab === id ? "var(--c-acid, #d7ff55)" : "var(--c-paper, inherit)",
                background: tab === id ? "rgba(215,255,85,0.08)" : "transparent",
                borderLeft: tab === id ? "3px solid var(--c-acid, #d7ff55)" : "3px solid transparent",
                marginBottom: 4,
                borderRadius: 2,
              }}
              onClick={() => {
                setTab(id);
                onNavigate(id === "wishlist" ? "/account/wishlist" : id === "orders" ? "/account/orders" : "/account/profile");
              }}
            >
              {label}
            </button>
          ))}
          <button
            className="btn text danger-text"
            style={{
              display: "block",
              padding: "12px 14px",
              width: "100%",
              textAlign: "left",
              color: "#ff6b6b",
              marginTop: 8,
              borderLeft: "3px solid transparent",
            }}
            onClick={() => {
              setTab("profile");
              setDeleteConfirmOpen(true);
              onNavigate("/account/profile");
            }}
          >
            Delete account
          </button>
          <button
            className="btn text danger-text"
            style={{
              display: "block",
              padding: "12px 14px",
              width: "100%",
              textAlign: "left",
              color: "#ff6b6b",
              marginTop: 18,
              borderTop: "1px solid var(--c-line, rgba(255,255,255,0.12))",
            }}
            onClick={onLogout}
          >
            Sign out
          </button>
        </aside>
        <section>
          {tab === "orders" && (
            <div className="account-orders">
              <div className="account-orders-heading"><div><div className="eyebrow">CLIENT HISTORY</div><h2 className="serif">Your orders</h2></div><span>{orders.length} {orders.length === 1 ? "order" : "orders"}</span></div>
              {ordersBusy ? <div className="checkout-card">Loading your orders…</div> : orders.length ? <div className="account-order-list">{orders.map((order: any) => <article key={order.id} className={`account-order-card ${selectedOrderId === order.id ? "selected" : ""}`}><button type="button" className="account-order-summary" onClick={() => onNavigate(selectedOrderId === order.id ? "/account/orders" : `/account/orders/${order.id}`)}><span><small>ORDER / {String(order.orderNumber || order.id).slice(-12)}</small><strong>{new Date(order.createdAt).toLocaleDateString()}</strong></span><span><small>{order.paymentStatus || order.status || "PROCESSING"}</small><strong>{money(Number(order.total || 0))}</strong></span><i>{selectedOrderId === order.id ? "−" : "+"}</i></button>{selectedOrderId === order.id && <div className="account-order-details">{(order.items || []).map((item: any, index: number) => <div key={`${item.id || item.productId}-${index}`}><span>{item.productName} · {item.color} / {item.size} × {item.quantity}</span><strong>{money(Number(item.unitPrice || 0) * Number(item.quantity || 0))}</strong></div>)}<p>Delivery address: {typeof order.shippingAddress === "string" ? order.shippingAddress : order.shippingAddress?.line1 ? `${order.shippingAddress.line1}, ${order.shippingAddress.city || ""}` : "See confirmation email"}</p></div>}</article>)}</div> : <div className="checkout-card empty account-orders-empty"><div className="eyebrow">YOUR ARCHIVE</div><h3 className="serif">No orders yet.</h3><p>Your orders will appear here after checkout.</p><button className="btn" onClick={() => onNavigate("/shop")}>Explore the collection</button></div>}
            </div>
          )}
          {tab === "wishlist" && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 20 }}>
                <h3 style={{ margin: 0 }}>Saved Wishlist Pieces</h3>
                <span className="muted" style={{ fontSize: 12 }}>
                  {wish.length} {wish.length === 1 ? "item" : "items"}
                </span>
              </div>
              {wish.length ? (
                <div
                  className="product-grid"
                  style={{
                    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                    gap: 18,
                  }}
                >
                  {wish.map((p: Product) => (
                    <ProductCard
                      key={p.id}
                      p={p}
                      saved
                      onNavigate={onNavigate}
                      onToggleWish={onToggleWish}
                      onAddCart={onAddCart}
                    />
                  ))}
                </div>
              ) : (
                <div
                  className="checkout-card empty"
                  style={{ textAlign: "center", padding: "50px 24px" }}
                >
                  <div className="eyebrow">YOUR COLLECTION</div>
                  <h3 className="serif" style={{ fontSize: 24, margin: "12px 0 8px" }}>
                    Your Wishlist is Empty
                  </h3>
                  <p className="muted" style={{ maxWidth: 360, margin: "0 auto 22px" }}>
                    Browse our contemporary garments and tap the bookmark or heart icon to save looks to your personal archive.
                  </p>
                  <button className="btn" onClick={() => onNavigate("/shop")}>
                    Explore Collection
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === "profile" && (
            <div style={{ display: "grid", gap: 24 }}>
              <div className="checkout-card">
                <h3>Personal Information</h3>
                <div className="form-grid">
                  <Field
                    label="Full Name"
                    value={profile.name}
                    onChange={(v) => setProfile({ ...profile, name: v })}
                    required
                  />
                  <Field
                    label="Email Address"
                    value={user.email}
                    onChange={() => {}}
                    disabled
                  />
                  <Field
                    label="Mobile Phone"
                    value={profile.phone}
                    onChange={(v) => setProfile({ ...profile, phone: v })}
                    required
                  />
                </div>
                <button
                  className="btn"
                  style={{ marginTop: 18 }}
                  onClick={saveProfile}
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Save Changes"}
                </button>
              </div>

              <div
                className="checkout-card"
                style={{
                  border: "1px solid rgba(255, 77, 77, 0.35)",
                  background: "rgba(255, 50, 50, 0.03)",
                }}
              >
                <div className="eyebrow" style={{ color: "#ff6b6b" }}>
                  Danger Zone
                </div>
                <h3 style={{ marginTop: 6 }}>Delete Account</h3>
                <p className="muted" style={{ fontSize: 13, lineHeight: 1.6, margin: "8px 0 16px" }}>
                  Permanently delete your ATELIER account and personal details. Once deleted, your account cannot be recovered.
                </p>
                <button
                  className="btn text danger-text"
                  style={{
                    border: "1px solid #ff6b6b",
                    padding: "10px 18px",
                    color: "#ff6b6b",
                    borderRadius: 2,
                  }}
                  onClick={() => setDeleteConfirmOpen(true)}
                  disabled={busy}
                >
                  Delete My Account
                </button>
              </div>

              {deleteConfirmOpen && (
                <div
                  className="overlay"
                  style={{
                    position: "fixed",
                    inset: 0,
                    background: "rgba(0,0,0,0.8)",
                    backdropFilter: "blur(6px)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    zIndex: 500,
                    padding: 20,
                  }}
                  role="dialog"
                  aria-modal="true"
                >
                  <div
                    className="checkout-card"
                    style={{
                      maxWidth: 440,
                      width: "100%",
                      background: "var(--c-ink, #10140f)",
                      border: "1px solid rgba(255, 77, 77, 0.4)",
                      padding: 28,
                    }}
                  >
                    <div className="eyebrow" style={{ color: "#ff6b6b" }}>
                      Permanent Action
                    </div>
                    <h3 style={{ fontSize: 20, margin: "10px 0" }}>
                      Delete Account Permanently?
                    </h3>
                    <p style={{ fontSize: 13, lineHeight: 1.6, color: "var(--muted)", margin: "0 0 20px" }}>
                      Are you sure you want to permanently delete your account? All your personal information, saved preferences, and access will be completely wiped.
                    </p>
                    <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
                      <button
                        className="btn text"
                        onClick={() => setDeleteConfirmOpen(false)}
                        disabled={busy}
                      >
                        Cancel
                      </button>
                      <button
                        className="btn dark"
                        style={{ background: "#ff4d4d", borderColor: "#ff4d4d", color: "#fff" }}
                        onClick={deleteAccount}
                        disabled={busy}
                      >
                        {busy ? "Deleting…" : "Yes, Delete Account"}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === "logout" && (
            <div className="checkout-card" style={{ textAlign: "center", padding: "40px 20px" }}>
              <div className="eyebrow">SESSION CONTROL</div>
              <h3 style={{ margin: "12px 0 8px" }}>Sign Out of ATELIER</h3>
              <p className="muted" style={{ margin: "0 auto 20px", maxWidth: 360 }}>
                Click below to end your active session and return to the storefront.
              </p>
              <button className="btn dark" onClick={onLogout}>
                Confirm Logout
              </button>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
function AddressBook({
  addresses,
  setAddresses,
  user,
  onNotify,
}: {
  addresses: Address[];
  setAddresses: (a: Address[]) => void;
  user: User;
  onNotify: (x: string) => void;
}) {
  const blank: Address = {
    firstName: user.name.split(" ")[0] || "",
    lastName: user.name.split(" ").slice(1).join(" ") || "",
    phone: user.phone,
    addressLine1: "",
    addressLine2: "",
    city: "",
    state: "",
    postalCode: "",
    country: "India",
    isDefault: addresses.length === 0,
  };
  const [form, setForm] = useState<Address>(blank);
  const [editingId, setEditingId] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const reset = () => {
    setEditingId(undefined);
    setForm({ ...blank, isDefault: addresses.length === 0 });
  };
  const save = async () => {
    setBusy(true);
    try {
      const a = await api<Address>(
        editingId ? `/addresses/${editingId}` : "/addresses",
        { method: editingId ? "PATCH" : "POST", body: JSON.stringify(form) },
      );
      setAddresses(
        editingId
          ? addresses.map((x) => (x.id === a.id ? a : x))
          : [a, ...addresses],
      );
      reset();
      onNotify("Address saved.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setBusy(false);
    }
  };
  const setDefault = async (id: string) => {
    try {
      const a = await api<Address>(`/addresses/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ isDefault: true }),
      });
      setAddresses(
        addresses.map((x) => (x.id === a.id ? a : { ...x, isDefault: false })),
      );
    } catch (e: any) {
      onNotify(errorText(e.message));
    }
  };
  const remove = async (id: string) => {
    try {
      await api(`/addresses/${id}`, { method: "DELETE" });
      const updated = await api<Address[]>("/addresses");
      setAddresses(
        Array.isArray(updated) ? updated : addresses.filter((x) => x.id !== id),
      );
      onNotify("Address removed.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    }
  };
  return (
    <div className="checkout-card address-book">
      <div className="address-head">
        <div>
          <h3>Addresses</h3>
          <p className="muted">Save a delivery address for faster checkout.</p>
        </div>
        {editingId && (
          <button className="btn text" onClick={reset}>
            Cancel
          </button>
        )}
      </div>
      {addresses.length ? (
        <div className="address-list">
          {addresses.map((a) => (
            <div
              className={`address-card ${a.isDefault ? "default" : ""}`}
              key={a.id}
            >
              <div>
                <div className="address-label">
                  {a.isDefault ? "Default address" : "Saved address"}
                </div>
                <div>{formatAddress(a)}</div>
              </div>
              <div className="address-actions">
                <button
                  className="btn text"
                  onClick={() => {
                    setEditingId(a.id);
                    setForm({ ...a });
                  }}
                >
                  Edit
                </button>
                {!a.isDefault && (
                  <button
                    className="btn text"
                    onClick={() => void setDefault(a.id!)}
                  >
                    Set default
                  </button>
                )}
                <button
                  className="btn text danger-text"
                  onClick={() => void remove(a.id!)}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="muted">No saved addresses yet.</div>
      )}
      <div className="address-form">
        <h4>{editingId ? "Edit address" : "Add address"}</h4>
        <div className="form-grid">
          <Field
            label="First Name"
            value={form.firstName}
            onChange={(v) => setForm({ ...form, firstName: v })}
            required
          />
          <Field
            label="Last Name"
            value={form.lastName}
            onChange={(v) => setForm({ ...form, lastName: v })}
            required
          />
          <Field
            label="Phone"
            value={form.phone}
            onChange={(v) => setForm({ ...form, phone: v })}
            required
          />
          <Field
            label="Address"
            value={form.addressLine1}
            onChange={(v) => setForm({ ...form, addressLine1: v })}
            required
            full
          />
          <Field
            label="Apartment / Suite"
            value={form.addressLine2 || ""}
            onChange={(v) => setForm({ ...form, addressLine2: v })}
            full
          />
          <Field
            label="City"
            value={form.city}
            onChange={(v) => setForm({ ...form, city: v })}
            required
          />
          <Field
            label="State"
            value={form.state}
            onChange={(v) => setForm({ ...form, state: v })}
            required
          />
          <Field
            label="Postal Code"
            value={form.postalCode}
            onChange={(v) => setForm({ ...form, postalCode: v })}
            required
          />
          <Field
            label="Country"
            value={form.country}
            onChange={(v) => setForm({ ...form, country: v })}
            required
          />
        </div>
        <label className="check default-check">
          <input
            type="checkbox"
            checked={Boolean(form.isDefault)}
            onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
          />{" "}
          Make this my default address
        </label>
        <button
          className="btn"
          style={{ marginTop: 14 }}
          onClick={() => void save()}
          disabled={busy}
        >
          {busy ? "Saving…" : editingId ? "Update address" : "Save address"}
        </button>
      </div>
    </div>
  );
}
async function fetchOrder(id: string) {
  return api<any>(`/orders/${id}`);
}
function OrderDetails({ id }: { id: string }) {
  const [order, setOrder] = useState<any>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setOrder(null);
    setError("");
    fetchOrder(id)
      .then(setOrder)
      .catch((e: any) => setError(errorText(e.message)));
  }, [id]);
  if (error)
    return (
      <div className="checkout-card">
        <h3>Order</h3>
        <div className="checkout-note" role="alert">
          {error}
        </div>
      </div>
    );
  if (!order)
    return (
      <div className="checkout-card">
        <h3>Order</h3>
        <div className="muted">Loading…</div>
      </div>
    );
  return (
    <div className="checkout-card">
      <h3>{order.orderNumber}</h3>
      <div className="option">
        <span>Status</span>
        <b>{order.status}</b>
      </div>
      <div className="option">
        <span>Payment</span>
        <b>{order.paymentStatus}</b>
      </div>
      <div className="option">
        <span>Shipping</span>
        <span>{order.shipping === 0 ? "Free" : money(order.shipping)}</span>
      </div>
      <div className="option">
        <span>Delivery address</span>
        <span style={{ maxWidth: 520, textAlign: "right" }}>
          {formatAddress(order.shippingAddress || {})}
        </span>
      </div>
      {(Array.isArray(order.items) ? order.items : []).map((i: any) => (
        <div className="cart-item" key={i.id}>
          <div className="cart-thumb">
            <SmartImage src={i.imageUrl} alt={i.productName} />
          </div>
          <div>
            <div className="item-name">{i.productName}</div>
            <div className="item-variant">
              {i.color} / {i.size} · ×{i.quantity}
            </div>
          </div>
          <div>{money(i.unitPrice * i.quantity)}</div>
        </div>
      ))}
    </div>
  );
}
function formatAddress(a: any) {
  return [
    a.firstName + " " + a.lastName,
    a.addressLine1,
    a.addressLine2,
    a.city,
    a.state,
    a.postalCode,
    a.country,
    a.phone,
  ]
    .filter(Boolean)
    .join(", ");
}

function Wishlist({
  wish,
  onNavigate,
  onToggleWish,
  onAddCart,
}: {
  wish: Product[];
  onNavigate: (x: string) => void;
  onToggleWish: (p: Product) => void;
  onAddCart: (
    p: Product,
    size?: string,
    color?: string,
    qty?: number,
  ) => Promise<boolean>;
}) {
  return (
    <div className="wrap" style={{ paddingBottom: 100 }}>
      <div className="page-hero">
        <div className="breadcrumb">
          Home <span>/</span> Wishlist
        </div>
        <h1>Your Wishlist</h1>
        <p>Pieces you've saved to return to.</p>
      </div>
      {wish.length ? (
        <div className="product-grid">
          {wish.map((p: Product) => (
            <ProductCard
              key={p.id}
              p={p}
              saved
              onNavigate={onNavigate}
              onToggleWish={onToggleWish}
              onAddCart={onAddCart}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="eyebrow">ATELIER / Wishlist</div>
          <h2>Your wishlist is empty.</h2>
          <p>Save pieces you want to come back to.</p>
          <button
            className="btn"
            style={{ marginTop: 20 }}
            onClick={() => onNavigate("/shop")}
          >
            Explore Collection
          </button>
        </div>
      )}
    </div>
  );
}

function SearchPage({
  products,
  onNavigate,
  onAddCart,
  onToggleWish,
}: {
  products: Product[];
  onNavigate: (p: string) => void;
  onAddCart: (
    p: Product,
    size?: string,
    color?: string,
    qty?: number,
  ) => Promise<boolean>;
  onToggleWish: (p: Product) => void;
}) {
  const params = useSearchParams();
  const [q, setQ] = useState(params.get("q") || "");
  const res = useMemo(
    () =>
      products.filter(
        (p: Product) =>
          !q ||
          fuzzyMatch(
            q,
            `${p.name} ${p.gender} ${p.category?.name || ""} ${p.type} ${productColors(p).join(" ")}`,
          ),
      ),
    [products, q],
  );

  useEffect(() => {
    const next = params.get("q") || "";
    setQ(next);
  }, [params]);

  return (
    <div className="wrap">
      <div className="page-hero">
        <div className="breadcrumb">
          Home <span>/</span> Search
        </div>
        <h1>Search the Edit</h1>
        <input
          className="search-input"
          style={{
            width: "100%",
            height: 65,
            fontSize: 42,
            borderBottom: "1px solid var(--line)",
          }}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")
              onNavigate(`/search?q=${encodeURIComponent(q.trim())}`);
          }}
          placeholder="Search for products..."
          aria-label="Search for products"
        />
      </div>
      {res.length ? (
        <div className="product-grid" style={{ paddingBottom: 100 }}>
          {res.map((p: Product) => (
            <ProductCard
              key={p.id}
              p={p}
              onNavigate={onNavigate}
              onToggleWish={onToggleWish}
              onAddCart={onAddCart}
            />
          ))}
        </div>
      ) : (
        <div className="empty">
          <div className="eyebrow">ATELIER / Search</div>
          <h2>No pieces found.</h2>
          <p>
            Try a product name, category, colour, or style such as “blazer”,
            “kurta”, or “trouser”.
          </p>
          <button
            className="btn"
            style={{ marginTop: 20 }}
            onClick={() => onNavigate("/shop")}
          >
            Explore Collection
          </button>
        </div>
      )}
    </div>
  );
}

function CustomFit({ products, onNotify, onAddCart }: any) {
  const p =
    products.find((x: Product) => x.name.includes("Blazer")) || products[0];
  const [width, setWidth] = useState(50);
  const [length, setLength] = useState(50);
  const [size, setSize] = useState("M");
  const [color, setColor] = useState(p?.colors?.[0] || "Black");
  const price = (p?.price || 6999) + 750;
  return (
    <div className="wrap" style={{ padding: "32px 0 90px" }}>
      <div className="breadcrumb">
        Home <span>/</span> Custom Fit
      </div>
      <div
        className="pdp-top"
        style={{ gridTemplateColumns: "1.05fr .85fr", marginTop: 18 }}
      >
        <div className="main-image" style={{ cursor: "default" }}>
          <SmartImage
            src={productImage(p) || p?.images?.[0] || PHOTOS[3]}
            fallbackSrc={productImage(p)}
            alt="Custom fit ATELIER model"
          />
        </div>
        <section className="info">
          <div className="category">Made to measure</div>
          <h1>Custom Fit</h1>
          <p className="desc">
            Adjust the proportion of a selected garment before it is made. Your
            measurements stay with your account for the next order.
          </p>
          <span className="field-label">Garment</span>
          <div
            className="option"
            style={{ justifyContent: "flex-start", gap: 12 }}
          >
            <SmartImage
              src={p?.images?.[0] || FALLBACK}
              alt={p?.name || "Garment"}
              style={{ width: 48, height: 60, objectFit: "cover" } as any}
            />
            <span>
              <b>{p?.name}</b>
              <small style={{ display: "block", color: "var(--muted)" }}>
                {money(p?.price || 0)}
              </small>
            </span>
          </div>
          <span className="field-label">Size</span>
          <div className="selectors">
            {["S", "M", "L", "XL"].map((s) => (
              <button
                key={s}
                className={`selector ${s === size ? "active" : ""}`}
                onClick={() => setSize(s)}
              >
                {s}
              </button>
            ))}
          </div>
          <span className="field-label">Colour</span>
          <div className="swatches-large">
            {(p?.colors || ["Black", "Beige"]).map((c: string) => (
              <button
                key={c}
                className={`swatch ${c === color ? "active" : ""}`}
                style={{ background: colorHex[c] || c }}
                onClick={() => setColor(c)}
                title={c}
              />
            ))}
          </div>
          <div
            className="sliders"
            style={{ display: "grid", gap: 18, marginTop: 25 }}
          >
            <label>
              Width{" "}
              <input
                type="range"
                min="0"
                max="100"
                value={width}
                onChange={(e) => setWidth(+e.target.value)}
              />
            </label>
            <label>
              Length{" "}
              <input
                type="range"
                min="0"
                max="100"
                value={length}
                onChange={(e) => setLength(+e.target.value)}
              />
            </label>
          </div>
          <div className="summary-row total" style={{ marginTop: 28 }}>
            <span>Made-to-measure</span>
            <b>{money(price)}</b>
          </div>
          <button
            className="btn"
            style={{ width: "100%", marginTop: 10 }}
            onClick={async () => {
              const ok = await onAddCart(
                { ...p, name: `${p.name} — Custom Fit`, price },
                size,
                color,
                1,
              );
              if (ok) onNotify("Custom fit piece added to your cart.");
            }}
          >
            Add Custom Piece
          </button>
        </section>
      </div>
    </div>
  );
}
function Builder({
  products,
  onNavigate,
  onNotify,
}: {
  products: Product[];
  onNavigate: (path: string) => void;
  onNotify: (message: string) => void;
}) {
  const [top, setTop] = useState<string>("");
  const [bottom, setBottom] = useState<string>("");
  const [outer, setOuter] = useState<string>("");
  const [savedLook, setSavedLook] = useState(false);
  const tops = products.filter((p: Product) =>
    ["Shirts", "T-Shirts", "Knitwear"].includes(p.category?.name || ""),
  );
  const bottoms = products.filter(
    (p: Product) => p.category?.name === "Trousers",
  );
  const outers = products.filter((p: Product) =>
    ["Jackets", "Coats"].includes(p.category?.name || ""),
  );
  const pick = (list: Product[], id: string) =>
    list.find((x) => x.id === id) || list[0];
  useEffect(() => {
    try {
      const saved = JSON.parse(
        localStorage.getItem("atelier_saved_look") || "null",
      );
      setSavedLook(Boolean(saved));
      if (saved?.top && tops.some((p) => p.id === saved.top)) setTop(saved.top);
      if (saved?.bottom && bottoms.some((p) => p.id === saved.bottom))
        setBottom(saved.bottom);
      if (saved?.outer && outers.some((p) => p.id === saved.outer))
        setOuter(saved.outer);
    } catch {}
  }, [products]);
  const saveLook = () => {
    try {
      localStorage.setItem(
        "atelier_saved_look",
        JSON.stringify({
          top,
          bottom,
          outer,
          savedAt: new Date().toISOString(),
        }),
      );
      setSavedLook(true);
      onNotify("Look saved on this device.");
    } catch {
      onNotify("Could not save this look on this device.");
    }
  };
  return (
    <div className="wrap" style={{ padding: "32px 0 90px" }}>
      <div className="breadcrumb">
        Home <span>/</span> Outfit Builder
      </div>
      <div
        className="pdp-top"
        style={{ gridTemplateColumns: ".85fr 1.1fr", marginTop: 18 }}
      >
        <div className="main-image" style={{ cursor: "default" }}>
          <div
            style={{
              position: "absolute",
              inset: 0,
              display: "grid",
              placeItems: "center",
              padding: 30,
            }}
          >
            <div style={{ height: "90%", width: "52%", overflow: "hidden" }}>
              <SmartImage
                src={
                  productImage(pick([...outers, ...tops], outer || top)) ||
                  pick([...outers, ...tops], outer || top)?.images?.[0] ||
                  PHOTOS[3]
                }
                fallbackSrc={productImage(
                  pick([...outers, ...tops], outer || top),
                )}
                alt="ATELIER outfit preview"
              />
            </div>
          </div>
        </div>
        <section className="info">
          <div className="category">Build your look</div>
          <h1>Outfit Builder</h1>
          <p className="desc">
            Layer pieces, swap silhouettes, and save a look you can come back
            to.
          </p>
          <BuilderGroup
            label="Tops"
            items={tops}
            value={top}
            setValue={setTop}
          />
          <BuilderGroup
            label="Bottoms"
            items={bottoms}
            value={bottom}
            setValue={setBottom}
          />
          <BuilderGroup
            label="Outerwear"
            items={outers}
            value={outer}
            setValue={setOuter}
          />
          <div className="summary-row total" style={{ marginTop: 20 }}>
            <span>Look total</span>
            <b>
              {money(
                [top, bottom, outer]
                  .filter(Boolean)
                  .reduce(
                    (s, id) =>
                      s +
                      (products.find((p: Product) => p.id === id)?.price || 0),
                    0,
                  ),
              )}
            </b>
          </div>
          <button
            className="btn"
            style={{ width: "100%", marginTop: 9 }}
            onClick={saveLook}
          >
            {savedLook ? "Look saved" : "Save this look"}
          </button>
          <button
            className="btn dark"
            style={{ width: "100%", marginTop: 8 }}
            onClick={() => onNavigate("/stylist")}
          >
            Ask the stylist
          </button>
        </section>
      </div>
    </div>
  );
}
function BuilderGroup({
  label,
  items,
  value,
  setValue,
}: {
  label: string;
  items: Product[];
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <div style={{ marginTop: 24 }}>
      <span className="field-label">{label}</span>
      <div
        className="looks"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3,1fr)",
          overflow: "visible",
        }}
      >
        {items.slice(0, 6).map((p) => (
          <button
            key={p.id}
            onClick={() => setValue(p.id)}
            style={{
              borderColor: value === p.id ? "var(--accent)" : "var(--line)",
              background: "var(--surface)",
              padding: 0,
            }}
          >
            <SmartImage
              src={productImage(p)}
              alt={p.name}
              className="builder-thumb"
            />
            <span style={{ display: "block", padding: "8px", fontSize: 10 }}>
              {p.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function Stylist({ user, cart, products, onNavigate }: any) {
  return (
    <AtelierAIPanel
      key={user?.id || "guest"}
      user={user}
      cart={cart}
      products={products}
      onClose={() => onNavigate("/")}
      onNavigate={onNavigate}
    />
  );
}

function AdminLivePreview({
  path = "/",
  onClose,
}: {
  path?: string;
  onClose: () => void;
}) {
  const [reload, setReload] = useState(0);
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const deviceRef = useRef<HTMLDivElement | null>(null);
  const [box, setBox] = useState({ w: 0, h: 0 });
  useEffect(() => {
    const el = deviceRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const measure = () =>
      setBox((b) =>
        Math.abs(b.w - el.clientWidth) < 1 &&
        Math.abs(b.h - el.clientHeight) < 1
          ? b
          : { w: el.clientWidth, h: el.clientHeight },
      );
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewport]);
  // Desktop preview renders the storefront at a true 1280px width and scales it down to fit the panel,
  // so "Desktop" really shows the desktop layout even when the panel is narrow.
  const DESKTOP_W = 1280;
  const scale =
    viewport === "desktop" && box.w > 0 ? Math.min(1, box.w / DESKTOP_W) : 1;
  const iframeStyle: React.CSSProperties | undefined =
    viewport === "desktop" && scale < 1
      ? {
          width: DESKTOP_W,
          height: box.h / scale,
          transform: `scale(${scale})`,
          transformOrigin: "0 0",
        }
      : undefined;
  useEffect(() => {
    const refresh = () => setReload((v) => v + 1);
    window.addEventListener("atelier:data-changed", refresh);
    return () => window.removeEventListener("atelier:data-changed", refresh);
  }, []);
  // Always use an absolute URL so the iframe loads the storefront root correctly
  // even when the admin panel is mounted on a different path (e.g. /_atelier-console-8f2d6c).
  const origin = typeof window !== "undefined" ? window.location.origin : "";
  const cleanPath = path || "/";
  const src = `${origin}${cleanPath}${cleanPath.includes("?") ? "&" : "?"}preview=1&v=${reload}`;
  return (
    <aside className="admin-live-preview" aria-label="Live storefront preview">
      <div className="admin-live-preview-head">
        <div>
          <div className="eyebrow">Storefront / Live Preview</div>
          <strong>{path || "/"}</strong>
          <span className="admin-preview-status">
            <i /> Saved changes sync automatically
          </span>
        </div>
        <div className="admin-live-preview-actions">
          <div
            className="admin-preview-switch"
            role="group"
            aria-label="Preview viewport"
          >
            <button
              className={viewport === "desktop" ? "active" : ""}
              onClick={() => setViewport("desktop")}
            >
              Desktop
            </button>
            <button
              className={viewport === "mobile" ? "active" : ""}
              onClick={() => setViewport("mobile")}
            >
              Mobile
            </button>
          </div>
          <button className="btn text" onClick={() => setReload((v) => v + 1)}>
            Refresh
          </button>
          <a
            className="btn text"
            href={`${origin}${cleanPath}`}
            target="_blank"
            rel="noreferrer"
          >
            Open ↗
          </a>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close live preview"
          >
            <Icon name="close" size={16} />
          </button>
        </div>
      </div>
      <div className={`admin-preview-canvas ${viewport}`}>
        <div className="admin-preview-device" ref={deviceRef}>
          <iframe
            key={src}
            src={src}
            title="ATELIER storefront live preview"
            loading="eager"
            style={iframeStyle}
          />
        </div>
      </div>
    </aside>
  );
}

function AdminPageFrame({
  eyebrow,
  title,
  description,
  actions,
  children,
  count,
}: {
  eyebrow: string;
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
  count?: number;
}) {
  return (
    <>
      <div className="admin-toolbar admin-section-toolbar">
        <div>
          <div className="eyebrow">{eyebrow}</div>
          <div className="admin-title-row">
            <h2 className="serif">{title}</h2>
            {typeof count === "number" && (
              <span className="admin-product-count">{count} records</span>
            )}
          </div>
          {description && (
            <p className="admin-section-description">{description}</p>
          )}
        </div>
        <div className="admin-toolbar-actions">{actions}</div>
      </div>
      <div className="admin-data-surface">{children}</div>
    </>
  );
}

function AdminNavigation({
  settings,
  setSettings,
  onNotify,
  onPreview,
}: {
  settings: Record<string, any>;
  setSettings: (x: any) => void;
  onNotify: (x: string) => void;
  onPreview?: (path: string) => void;
}) {
  const [draft, setDraft] = useState(String(settings.navLinks || ""));
  const [saving, setSaving] = useState(false);
  useEffect(
    () => setDraft(String(settings.navLinks || "")),
    [settings.navLinks],
  );
  const save = async () => {
    setSaving(true);
    try {
      const out = await api<Record<string, any>>("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ navLinks: draft }),
      });
      setSettings(out);
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify("Navigation saved.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div className="admin-module">
      <AdminPageFrame
        eyebrow="Website / Navigation"
        title="Navigation"
        description="Manage the storefront menu without touching code."
        actions={
          <div className="admin-toolbar-actions">
            <button className="btn text" onClick={() => onPreview?.("/")}>
              Preview
            </button>
            <button className="btn" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Save navigation"}
            </button>
          </div>
        }
      >
        <div className="admin-card admin-module-card">
          <NavEditor value={draft} onChange={setDraft} />
        </div>
      </AdminPageFrame>
    </div>
  );
}

function AdminTheme({
  settings,
  setSettings,
  onNotify,
  onPreview,
}: {
  settings: Record<string, any>;
  setSettings: (x: any) => void;
  onNotify: (x: string) => void;
  onPreview?: (path: string) => void;
}) {
  const defaults = {
    paper: "#f5f0e9",
    paper2: "#eee6dc",
    ink: "#201914",
    muted: "#746960",
    accent: "#e9b8a5",
    dark: "#19120e",
    brown: "#3a2920",
    radius: 0,
    maxWidth: 1480,
    imageAspect: "4/5",
    imageFit: "contain",
    imageScale: 100,
    imagePadding: 8,
    shopCols: 3,
    homeCols: 5,
    imageQuality: 85,
  };
  const [draft, setDraft] = useState<any>({
    ...defaults,
    ...(settings.theme || {}),
  });
  const [saving, setSaving] = useState(false);
  useEffect(
    () => setDraft({ ...defaults, ...(settings.theme || {}) }),
    [settings.theme],
  );
  const set = (k: string, v: any) => setDraft((d: any) => ({ ...d, [k]: v }));
  const save = async () => {
    setSaving(true);
    try {
      const out = await api<Record<string, any>>("/admin/settings", {
        method: "PUT",
        body: JSON.stringify({ theme: draft }),
      });
      setSettings(out);
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify("Global theme saved.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setSaving(false);
    }
  };
  const Color = ({ k, label }: { k: string; label: string }) => (
    <div className="theme-swatch-field">
      <label>{label}</label>
      <div className="theme-color-row">
        <input
          type="color"
          value={draft[k] || defaults[k as keyof typeof defaults]}
          onChange={(e) => set(k, e.target.value)}
        />
        <input
          value={String(draft[k] || "")}
          onChange={(e) => set(k, e.target.value)}
        />
      </div>
    </div>
  );
  return (
    <div className="admin-module">
      <AdminPageFrame
        eyebrow="Website / Appearance"
        title="Theme Studio"
        description="Control the global visual language used across the storefront."
        actions={
          <div className="admin-toolbar-actions">
            <button className="btn text" onClick={() => onPreview?.("/")}>
              Live Preview
            </button>
            <button className="btn" disabled={saving} onClick={save}>
              {saving ? "Saving…" : "Publish theme"}
            </button>
          </div>
        }
      >
        <div className="theme-studio-grid">
          <section className="admin-card admin-module-card">
            <div className="eyebrow">Palette</div>
            <h3 className="serif">Global colours</h3>
            <div className="theme-color-grid">
              <Color k="paper" label="Paper" />
              <Color k="paper2" label="Surface" />
              <Color k="ink" label="Ink" />
              <Color k="muted" label="Muted" />
              <Color k="accent" label="Accent" />
              <Color k="dark" label="Dark" />
              <Color k="brown" label="Brown" />
            </div>
            <div className="form-grid" style={{ marginTop: 20 }}>
              <RangeControl
                label="Corner radius"
                value={Number(draft.radius || 0)}
                min={0}
                max={32}
                step={1}
                unit="px"
                onChange={(v) => set("radius", v)}
              />
              <RangeControl
                label="Site max width"
                value={Number(draft.maxWidth || 1480)}
                min={960}
                max={1920}
                step={20}
                unit="px"
                onChange={(v) => set("maxWidth", v)}
              />
            </div>
            <div className="field" style={{ marginTop: 18 }}>
              <label>Heading font</label>
              <select
                value={String(draft.headingFont || "Georgia")}
                onChange={(e) => set("headingFont", e.target.value)}
              >
                <option>Georgia</option>
                <option>Times New Roman</option>
                <option>Garamond</option>
              </select>
            </div>
            <div className="field">
              <label>Body font</label>
              <select
                value={String(draft.bodyFont || "Arial")}
                onChange={(e) => set("bodyFont", e.target.value)}
              >
                <option>Arial</option>
                <option>Helvetica</option>
                <option>Verdana</option>
              </select>
            </div>
            <div className="eyebrow" style={{ marginTop: 24 }}>Media & Images</div>
            <h3 className="serif">Storefront Image Controls</h3>
            <p style={{ fontSize: 12, color: "var(--ref-muted)", marginBottom: 14 }}>
              Control product and catalog image sizes, aspect ratios, fit style, card padding, and catalog grid density across the entire site.
            </p>
            <div className="field">
              <label>Product Image Aspect Ratio</label>
              <select
                value={String(draft.imageAspect || "4/5")}
                onChange={(e) => set("imageAspect", e.target.value)}
              >
                <option value="4/5">4:5 — Editorial Portrait (Tall / Luxury)</option>
                <option value="3/4">3:4 — Classic Studio Portrait</option>
                <option value="1/1">1:1 — Clean Square (E-Commerce Standard)</option>
                <option value="16/9">16:9 — Cinematic Landscape</option>
                <option value="auto">Auto / Original ratio</option>
              </select>
            </div>
            <div className="field">
              <label>Image Framing & Fit</label>
              <select
                value={String(draft.imageFit || "contain")}
                onChange={(e) => set("imageFit", e.target.value)}
              >
                <option value="contain">Contain (Show complete silhouette with padding)</option>
                <option value="cover">Cover (Fill entire card edge-to-edge)</option>
              </select>
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <RangeControl
                label="Image Zoom / Scale"
                value={Number(draft.imageScale ?? 100)}
                min={75}
                max={125}
                step={5}
                unit="%"
                onChange={(v) => set("imageScale", v)}
              />
              <RangeControl
                label="Card Image Padding"
                value={Number(draft.imagePadding ?? 8)}
                min={0}
                max={24}
                step={2}
                unit="px"
                onChange={(v) => set("imagePadding", v)}
              />
            </div>
            <div className="form-grid" style={{ marginTop: 14 }}>
              <RangeControl
                label="Shop Catalog Grid Columns"
                value={Number(draft.shopCols || 3)}
                min={2}
                max={5}
                step={1}
                unit="cols"
                onChange={(v) => set("shopCols", v)}
              />
              <RangeControl
                label="Homepage Product Columns"
                value={Number(draft.homeCols || 5)}
                min={2}
                max={6}
                step={1}
                unit="cols"
                onChange={(v) => set("homeCols", v)}
              />
            </div>
            <div style={{ marginTop: 14 }}>
              <RangeControl
                label="Image Compression Quality"
                value={Number(draft.imageQuality || 85)}
                min={50}
                max={98}
                step={5}
                unit="%"
                onChange={(v) => set("imageQuality", v)}
              />
            </div>
          </section>
          <section className="admin-card admin-module-card theme-preview-card">
            <div className="eyebrow">Live design preview</div>
            <div
              className="theme-preview"
              style={{ background: draft.paper, color: draft.ink }}
            >
              <div className="theme-preview-nav">
                <span>ATELIER</span>
                <span>SHOP&nbsp;&nbsp; COLLECTIONS&nbsp;&nbsp; ABOUT</span>
                <span>⌕ ♡ ◫</span>
              </div>
              <div
                className="theme-preview-hero"
                style={{ background: draft.dark }}
              >
                <small style={{ color: draft.accent }}>THE ATELIER EDIT</small>
                <h2
                  style={{ fontFamily: String(draft.headingFont || "Georgia") }}
                >
                  Redefining
                  <br />
                  Modern Luxury
                </h2>
                <p>
                  Everything you see here can be controlled from the admin
                  control room.
                </p>
                <button style={{ background: draft.accent, color: draft.ink }}>
                  EXPLORE
                </button>
              </div>
              <div className="theme-preview-cards">
                <div />
                <div />
                <div />
              </div>
            </div>
          </section>
        </div>
      </AdminPageFrame>
    </div>
  );
}

function AdminMedia({ onNotify }: { onNotify: (x: string) => void }) {
  const [files, setFiles] = useState<any[]>([]);
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [prompt, setPrompt] = useState(
    "Luxury fashion editorial campaign for ATELIER, elegant Indian-European fusion styling, cinematic studio lighting, rich fabric texture, high-end magazine photography, no text or watermark.",
  );
  const [generating, setGenerating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const load = async () => {
    setBusy(true);
    try {
      const v = await api<any[]>("/admin/media");
      setFiles(Array.isArray(v) ? v : []);
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setBusy(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const upload = async (file?: File) => {
    if (!file || uploading) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type))
      return onNotify("Use JPG, PNG or WEBP.");
    if (file.size > 8 * 1024 * 1024)
      return onNotify("Image must be 8 MB or smaller.");
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("IMAGE_READ_FAILED"));
        reader.readAsDataURL(file);
      });
      if (!dataUrl.startsWith("data:image/"))
        throw new Error("IMAGE_READ_FAILED");
      await api("/admin/images/upload", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, dataUrl }),
      });
      onNotify("Image uploaded to Media Library.");
      await load();
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setUploading(false);
    }
  };
  const generate = async () => {
    if (prompt.trim().length < 5)
      return onNotify("Enter a longer image prompt.");
    setGenerating(true);
    try {
      const out = await api<{ url: string }>("/admin/ai/generate-image", {
        method: "POST",
        body: JSON.stringify({ prompt: prompt.trim() }),
      });
      onNotify("AI image generated and saved to Media Library.");
      await load();
      if (out.url) {
        try {
          await navigator.clipboard.writeText(out.url);
        } catch {}
      }
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setGenerating(false);
    }
  };
  const filtered = files.filter(
    (f) => !q || String(f.name).toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <div className="admin-module">
      <AdminPageFrame
        eyebrow="Website / Assets"
        title="Media Library"
        description="Upload existing assets or generate original campaign imagery, then reuse the saved image paths anywhere in the visual builder."
        count={filtered.length}
        actions={
          <div className="admin-toolbar-actions">
            <input
              className="admin-search"
              placeholder="Search media"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label="Search media files by name"
            />
            <label
              className={`btn dark ${busy || uploading ? "is-disabled" : ""}`}
              aria-disabled={busy || uploading}
              style={{ cursor: busy || uploading ? "not-allowed" : "pointer" }}
            >
              {uploading ? "Uploading…" : busy ? "Loading…" : "Upload media"}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                hidden
                disabled={busy || uploading}
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  void upload(file);
                }}
              />
            </label>
            <button
              className="btn text"
              onClick={() => void load()}
              disabled={busy}
            >
              Refresh
            </button>
          </div>
        }
      >
        <section
          className="admin-card admin-module-card"
          style={{ marginBottom: 22 }}
        >
          <div className="eyebrow">AI Studio · Configurable Provider</div>
          <h3 className="serif" style={{ marginTop: 8 }}>
            Generate a new image
          </h3>
          <p className="admin-section-description">
            Describe the image you want. Choose the active image API in Admin →
            AI API Studio; backend/.env image settings remain available as a
            fallback. Generated images are saved directly into this Media
            Library; provider quotas and pricing depend on the configured
            service.
          </p>
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="atelier-ai-image-prompt">Image prompt</label>
            <textarea
              id="atelier-ai-image-prompt"
              rows={4}
              maxLength={1200}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Describe the fashion campaign, subject, lighting, setting, mood and composition…"
            />
          </div>
          <div
            className="admin-toolbar-actions"
            style={{ justifyContent: "space-between", marginTop: 12 }}
          >
            <span className="admin-section-description">
              {prompt.length}/1200 characters · portrait 2:3 output
            </span>
            <button
              className="btn dark"
              onClick={() => void generate()}
              disabled={generating || prompt.trim().length < 5}
            >
              {generating ? "Generating image…" : "Generate image"}
            </button>
          </div>
        </section>
        <div className="media-grid">
          {busy ? (
            <div className="admin-empty">
              <strong>Loading media…</strong>
              <span>Your library is being refreshed.</span>
            </div>
          ) : filtered.length ? (
            filtered.map((f: any) => (
              <article key={f.url} className="media-card">
                <div className="media-thumb">
                  <img
                    src={f.url}
                    alt={f.name}
                    onError={(e) => {
                      e.currentTarget.style.display = "none";
                      const fallback = e.currentTarget
                        .nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "grid";
                    }}
                    onLoad={(e) => {
                      e.currentTarget.style.display = "block";
                      const fallback = e.currentTarget
                        .nextElementSibling as HTMLElement | null;
                      if (fallback) fallback.style.display = "none";
                    }}
                  />
                  <div className="media-thumb-fallback" role="status">
                    Preview unavailable
                  </div>
                </div>
                <div className="media-meta">
                  <strong title={f.name}>{f.name}</strong>
                  <span>
                    {Math.max(1, Math.round(Number(f.bytes || 0) / 1024))} KB
                  </span>
                  <button
                    className="btn text"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(f.url);
                        onNotify("Asset URL copied.");
                      } catch {
                        onNotify(f.url);
                      }
                    }}
                  >
                    Copy URL
                  </button>
                </div>
              </article>
            ))
          ) : (
            <div className="admin-empty">
              <strong>{q ? "No matching media." : "No uploaded media."}</strong>
              <span>
                {q
                  ? "Try a different search term."
                  : "Upload your first site asset or generate an image above."}
              </span>
            </div>
          )}
        </div>
      </AdminPageFrame>
    </div>
  );
}

function Admin({ section, onNavigate, onNotify, onLogout }: any) {
  const [authorized, setAuthorized] = useState<boolean | null>(null);
  const [authCheckError, setAuthCheckError] = useState("");
  const [authCheckAttempt, setAuthCheckAttempt] = useState(0);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [quickOpen, setQuickOpen] = useState(false);
  useEffect(() => {
    const k = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setQuickOpen((v) => !v);
      }
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, []);
  const [previewPath, setPreviewPath] = useState("/");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [dash, setDash] = useState<{ orders: any[]; low: any[] }>({
    orders: [],
    low: [],
  });
  const [editUser, setEditUser] = useState<any>(null);
  const [data, setData] = useState<any[]>([]);
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [pages, setPages] = useState<CmsPage[]>([]);
  const [adminCategories, setAdminCategories] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [q, setQ] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [dataLoading, setDataLoading] = useState(false);
  const [openingUserId, setOpeningUserId] = useState<string | null>(null);
  const [showUnblockForm, setShowUnblockForm] = useState(false);
  const [blockedEmail, setBlockedEmail] = useState("");
  const [blockedPhone, setBlockedPhone] = useState("");
  const [unblockingIdentity, setUnblockingIdentity] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSearchQuery(q.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    let active = true;
    setAuthCheckError("");
    api<{ user: User }>("/auth/admin/me")
      .then((r) => {
        if (r.user.role !== "ADMIN") throw 0;
        if (active) setAuthorized(true);
      })
      .catch((error) => {
        if (!active) return;
        if (error instanceof ApiError && error.status === 401) {
          setAuthorized(false);
          return;
        }
        setAuthCheckError(errorText(error?.message || "Dashboard connection failed."));
      });
    try {
      setSidebarCollapsed(
        localStorage.getItem("atelier_admin_sidebar_collapsed") === "1",
      );
    } catch {}
    return () => { active = false; };
  }, [authCheckAttempt]);
  useEffect(() => {
    try {
      localStorage.setItem(
        "atelier_admin_sidebar_collapsed",
        sidebarCollapsed ? "1" : "0",
      );
    } catch {}
  }, [sidebarCollapsed]);
  useEffect(() => {
    setMobileNavOpen(false);
  }, [section]);
  useEffect(() => {
    if (!authorized) return;
    let cancelled = false;
    const needsData = [
      "dashboard",
      "users",
      "orders",
      "payments",
      "products",
      "categories",
      "builder",
      "navigation",
      "theme",
      "media",
      "settings",
    ].includes(section);
    if (!needsData) {
      setDataLoading(false);
      return () => {
        cancelled = true;
      };
    }
    setDataLoading(true);
    (async () => {
      try {
        if (section === "dashboard") {
          const [v, o, pr] = await Promise.all([
            api<any>("/admin/stats"),
            api<any>("/admin/orders"),
            api<any>("/admin/products"),
          ]);
          if (!cancelled) {
            setStats(v);
            setDash({
              orders: Array.isArray(o) ? o.slice(0, 6) : [],
              low: Array.isArray(pr)
                ? pr
                    .filter((x: any) => x.status === "ACTIVE" && x.stock < 6)
                    .sort((a: any, b: any) => a.stock - b.stock)
                    .slice(0, 8)
                : [],
            });
          }
        }
        if (section === "users") {
          const v = await api<any>(
            `/admin/users${searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : ""}`,
          );
          if (!cancelled) setData(Array.isArray(v) ? v : []);
        }
        if (section === "orders") {
          const v = await api<any>("/admin/orders");
          if (!cancelled) setData(Array.isArray(v) ? v : []);
        }
        if (section === "payments") {
          const v = await api<any>("/admin/payments");
          if (!cancelled) setData(Array.isArray(v) ? v : []);
        }
        if (section === "products") {
          const [v, c] = await Promise.all([
            api<any>("/admin/products"),
            api<any>("/admin/categories"),
          ]);
          if (!cancelled) {
            setData(Array.isArray(v) ? v : []);
            setAdminCategories(Array.isArray(c) ? c : []);
          }
        }
        if (section === "categories") {
          const v = await api<any>("/admin/categories");
          if (!cancelled) setData(Array.isArray(v) ? v : []);
        }
        if (
          ["builder", "navigation", "theme", "media", "settings"].includes(
            section,
          )
        ) {
          const [v, st] = await Promise.all([
            api<any>("/admin/pages"),
            api<any>("/admin/settings"),
          ]);
          if (!cancelled) {
            setPages(Array.isArray(v) ? v : []);
            setSettings(st && typeof st === "object" ? st : {});
          }
        }
      } catch (e: any) {
        if (!cancelled) onNotify(errorText(e.message));
      } finally {
        if (!cancelled) setDataLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authorized, section, searchQuery]);

  const previewPathRef = useRef(previewPath);
  useEffect(() => {
    previewPathRef.current = previewPath;
  }, [previewPath]);
  const openPreview = useCallback((path?: string) => {
    const nextPath = path || previewPathRef.current || "/";
    setPreviewPath(nextPath);
    setPreviewOpen(true);
    setMobileNavOpen(false);
  }, []);
  const togglePreview = useCallback(() => {
    setPreviewOpen((v) => !v);
    setMobileNavOpen(false);
  }, []);
  if (authorized === null && authCheckError)
    return (
      <div className="empty">
        <div className="eyebrow">ATELIER / CONNECTION</div>
        <h2>Dashboard could not verify your session.</h2>
        <p>{authCheckError}</p>
        <button className="btn dark" onClick={() => { setAuthorized(null); setAuthCheckAttempt((n) => n + 1); }}>Try again</button>
      </div>
    );
  if (authorized === null)
    return (
      <div className="empty">
        <div className="eyebrow">ATELIER</div>
        <h2>Loading…</h2>
      </div>
    );
  if (!authorized) return <RedirectTo to="/login" onNavigate={onNavigate} />;

  const tabs: [string, string, IconName][] = [
    ["dashboard", "Dashboard", "grid"],
    ["ai", "AI API Studio", "ai"],
    ["builder", "Website editor", "settings"],
    ["navigation", "Navigation", "arrow"],
    ["theme", "Theme Studio", "settings"],
    ["media", "Media Library", "image"],
    ["products", "Products", "box"],
    ["categories", "Categories", "category"],
    ["orders", "Orders", "orders"],
    ["payments", "Payments", "cart"],
    ["users", "Customers", "users"],
    ["settings", "Store Settings", "settings"],
    ["security", "Security Monitor", "shield"],
    ["audit", "Activity Log", "orders"],
  ];
  const selectTab = (x: string) => {
    setData([]);
    setSelected(null);
    const defaults: Record<string, string> = {
      dashboard: "/",
      products: "/shop",
      orders: "/shop",
      payments: "/",
      users: "/",
      categories: "/collections",
      builder: "/",
      navigation: "/",
      theme: "/",
      media: "/",
      settings: "/",
      audit: "/",
    };
    setPreviewPath(defaults[x] || "/");
    setMobileNavOpen(false);
    onNavigate(`${ADMIN_ROUTE}?section=${x}`);
  };
  const doLogout = async () => {
    try {
      await api("/auth/admin/logout", { method: "POST" });
    } catch {
    } finally {
      onLogout();
    }
  };
  const openCustomer = async (id: string) => {
    setOpeningUserId(id);
    try {
      setSelected(await api(`/admin/users/${id}`));
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setOpeningUserId(null);
    }
  };
  const unblockIdentity = async () => {
    const email = blockedEmail.trim();
    const phone = blockedPhone.trim();
    if (!email && !phone)
      return onNotify("Enter the blocked email address or mobile number.");
    if (unblockingIdentity) return;
    if (
      !confirm(
        "Remove the block entry matching this email/mobile? This only clears matching blocked identities; it does not restore a deleted customer account.",
      )
    )
      return;
    setUnblockingIdentity(true);
    try {
      const out = await api<{ ok: boolean; deleted: number }>(
        "/admin/blocked-identities/unblock",
        {
          method: "POST",
          body: JSON.stringify({
            email: email || undefined,
            phone: phone || undefined,
          }),
        },
      );
      if (out.deleted > 0) {
        onNotify(
          `Block entry cleared (${out.deleted}). Try registration again.`,
        );
        setBlockedEmail("");
        setBlockedPhone("");
        setShowUnblockForm(false);
      } else
        onNotify(
          "No block entry matched. Check the email/mobile spelling and try the other identifier if needed.",
        );
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setUnblockingIdentity(false);
    }
  };
  const updateOrder = async (id: string, status: string) => {
    if (
      ["CANCELLED", "REFUNDED"].includes(status) &&
      !confirm(
        `Mark this order as ${status}? A captured payment will be refunded and stock returned where applicable.`,
      )
    )
      return;
    setBusy(true);
    try {
      const out = await api<any>(`/admin/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      setData((v) =>
        v.map((o) => (o.id === id ? { ...o, ...out, status } : o)),
      );
      onNotify("Order status updated.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setBusy(false);
    }
  };

  const main = (
    <section className="admin-main" aria-busy={dataLoading}>
      {section === "dashboard" && (
        <AdminDashboard
          stats={stats}
          dash={dash}
          onGo={selectTab}
          onPreview={openPreview}
          onLogout={doLogout}
        />
      )}
      {section === "ai" && <AIProviderStudio onNotify={onNotify} />}
      {section === "products" && (
        <AdminProducts
          data={data}
          categories={adminCategories}
          onNotify={onNotify}
          onPreview={openPreview}
        />
      )}
      {section === "categories" && (
        <AdminCategories
          data={data}
          onNotify={onNotify}
          onPreview={openPreview}
        />
      )}
      {section === "users" && (
        <AdminPageFrame
          eyebrow="Customer directory"
          title="Users"
          description="Customer accounts and roles. Select a row to inspect the full profile."
          count={data.length}
          actions={
            <>
              <input
                className="admin-search"
                placeholder="Search name / email / phone"
                value={q}
                onChange={(e) => setQ(e.target.value)}
              />
              <button
                type="button"
                className="btn text"
                onClick={() => setShowUnblockForm((v) => !v)}
                aria-expanded={showUnblockForm}
              >
                {showUnblockForm
                  ? "Close unblock tool"
                  : "Resolve registration block"}
              </button>
            </>
          }
        >
          {showUnblockForm && (
            <section
              className="admin-card admin-module-card"
              style={{ marginBottom: 18 }}
            >
              <div className="eyebrow">Account access</div>
              <h3 className="serif" style={{ marginTop: 8 }}>
                Unblock an email or mobile
              </h3>
              <p className="admin-section-description">
                Use the exact email or phone shown in the registration error.
                Only matching block entries are removed; customer accounts and
                order history are not deleted.
              </p>
              <div
                className="admin-toolbar-actions"
                style={{
                  marginTop: 12,
                  justifyContent: "flex-start",
                  flexWrap: "wrap",
                }}
              >
                <input
                  className="admin-search"
                  style={{ minWidth: 220 }}
                  type="email"
                  autoComplete="off"
                  aria-label="Blocked email address"
                  placeholder="Blocked email address"
                  value={blockedEmail}
                  onChange={(e) => setBlockedEmail(e.target.value)}
                />
                <input
                  className="admin-search"
                  style={{ minWidth: 180 }}
                  type="tel"
                  autoComplete="off"
                  aria-label="Blocked mobile number"
                  placeholder="Blocked mobile number"
                  value={blockedPhone}
                  onChange={(e) => setBlockedPhone(e.target.value)}
                />
                <button
                  type="button"
                  className="btn dark"
                  onClick={() => void unblockIdentity()}
                  disabled={
                    unblockingIdentity ||
                    (!blockedEmail.trim() && !blockedPhone.trim())
                  }
                >
                  {unblockingIdentity
                    ? "Unblocking…"
                    : "Unblock matching identity"}
                </button>
              </div>
            </section>
          )}
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Mobile</th>
                  <th>Role</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.length ? (
                  data.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <button
                          type="button"
                          className="admin-user-open"
                          onClick={() => void openCustomer(u.id)}
                          disabled={openingUserId === u.id}
                        >
                          <strong>
                            {openingUserId === u.id ? "Loading…" : u.name}
                          </strong>
                        </button>
                      </td>
                      <td>{u.email}</td>
                      <td>{u.phone || "—"}</td>
                      <td>
                        <span
                          className={`admin-badge ${u.role === "ADMIN" ? "admin-badge-dark" : ""}`}
                        >
                          {u.role}
                        </span>
                        {u.blockedAt && (
                          <span
                            className="admin-badge admin-badge-danger"
                            style={{ marginLeft: 6 }}
                          >
                            BLOCKED
                          </span>
                        )}
                      </td>
                      <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                      <td>
                        {u.role !== "ADMIN" && (
                          <div className="admin-row-actions">
                            <button
                              className="btn text"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditUser({
                                  id: u.id,
                                  name: u.name,
                                  phone: u.phone || "",
                                });
                              }}
                            >
                              Edit
                            </button>
                            <button
                              className="btn text"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (
                                  !confirm(
                                    "Block this customer? Their email, phone and known addresses will remain blocked.",
                                  )
                                )
                                  return;
                                try {
                                  await api(`/admin/users/${u.id}/block`, {
                                    method: "POST",
                                    body: JSON.stringify({
                                      reason: "ADMIN_BLOCK",
                                    }),
                                  });
                                  setData((v) =>
                                    v.map((x) =>
                                      x.id === u.id
                                        ? {
                                            ...x,
                                            blockedAt: new Date().toISOString(),
                                          }
                                        : x,
                                    ),
                                  );
                                  onNotify("Customer blocked.");
                                } catch (err: any) {
                                  onNotify(errorText(err.message));
                                }
                              }}
                              disabled={Boolean(u.blockedAt)}
                            >
                              {u.blockedAt ? "Blocked" : "Block"}
                            </button>
                            {u.blockedAt && (
                              <button
                                className="btn text"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  if (
                                    !confirm(
                                      "Unblock this customer? They will be able to log in and register again.",
                                    )
                                  )
                                    return;
                                  try {
                                    await api(`/admin/users/${u.id}/unblock`, {
                                      method: "POST",
                                    });
                                    setData((v) =>
                                      v.map((x) =>
                                        x.id === u.id
                                          ? { ...x, blockedAt: null }
                                          : x,
                                      ),
                                    );
                                    onNotify("Customer unblocked.");
                                  } catch (err: any) {
                                    onNotify(errorText(err.message));
                                  }
                                }}
                              >
                                Unblock
                              </button>
                            )}
                            <button
                              className="btn text danger-text"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (
                                  !confirm(
                                    "Delete this customer permanently and block their known identity?",
                                  )
                                )
                                  return;
                                try {
                                  await api(`/admin/users/${u.id}`, {
                                    method: "DELETE",
                                  });
                                  setData((v) =>
                                    v.filter((x) => x.id !== u.id),
                                  );
                                  onNotify("Customer deleted and blocked.");
                                } catch (err: any) {
                                  onNotify(errorText(err.message));
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="admin-empty">No users yet.</div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminPageFrame>
      )}
      {section === "orders" && (
        <AdminPageFrame
          eyebrow="Payments & fulfilment"
          title="Orders"
          description="Order lifecycle, customer details, payment state and fulfilment status."
          count={data.length}
        >
          <div className="admin-table-wrap">
            <table className="admin-table admin-table-orders">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Items</th>
                  <th>Total</th>
                  <th>Payment</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {data.length ? (
                  data.map((o) => (
                    <tr key={o.id}>
                      <td>
                        <strong>{o.orderNumber}</strong>
                        <div className="muted">
                          {new Date(o.createdAt).toLocaleString()}
                        </div>
                      </td>
                      <td>
                        <strong>{o.user?.name || "Customer"}</strong>
                        <div className="muted">
                          {o.user?.email || "—"}
                          <br />
                          {o.user?.phone || "—"}
                        </div>
                      </td>
                      <td>
                        {(Array.isArray(o.items) ? o.items : []).map(
                          (i: any) => (
                            <div className="admin-line-item" key={i.id}>
                              {i.productName} <span>× {i.quantity}</span>
                            </div>
                          ),
                        )}
                      </td>
                      <td>
                        <strong>{money(o.total)}</strong>
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${o.paymentStatus === "CAPTURED" ? "admin-badge-success" : ""}`}
                        >
                          {o.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <select
                          value={o.status}
                          onChange={(e) => updateOrder(o.id, e.target.value)}
                          disabled={
                            busy || !(ORDER_NEXT[o.status] || []).length
                          }
                          className="admin-status-select"
                          aria-label={`Status for ${o.orderNumber}`}
                          title={
                            (ORDER_NEXT[o.status] || []).length
                              ? "Move this order to the next stage"
                              : "Final status"
                          }
                        >
                          {[o.status, ...(ORDER_NEXT[o.status] || [])].map(
                            (x: string) => (
                              <option key={x} value={x}>
                                {x}
                              </option>
                            ),
                          )}
                        </select>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="admin-empty">
                        <strong>No orders yet.</strong>
                        <span>
                          Orders will appear here after the first completed
                          purchase.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </AdminPageFrame>
      )}
      {section === "payments" && (
        <AdminPayments
          data={data}
          onNotify={onNotify}
          onRefunded={(id: string) =>
            setData((v) =>
              v.map((p) =>
                p.id === id
                  ? {
                      ...p,
                      status: "REFUNDED",
                      payments: (p.payments || []).map((x: any) =>
                        x.status === "CAPTURED"
                          ? { ...x, status: "REFUNDED" }
                          : x,
                      ),
                    }
                  : p,
              ),
            )
          }
        />
      )}
      {section === "builder" && (
        <VisualSiteBuilder
          settings={settings}
          setSettings={setSettings}
          pages={pages}
          setPages={setPages}
          onNotify={onNotify}
          onPreview={openPreview}
        />
      )}
      {section === "navigation" && (
        <AdminNavigation
          settings={settings}
          setSettings={setSettings}
          onNotify={onNotify}
          onPreview={openPreview}
        />
      )}
      {section === "theme" && (
        <AdminTheme
          settings={settings}
          setSettings={setSettings}
          onNotify={onNotify}
          onPreview={openPreview}
        />
      )}
      {section === "media" && <AdminMedia onNotify={onNotify} />}
      {section === "settings" && (
        <SiteSettings
          settings={settings}
          setSettings={setSettings}
          onNotify={onNotify}
          onPreview={openPreview}
        />
      )}
      {section === "audit" && <Audit onNotify={onNotify} />}
      {section === "security" && <AdminSecurityMonitor onNotify={onNotify} />}
      {selected && (
        <UserModal data={selected} onClose={() => setSelected(null)} />
      )}
      {editUser && (
        <EditCustomerModal
          user={editUser}
          onClose={() => setEditUser(null)}
          onSaved={(out) => {
            setData((v) =>
              v.map((x) => (x.id === out.id ? { ...x, ...out } : x)),
            );
            setEditUser(null);
            onNotify("Customer updated.");
          }}
          onNotify={onNotify}
        />
      )}
      {dataLoading && (
        <div className="admin-loading-overlay" role="status" aria-live="polite">
          <span className="admin-loading-spinner" aria-hidden="true" />
          <strong>Loading control-room data…</strong>
        </div>
      )}
    </section>
  );

  return (
    <div
      className={`admin ${previewOpen ? "with-preview" : ""} ${sidebarCollapsed ? "sidebar-collapsed" : ""} ${mobileNavOpen ? "mobile-nav-open" : ""}`}
    >
      {mobileNavOpen && (
        <button
          className="admin-nav-backdrop"
          aria-label="Close admin menu"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside
        id="atelier-admin-navigation"
        className="admin-nav"
        aria-label="Admin navigation"
      >
        <div className="admin-nav-head">
          <div className="admin-brand">
            <span className="admin-brand-mark">A</span>
            <span className="admin-nav-label">
              <b>ATELIER</b>
              <small>Control Room</small>
            </span>
          </div>
          <button
            className="admin-nav-collapse"
            onClick={() => setSidebarCollapsed((v) => !v)}
            aria-expanded={!sidebarCollapsed}
            aria-label={
              sidebarCollapsed ? "Open full admin menu" : "Collapse admin menu"
            }
            title={sidebarCollapsed ? "Open menu" : "Collapse menu"}
          >
            <Icon name="chevron" size={15} />
            <span className="admin-nav-label">
              {sidebarCollapsed ? "Open" : "Collapse"}
            </span>
          </button>
        </div>
        <button
          className="admin-live-preview-toggle"
          onClick={togglePreview}
          aria-pressed={previewOpen}
          title="Open or close storefront preview"
        >
          <Icon name="grid" size={14} />
          <span className="admin-nav-label">
            {previewOpen ? "Close Live Preview" : "Live Preview"}
          </span>
        </button>
        <div className="admin-nav-scroll">
          {(
            [
              ["WORKSPACE", tabs.filter((x) => ["dashboard"].includes(x[0]))],
              [
                "WEBSITE",
                tabs.filter((x) =>
                  ["builder", "navigation", "theme", "media"].includes(x[0]),
                ),
              ],
              [
                "STORE",
                tabs.filter((x) => ["products", "categories"].includes(x[0])),
              ],
              [
                "COMMERCE",
                tabs.filter((x) => ["orders", "payments"].includes(x[0])),
              ],
              ["CUSTOMERS", tabs.filter((x) => ["users"].includes(x[0]))],
              [
                "SYSTEM",
                tabs.filter((x) =>
                  ["ai", "settings", "security", "audit"].includes(x[0]),
                ),
              ],
            ] as [string, typeof tabs][]
          ).map(([group, items]) => (
            <div className="admin-nav-group" key={group}>
              <div className="admin-nav-section-label">{group}</div>
              {items.map(([id, label, icon]) => (
                <button
                  className={section === id ? "active" : ""}
                  key={id}
                  onClick={() => selectTab(id)}
                  title={label}
                  aria-label={label}
                >
                  <Icon name={icon} size={14} />
                  <span className="admin-nav-label">{label}</span>
                </button>
              ))}
            </div>
          ))}
        </div>
        <div className="admin-nav-foot">
          <button onClick={() => onNavigate("/")} title="View storefront">
            <span className="admin-nav-label">View storefront ↗</span>
            <span className="admin-nav-icon-only">↗</span>
          </button>
          <button className="admin-logout" onClick={doLogout} title="Logout">
            <Icon name="close" size={14} />
            <span className="admin-nav-label">Logout</span>
          </button>
        </div>
      </aside>
      <button
        className="admin-mobile-nav-toggle"
        onClick={() => setMobileNavOpen((v) => !v)}
        aria-expanded={mobileNavOpen}
        aria-controls="atelier-admin-navigation"
      >
        <Icon name={mobileNavOpen ? "close" : "menu"} size={16} />
        <span>{mobileNavOpen ? "Close menu" : "Open menu"}</span>
      </button>
      {main}
      {previewOpen && (
        <AdminLivePreview
          path={previewPath}
          onClose={() => setPreviewOpen(false)}
        />
      )}
      <AdminStatusChip onGo={selectTab} />
      <AdminDock
        section={section}
        previewOpen={previewOpen}
        onPreview={() => setPreviewOpen((v) => !v)}
        onEdit={() => selectTab("builder")}
        onFind={() => setQuickOpen(true)}
      />
      <QuickFind
        open={quickOpen}
        onClose={() => setQuickOpen(false)}
        areas={tabs.map((t) => [t[0], t[1]] as [string, string])}
        onGo={selectTab}
      />
    </div>
  );
}

const ORDER_NEXT: Record<string, string[]> = {
  PAID: ["PROCESSING", "CANCELLED", "REFUNDED"],
  PROCESSING: ["SHIPPED", "CANCELLED", "REFUNDED"],
  SHIPPED: ["DELIVERED"],
  DELIVERED: ["REFUNDED"],
  CANCELLED: [],
  REFUNDED: [],
};

function AdminDashboard({
  stats,
  dash,
  onGo,
  onPreview,
  onLogout,
}: {
  stats: any;
  dash: { orders: any[]; low: any[] };
  onGo: (x: string) => void;
  onPreview: (p?: string) => void;
  onLogout: () => void;
}) {
  const cards: [string, any, string][] = [
    ["Customers", stats?.users ?? "—", "users"],
    ["Products", stats?.products ?? "—", "products"],
    ["Categories", stats?.categories ?? "—", "categories"],
    ["Orders", stats?.orders ?? "—", "orders"],
    ["Revenue", stats ? money(stats.revenue || 0) : "—", "payments"],
    ["Low stock", stats?.lowStock ?? "—", "products"],
  ];
  return (
    <div className="admin-dashboard">
      <div className="eyebrow">ATELIER Control Room</div>
      <div className="admin-dashboard-head">
        <div>
          <h1 className="serif">Dashboard</h1>
          <p className="admin-section-description">
            A live snapshot of your store. Select any tile to open that area.
          </p>
        </div>
        <div className="admin-toolbar-actions">
          <button className="btn text" onClick={() => onPreview("/")}>
            Live preview
          </button>
          <button className="btn" onClick={() => onGo("products")}>
            Manage products
          </button>
          <button className="btn dark" onClick={onLogout}>
            Logout
          </button>
        </div>
      </div>
      <AdminWelcome onGo={onGo} onPreview={onPreview} stats={stats} />
      <div className="stats">
        {cards.map(([l, v, to]) => (
          <button
            type="button"
            className="stat-card"
            key={l}
            onClick={() => onGo(to)}
          >
            <span>{l}</span>
            <b>{v}</b>
          </button>
        ))}
      </div>
      <div className="admin-dash-grid">
        <section className="admin-card admin-module-card">
          <div className="admin-dash-head">
            <h3 className="serif">Recent orders</h3>
            <button className="btn text" onClick={() => onGo("orders")}>
              View all
            </button>
          </div>
          {dash.orders.length ? (
            <ul className="admin-dash-list">
              {dash.orders.map((o) => (
                <li key={o.id}>
                  <span>
                    <b>{o.orderNumber}</b>
                    <small>
                      {o.user?.name || "Customer"} ·{" "}
                      {new Date(o.createdAt).toLocaleDateString()}
                    </small>
                  </span>
                  <span className="admin-dash-right">
                    <b>{money(o.total)}</b>
                    <span
                      className={`admin-badge ${o.status === "DELIVERED" ? "admin-badge-success" : ["CANCELLED", "REFUNDED"].includes(o.status) ? "admin-badge-danger" : ""}`}
                    >
                      {o.status}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="admin-empty">
              <strong>No orders yet.</strong>
              <span>
                Orders appear here after the first completed purchase.
              </span>
            </div>
          )}
        </section>
        <section className="admin-card admin-module-card">
          <div className="admin-dash-head">
            <h3 className="serif">Needs restocking</h3>
            <button className="btn text" onClick={() => onGo("products")}>
              Open products
            </button>
          </div>
          {dash.low.length ? (
            <ul className="admin-dash-list">
              {dash.low.map((p) => (
                <li key={p.id}>
                  <span>
                    <b>{p.name}</b>
                    <small>{p.sku}</small>
                  </span>
                  <span className="admin-dash-right">
                    <span
                      className={`admin-badge ${p.stock ? "admin-badge-warn" : "admin-badge-danger"}`}
                    >
                      {p.stock ? `${p.stock} left` : "Out of stock"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="admin-empty">
              <strong>Stock looks healthy.</strong>
              <span>No active product has fewer than 6 units.</span>
            </div>
          )}
        </section>
      </div>
      <div className="admin-quick">
        {[
          ["Website builder", "builder"],
          ["Media library", "media"],
          ["Store settings", "settings"],
          ["Activity log", "audit"],
        ].map(([l, to]) => (
          <button
            type="button"
            className="btn text"
            key={to}
            onClick={() => onGo(to)}
          >
            {l} →
          </button>
        ))}
      </div>
    </div>
  );
}

function EditCustomerModal({
  user,
  onClose,
  onSaved,
  onNotify,
}: {
  user: { id: string; name: string; phone: string };
  onClose: () => void;
  onSaved: (u: any) => void;
  onNotify: (x: string) => void;
}) {
  const [name, setName] = useState(user.name);
  const [phone, setPhone] = useState(user.phone);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving) onClose();
    };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose, saving]);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    try {
      const out = await api<any>(`/admin/users/${user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() }),
      });
      onSaved(out);
    } catch (err: any) {
      onNotify(errorText(err.message));
    } finally {
      setSaving(false);
    }
  };
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <form
        className="admin-dark-panel admin-dark-panel-narrow"
        role="dialog"
        aria-modal="true"
        aria-label="Edit customer"
        onSubmit={submit}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <h2 className="serif" style={{ fontSize: 34 }}>
            Edit Customer
          </h2>
          <button
            type="button"
            className="close-btn"
            onClick={onClose}
            disabled={saving}
            aria-label="Close"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="admin-form" style={{ marginTop: 22 }}>
          <Field label="Name" value={name} onChange={setName} required />
          <Field
            label="Mobile (Indian, 10 digits)"
            value={phone}
            onChange={setPhone}
            required
          />
        </div>
        <div
          className="admin-toolbar-actions"
          style={{ marginTop: 20, justifyContent: "flex-end" }}
        >
          <button
            type="button"
            className="btn text"
            onClick={onClose}
            disabled={saving}
          >
            Cancel
          </button>
          <button className="btn" disabled={saving || name.trim().length < 2}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function AdminPayments({
  data,
  onNotify,
  onRefunded,
}: {
  data: any[];
  onNotify: (message: string) => void;
  onRefunded: (id: string) => void;
}) {
  const [refundingId, setRefundingId] = useState<string | null>(null);
  const refundUnmatched = async (p: any) => {
    if (
      !confirm(
        `Refund ${money(p.amount)} to the original payment method? This payment has no order.`,
      )
    )
      return;
    setRefundingId(p.id);
    try {
      await api(`/admin/payments/${p.id}/refund`, { method: "POST" });
      onRefunded(p.id);
      onNotify("Unmatched payment refunded at the provider and recorded.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setRefundingId(null);
    }
  };
  return (
    <AdminPageFrame
      eyebrow="Gateway ledger"
      title="Payments"
      description="Gateway transactions, amounts, statuses and provider references. Captured payments without an order can be refunded here for recovery."
      count={data.length}
    >
      <PaymentConfigCard onNotify={onNotify} />
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Created</th>
              <th>Customer</th>
              <th>Intent</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Gateway refs</th>
              <th>Recovery</th>
            </tr>
          </thead>
          <tbody>
            {data.length ? (
              data.map((p: any) => {
                const captured = (
                  Array.isArray(p.payments) ? p.payments : []
                ).find((x: any) => x.status === "CAPTURED");
                const unmatched =
                  !p.order && Boolean(captured) && p.status !== "REFUNDED";
                return (
                  <tr key={p.id}>
                    <td>{new Date(p.createdAt).toLocaleString()}</td>
                    <td>
                      <strong>{p.user?.name || "—"}</strong>
                      <div className="muted">
                        {p.user?.email || "—"}
                        <br />
                        {p.user?.phone || "—"}
                      </div>
                    </td>
                    <td>
                      <strong>{p.id}</strong>
                      <div className="muted">
                        {p.order?.orderNumber || "No order yet"}
                      </div>
                    </td>
                    <td>
                      <strong>{money(p.amount)}</strong>
                    </td>
                    <td>
                      <span
                        className={`admin-badge ${p.status === "CAPTURED" || captured ? "admin-badge-success" : p.status === "FAILED" ? "admin-badge-danger" : ""}`}
                      >
                        {p.status}
                        {!p.order && captured && p.status !== "REFUNDED"
                          ? " · ORDER MISSING"
                          : ""}
                      </span>
                    </td>
                    <td>
                      {(Array.isArray(p.payments) ? p.payments : [])
                        .map((x: any) => x.providerId)
                        .join(" · ") || "—"}
                      <div className="muted">QR: {p.razorpayQrId || "—"}</div>
                    </td>
                    <td>
                      {unmatched ? (
                        <button
                          className="btn text danger-text"
                          type="button"
                          disabled={refundingId === p.id}
                          onClick={() => void refundUnmatched(p)}
                        >
                          {refundingId === p.id
                            ? "Refunding…"
                            : "Refund payment"}
                        </button>
                      ) : p.status === "REFUNDED" ? (
                        <span className="muted">Refunded</span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="admin-empty">
                    <strong>No payments yet.</strong>
                    <span>
                      Gateway records will appear here after a payment attempt.
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminPageFrame>
  );
}

function AdminProducts({ data, categories, onNotify, onPreview }: any) {
  const [rows, setRows] = useState<any[]>(Array.isArray(data) ? data : []);
  const [editing, setEditing] = useState<any>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [catList, setCatList] = useState<any[]>(
    Array.isArray(categories) ? categories : [],
  );
  const [genderFilter, setGenderFilter] = useState<"ALL" | "Men" | "Women">(
    "ALL",
  );
  const [pq, setPq] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => setRows(Array.isArray(data) ? data : []), [data]);
  useEffect(
    () => setCatList(Array.isArray(categories) ? categories : []),
    [categories],
  );
  useEffect(() => {
    if (!editing) return;
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !saving && !uploading) setEditing(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editing, saving, uploading]);
  const needle = pq.trim().toLowerCase();
  const visibleRows = rows.filter(
    (p: any) =>
      (genderFilter === "ALL" || p.gender === genderFilter) &&
      (statusFilter === "ALL" || p.status === statusFilter) &&
      (!needle ||
        `${p.name} ${p.sku} ${p.category?.name || ""}`
          .toLowerCase()
          .includes(needle)),
  );
  const beginAdd = (gender: "Men" | "Women") =>
    setEditing({
      sku: "",
      name: "",
      slug: "",
      price: 0,
      categoryId: catList[0]?.id || "",
      gender,
      type: "shirt",
      description: "",
      colorsCsv: "Black,White",
      sizesCsv: "XS,S,M,L,XL,XXL",
      imagesList: [],
      stock: 0,
      featured: false,
      newArrival: false,
      bestSeller: false,
      status: "ACTIVE",
      collectionType: gender === "Men" ? "MEN" : "WOMEN_WESTERN",
    });
  const currentImages = () =>
    Array.isArray(editing?.imagesList)
      ? editing.imagesList
      : String(editing?.imagesCsv || editing?.images || "")
          .split("\n")
          .map((x: string) => x.trim())
          .filter(Boolean);
  const setImages = (images: string[]) =>
    setEditing({
      ...editing,
      imagesList: Array.from(new Set(images.filter(Boolean))),
      imagesCsv: Array.from(new Set(images.filter(Boolean))).join("\n"),
    });
  const addImageUrl = () => {
    const value = String(editing?.newImageUrl || "").trim();
    if (!value) return;
    setImages([...currentImages(), value]);
    setEditing((v: any) => ({ ...v, newImageUrl: "" }));
  };
  const removeImage = (src: string) =>
    setImages(currentImages().filter((x: string) => x !== src));
  const uploadImage = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type))
      return onNotify("Please choose JPG, PNG or WEBP.");
    if (file.size > 8 * 1024 * 1024)
      return onNotify("Image must be 8 MB or smaller.");
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => resolve(String(r.result || ""));
        r.onerror = () => reject(new Error("IMAGE_READ_FAILED"));
        r.readAsDataURL(file);
      });
      const out = await api<{ url: string }>("/admin/images/upload", {
        method: "POST",
        body: JSON.stringify({ filename: file.name, dataUrl }),
      });
      setEditing((current: any) => {
        const currentImagesList = Array.isArray(current?.imagesList)
          ? current.imagesList
          : String(current?.imagesCsv || current?.images || "")
              .split("\n")
              .map((x: string) => x.trim())
              .filter(Boolean);
        const nextImages = Array.from(new Set([...currentImagesList, out.url]));
        return {
          ...current,
          imagesList: nextImages,
          imagesCsv: nextImages.join("\n"),
        };
      });
      onNotify("Image uploaded. Save the product to publish it.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setUploading(false);
    }
  };
  const save = async () => {
    if (!editing || saving) return;
    const images = currentImages();
    if (!images.length) return onNotify("Add at least one product image.");
    setSaving(true);
    try {
      const payload = {
        ...editing,
        price: Number(editing.price),
        stock: Number(editing.stock),
        colors: String(editing.colorsCsv || editing.colors || "")
          .split(",")
          .map((x: string) => x.trim())
          .filter(Boolean),
        sizes: String(editing.sizesCsv || editing.sizes || "")
          .split(",")
          .map((x: string) => x.trim())
          .filter(Boolean),
        images,
      };
      delete payload.colorsCsv;
      delete payload.sizesCsv;
      delete payload.imagesCsv;
      delete payload.imagesList;
      delete payload.newImageUrl;
      const out = editing.id
        ? await api<any>(`/admin/products/${editing.id}`, {
            method: "PATCH",
            body: JSON.stringify(payload),
          })
        : await api<any>("/admin/products", {
            method: "POST",
            body: JSON.stringify(payload),
          });
      setRows((r) =>
        editing.id
          ? r.map((x) => (x.id === out.id ? { ...x, ...out } : x))
          : [out, ...r],
      );
      setEditing(null);
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify("Product saved.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <div className="admin-toolbar admin-product-toolbar">
        <div>
          <div className="eyebrow">Catalog control</div>
          <h2 className="serif" style={{ fontSize: 42, margin: 6 }}>
            {genderFilter === "ALL" ? "Products" : `${genderFilter} Products`}
          </h2>
          <div className="admin-product-count">
            {visibleRows.length}{" "}
            {genderFilter === "ALL" ? "catalogue" : "products"}
          </div>
        </div>
        <div className="admin-product-actions">
          <input
            className="admin-search"
            placeholder="Search name / SKU"
            value={pq}
            onChange={(e) => setPq(e.target.value)}
            aria-label="Search products"
          />
          <select
            className="admin-status-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            aria-label="Filter by status"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="DRAFT">Draft</option>
            <option value="ARCHIVED">Archived</option>
          </select>
          <div
            className="admin-segment"
            role="tablist"
            aria-label="Product gender view"
          >
            <button
              className={genderFilter === "ALL" ? "active" : ""}
              onClick={() => setGenderFilter("ALL")}
            >
              All
            </button>
            <button
              className={genderFilter === "Men" ? "active" : ""}
              onClick={() => setGenderFilter("Men")}
            >
              Men
            </button>
            <button
              className={genderFilter === "Women" ? "active" : ""}
              onClick={() => setGenderFilter("Women")}
            >
              Women
            </button>
          </div>
          <button
            className="btn"
            onClick={() => beginAdd(genderFilter === "Women" ? "Women" : "Men")}
          >
            Add {genderFilter === "Women" ? "Women" : "Men"}
          </button>
        </div>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Product</th>
              <th>Gender</th>
              <th>Category</th>
              <th>Price</th>
              <th>Stock</th>
              <th>Status</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {visibleRows.length ? (
              visibleRows.map((p: any) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ display: "flex", gap: 9 }}>
                      <SmartImage
                        src={productImage(p)}
                        alt={p.name}
                        className="admin-thumb"
                      />
                      <span>
                        <b>{p.name}</b>
                        <small className="muted" style={{ display: "block" }}>
                          {p.sku}
                        </small>
                      </span>
                    </div>
                  </td>
                  <td>{p.gender}</td>
                  <td>{p.category?.name || "—"}</td>
                  <td>{money(p.price)}</td>
                  <td>{p.stock}</td>
                  <td>
                    <span
                      className={`admin-badge ${p.status === "ACTIVE" ? "admin-badge-success" : p.status === "ARCHIVED" ? "admin-badge-danger" : ""}`}
                    >
                      {p.status}
                    </span>
                    {p.status === "ACTIVE" && p.stock < 6 && (
                      <span
                        className="admin-badge admin-badge-warn"
                        style={{ marginLeft: 6 }}
                      >
                        {p.stock ? "LOW" : "OUT"}
                      </span>
                    )}
                  </td>
                  <td>
                    <button
                      className="btn text"
                      onClick={() => {
                        setEditing({
                          ...p,
                          colorsCsv: p.colors?.join(","),
                          sizesCsv: p.sizes?.join(","),
                          imagesList: Array.isArray(p.images)
                            ? p.images.slice()
                            : [],
                          imagesCsv: p.images?.join("\n"),
                        });
                      }}
                    >
                      Edit
                    </button>
                    {p.status === "ARCHIVED" ? (
                      <button
                        className="btn text"
                        onClick={async () => {
                          try {
                            const out = await api<any>(
                              `/admin/products/${p.id}`,
                              {
                                method: "PATCH",
                                body: JSON.stringify({ status: "ACTIVE" }),
                              },
                            );
                            setRows((r) =>
                              r.map((x) =>
                                x.id === p.id ? { ...x, ...out } : x,
                              ),
                            );
                            window.dispatchEvent(
                              new CustomEvent("atelier:data-changed"),
                            );
                            onNotify("Product restored.");
                          } catch (e: any) {
                            onNotify(errorText(e.message));
                          }
                        }}
                      >
                        Restore
                      </button>
                    ) : (
                      <button
                        className={`btn text ${confirmId === p.id ? "confirm-action" : ""}`}
                        onClick={async () => {
                          if (confirmId !== p.id) {
                            setConfirmId(p.id);
                            return;
                          }
                          setConfirmId("");
                          try {
                            await api(`/admin/products/${p.id}`, {
                              method: "DELETE",
                            });
                            setRows((r) =>
                              r.map((x) =>
                                x.id === p.id
                                  ? { ...x, status: "ARCHIVED" }
                                  : x,
                              ),
                            );
                            onNotify("Product archived.");
                          } catch (e: any) {
                            onNotify(errorText(e.message));
                          }
                        }}
                      >
                        {confirmId === p.id ? "Confirm archive" : "Archive"}
                      </button>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7}>
                  <div className="admin-empty">
                    <strong>No products found.</strong>
                    <span>Change the gender filter or add a product.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {editing && (
        <div
          className="overlay"
          onClick={(e) => {
            if (e.target === e.currentTarget && !saving && !uploading)
              setEditing(null);
          }}
        >
          <div
            className="admin-editor-drawer"
            role="dialog"
            aria-modal="true"
            aria-label={editing.id ? "Edit product" : "Create product"}
          >
            <div className="admin-editor-head">
              <div>
                <div className="eyebrow">
                  {editing.id ? "Edit product" : "New product"}
                </div>
                <h2 className="serif" style={{ fontSize: 38, margin: "6px 0" }}>
                  {editing.name || "Add Product"}
                </h2>
              </div>
              <button
                className="close-btn"
                onClick={() => setEditing(null)}
                disabled={saving || uploading}
                aria-label="Close product editor"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="admin-form" style={{ marginTop: 25 }}>
              <div className="admin-form-section">
                <h3>Identity & pricing</h3>
                <div className="form-grid">
                  <Field
                    label="SKU"
                    value={editing.sku || ""}
                    onChange={(v) => setEditing({ ...editing, sku: v })}
                    required
                  />
                  <Field
                    label="Name"
                    value={editing.name || ""}
                    onChange={(v) => setEditing({ ...editing, name: v })}
                    required
                  />
                  <Field
                    label="Slug"
                    value={editing.slug || ""}
                    onChange={(v) => setEditing({ ...editing, slug: v })}
                    required
                  />
                  <Field
                    label="Price"
                    value={String(editing.price ?? 0)}
                    onChange={(v) => setEditing({ ...editing, price: v })}
                    required
                  />
                  <Field
                    label="Stock"
                    value={String(editing.stock ?? 0)}
                    onChange={(v) => setEditing({ ...editing, stock: v })}
                    required
                  />
                </div>
              </div>
              <div className="admin-form-section">
                <h3>Category & collection</h3>
                <div className="form-grid">
                  <div className="field">
                    <label>Category</label>
                    <select
                      value={editing.categoryId || ""}
                      onChange={(e) =>
                        setEditing({ ...editing, categoryId: e.target.value })
                      }
                    >
                      <option value="">Choose category</option>
                      {catList.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>Gender</label>
                    <select
                      value={editing.gender || "Women"}
                      onChange={(e) => {
                        const gender = e.target.value as "Men" | "Women";
                        setEditing({
                          ...editing,
                          gender,
                          collectionType:
                            gender === "Men"
                              ? "MEN"
                              : editing.collectionType === "MEN"
                                ? "WOMEN_WESTERN"
                                : editing.collectionType || "WOMEN_WESTERN",
                        });
                      }}
                    >
                      <option value="Men">Men</option>
                      <option value="Women">Women</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Collection</label>
                    <select
                      value={editing.collectionType || "WOMEN_WESTERN"}
                      onChange={(e) =>
                        setEditing({
                          ...editing,
                          collectionType: e.target.value,
                        })
                      }
                    >
                      <option value="MEN">Men’s Collection</option>
                      <option value="WOMEN_INDO_WESTERN">
                        Indo-Western Edit
                      </option>
                      <option value="WOMEN_WESTERN">Western Edit</option>
                    </select>
                  </div>
                  <Field
                    label="Type"
                    value={editing.type || "shirt"}
                    onChange={(v) => setEditing({ ...editing, type: v })}
                    required
                  />
                </div>
              </div>
              <div className="admin-form-section">
                <h3>Images</h3>
                <div className="admin-image-grid">
                  {currentImages().map((src: string, i: number) => (
                    <div className="admin-image-item" key={`${src}-${i}`}>
                      <SmartImage
                        src={src}
                        alt={`Product image ${i + 1}`}
                        fallbackSrc={FALLBACK}
                      />
                      <div className="admin-image-item-foot">
                        <span>Image {i + 1}</span>
                        <button
                          type="button"
                          className="btn text danger-text"
                          onClick={() => removeImage(src)}
                          disabled={uploading || saving}
                        >
                          Remove
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="admin-image-add">
                  <input
                    className="utr"
                    value={editing.newImageUrl || ""}
                    onChange={(e) =>
                      setEditing({ ...editing, newImageUrl: e.target.value })
                    }
                    placeholder="/images/products/...avif or trusted image URL"
                  />
                  <button
                    type="button"
                    className="btn dark"
                    onClick={addImageUrl}
                    disabled={uploading || saving}
                  >
                    Add URL
                  </button>
                </div>
                <label className="upload-drop">
                  <span>
                    {uploading ? "Uploading…" : "Upload JPG / PNG / WEBP"}
                  </span>
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={(e) => {
                      const file = e.currentTarget.files?.[0];
                      e.currentTarget.value = "";
                      void uploadImage(file);
                    }}
                    disabled={uploading}
                  />
                </label>
                <p className="checkout-note">
                  Images are previewed here. Removing an image only removes it
                  from this product; the stored upload is not deleted from disk.
                </p>
              </div>
              <div className="admin-form-section">
                <h3>Variants & copy</h3>
                <div className="form-grid">
                  <Field
                    label="Colors (comma separated)"
                    value={editing.colorsCsv || ""}
                    onChange={(v) => setEditing({ ...editing, colorsCsv: v })}
                    full
                  />
                  <Field
                    label="Sizes (comma separated)"
                    value={editing.sizesCsv || ""}
                    onChange={(v) => setEditing({ ...editing, sizesCsv: v })}
                    full
                  />
                  <Field
                    label="Description"
                    value={editing.description || ""}
                    onChange={(v) => setEditing({ ...editing, description: v })}
                    full
                  />
                </div>
                <div className="admin-check-row">
                  {[
                    ["featured", "Featured"],
                    ["newArrival", "New Arrival"],
                    ["bestSeller", "Best Seller"],
                  ].map(([k, l]) => (
                    <label className="check" key={k}>
                      <input
                        type="checkbox"
                        checked={Boolean(editing[k])}
                        onChange={(e) =>
                          setEditing({ ...editing, [k]: e.target.checked })
                        }
                      />
                      {l}
                    </label>
                  ))}
                </div>
              </div>
            </div>
            <button
              className="btn"
              style={{ marginTop: 20 }}
              disabled={saving || uploading}
              onClick={() => void save()}
            >
              {saving ? "Saving…" : "Save product"}
            </button>
          </div>
        </div>
      )}
    </>
  );
}

function AdminCategories({ data, onNotify, onPreview }: any) {
  const [rows, setRows] = useState<any[]>(data);
  const [newName, setNewName] = useState("");
  const [newSlug, setNewSlug] = useState("");
  const [editing, setEditing] = useState<any>(null);
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState("");
  useEffect(() => setRows(Array.isArray(data) ? data : []), [data]);
  useEffect(() => {
    if (!editing) return;
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) setEditing(null);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [editing, busy]);
  const add = async () => {
    if (!newName.trim() || !newSlug.trim())
      return onNotify("Category name and slug are required.");
    setBusy(true);
    try {
      const c = await api<any>("/admin/categories", {
        method: "POST",
        body: JSON.stringify({
          name: newName.trim(),
          slug: newSlug.trim(),
          imageMode: "contain",
          imageRatio: "original",
        }),
      });
      setRows((r) => [...r, c]);
      setNewName("");
      setNewSlug("");
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify("Category created.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setBusy(false);
    }
  };
  const save = async () => {
    if (!editing) return;
    setBusy(true);
    try {
      const c = await api<any>(`/admin/categories/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editing.name.trim(),
          slug: editing.slug.trim(),
          description: editing.description || "",
          sortOrder: Number(editing.sortOrder) || 0,
          active: Boolean(editing.active),
          imageUrl: editing.imageUrl || "",
          imageMode: editing.imageMode || "contain",
          imageRatio: editing.imageRatio || "original",
          imageHeight: editing.imageHeight ? Number(editing.imageHeight) : null,
        }),
      });
      setRows((r) => r.map((x) => (x.id === c.id ? { ...x, ...c } : x)));
      setEditing(null);
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify("Category updated.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setBusy(false);
    }
  };
  const remove = async (id: string) => {
    if (confirmId !== id) {
      setConfirmId(id);
      return;
    }
    setConfirmId("");
    setBusy(true);
    try {
      await api(`/admin/categories/${id}`, { method: "DELETE" });
      setRows((r) => r.filter((x) => x.id !== id));
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify("Category removed.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <AdminPageFrame
        eyebrow="Catalog structure"
        title="Categories"
        description="Manage the real catalog taxonomy, imagery and display behaviour."
        count={rows.length}
        actions={
          <div className="admin-category-add-controls">
            <input
              className="admin-search"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="New category"
            />
            <input
              className="admin-search"
              value={newSlug}
              onChange={(e) => setNewSlug(e.target.value)}
              placeholder="slug"
            />
            <button className="btn" onClick={add} disabled={busy}>
              Add category
            </button>
          </div>
        }
      >
        <div className="admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Slug</th>
                <th>Products</th>
                <th>Image</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.length ? (
                rows.map((c: any) => (
                  <tr key={c.id}>
                    <td>
                      <strong>{c.name}</strong>
                      <div className="muted">
                        {c.description || "No description"}
                      </div>
                    </td>
                    <td>{c.slug}</td>
                    <td>{c._count?.products ?? 0}</td>
                    <td>
                      {c.imageUrl ? (
                        <img
                          className="admin-thumb"
                          src={c.imageUrl}
                          alt=""
                          onError={(e) => {
                            const el = e.currentTarget;
                            el.style.display = "none";
                            const m =
                              el.nextElementSibling as HTMLElement | null;
                            if (m) m.style.display = "inline";
                          }}
                          onLoad={(e) => {
                            const el = e.currentTarget;
                            el.style.display = "block";
                            const m =
                              el.nextElementSibling as HTMLElement | null;
                            if (m) m.style.display = "none";
                          }}
                        />
                      ) : null}
                      <span
                        className="muted"
                        style={{ display: c.imageUrl ? "none" : "inline" }}
                      >
                        {c.imageUrl ? "Image missing" : "None"}
                      </span>
                    </td>
                    <td>
                      <span className="admin-badge">
                        {c.active ? "ACTIVE" : "HIDDEN"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="btn text"
                        onClick={() => {
                          setEditing({ ...c });
                        }}
                        disabled={busy}
                      >
                        Edit
                      </button>
                      <button
                        className={`btn text ${confirmId === c.id ? "confirm-action" : ""}`}
                        onClick={() => remove(c.id)}
                        disabled={busy}
                      >
                        {confirmId === c.id ? "Confirm delete" : "Delete"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6}>
                    <div className="admin-empty">No categories yet.</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </AdminPageFrame>
      {editing && (
        <div
          className="overlay"
          onClick={(e) =>
            e.target === e.currentTarget && !busy && setEditing(null)
          }
        >
          <div
            className="admin-dark-panel admin-dark-panel-narrow"
            role="dialog"
            aria-modal="true"
            aria-label="Edit category"
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <h2 className="serif" style={{ fontSize: 38 }}>
                Edit Category
              </h2>
              <button
                className="close-btn"
                onClick={() => setEditing(null)}
                disabled={busy}
                aria-label="Close category editor"
              >
                <Icon name="close" />
              </button>
            </div>
            <div className="admin-form" style={{ marginTop: 24 }}>
              <Field
                label="Name"
                value={editing.name || ""}
                onChange={(v) => setEditing({ ...editing, name: v })}
                required
              />
              <Field
                label="Slug"
                value={editing.slug || ""}
                onChange={(v) => setEditing({ ...editing, slug: v })}
                required
              />
              <RangeControl
                label="Sort order"
                value={Number(editing.sortOrder ?? 0)}
                min={0}
                max={100}
                step={1}
                hint="Lower numbers appear first"
                onChange={(v) => setEditing({ ...editing, sortOrder: v })}
              />
              <ImageField
                label="Category image (URL or upload)"
                value={editing.imageUrl || ""}
                onChange={(v) => setEditing({ ...editing, imageUrl: v })}
                onNotify={onNotify}
              />
              <div className="form-grid">
                <div className="field">
                  <label>Display mode</label>
                  <select
                    value={editing.imageMode || "contain"}
                    onChange={(e) =>
                      setEditing({ ...editing, imageMode: e.target.value })
                    }
                  >
                    <option>contain</option>
                    <option>cover</option>
                    <option>full</option>
                  </select>
                </div>
                <div className="field">
                  <label>Aspect ratio</label>
                  <select
                    value={editing.imageRatio || "original"}
                    onChange={(e) =>
                      setEditing({ ...editing, imageRatio: e.target.value })
                    }
                  >
                    <option>original</option>
                    <option>5:8</option>
                    <option>4:5</option>
                    <option>3:4</option>
                    <option>1:1</option>
                  </select>
                </div>
                <RangeControl
                  label="Image height"
                  value={Number(editing.imageHeight || 0)}
                  min={0}
                  max={1600}
                  step={10}
                  unit="px"
                  hint="0 = natural height"
                  onChange={(v) => setEditing({ ...editing, imageHeight: v })}
                />
              </div>
              <div className="field full">
                <label>Description</label>
                <textarea
                  value={editing.description || ""}
                  onChange={(e) =>
                    setEditing({ ...editing, description: e.target.value })
                  }
                />
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={Boolean(editing.active)}
                  onChange={(e) =>
                    setEditing({ ...editing, active: e.target.checked })
                  }
                />
                Visible in storefront
              </label>
            </div>
            <button
              className="btn"
              style={{ marginTop: 20 }}
              onClick={save}
              disabled={busy}
            >
              Save category
            </button>
          </div>
        </div>
      )}
    </>
  );
}
function SiteSettings({
  settings,
  setSettings,
  onNotify,
  onPreview,
}: {
  settings: Record<string, any>;
  setSettings: (x: any) => void;
  onNotify: (x: string) => void;
  onPreview?: (path: string) => void;
}) {
  const [draft, setDraft] = useState(settings);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => setDraft(settings), [settings]);
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const out = await api<Record<string, any>>("/admin/settings", {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      setSettings(out);
      window.dispatchEvent(new CustomEvent("atelier:data-changed"));
      onNotify("Site settings saved.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setSaving(false);
    }
  };
  const update = (key: string, value: any) =>
    setDraft((d: any) => ({ ...d, [key]: value }));
  const onQr = async (file?: File) => {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type))
      return onNotify("Choose a JPG, PNG or WEBP image.");
    if (file.size > 1000 * 1024)
      return onNotify("QR image must be 1 MB or smaller.");
    setUploading(true);
    try {
      const reader = new FileReader();
      const data = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("QR_READ_FAILED"));
        reader.readAsDataURL(file);
      });
      setDraft((d: any) => ({ ...d, paymentQrUrl: data }));
      onNotify("QR image loaded. Save settings to publish it.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setUploading(false);
    }
  };
  const TextField = ({
    label,
    k,
    help,
  }: {
    label: string;
    k: string;
    help?: string;
  }) => (
    <div className="field">
      <label>{label}</label>
      <input
        value={String(draft[k] ?? "")}
        onChange={(e) => update(k, e.target.value)}
      />
      {help && <small className="settings-help">{help}</small>}
    </div>
  );
  const HeroCard = ({
    n,
    title,
    description,
  }: {
    n: 1 | 2 | 3;
    title: string;
    description: string;
  }) => {
    const prefix = `hero${n}`;
    const imageKey = `${prefix}Image`;
    return (
      <section className="settings-section hero-settings-card">
        <div className="settings-section-head">
          <div>
            <div className="eyebrow">HERO 0{n}</div>
            <h3>{title}</h3>
            <p>{description}</p>
          </div>
          <span className="settings-index">0{n}</span>
        </div>
        <div className="settings-hero-grid">
          <div className="admin-form">
            <TextField label="Eyebrow" k={`${prefix}Eyebrow`} />
            <TextField label="Supporting Text" k={`${prefix}Text`} />
            <TextField label="Headline Line 1" k={`${prefix}Line1`} />
            <TextField label="Headline Line 2" k={`${prefix}Line2`} />
            <TextField label="Headline Line 3" k={`${prefix}Line3`} />
            <ImageField
              label="Hero Image (URL or upload)"
              value={String(draft[imageKey] || "")}
              onChange={(v) => update(imageKey, v)}
              onNotify={onNotify}
            />
          </div>
          <div className="settings-image-preview">
            <div className="eyebrow">Preview</div>
            {draft[imageKey] ? (
              <img
                src={String(draft[imageKey])}
                alt={`Hero 0${n} preview`}
                onError={(e) => {
                  e.currentTarget.style.display = "none";
                }}
                onLoad={(e) => {
                  e.currentTarget.style.display = "block";
                }}
              />
            ) : (
              <div className="settings-image-empty">
                Add an image URL to preview this hero.
              </div>
            )}
          </div>
        </div>
      </section>
    );
  };
  return (
    <div className="site-settings">
      <div className="admin-toolbar admin-section-toolbar settings-toolbar">
        <div>
          <div className="eyebrow">Full website controls</div>
          <h2 className="serif">Site Settings</h2>
          <p className="admin-section-description">
            Configure the storefront content without guessing what each Hero
            field controls.
          </p>
        </div>
        <div
          style={{
            display: "flex",
            gap: 8,
            flexWrap: "wrap",
            justifyContent: "flex-end",
          }}
        >
          <button className="btn text" onClick={() => onPreview?.("/")}>
            Live Preview
          </button>
          <button className="btn" disabled={saving || uploading} onClick={save}>
            {saving ? "Saving…" : "Save changes"}
          </button>
        </div>
      </div>
      <fieldset className="settings-controls" disabled={saving || uploading}>
        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <div className="eyebrow">General</div>
              <h3>Brand & General</h3>
              <p>Core storefront identity and customer-facing messaging.</p>
            </div>
          </div>
          <div className="admin-form">
            <TextField label="Site Name" k="siteName" />
            <TextField label="Tagline" k="tagline" />
            <TextField label="Announcement" k="announcement" />
            <TextField label="Currency" k="currency" />
            <TextField label="Contact Email" k="contactEmail" />
            <TextField label="WhatsApp Admin Number" k="whatsappAdminNumber" />
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <div className="eyebrow">Navigation</div>
              <h3>Header & Footer</h3>
              <p>Labels shown across the storefront navigation and footer.</p>
            </div>
          </div>
          <div className="admin-form">
            <TextField label="Home Label" k="headerHomeLabel" />
            <TextField label="Shop Label" k="headerShopLabel" />
            <TextField label="Collections Label" k="headerCollectionsLabel" />
            <TextField label="About Label" k="headerAboutLabel" />
            <TextField label="Footer Tagline" k="footerTagline" />
            <TextField label="Footer Shop Label" k="footerShopLabel" />
            <TextField label="Footer About Label" k="footerAboutLabel" />
            <TextField label="Footer Help Label" k="footerHelpLabel" />
            <TextField label="Copyright" k="copyrightText" />
            <TextField label="Newsletter Text" k="newsletterText" />
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <div className="eyebrow">Navigation</div>
              <h3>Main menu links</h3>
              <p>
                Add, rename, reorder or remove the header menu links (new pages
                can be added here).
              </p>
            </div>
          </div>
          <NavEditor
            value={String(draft.navLinks || "")}
            onChange={(v) => update("navLinks", v)}
          />
        </section>
        <HeroCard
          n={1}
          title="Primary Homepage Hero"
          description="The first campaign slide shown on the ATELIER homepage."
        />
        <HeroCard
          n={2}
          title="Secondary Homepage Hero"
          description="The second campaign slide in the homepage hero carousel."
        />
        <HeroCard
          n={3}
          title="Tertiary Homepage Hero"
          description="The third campaign slide in the homepage hero carousel."
        />
        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <div className="eyebrow">Homepage Sections</div>
              <h3>Ticker, Story & Manifesto</h3>
              <p>Control the editorial storytelling sections and ticker shown on the homepage.</p>
            </div>
          </div>
          <div className="admin-form">
            <TextField label="Homepage Scrolling Ticker Text" k="homeTicker" help="Text appearing in the continuous marquee banner under the hero." />
            <TextField label="Film Section Intro Title" k="homeFilmTitle" help="Heading for 01 / THE POINT OF VIEW section." />
            <TextField label="Film Section Intro Description" k="homeFilmText" />
            <TextField label="Manifesto Headline" k="homeManifestoTitle" />
            <TextField label="Manifesto Emphasized Word" k="homeManifestoEmphasis" />
            <TextField label="Manifesto Paragraph" k="homeManifestoBody" />
            <TextField label="Curated Shop Title" k="homeShopTitle" />
            <TextField label="Curated Shop Description" k="homeShopBody" />
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <div className="eyebrow">Homepage Cards</div>
              <h3>Featured Editorial Collections</h3>
              <p>Editorial collection spotlight cards shown on the homepage.</p>
            </div>
          </div>
          <div className="admin-form">
            <TextField label="Card 1 Title" k="homeEditorialCard1Title" />
            <TextField label="Card 1 Subtitle / Label" k="homeEditorialCard1Label" />
            <ImageField
              label="Card 1 Image"
              value={String(draft.homeEditorialCard1Image || "")}
              onChange={(v) => update("homeEditorialCard1Image", v)}
              onNotify={onNotify}
            />
            <TextField label="Card 2 Title" k="homeEditorialCard2Title" />
            <TextField label="Card 2 Subtitle / Label" k="homeEditorialCard2Label" />
            <ImageField
              label="Card 2 Image"
              value={String(draft.homeEditorialCard2Image || "")}
              onChange={(v) => update("homeEditorialCard2Image", v)}
              onNotify={onNotify}
            />
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <div className="eyebrow">Visual Appearance</div>
              <h3>Site Image Size & Grid Density</h3>
              <p>Change product image aspect ratios, scaling, padding, and catalog columns across the entire website.</p>
            </div>
          </div>
          <div className="admin-form">
            <div className="field">
              <label>Product Card Aspect Ratio</label>
              <select
                value={String(draft.imageAspect || draft.theme?.imageAspect || "4/5")}
                onChange={(e) => {
                  update("imageAspect", e.target.value);
                  update("theme", { ...(draft.theme || {}), imageAspect: e.target.value });
                }}
              >
                <option value="4/5">4:5 — Editorial Portrait (Tall / Luxury)</option>
                <option value="3/4">3:4 — Classic Studio Portrait</option>
                <option value="1/1">1:1 — Clean Square (E-Commerce Standard)</option>
                <option value="16/9">16:9 — Cinematic Landscape</option>
                <option value="auto">Auto / Original aspect</option>
              </select>
            </div>
            <div className="field">
              <label>Image Framing Style</label>
              <select
                value={String(draft.imageFit || draft.theme?.imageFit || "contain")}
                onChange={(e) => {
                  update("imageFit", e.target.value);
                  update("theme", { ...(draft.theme || {}), imageFit: e.target.value });
                }}
              >
                <option value="contain">Contain (Full garment visible with padding)</option>
                <option value="cover">Cover (Fill card edge-to-edge)</option>
              </select>
            </div>
            <RangeControl
              label="Shop Catalog Grid Columns"
              value={Number(draft.shopCols || draft.theme?.shopCols || 3)}
              min={2}
              max={5}
              step={1}
              unit="cols"
              onChange={(v) => {
                update("shopCols", v);
                update("theme", { ...(draft.theme || {}), shopCols: v });
              }}
            />
            <RangeControl
              label="Homepage Product Columns"
              value={Number(draft.homeCols || draft.theme?.homeCols || 5)}
              min={2}
              max={6}
              step={1}
              unit="cols"
              onChange={(v) => {
                update("homeCols", v);
                update("theme", { ...(draft.theme || {}), homeCols: v });
              }}
            />
            <RangeControl
              label="Card Image Padding"
              value={Number(draft.imagePadding ?? draft.theme?.imagePadding ?? 8)}
              min={0}
              max={24}
              step={2}
              unit="px"
              onChange={(v) => {
                update("imagePadding", v);
                update("theme", { ...(draft.theme || {}), imagePadding: v });
              }}
            />
            <RangeControl
              label="Image Zoom / Scale"
              value={Number(draft.imageScale ?? draft.theme?.imageScale ?? 100)}
              min={75}
              max={125}
              step={5}
              unit="%"
              onChange={(v) => {
                update("imageScale", v);
                update("theme", { ...(draft.theme || {}), imageScale: v });
              }}
            />
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <div className="eyebrow">Payments</div>
              <h3>Payment & QR</h3>
              <p>Store payment configuration and QR reference image.</p>
            </div>
          </div>
          <div className="admin-form">
            <TextField label="UPI ID" k="paymentUpiId" />
            <TextField label="Razorpay QR ID" k="paymentRazorpayQrId" />
            <div className="field full">
              <label>Store Payment QR</label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.currentTarget.files?.[0];
                  e.currentTarget.value = "";
                  void onQr(file);
                }}
                disabled={uploading}
              />
              {draft.paymentQrUrl && (
                <img
                  className="settings-qr-preview"
                  src={String(draft.paymentQrUrl)}
                  alt="Configured ATELIER payment QR"
                  onError={(e) => {
                    e.currentTarget.style.display = "none";
                  }}
                  onLoad={(e) => {
                    e.currentTarget.style.display = "block";
                  }}
                />
              )}
              <small className="settings-help">
                Upload an image and save settings to publish it.
              </small>
            </div>
          </div>
        </section>
        <section className="settings-section">
          <div className="settings-section-head">
            <div>
              <div className="eyebrow">Social</div>
              <h3>Social Links</h3>
            </div>
          </div>
          <div className="admin-form">
            <TextField label="Instagram" k="socialInstagram" />
            <TextField label="Pinterest" k="socialPinterest" />
            <TextField label="Facebook" k="socialFacebook" />
          </div>
        </section>
      </fieldset>
    </div>
  );
}

function AdminSecurityMonitor({ onNotify }: { onNotify: (x: string) => void }) {
  const [events, setEvents] = useState<any[]>([]);
  const [blocks, setBlocks] = useState<any[]>([]);
  const [ipAddress, setIpAddress] = useState("");
  const [reason, setReason] = useState("Repeated suspicious requests");
  const [isPermanent, setIsPermanent] = useState(true);
  const [hours, setHours] = useState("24");
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const load = async () => {
    setLoading(true);
    try {
      const [e, b] = await Promise.all([
        api<any[]>("/admin/security/events"),
        api<any[]>("/admin/security/blocks"),
      ]);
      setEvents(Array.isArray(e) ? e : []);
      setBlocks(Array.isArray(b) ? b : []);
    } catch (err: any) {
      onNotify(errorText(err.message));
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const blockIp = async (value: string, why?: string) => {
    const target = value.trim();
    if (!target) return onNotify("Enter an IP address first.");
    const perm = isPermanent;
    const title = perm
      ? `Permanently block ${target}?`
      : `Temporarily block ${target} for ${hours} hour(s)?`;
    if (
      !confirm(
        `${title}\nRequests from this IP will receive a 404 security warning. IP-only blocking can be bypassed if the visitor changes networks or uses a VPN.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api("/admin/security/blocks", {
        method: "POST",
        body: JSON.stringify({
          ipAddress: target,
          reason:
            (why || reason).trim() || "Manual administrator security block",
          isPermanent: perm,
          ...(!perm ? { hours: Number(hours) } : {}),
        }),
      });
      onNotify(
        perm
          ? `Permanent IP block added for ${target}.`
          : `Temporary IP block added for ${target}.`,
      );
      setIpAddress("");
      await load();
    } catch (err: any) {
      onNotify(errorText(err.message));
    } finally {
      setBusy(false);
    }
  };
  const unblock = async (block: any) => {
    if (
      !confirm(
        `Remove the ${block.isPermanent ? "permanent" : "temporary"} block for ${block.ipAddress}?`,
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/admin/security/blocks/${block.id}`, { method: "DELETE" });
      onNotify(`IP block removed for ${block.ipAddress}.`);
      await load();
    } catch (err: any) {
      onNotify(errorText(err.message));
    } finally {
      setBusy(false);
    }
  };
  const activeIps = new Set(blocks.map((b) => b.ipAddress));
  return (
    <div className="admin-module">
      <AdminPageFrame
        eyebrow="Security / Threat response"
        title="Security Monitor"
        description="High-confidence request probes, automatic temporary IP blocks, and administrator-managed permanent bans. This records detections; it cannot guarantee detection of every exploit."
        count={events.length}
        actions={
          <div className="admin-toolbar-actions">
            <button
              className="btn text"
              onClick={() => void load()}
              disabled={busy || loading}
            >
              Refresh
            </button>
          </div>
        }
      >
        <section
          className="admin-card admin-module-card"
          style={{ marginBottom: 20 }}
        >
          <div className="eyebrow">Manual IP control</div>
          <h3 className="serif" style={{ margin: "8px 0" }}>
            Block an IP address
          </h3>
          <p className="admin-section-description">
            Use an exact IPv4 or IPv6 address from the event list. Permanent
            bans stay in the database until an administrator removes them.
            Localhost and allowlisted IPs cannot be blocked from this panel.
          </p>
          <div className="admin-form" style={{ marginTop: 14 }}>
            <div className="field">
              <label htmlFor="security-ip-address">IP address</label>
              <input
                id="security-ip-address"
                className="admin-search"
                autoComplete="off"
                spellCheck={false}
                placeholder="203.0.113.10"
                value={ipAddress}
                onChange={(e) => setIpAddress(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="security-ip-reason">Reason</label>
              <input
                id="security-ip-reason"
                className="admin-search"
                maxLength={240}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="security-ip-permanent">Block duration</label>
              <label
                style={{
                  display: "flex",
                  gap: 9,
                  alignItems: "center",
                  padding: "10px 0",
                }}
              >
                <input
                  id="security-ip-permanent"
                  type="checkbox"
                  checked={isPermanent}
                  onChange={(e) => setIsPermanent(e.target.checked)}
                />{" "}
                Permanent block
              </label>
              {!isPermanent && (
                <select
                  className="admin-search"
                  aria-label="Temporary block duration"
                  value={hours}
                  onChange={(e) => setHours(e.target.value)}
                >
                  <option value="1">1 hour</option>
                  <option value="6">6 hours</option>
                  <option value="24">24 hours</option>
                  <option value="72">3 days</option>
                  <option value="168">7 days</option>
                  <option value="720">30 days</option>
                </select>
              )}
            </div>
          </div>
          <div
            className="admin-toolbar-actions"
            style={{ marginTop: 12, justifyContent: "flex-start" }}
          >
            <button
              className="btn dark"
              disabled={busy || !ipAddress.trim() || !reason.trim()}
              onClick={() => void blockIp(ipAddress)}
            >
              <Icon name="shield" size={14} />
              {busy
                ? "Saving…"
                : isPermanent
                  ? "Permanently block IP"
                  : "Block IP temporarily"}
            </button>
          </div>
        </section>
        <section
          className="admin-card admin-module-card"
          style={{ marginBottom: 20 }}
        >
          <div className="eyebrow">Current block list</div>
          <h3 className="serif" style={{ margin: "8px 0 16px" }}>
            Blocked IP addresses
          </h3>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>IP address</th>
                  <th>Type</th>
                  <th>Reason</th>
                  <th>Expires</th>
                  <th>Added</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {blocks.length ? (
                  blocks.map((b) => (
                    <tr key={b.id}>
                      <td>
                        <strong>{b.ipAddress}</strong>
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${b.isPermanent ? "admin-badge-danger" : ""}`}
                        >
                          {b.isPermanent ? "PERMANENT" : "TEMPORARY"}
                        </span>
                      </td>
                      <td>{b.reason || "—"}</td>
                      <td>
                        {b.isPermanent
                          ? "Never"
                          : b.expiresAt
                            ? new Date(b.expiresAt).toLocaleString()
                            : "—"}
                      </td>
                      <td>{new Date(b.createdAt).toLocaleString()}</td>
                      <td>
                        <button
                          className="btn text danger-text"
                          disabled={busy}
                          onClick={() => void unblock(b)}
                        >
                          Unblock
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6}>
                      <div className="admin-empty">
                        <strong>No active IP blocks.</strong>
                        <span>
                          Automatic blocks and permanent bans will appear here.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
        <section className="admin-card admin-module-card">
          <div className="eyebrow">Request detections</div>
          <h3 className="serif" style={{ margin: "8px 0 16px" }}>
            Security audit events
          </h3>
          <p className="admin-section-description">
            The same event history is also recorded in Activity Log. Automatic
            blocks are temporary for 24 hours after three high-confidence
            signals within 15 minutes; administrators can apply permanent blocks
            here.
          </p>
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Time</th>
                  <th>IP address</th>
                  <th>Detection</th>
                  <th>Request</th>
                  <th>Action</th>
                  <th>User agent</th>
                  <th>Response</th>
                </tr>
              </thead>
              <tbody>
                {events.length ? (
                  events.map((e) => (
                    <tr key={e.id}>
                      <td>{new Date(e.createdAt).toLocaleString()}</td>
                      <td>
                        <strong>{e.ipAddress}</strong>
                      </td>
                      <td>{e.reason}</td>
                      <td>
                        <div>{e.method}</div>
                        <div
                          className="muted"
                          style={{ maxWidth: 260, overflowWrap: "anywhere" }}
                        >
                          {e.path}
                        </div>
                      </td>
                      <td>
                        <span
                          className={`admin-badge ${String(e.action).includes("BLOCK") ? "admin-badge-danger" : ""}`}
                        >
                          {e.action}
                        </span>
                      </td>
                      <td>
                        <span
                          className="muted"
                          style={{
                            maxWidth: 230,
                            display: "block",
                            overflowWrap: "anywhere",
                          }}
                        >
                          {e.userAgent || "—"}
                        </span>
                      </td>
                      <td>
                        {activeIps.has(e.ipAddress) ? (
                          <span className="admin-badge admin-badge-danger">
                            BLOCKED
                          </span>
                        ) : (
                          <button
                            className="btn text danger-text"
                            disabled={busy || activeIps.has(e.ipAddress)}
                            onClick={() =>
                              void blockIp(
                                e.ipAddress,
                                `Security event: ${e.reason}`,
                              )
                            }
                          >
                            Block IP
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={7}>
                      <div className="admin-empty">
                        <strong>
                          {loading
                            ? "Loading events…"
                            : "No security events yet."}
                        </strong>
                        <span>
                          Suspicious requests and blocked-IP reattempts will be
                          listed here.
                        </span>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </AdminPageFrame>
    </div>
  );
}

function Audit({ onNotify }: { onNotify: (x: string) => void }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [busy, setBusy] = useState<string | "all" | null>(null);
  const load = async () => {
    try {
      const v = await api<any[]>("/admin/audit");
      setLogs(Array.isArray(v) ? v : []);
    } catch (e: any) {
      onNotify(errorText(e.message));
    }
  };
  useEffect(() => {
    void load();
  }, []);
  const deleteOne = async (id: string) => {
    if (!confirm("Delete this audit event permanently? This cannot be undone."))
      return;
    setBusy(id);
    try {
      await api(`/admin/audit/${id}`, { method: "DELETE" });
      setLogs((v) => v.filter((x) => x.id !== id));
      onNotify("Audit event deleted.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setBusy(null);
    }
  };
  const clearAll = async () => {
    if (!logs.length) return;
    const confirmed = confirm(
      `Delete all ${logs.length} visible audit events permanently? This cannot be undone.`,
    );
    if (!confirmed) return;
    const typed = prompt("Type DELETE AUDIT to confirm permanent removal:");
    if (typed !== "DELETE AUDIT") return onNotify("Audit deletion cancelled.");
    setBusy("all");
    try {
      await api("/admin/audit", { method: "DELETE" });
      setLogs([]);
      onNotify("Audit log cleared.");
    } catch (e: any) {
      onNotify(errorText(e.message));
    } finally {
      setBusy(null);
    }
  };
  return (
    <AdminPageFrame
      eyebrow="Traceability"
      title="Audit Log"
      description="Administrative activity and system traceability. Deletion is permanent and requires explicit confirmation."
      count={logs.length}
      actions={
        <div className="admin-toolbar-actions">
          <button
            className="btn text"
            onClick={() => void load()}
            disabled={busy !== null}
          >
            Refresh
          </button>
          <button
            className="btn danger"
            onClick={clearAll}
            disabled={!logs.length || busy !== null}
          >
            <Icon name="trash" size={13} /> Delete all
          </button>
        </div>
      }
    >
      <div className="admin-audit-warning">
        <Icon name="shield" size={14} />
        <span>
          Audit deletion removes stored trace records and is not reversible.
        </span>
      </div>
      <div className="admin-table-wrap">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Actor</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Details</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {logs.length ? (
              logs.map((l) => (
                <tr key={l.id}>
                  <td>{new Date(l.createdAt).toLocaleString()}</td>
                  <td>{l.actor?.email || "System"}</td>
                  <td>
                    <span className="admin-badge">{l.action}</span>
                  </td>
                  <td>{l.entity}</td>
                  <td>
                    <details className="admin-details">
                      <summary>View details</summary>
                      <pre>{JSON.stringify(l.details, null, 2)}</pre>
                    </details>
                  </td>
                  <td>
                    <button
                      className="btn text danger-text"
                      onClick={() => void deleteOne(l.id)}
                      disabled={busy !== null}
                    >
                      <Icon name="trash" size={13} /> Delete
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>
                  <div className="admin-empty">
                    <strong>No audit events.</strong>
                    <span>
                      Administrative activity will appear here automatically.
                    </span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AdminPageFrame>
  );
}

function UserModal({ data, onClose }: { data: any; onClose: () => void }) {
  useEffect(() => {
    const closeOnEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);
  return (
    <div
      className="overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="admin-dark-panel"
        role="dialog"
        aria-modal="true"
        aria-label="Customer detail"
      >
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div className="eyebrow">Customer detail</div>
            <h2
              className="serif"
              style={{ fontSize: 42, margin: "6px 0", color: "#f5efe7" }}
            >
              {data.user.name}
            </h2>
            <div className="muted" style={{ color: "#bdb5aa" }}>
              {data.user.email} · {data.user.phone}
            </div>
          </div>
          <button
            className="close-btn"
            onClick={onClose}
            aria-label="Close customer detail"
          >
            <Icon name="close" />
          </button>
        </div>
        <div className="checkout-card">
          <h3>Addresses</h3>
          {Array.isArray(data.addresses) && data.addresses.length ? (
            data.addresses.map((a: any) => (
              <div className="option" key={a.id}>
                {formatAddress(a)}
              </div>
            ))
          ) : (
            <div className="muted">No saved addresses.</div>
          )}
        </div>
        <div className="checkout-card">
          <h3>Orders</h3>
          {Array.isArray(data.orders) && data.orders.length ? (
            data.orders.map((o: any) => (
              <div key={o.id} className="option">
                <span>
                  <b>{o.orderNumber}</b>
                  <span
                    style={{
                      display: "block",
                      color: "var(--muted)",
                      fontSize: 10,
                    }}
                  >
                    {(Array.isArray(o.items) ? o.items : [])
                      .map((i: any) => `${i.productName} × ${i.quantity}`)
                      .join(" · ")}
                  </span>
                </span>
                <span>
                  {money(o.total)}
                  <span
                    style={{
                      display: "block",
                      color: "var(--muted)",
                      fontSize: 9,
                    }}
                  >
                    {o.paymentStatus}
                  </span>
                </span>
              </div>
            ))
          ) : (
            <div className="muted">No orders.</div>
          )}
        </div>
        <div className="checkout-card">
          <h3>Wishlist</h3>
          <div className="muted">
            {Array.isArray(data.wishlist) && data.wishlist.length
              ? data.wishlist.map((p: any) => p.name).join(" · ")
              : "No saved pieces."}
          </div>
        </div>
        <div className="checkout-card">
          <h3>Current Cart</h3>
          {Array.isArray(data.cart) && data.cart.length ? (
            data.cart.map((i: any) => (
              <div key={i.id} className="option">
                <span>
                  {i.product?.name} · {i.color} / {i.size}
                </span>
                <b>× {i.quantity}</b>
              </div>
            ))
          ) : (
            <div className="muted">Cart is empty.</div>
          )}
        </div>
      </div>
    </div>
  );
}

function NotFound({ onNavigate }: { onNavigate: (x: string) => void }) {
  return (
    <div className="wrap empty">
      <div className="eyebrow">ATELIER / 404</div>
      <h2>Page not found.</h2>
      <p>Return to the collection.</p>
      <button
        className="btn"
        style={{ marginTop: 20 }}
        onClick={() => onNavigate("/")}
      >
        Back to Home
      </button>
    </div>
  );
}
