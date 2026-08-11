import { ErrorScreen } from "@/components/shared/error-screen";

export default function NotFound() {
  return (
    <main id="main">
      <ErrorScreen
        kind="not-found"
        code="404 • LOST WORLD"
        title="These coordinates lead nowhere."
        copy="The page may have moved, been renamed, or never existed. Return to the network and choose another path."
      />
    </main>
  );
}
