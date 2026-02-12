import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import ChatLayout from "./routes/(chat)";
import "./app.css";
import { PowerSyncContext } from "./lib/powersync-solid";
import { powersync } from "./lib/powersync";

export default function App() {
  return (
    <PowerSyncContext.Provider value={powersync}>
      <Router
        root={(props) => (
          <Suspense>
            <ChatLayout>{props.children}</ChatLayout>
          </Suspense>
        )}
      >
        <FileRoutes />
      </Router>
    </PowerSyncContext.Provider>
  );
}
