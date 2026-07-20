import { RouteLoading } from "@/components/shared/route-loading";

export default function AuthLoading() {
  // The auth form column is a theme surface, not the dark world artwork.
  return <RouteLoading tone="surface" />;
}