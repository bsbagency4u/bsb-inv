"use client";

import * as React from "react";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getBrowserClient } from "@/lib/supabase/client";
import { getClientServices } from "@/services";
import { hasDemoSession } from "@/lib/session/demo-session";
import { normalizeError } from "@/lib/errors";
import type { BusinessProfile, SessionState, SessionUser } from "@/types/domain";

interface SessionContextValue extends SessionState {
  refresh: () => Promise<void>;
  setBusiness: (business: BusinessProfile) => void;
}

const SessionContext = React.createContext<SessionContextValue | null>(null);

const EMPTY_STATE: SessionState = {
  user: null,
  business: null,
  businesses: [],
  status: "loading",
  isDemo: false,
  error: null,
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<SessionState>(EMPTY_STATE);

  const hydrateUser = React.useCallback(async (forcedUserId?: string) => {
    try {
      const services = getClientServices();
      const client = getBrowserClient();
      if (!client) return;
      const {
        data: { user: authUser },
      } = await client.auth.getUser();

      if (!authUser) {
        setState({ ...EMPTY_STATE, status: "unauthenticated" });
        return;
      }

      const userId = forcedUserId ?? authUser.id;
      const authSessionUser: SessionUser = {
        id: userId,
        email: authUser.email ?? "",
        fullName: (authUser.user_metadata?.full_name as string) ?? "",
        username: (authUser.user_metadata?.username as string) ?? null,
        phone: null,
        avatarUrl: (authUser.user_metadata?.avatar_url as string) ?? null,
        role: null,
        isOwner: false,
        isDemo: false,
      };

      const [profile, businesses, business] = await Promise.all([
        services.profiles.getProfile(userId),
        services.businesses.listForUser(userId),
        services.businesses.getActiveBusiness(userId),
      ]);

      const user: SessionUser = {
        ...authSessionUser,
        fullName: profile?.fullName || authSessionUser.fullName,
        username: profile?.username || authSessionUser.username,
        email: profile?.email || authSessionUser.email,
        phone: profile?.phone ?? null,
        avatarUrl: profile?.avatarUrl ?? null,
      };

      setState({
        user,
        business,
        businesses,
        status: "authenticated",
        isDemo: false,
        error: null,
      });
    } catch (error) {
      const normalized = normalizeError(error);
      setState((current) => ({
        ...current,
        status: current.status === "loading" ? "unauthenticated" : current.status,
        error: normalized.userMessage,
      }));
    }
  }, []);

  const load = React.useCallback(async () => {
    try {
      const services = getClientServices();
      const isDemo = !isSupabaseConfigured();

      if (isDemo) {
        if (!hasDemoSession()) {
          setState({ ...EMPTY_STATE, status: "unauthenticated", isDemo: true });
          return;
        }
        const user = await services.auth.getCurrentUser();
        if (!user) {
          setState({ ...EMPTY_STATE, status: "unauthenticated", isDemo: true });
          return;
        }
        const [businesses, business] = await Promise.all([
          services.businesses.listForUser(user.id),
          services.businesses.getActiveBusiness(user.id),
        ]);
        setState({
          user: { ...user, isDemo: true },
          business,
          businesses,
          status: "authenticated",
          isDemo: true,
          error: null,
        });
        return;
      }

      const client = getBrowserClient();
      if (!client) {
        setState({ ...EMPTY_STATE, status: "unauthenticated", isDemo: false });
        return;
      }

      const {
        data: { session },
      } = await client.auth.getSession();

      if (!session?.user) {
        setState({ ...EMPTY_STATE, status: "unauthenticated", isDemo: false });
        return;
      }

      await hydrateUser(session.user.id);

      const {
        data: { subscription },
      } = client.auth.onAuthStateChange((event) => {
        if (event === "SIGNED_OUT") {
          setState({ ...EMPTY_STATE, status: "unauthenticated", isDemo: false });
          return;
        }
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          void hydrateUser();
        }
      });

      return () => {
        subscription.unsubscribe();
      };
    } catch (error) {
      const normalized = normalizeError(error);
      setState({
        ...EMPTY_STATE,
        status: "unauthenticated",
        error: normalized.userMessage,
      });
    }
  }, [hydrateUser]);

  React.useEffect(() => {
    let unsubscribe: (() => void) | undefined;
    let active = true;

    (async () => {
      const result = await load();
      if (active && typeof result === "function") {
        unsubscribe = result;
      }
    })();

    return () => {
      active = false;
      unsubscribe?.();
    };
  }, [load]);

  const refresh = React.useCallback(async () => {
    await load();
  }, [load]);

  const setBusiness = React.useCallback((business: BusinessProfile) => {
    const services = getClientServices();
    services.businesses.setActiveBusinessId(business.id);
    setState((current) => ({ ...current, business }));
  }, []);

  const value = React.useMemo<SessionContextValue>(
    () => ({ ...state, refresh, setBusiness }),
    [state, refresh, setBusiness]
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const context = React.useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider.");
  }
  return context;
}

export function useCurrentUser(): SessionUser | null {
  return useSession().user;
}
