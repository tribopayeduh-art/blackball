import { createFileRoute } from "@tanstack/react-router";
import { handlePartner, corsPreflight } from "@/lib/partner-api.server";

export const Route = createFileRoute("/api/public/v1/bet")({
  server: {
    handlers: {
      OPTIONS: async () => corsPreflight(),
      POST: async ({ request }) =>
        handlePartner(request, "/v1/bet", async ({ partner, body, admin }) => {
          const round_id = String(body.round_id ?? "").trim();
          const user_id = String(body.user_id ?? "").trim();
          const stake = Number(body.stake);
          if (!round_id || !user_id) return { status: 400, body: { error: "missing_fields" } };
          if (!Number.isFinite(stake) || stake <= 0) return { status: 400, body: { error: "invalid_stake" } };

          const { data: existing } = await admin.from("api_rounds")
            .select("*").eq("partner_id", partner.id).eq("external_round_id", round_id).maybeSingle();
          if (existing) {
            return { status: 200, body: { round_id, status: existing.status, balance: Number(partner.balance), duplicate: true } };
          }
          if (Number(partner.balance) < stake) return { status: 402, body: { error: "insufficient_funds" } };

          const newBal = Number(partner.balance) - stake;
          await admin.from("api_partners").update({ balance: newBal, updated_at: new Date().toISOString() }).eq("id", partner.id);
          await admin.from("api_rounds").insert({
            partner_id: partner.id, external_round_id: round_id, external_user_id: user_id,
            stake, status: "open", meta: body.meta ?? null,
          });
          return { status: 200, body: { round_id, status: "open", stake, balance: newBal } };
        }),
    },
  },
});