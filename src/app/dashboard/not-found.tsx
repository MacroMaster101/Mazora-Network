import { ErrorScreen } from "@/components/shared/error-screen";

export default function DashboardNotFound() {
  return <ErrorScreen kind="not-found" code="404 • PORTAL ROUTE" title="This dashboard page does not exist." copy="The page may have moved or is not available for your account. Return to your dashboard and choose another section." returnHref="/dashboard" returnLabel="Dashboard home" compact />;
}