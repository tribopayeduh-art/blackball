import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { LOCAL_TEST_MODE } from "@/lib/local-test-mode";
import { toast } from "sonner";
import { ArrowRight, Check, Eye, EyeOff, LockKeyhole, Mail, Shield, User, Zap } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar — Black Ball" }, { name: "description", content: "Entre ou crie sua conta Black Ball." }, { name: "robots", content: "noindex" }] }),
  component: AuthPage,
});

type Mode = "login" | "signup";

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (!email.includes("@") || password.length < 6 || (mode === "signup" && name.trim().length < 3)) {
      toast.error("Confira os dados. A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    setBusy(true);
    if (LOCAL_TEST_MODE) {
      sessionStorage.setItem("bb:demo-auth", "1");
      setTimeout(() => { setBusy(false); toast.success(mode === "login" ? "Login realizado" : "Conta criada com sucesso"); navigate({ to: "/" }); }, 450);
      return;
    }
    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { data: { username: name.trim() } } });
    setBusy(false);
    if (result.error) return toast.error(result.error.message);
    toast.success(mode === "login" ? "Bem-vindo de volta!" : "Conta criada. Confira seu e-mail.");
    if (mode === "login") navigate({ to: "/" });
  }

  return (
    <main className="auth-arena">
      <section className="auth-showcase">
        <div className="auth-brand"><b>8</b><span>BLACK <em>BALL</em></span></div>
        <div className="auth-showcase__copy"><span><Zap /> ARENA ONLINE</span><h1>SUA PRÓXIMA<br />GRANDE TACADA.</h1><p>Entre nas mesas, desafie jogadores e construa sua coleção de tacos.</p></div>
        <div className="auth-benefits"><span><Check /> Partidas rápidas</span><span><Check /> Carteira integrada</span><span><Check /> Recompensas diárias</span></div>
      </section>
      <section className="auth-panel">
        <div className="auth-panel__mobile-brand"><b>8</b><strong>BLACK BALL</strong></div>
        <div className="auth-tabs"><button className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>ENTRAR</button><button className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>CRIAR CONTA</button></div>
        <div className="auth-heading"><small>{mode === "login" ? "BEM-VINDO DE VOLTA" : "NOVO JOGADOR"}</small><h2>{mode === "login" ? "Entre na arena" : "Crie sua conta"}</h2><p>{mode === "login" ? "Continue de onde parou." : "Leva menos de um minuto."}</p></div>
        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && <label><span><User /> NOME DE JOGADOR</span><input value={name} onChange={e => setName(e.target.value)} placeholder="Como quer ser chamado?" autoComplete="nickname" /></label>}
          <label><span><Mail /> E-MAIL</span><input value={email} onChange={e => setEmail(e.target.value)} type="email" placeholder="voce@email.com" autoComplete="email" /></label>
          <label><span><LockKeyhole /> SENHA</span><div className="auth-password"><input value={password} onChange={e => setPassword(e.target.value)} type={showPassword ? "text" : "password"} placeholder="Mínimo de 6 caracteres" autoComplete={mode === "login" ? "current-password" : "new-password"} /><button type="button" onClick={() => setShowPassword(v => !v)} aria-label="Mostrar senha">{showPassword ? <EyeOff /> : <Eye />}</button></div></label>
          {mode === "login" && <button type="button" className="auth-forgot" onClick={() => toast.info("Informe seu e-mail para recuperar a senha.")}>Esqueci minha senha</button>}
          <button className="auth-submit" disabled={busy}>{busy ? "PROCESSANDO…" : mode === "login" ? "ENTRAR NA ARENA" : "CRIAR CONTA"}<ArrowRight /></button>
        </form>
        <div className="auth-security"><Shield /> Seus dados são protegidos e nunca serão compartilhados.</div>
      </section>
    </main>
  );
}
