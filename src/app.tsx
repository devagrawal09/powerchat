import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { createEffect, createSignal, Show, Suspense } from "solid-js";
import ChatLayout from "./routes/(chat)";
import "./app.css";
import { PowerSyncContext } from "./lib/powersync-solid";
import { connectPowerSync, powersync } from "./lib/powersync";
import { SessionProvider } from "./lib/session";

export default function App() {
  const [isConnected, setIsConnected] = createSignal(false);

  createEffect(() => {
    console.log("[App] connecting to PowerSync");
    connectPowerSync().then(() => setIsConnected(true));
  });
  return (
    <Show when={isConnected()}>
      <SessionProvider>
        <PowerSyncContext.Provider value={powersync}>
          <Router
            root={(props) => (
              <Suspense fallback={<div>Loading...</div>}>
                <ChatLayout>{props.children}</ChatLayout>
              </Suspense>
            )}
          >
            <FileRoutes />
          </Router>
        </PowerSyncContext.Provider>
      </SessionProvider>
    </Show>
  );
}
