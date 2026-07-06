import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/")({
  component: () => {
    // TEMPORARY: Show a debug page so we can see if routing works
    return (
      <div className="p-8">
        <h1 className="text-2xl">Authenticated Root – Debug</h1>
        <p>If you see this, the _authenticated layout works.</p>
      </div>
    );
  },
});
