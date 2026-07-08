import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/dashboard")({
  ssr: false,
  component: () => <div>Dashboard works!</div>,
});
