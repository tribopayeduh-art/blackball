import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/pix/callback")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let payload: Record<string, unknown> = {};
        try {
          payload = (await request.json()) as Record<string, unknown>;
        } catch {
          return new Response(JSON.stringify({ ok: false, error: "invalid_json" }), { status: 400 });
        }

        const identifier =
          (payload.identifier as string) ||
          ((payload.transaction as Record<string, unknown> | undefined)?.identifier as string) ||
          "";
        const gatewayId =
          (payload.transactionId as string) ||
          ((payload.transaction as Record<string, unknown> | undefined)?.id as string) ||
          "";
        const status =
          ((payload.status as string) ||
            ((payload.transaction as Record<string, unknown> | undefined)?.status as string) ||
            "PENDING").toUpperCase();

        if (!identifier) {
          return new Response(JSON.stringify({ ok: false, error: "missing_identifier" }), { status: 400 });
        }

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.rpc("credit_pix_deposit", {
          _identifier: identifier,
          _gateway_id: gatewayId,
          _status: status,
        });

        if (error) {
          console.error("pix callback error", error);
          return new Response(JSON.stringify({ ok: false, error: error.message }), { status: 500 });
        }

        return Response.json({ ok: true, result: data });
      },
    },
  },
});