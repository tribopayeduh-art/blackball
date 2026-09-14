import { createFileRoute } from "@tanstack/react-router";
import { handlePartner, corsPreflight } from "@/lib/partner-api.server";

export const Route = createFileRoute("/api/public/v1/settle")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) =>
        handlePartner(request, "/v1/settle", async ({ partner, body, admin }) => {
          const round_id = String(body.round_id ?? "").trim();
          const payout = Number(body.payout ?? 0);
          if (!round_id) return { status: 400, body: { error: "missing_round_id" } };
          if (!Number.isFinite(payout) || payout < 0) return { status: 400, body: { error: "invalid_payout" } };

          const { data: round } = await admin.from("api_rounds")
            .select("*").eq("partner_id", partner.id).eq("external_round_id", round_id).maybeSingle();
          if (!round) return { status: 404, body: { error: "round_not_found" } };
          if (round.status !== "open") {
            return { status: 200, body: { round_id, status: round.status, payout: Number(round.payout), balance: Number(partner.balance), duplicate: true } };
          }
          const status = payout > 0 ? "won" : "lost";
          const newBal = Number(partner.balance) + payout;
          await admin.from("api_partners").update({ balance: newBal, updated_at: new Date().toISOString() }).eq("id", partner.id);
          await admin.from("api_rounds").update({ payout, status, settled_at: new Date().toISOString() }).eq("id", round.id);
          return { status: 200, body: { round_id, status, payout, balance: newBal } };
        }),
    },
  },
});