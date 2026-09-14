import { createHmac, timingSafeEqual } from "crypto";

export type PartnerRow = {
  id: string;
  name: string;
  api_key: string;
  api_secret: string;
  active: boolean;
  balance: number;
  callback_url: string | null;
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
    },
  });
}

export function corsPreflight() {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type, x-api-key, x-signature, x-timestamp",
    },
  });
}

export async function handlePartner(
  request: Request,
  endpoint: string,
  run: (ctx: { partner: PartnerRow; body: any; admin: any }) => Promise<{ status: number; body: any }>,
) {
  const raw = await request.text();
  const ip = request.headers.get("x-forwarded-for") ?? null;
  const apiKey = request.headers.get("x-api-key") ?? "";
  const sig = request.headers.get("x-signature") ?? "";
  const ts = request.headers.get("x-timestamp") ?? "";

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const log = async (partnerId: string | null, status: number, payload: any, response: any) => {
    await supabaseAdmin.from("api_calls").insert({
      partner_id: partnerId,
      endpoint,
      method: "POST",
      status_code: status,
      payload,
      response,
      ip,
    });
  };

  let body: any = {};
  try { body = raw ? JSON.parse(raw) : {}; } catch {
    await log(null, 400, { raw }, { error: "invalid_json" });
    return json(400, { error: "invalid_json" });
  }

  if (!apiKey) { await log(null, 401, body, { error: "missing_api_key" }); return json(401, { error: "missing_api_key" }); }

  const { data: partner } = await supabaseAdmin
    .from("api_partners").select("*").eq("api_key", apiKey).maybeSingle();

  if (!partner) { await log(null, 401, body, { error: "invalid_api_key" }); return json(401, { error: "invalid_api_key" }); }
  if (!partner.active) { await log(partner.id, 403, body, { error: "partner_disabled" }); return json(403, { error: "partner_disabled" }); }

  // Optional HMAC signature: sha256(timestamp + "." + raw_body, api_secret)
  if (sig || ts) {
    if (!sig || !ts) { await log(partner.id, 401, body, { error: "missing_signature" }); return json(401, { error: "missing_signature" }); }
    const age = Math.abs(Date.now() - Number(ts));
    if (!Number.isFinite(age) || age > 5 * 60 * 1000) {
      await log(partner.id, 401, body, { error: "stale_timestamp" }); return json(401, { error: "stale_timestamp" });
    }
    const expected = createHmac("sha256", partner.api_secret).update(`${ts}.${raw}`).digest("hex");
    const a = Buffer.from(sig); const b = Buffer.from(expected);
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      await log(partner.id, 401, body, { error: "invalid_signature" }); return json(401, { error: "invalid_signature" });
    }
  }

  try {
    const res = await run({ partner: partner as PartnerRow, body, admin: supabaseAdmin });
    await log(partner.id, res.status, body, res.body);
    return json(res.status, res.body);
  } catch (e: any) {
    const err = { error: "internal_error", message: String(e?.message ?? e) };
    await log(partner.id, 500, body, err);
    return json(500, err);
  }
}