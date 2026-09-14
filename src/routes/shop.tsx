import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, BadgeCheck, Check, ChevronRight, Clock3, Copy, LoaderCircle, LockKeyhole, QrCode, ShieldCheck, Volume2, VolumeX, Zap } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/lib/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { createPixDeposit } from "@/lib/pix.functions";
import { applyLocalWallet, LOCAL_TEST_MODE, readLocalGameState } from "@/lib/local-test-mode";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/shop")({ head: () => ({ meta: [{ title: "Depositar — Black Ball" }, { name: "description", content: "Adicione saldo à sua carteira Black Ball via PIX." }] }), component: Deposit });
const VALUES = [20, 50, 100, 200, 500, 1000];

function Deposit() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const pixCreate = useServerFn(createPixDeposit);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState(50);
  const [busy, setBusy] = useState(false);
  const [pix, setPix] = useState<{ code: string; image: string; amount: number } | null>(null);
  const [sound, setSound] = useState(() => typeof window === "undefined" ? true : localStorage.getItem("bb:deposit-sound") !== "off");

  function playSound(type: "select" | "action" | "success") {
    if (!sound || typeof window === "undefined") return;
    const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(type === "success" ? .1 : .055, ctx.currentTime + .012);
    gain.gain.exponentialRampToValueAtTime(.0001, ctx.currentTime + (type === "success" ? .24 : .1));
    gain.connect(ctx.destination);
    const notes = type === "success" ? [523.25, 659.25] : [type === "action" ? 360 : 620];
    notes.forEach((frequency, index) => {
      const osc = ctx.createOscillator();
      osc.type = type === "action" ? "triangle" : "sine";
      osc.frequency.value = frequency;
      osc.connect(gain);
      const start = ctx.currentTime + index * .08;
      osc.start(start); osc.stop(start + .13);
    });
    window.setTimeout(() => void ctx.close(), 450);
  }

  function toggleSound() {
    const next = !sound; setSound(next); localStorage.setItem("bb:deposit-sound", next ? "on" : "off");
  }

  useEffect(() => { if (!loading && !user) navigate({ to: "/auth" }); }, [loading, navigate, user]);
  useEffect(() => {
    if (!user) return;
    if (LOCAL_TEST_MODE) { setBalance(readLocalGameState().profile.balance); return; }
    supabase.from("profiles").select("balance").eq("id", user.id).single().then(({ data }) => setBalance(Number(data?.balance ?? 0)));
  }, [user]);

  async function deposit() {
    if (!Number.isFinite(amount) || amount < 10) return toast.error("O depósito mínimo é R$ 10,00.");
    setBusy(true);
    try {
      if (LOCAL_TEST_MODE) {
        const tx = applyLocalWallet("deposit", amount);
        setBalance(Number(tx.balance_after));
        playSound("success"); toast.success(`R$ ${amount.toFixed(2).replace(".", ",")} adicionados ao saldo de teste.`);
        return;
      }
      const result = await pixCreate({ data: { amount } });
      setPix({ code: result.pixCode, image: result.pixImage, amount: result.amount }); playSound("success");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Não foi possível gerar o PIX."); }
    finally { setBusy(false); }
  }

  async function copyPix() { if (pix) { await navigator.clipboard.writeText(pix.code); playSound("success"); toast.success("Código PIX copiado!"); } }
  if (loading || !user) return <div className="deposit-loading"><span>8</span><p>Preparando depósito…</p></div>;

  return <div className="deposit-page page-enter">
    <header className="deposit-header">
      <button onClick={() => navigate({ to: "/" })} aria-label="Voltar"><ArrowLeft /></button>
      <div className="deposit-brand"><img src="/brand/black-ball-logo.svg" alt="Black Ball" width="160" height="38" /></div>
      <div className="deposit-header__actions"><button className="deposit-sound" onClick={toggleSound} aria-label={sound ? "Desativar sons" : "Ativar sons"}>{sound ? <Volume2/> : <VolumeX/>}</button><div className="deposit-balance"><small>SEU SALDO</small><strong>R$ {balance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></div>
    </header>
    <main className="deposit-main">
      <section className="deposit-intro">
        <img className="deposit-intro__art" src="/platform/deposit/black-ball-deposit-banner-v2.png" alt="Bola 8 Black Ball com fichas douradas" />
        <div className="deposit-intro__overlay" />
        <div className="deposit-intro__content">
          <span><Zap /> SALDO EM SEGUNDOS</span>
          <h1>DEPÓSITO <em>PIX</em></h1>
          <p>Escolha um valor, gere o código e volte para as mesas.</p>
          <div className="deposit-intro__actions"><button onClick={() => document.querySelector('.deposit-panel')?.scrollIntoView({ behavior: 'smooth' })}>DEPOSITAR AGORA <ChevronRight /></button><small><ShieldCheck /> Confirmação automática</small></div>
        </div>
      </section>
      <section className="deposit-panel">
        <div className="deposit-progress" aria-label="Etapas do depósito"><span className="active"><i>1</i>VALOR</span><b/><span><i>2</i>PAGAMENTO</span><b/><span><i>3</i>CONFIRMAÇÃO</span></div>
        <div className="deposit-panel__title"><div><small>CARREGAR CARTEIRA</small><h2>Quanto deseja depositar?</h2></div><span>Mín. R$ 10</span></div>
        <div className="deposit-values">{VALUES.map(value => <button key={value} className={amount === value ? "active" : ""} onClick={() => { setAmount(value); playSound("select"); }}>{value === 100 && <em>POPULAR</em>}<small>R$</small><strong>{value}</strong>{amount === value && <Check />}</button>)}</div>
        <label className="deposit-custom"><span>Outro valor</span><div><b>R$</b><input aria-label="Valor do depósito" inputMode="decimal" type="number" min="10" value={amount} onChange={e => setAmount(Number(e.target.value))} /></div></label>
        <div className="deposit-method"><div><span><QrCode /></span><div><small>FORMA DE PAGAMENTO</small><strong>PIX instantâneo</strong><em>Liberação automática após o pagamento</em></div></div><BadgeCheck /></div>
        <div className="deposit-receipt"><div><span>Valor do depósito</span><b>R$ {Number(amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</b></div><div><span>Taxa de processamento</span><b className="free">GRÁTIS</b></div><i/><div className="total"><span>Crédito total</span><strong>R$ {Number(amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></div></div>
        <button className="deposit-cta deposit-cta--premium" onClick={() => { playSound("action"); void deposit(); }} disabled={busy} aria-busy={busy}>
          <span className="deposit-cta__icon">{busy ? <LoaderCircle className="animate-spin" /> : <QrCode />}</span>
          <span className="deposit-cta__copy"><small>{busy ? "PREPARANDO PAGAMENTO" : "PAGAMENTO INSTANTÂNEO"}</small><strong>{busy ? "GERANDO SEU PIX…" : "GERAR PIX AGORA"}</strong></span>
          <span className="deposit-cta__amount"><small>VALOR</small><strong>R$ {Number(amount || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</strong></span>
          <span className="deposit-cta__arrow"><ChevronRight /></span>
        </button>
        <p className="deposit-safe"><LockKeyhole /> Seus dados são protegidos e o saldo é atualizado após a confirmação.</p>
        <div className="deposit-panel__footer"><span><ShieldCheck /> Ambiente protegido</span><span><Zap /> Crédito rápido</span><span><Clock3 /> PIX 24 horas</span></div>
      </section>
    </main>
    <Dialog open={!!pix} onOpenChange={open => !open && setPix(null)}><DialogContent className="deposit-pix-dialog"><div className="deposit-pix-dialog__icon"><QrCode/></div><DialogHeader><DialogTitle>PIX PRONTO PARA PAGAR</DialogTitle><DialogDescription>Abra o aplicativo do seu banco e pague R$ {pix?.amount.toFixed(2).replace(".", ",")}.</DialogDescription></DialogHeader>{pix && <><div className="deposit-pix-dialog__qr"><img src={pix.image} alt="QR Code PIX"/><span>ESCANEIE O QR CODE</span></div><button onClick={copyPix}><Copy/> COPIAR CÓDIGO PIX</button><div className="deposit-pix-dialog__status"><i/><span><b>Aguardando pagamento</b><small>A confirmação acontece automaticamente</small></span><Clock3/></div></>}</DialogContent></Dialog>
  </div>;
}
