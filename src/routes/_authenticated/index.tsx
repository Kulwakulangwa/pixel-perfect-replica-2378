import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  ssr: false,
  beforeLoad: async () => {
    throw redirect({ to: "/dashboard", replace: true });
  },
  component: () => null,
});
