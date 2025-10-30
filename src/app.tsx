import { Router } from "@solidjs/router";
import { FileRoutes } from "@solidjs/start/router";
import { Suspense } from "solid-js";
import ChatLayout from "./routes/(chat)";
import "./app.css";

export default function App() {
  return (
    <Router
      root={(props) => (
        <Suspense>
          <ChatLayout>{props.children}</ChatLayout>
        </Suspense>
      )}
    >
      <FileRoutes />
    </Router>
  );
}
