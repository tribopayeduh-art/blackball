import { createFileRoute } from "@tanstack/react-router";
import { handlePartner, corsPreflight } from "@/lib/partner-api.server";

export const Route = createFileRoute("/api/public/v1/rollback")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) =>
        handlePartner(request, "/v1/rollback", async ({ partner, body, admin }) => {
          const round_id = String(body.round_id ?? "").trim();
          if (!round_id) return { status: 400, body: { error: "missing_round_id" } };
          const { data: round } = await admin.from("api_rounds")
            .select("*").eq("partner_id", partner.id).eq("external_round_id", round_id).maybeSingle();
          if (!round) return { status: 404, body: { error: "round_not_found" } };
          if (round.status === "refunded") {
            return { status: 200, body: { round_id, status: "refunded", balance: Number(partner.balance), duplicate: true } };
          }
          const delta = Number(round.stake) - Number(round.payout);
          const newBal = Number(partner.balance) + delta;
          await admin.from("api_partners").update({ balance: newBal, updated_at: new Date().toISOString() }).eq("id", partner.id);
          await admin.from("api_rounds").update({ status: "refunded", settled_at: new Date().toISOString() }).eq("id", round.id);
          return { status: 200, body: { round_id, status: "refunded", refunded: delta, balance: newBal } };
        }),
    },
  },
});