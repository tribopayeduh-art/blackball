import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, BadgeCheck, Check, ChevronRight, Clock3, Copy, LoaderCircle, LockKeyhole, QrCode, ShieldCheck, Sparkles, Volume2, VolumeX, WalletCards, Zap } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { createPixDeposit } from "@/lib/pix.functions";
import { applyLocalWallet, LOCAL_TEST_MODE, readLocalGameState } from "@/lib/local-test-mode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/shop")({
  head: () => ({ meta: [{ title: "Depósito PIX — Black Ball" }, { name: "description", content: "Coloque saldo na sua carteira Black Ball via PIX." }] }),
  component: Deposit,
});

const VALUES = [20, 50, 100, 200, 500, 1000];
const BANNERS = [
  { src: "/platform/deposit/black-ball-pix-premium.svg", alt: "Jogue sem esperar com PIX Black Ball" },
  { src: "/platform/deposit/black-ball-fast-wallet.svg", alt: "PIX simples e rápido Black Ball" },
];

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function Deposit() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const pixCreate = useServerFn(createPixDeposit);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [banner, setBanner] = useState(0);
  const [pix, setPix] = useState<{ code: string; image: string; amount: number } | null>(null);
  const [sound, setSound] = useState(() => typeof window === "undefined" || localStorage.getItem("bb:deposit-sound") !== "off");
  const validAmount = Number.isFinite(amount) && amount >= 10 && amount <= 10000;
  const amountError = amount > 0 && !validAmount ? (amount < 10 ? "O mínimo é R$ 10,00." : "O máximo por depósito é R$ 10.000,00.") : "";
  const selectedPreset = useMemo(() => VALUES.includes(amount), [amount]);

  function playSound(type: "select" | "action" | "success" | "error") {
    if (!sound || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(type === "success" ? .09 : .045, ctx.currentTime + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + .28);
    gain.connect(ctx.destination);
    const notes = type === "success" ? [523, 659, 784] : type === "error" ? [240, 175] : [type === "action" ? 360 : 620];
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = type === "error" ? "sawtooth" : type === "action" ? "triangle" : "sine";
      osc.frequency.value = frequency;
      osc.connect(gain);
      const start = ctx.currentTime + index * .065;
      osc.start(start); osc.stop(start + .12);
    });
    window.setTimeout(() => void ctx.close(), 500);
  }

  useEffect(() => {
    const id = window.setInterval(() => setBanner(current => (current + 1) % BANNERS.length), 7000);
    return () => window.clearInterval(id);
  }, []);
  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [loading, navigate, user]);
  useEffect(() => {
    if (!user) return;
    if (LOCAL_TEST_MODE) { setBalance(readLocalGameState().profile.balance); return; }
    supabase.from("profiles").select("balance").eq("id", user.id).single().then(({ data }) => setBalance(Number(data?.balance ?? 0)));
  }, [user]);

  function toggleSound() {
    const next = !sound;
    setSound(next);
    localStorage.setItem("bb:deposit-sound", next ? "on" : "off");
  }

  async function deposit() {
    if (!validAmount || busy) {
      playSound("error");
      toast.error(amountError || "Informe um valor válido.");
      return;
    }
    setBusy(true);
    try {
      if (LOCAL_TEST_MODE) {
        const tx = applyLocalWallet("deposit", amount);
        setBalance(Number(tx.balance_after));
        playSound("success");
        toast.success(`R$ ${money(amount)} adicionados ao saldo de teste.`);
        return;
      }
      const result = await pixCreate({ data: { amount } });
      if (!result?.pixCode || !result?.pixImage) throw new Error("O provedor não retornou um PIX válido.");
      setPix({ code: result.pixCode, image: result.pixImage, amount: result.amount });
      playSound("success");
    } catch (error) {
      playSound("error");
      toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PIX. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }

  async function copyPix() {
    if (!pix) return;
    try {
      await navigator.clipboard.writeText(pix.code);
      playSound("success");
      toast.success("Código PIX copiado!");
    } catch {
      playSound("error");
      toast.error("Não foi possível copiar. Toque e segure o código.");
    }
  }

  if (loading || !user) return <div className="deposit-loading"><span>8</span><p>Preparando seu depósito…</p></div>;

  return <div className="deposit-page deposit-v22 page-enter">
    <header className="deposit-header">
      <button onClick={() => navigate({ to: "/" })} aria-label="Voltar"><ArrowLeft /></button>
      <div className="deposit-brand"><img src="/brand/black-ball-logo-v2.svg" alt="Black Ball" width="190" height="48" /></div>
      <div className="deposit-header__actions">
        <button className="deposit-sound" onClick={toggleSound} aria-label={sound ? "Desativar sons" : "Ativar sons"}>{sound ? <Volume2/> : <VolumeX/>}</button>
        <div className="deposit-balance"><small>CARTEIRA</small><strong>R$ {money(balance)}</strong></div>
      </div>
    </header>

    <main className="deposit-main">
      <section className="deposit-showcase" aria-label="Destaques Black Ball">
        <div className="deposit-showcase__track" style={{ transform: `translateX(-${banner * 100}%)` }}>
          {BANNERS.map(item => <button key={item.src} onClick={() => document.querySelector(".deposit-panel")?.scrollIntoView({ behavior: "smooth" })}><img src={item.src} alt={item.alt}/></button>)}
        </div>
        <div className="deposit-showcase__dots">{BANNERS.map((_, index) => <button key={index} className={banner === index ? "active" : ""} onClick={() => setBanner(index)} aria-label={`Ver banner ${index + 1}`}/>)}</div>
      </section>

      <section className="deposit-panel">
        <div className="deposit-panel__head">
          <div className="deposit-panel__badge"><WalletCards/><span><small>CARTEIRA BLACK BALL</small><strong>Adicionar saldo</strong></span></div>
          <span className="deposit-panel__secure"><ShieldCheck/> PIX SEGURO</span>
        </div>

        <div className="deposit-progress" aria-label="Etapas do depósito">
          <span className="active"><i>1</i>VALOR</span><b/><span><i>2</i>PIX</span><b/><span><i>3</i>JOGAR</span>
        </div>

        <div className="deposit-panel__title"><div><small>ESCOLHA RÁPIDA</small><h1>Quanto deseja depositar?</h1></div><span>Mínimo R$ 10</span></div>

        <div className="deposit-values">
          {VALUES.map(value => <button key={value} className={amount === value ? "active" : ""} onClick={() => { setAmount(value); playSound("select"); }}>
            {value === 100 && <em>MAIS ESCOLHIDO</em>}
            <small>R$</small><strong>{value}</strong><span>via PIX</span>{amount === value && <Check />}
          </button>)}
        </div>

        <label className={`deposit-custom ${amountError ? "has-error" : ""}`}>
          <span>Outro valor {!selectedPreset && validAmount && <BadgeCheck/>}</span>
          <div><b>R$</b><input aria-label="Valor do depósito" inputMode="decimal" type="number" min="10" max="10000" value={amount || ""} onChange={event => setAmount(Number(event.target.value))} /></div>
          {amountError && <small>{amountError}</small>}
        </label>

        <div className="deposit-method">
          <div><span><QrCode /></span><div><small>FORMA DE PAGAMENTO</small><strong>PIX instantâneo</strong><em>QR Code e código Copia e Cola</em></div></div>
          <div className="deposit-method__status"><i/> DISPONÍVEL</div>
        </div>

        <div className="deposit-receipt">
          <div><span>Valor escolhido</span><b>R$ {money(amount)}</b></div>
          <div><span>Taxa</span><b className="free">R$ 0,00</b></div>
          <i/>
          <div className="total"><span>Você recebe</span><strong>R$ {money(amount)}</strong></div>
        </div>

        <button className="deposit-cta deposit-cta--premium" onClick={() => { playSound("action"); void deposit(); }} disabled={busy || !validAmount} aria-busy={busy}>
          <span className="deposit-cta__icon">{busy ? <LoaderCircle className="animate-spin" /> : <QrCode />}</span>
          <span className="deposit-cta__copy"><small>{busy ? "CONECTANDO AO PIX" : "PAGAMENTO INSTANTÂNEO"}</small><strong>{busy ? "GERANDO CÓDIGO…" : "GERAR PIX AGORA"}</strong></span>
          <span className="deposit-cta__amount"><small>TOTAL</small><strong>R$ {money(amount)}</strong></span>
          <span className="deposit-cta__arrow"><ChevronRight /></span>
        </button>

        <div className="deposit-trust">
          <span><LockKeyhole/><b>Dados protegidos</b><small>Conexão segura</small></span>
          <span><Zap/><b>Confirmação rápida</b><small>Saldo automático</small></span>
          <span><Clock3/><b>Disponível 24h</b><small>Todos os dias</small></span>
        </div>
      </section>
    </main>

    <Dialog open={!!pix} onOpenChange={open => !open && setPix(null)}>
      <DialogContent className="deposit-pix-dialog deposit-pix-dialog--v22">
        <div className="deposit-pix-dialog__icon"><QrCode/></div>
        <DialogHeader><DialogTitle>SEU PIX ESTÁ PRONTO</DialogTitle><DialogDescription>Pague <b>R$ {money(pix?.amount ?? 0)}</b> no aplicativo do seu banco.</DialogDescription></DialogHeader>
        {pix && <>
          <div className="deposit-pix-dialog__qr"><img src={pix.image} alt="QR Code PIX"/><span><Sparkles/> ESCANEIE PARA PAGAR</span></div>
          <button onClick={copyPix}><Copy/> COPIAR CÓDIGO PIX</button>
          <p className="deposit-pix-dialog__code">{pix.code}</p>
          <div className="deposit-pix-dialog__status"><i/><span><b>Aguardando pagamento</b><small>Esta tela pode ser fechada com segurança</small></span><Clock3/></div>
        </>}
      </DialogContent>
    </Dialog>
  </div>;
}
