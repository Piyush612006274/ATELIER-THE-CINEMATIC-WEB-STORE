import { Suspense } from "react";
import Storefront from "@/components/storefront/storefront";

export const dynamic = "force-dynamic";

function StorefrontFallback() {
  return (
    <div className="storefront-loading page" aria-busy="true" aria-label="Loading ATELIER">
      <div className="loading-topbar">
        <span className="loading-brand">ATELIER</span>
      </div>
    </div>
  );
}

export default function CatchAllPage() {
  return (
    <Suspense fallback={<StorefrontFallback />}>
      <Storefront />
    </Suspense>
  );
}
