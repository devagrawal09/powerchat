// @refresh reload
import { mount, StartClient } from "@solidjs/start/client";
import { ensureTanStackDbReady } from "~/lib/tanstack-db";

void ensureTanStackDbReady();

mount(() => <StartClient />, document.getElementById("app")!);
