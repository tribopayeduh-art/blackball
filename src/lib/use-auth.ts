import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Session } from "@supabase/supabase-js";
import { LOCAL_TEST_MODE, LOCAL_USER } from "@/lib/local-test-mode";

const LOCAL_SESSION = {
  access_token: "local-test-token",
  refresh_token: "local-test-refresh-token",
  expires_in: 31_536_000,
  expires_at: 4_102_444_800,
  token_type: "bearer",
  user: LOCAL_USER,
} as unknown as Session;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(() =>
    LOCAL_TEST_MODE ? LOCAL_SESSION : null,
  );
  const [authReady, setAuthReady] = useState(LOCAL_TEST_MODE);
  const [isAdmin, setIsAdmin] = useState(false);
  const [rolesLoading, setRolesLoading] = useState(false);
  const [roleUserId, setRoleUserId] = useState<string | null>(null);

  useEffect(() => {
    if (LOCAL_TEST_MODE) return;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      setAuthReady(true);
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (LOCAL_TEST_MODE) {
      setIsAdmin(true);
      setRoleUserId(LOCAL_USER.id);
      setRolesLoading(false);
      return;
    }
    if (!authReady) return;
    if (!session?.user) {
      setIsAdmin(false);
      setRoleUserId(null);
      setRolesLoading(false);
      return;
    }

    let cancelled = false;
    setRolesLoading(true);
    supabase
      .rpc("has_role", { _user_id: session.user.id, _role: "admin" })
      .then(({ data, error }) => {
        if (cancelled) return;
        setIsAdmin(!error && data === true);
        setRoleUserId(session.user.id);
        setRolesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [authReady, session?.user]);

  // Heartbeat: marks user as online for admin DAU/online metrics
  useEffect(() => {
    if (LOCAL_TEST_MODE) return;
    if (!session?.user) return;
    const ping = () => supabase.rpc("touch_last_seen").then(() => {});
    ping();
    const t = setInterval(ping, 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, [session?.user]);

  const loading = useMemo(
    () =>
      LOCAL_TEST_MODE
        ? false
        : !authReady || rolesLoading || (!!session?.user?.id && roleUserId !== session.user.id),
    [authReady, roleUserId, rolesLoading, session?.user?.id],
  );

  return { session, user: session?.user ?? null, loading, isAdmin };
}
