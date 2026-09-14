import { createFileRoute } from "@tanstack/react-router";
import { handlePartner, corsPreflight } from "@/lib/partner-api.server";

export const Route = createFileRoute("/api/public/v1/ping")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) =>
        handlePartner(request, "/v1/ping", async ({ partner }) => ({
          status: 200,
          body: { ok: true, partner: partner.name, ts: Date.now() },
        })),
    },
  },
});