import { createFileRoute } from "@tanstack/react-router";
import { handlePartner, corsPreflight } from "@/lib/partner-api.server";

export const Route = createFileRoute("/api/public/v1/balance")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) =>
        handlePartner(request, "/v1/balance", async ({ partner }) => ({
          status: 200,
          body: {
            partner: partner.name,
            currency: "BRL",
            balance: Number(partner.balance),
          },
        })),
    },
  },
});