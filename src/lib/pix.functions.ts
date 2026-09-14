import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const AMPLOPAY_BASE = "https://app.amplopay.com/api/v1";
const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

function isValidCPF(cpf: string): boolean {
  const c = cpf.replace(/\D/g, "");
  if (c.length !== 11 || /^(\d)\1+$/.test(c)) return false;
  let s = 0;
  for (let i = 1; i <= 9; i++) s += parseInt(c[i - 1], 10) * (11 - i);
  let r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  if (r !== parseInt(c[9], 10)) return false;
  s = 0;
  for (let i = 1; i <= 10; i++) s += parseInt(c[i - 1], 10) * (12 - i);
  r = (s * 10) % 11;
  if (r === 10 || r === 11) r = 0;
  return r === parseInt(c[10], 10);
}

function authHeaders(): Record<string, string> {
  const pk = process.env.AMPLOPAY_PUBLIC_KEY;
  const sk = process.env.AMPLOPAY_SECRET_KEY;
  if (!pk || !sk) throw new Error("AmploPay não configurada");
  return {
    "x-public-key": pk,
    "x-secret-key": sk,
    Authorization: "Basic " + Buffer.from(`${pk}:${sk}`).toString("base64"),
  };
}

export const createPixDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { amount: number }) => {
    const amt = Math.round(Number(input.amount) * 100) / 100;
    if (!Number.isFinite(amt) || amt < 1) throw new Error("Valor mínimo R$ 1,00");
    if (amt > 10000) throw new Error("Valor máximo R$ 10.000,00");
    return { amount: amt };
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: prof } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", userId)
      .maybeSingle();

    const identifier = `dep_${userId.replace(/-/g, "").slice(0, 12)}_${Date.now().toString(36)}`;
    const origin = process.env.SITE_URL || "https://game-stash-login.lovable.app";
    const callbackUrl = `${origin}/api/public/pix/callback`;

    const doc = "09628170074";
    const phone = "11999999999";
    const email = `${userId}@blackball.app`;
    void isValidCPF;

    const body: Record<string, unknown> = {
      identifier,
      amount: data.amount,
      client: {
        name: prof?.username || "Jogador",
        email,
        phone,
        document: doc,
      },
      products: [{ id: "deposit", name: "Depósito de saldo", quantity: 1, price: data.amount }],
      dueDate: new Date(Date.now() + 86_400_000).toISOString().split("T")[0],
      metadata: { userId, source: "blackball" },
    };
    // Webhook deve ser cadastrado uma única vez no painel da AmploPay
    // (URL: <origin>/api/public/pix/callback). Não enviamos por requisição
    // para evitar o limite de 20 webhooks por conta.
    if (process.env.AMPLOPAY_SEND_CALLBACK === "1") {
      body.callbackUrl = callbackUrl;
    }

    const resp = await fetch(`${AMPLOPAY_BASE}/gateway/pix/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "User-Agent": UA, ...authHeaders() },
      body: JSON.stringify(body),
    });

    const json = await resp.json().catch(() => ({}));
    if (!resp.ok) {
      const msg = (json as { message?: string })?.message || `Falha ao gerar PIX (HTTP ${resp.status})`;
      throw new Error(msg);
    }

    const r = json as {
      transactionId?: string;
      id?: string;
      status?: string;
      pixCode?: string;
      copyPaste?: string;
      emv?: string;
      qrCode?: string;
      pix?: {
        code?: string;
        payload?: string;
        image?: string;
        base64?: string;
        qrcode?: string;
        base64QrCode?: string;
      };
    };
    const pixCode = r.pix?.code || r.pix?.payload || r.pixCode || r.copyPaste || r.emv || "";
    const rawImg = r.qrCode || r.pix?.image || r.pix?.qrcode || r.pix?.base64QrCode || r.pix?.base64 || "";
    const pixImage = rawImg.startsWith("data:") || rawImg.startsWith("http")
      ? rawImg
      : rawImg
        ? `data:image/png;base64,${rawImg}`
        : "";
    const transactionId = r.transactionId || r.id || null;

    await supabase.from("pix_deposits").insert({
      user_id: userId,
      identifier,
      gateway_id: transactionId,
      amount: data.amount,
      status: r.status ?? "PENDING",
      pix_code: pixCode,
      pix_image: pixImage,
    });

    return {
      identifier,
      transactionId,
      amount: data.amount,
      pixCode,
      pixImage: pixImage || `https://api.qrserver.com/v1/create-qr-code/?size=320x320&data=${encodeURIComponent(pixCode)}`,
    };
  });

export const checkPixDeposit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { identifier: string }) => ({ identifier: String(input.identifier) }))
  .handler(async ({ data, context }) => {
    const { data: dep } = await context.supabase
      .from("pix_deposits")
      .select("status, credited_at, amount")
      .eq("identifier", data.identifier)
      .maybeSingle();
    return dep ?? { status: "UNKNOWN", credited_at: null, amount: 0 };
  });