import { createSignal, createEffect, onCleanup } from "solid-js";
import { getUsername } from "~/lib/getUsername";

export function UsernameCheck() {
  const [username, setUsername] = createSignal<string | null>(null);
  const [checking, setChecking] = createSignal(true);

  // Initial check and watch for cookie changes
  createEffect(() => {
    const checkCookie = () => {
      const currentUsername = getUsername();
      setUsername(currentUsername);
      setChecking(false);
    };

    // Initial check
    checkCookie();

    // Check cookie periodically and on storage events
    const interval = setInterval(checkCookie, 1000);
    window.addEventListener("storage", checkCookie);

    onCleanup(() => {
      clearInterval(interval);
      window.removeEventListener("storage", checkCookie);
    });
  });

  return {
    username: () => username(),
    hasUsername: () => !!username(),
    checking: () => checking(),
  };
}
