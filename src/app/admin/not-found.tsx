import { ErrorScreen } from "@/components/shared/error-screen";

export default function AdminNotFound() {
  return <ErrorScreen kind="not-found" code="404 • ADMIN ROUTE" title="This staff page does not exist." copy="The tool may have moved or may not be available for this role. Return to the control room and choose another section." returnHref="/admin" returnLabel="Control room" compact />;
}