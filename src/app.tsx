import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createEffect, createSignal, Show, Suspense } from "solid-js";
import ChatLayout from "./routes/(chat)";
import "./app.css";
import { PowerSyncContext } from "./lib/powersync-solid";
import { connectPowerSync, powersync } from "./lib/powersync";
import { SessionProvider } from "./lib/session";
import { useSession } from "./lib/session";
import { UsernameRegistration } from "./slices/username-registration";

function AppShell() {
  const session = useSession();
  const [isConnected, setIsConnected] = createSignal(false);

  createEffect(() => {
    if (!session.username()) {
      setIsConnected(false);
      return;
    }

    void connectPowerSync()
      .then(() => setIsConnected(true))
      .catch((error) => {
        console.error("[App] PowerSync connect failed", error);
        setIsConnected(false);
      });
  });

  return (
    <PowerSyncContext.Provider value={powersync}>
      <Show when={!session.username()}>
        <UsernameRegistration onSuccess={() => {}} />
      </Show>

      <Show when={session.username()}>
        <Show
          when={isConnected()}
          fallback={<div class="p-6 text-gray-500">Connecting PowerSync...</div>}
        >
          <Router
            root={(props) => (
              <Suspense fallback={<div>Loading...</div>}>
                <ChatLayout>{props.children}</ChatLayout>
              </Suspense>
            )}
          >
            <FileRoutes />
          </Router>
        </Show>
      </Show>
    </PowerSyncContext.Provider>
  );
}

export default function App() {
  return (
    <SessionProvider>
      <AppShell />
    </SessionProvider>
  );
}
