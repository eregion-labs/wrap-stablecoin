"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import {
  parseClientConfig,
  type ClientConfig,
} from "@florin/client-config";
import { ZodError } from "zod";
import { getBackendUrl } from "@/lib/bootstrap/backendUrl";
import {
  createApplicationServices,
  type ApplicationServices,
} from "@/lib/bootstrap/createApplicationServices";

type ReadyState = {
  status: "ready";
  config: Readonly<ClientConfig>;
  services: ApplicationServices;
};

type BootstrapState =
  | { status: "loading" }
  | ReadyState
  | { status: "fatal"; error: string; retryable: boolean };

const ClientConfigContext = createContext<ReadyState | null>(null);
const ApplicationServicesContext = createContext<ApplicationServices | null>(null);

let servicesRef: ApplicationServices | null = null;

export function getApplicationServices(): ApplicationServices {
  if (!servicesRef) {
    throw new Error("Application services not ready — wait for ClientConfigProvider");
  }
  return servicesRef;
}

export function useClientConfig(): Readonly<ClientConfig> {
  const ctx = useContext(ClientConfigContext);
  if (!ctx) {
    throw new Error("useClientConfig must be used within ClientConfigProvider");
  }
  return ctx.config;
}

export function useApplicationServices(): ApplicationServices {
  const ctx = useContext(ApplicationServicesContext);
  if (!ctx) {
    throw new Error("useApplicationServices must be used within ClientConfigProvider");
  }
  return ctx;
}

function formatBootstrapError(err: unknown, backendUrl: string): string {
  if (err instanceof ZodError) {
    const path = err.issues[0]
      ? err.issues.map((i) => i.path.join(".") || "(root)").join("; ")
      : "(unknown)";
    return `Invalid client config from ${backendUrl}/v1/client-config — field path: ${path}`;
  }
  if (err instanceof Error) return err.message;
  return String(err);
}

export default function ClientConfigProvider({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [state, setState] = useState<BootstrapState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  const backendUrl = useMemo(() => {
    try {
      return getBackendUrl();
    } catch {
      return null;
    }
  }, []);

  const load = useCallback(async () => {
    if (!backendUrl) {
      setState({
        status: "fatal",
        error: "NEXT_PUBLIC_BACKEND_URL is not set",
        retryable: false,
      });
      return;
    }

    setState({ status: "loading" });
    try {
      const res = await fetch(`${backendUrl}/v1/client-config`);
      if (!res.ok) {
        throw new Error(`GET /v1/client-config → ${res.status}: ${await res.text()}`);
      }
      const json: unknown = await res.json();
      const config = parseClientConfig(json);
      const services = createApplicationServices(config);
      servicesRef = services;
      setState({ status: "ready", config, services });
    } catch (err) {
      servicesRef = null;
      const retryable = !(err instanceof ZodError);
      setState({
        status: "fatal",
        error: formatBootstrapError(err, backendUrl),
        retryable,
      });
    }
  }, [backendUrl]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    void load();
  }, [load, attempt, mounted]);

  if (!mounted || state.status === "loading") {
    return (
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#6b7280",
          fontFamily: "system-ui, sans-serif",
        }}
      >
        Loading deployment config…
      </div>
    );
  }

  if (state.status === "fatal") {
    return (
      <Box sx={{ maxWidth: 560, mx: "auto", mt: 8, px: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {state.error}
        </Alert>
        {state.retryable && (
          <Button variant="contained" onClick={() => setAttempt((n) => n + 1)}>
            Retry
          </Button>
        )}
      </Box>
    );
  }

  return (
    <ClientConfigContext.Provider value={state}>
      <ApplicationServicesContext.Provider value={state.services}>
        {children}
      </ApplicationServicesContext.Provider>
    </ClientConfigContext.Provider>
  );
}
