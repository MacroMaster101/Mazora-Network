import { ErrorScreen } from "@/components/shared/error-screen";

export default function NotFound() {
  return (
    <ErrorScreen
      code="404 • LOST CHUNK"
      title="This world doesn’t exist."
      copy="The coordinates point beyond the generated map. The page may have moved, been renamed, or never spawned here."
    />
  );
}