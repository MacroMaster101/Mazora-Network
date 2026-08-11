import { ErrorScreen } from "@/components/shared/error-screen";

export default function AdminNotFound() {
  return (
    <div className="admin-recovery-overlay">
      <ErrorScreen
        kind="not-found"
        code="404 • ADMIN ROUTE NOT FOUND"
        title="This staff page does not exist."
        copy="The tool may have moved or may not be available for this staff role. Return to the Control Room to select another board."
        returnHref="/admin"
        returnLabel="Control room"
        compact
      />
    </div>
  );
}
