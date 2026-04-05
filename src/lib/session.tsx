import {
  createContext,
  createSignal,
  type Accessor,
  type JSX,
  useContext,
} from "solid-js";
import { getUsername } from "~/lib/getUsername";

type SessionContextValue = {
  username: Accessor<string | null>;
  setUsername: (username: string | null) => void;
};

const SessionContext = createContext<SessionContextValue>();

export function SessionProvider(props: { children: JSX.Element }) {
  const [username, setUsernameSignal] = createSignal<string | null>(getUsername());

  const setUsername = (username: string | null) => {
    if (username) {
      document.cookie = `pc_username=${encodeURIComponent(username)}; path=/; max-age=${
        60 * 60 * 24 * 365
      }; SameSite=Lax`;
    } else {
      document.cookie =
        "pc_username=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/; SameSite=Lax";
    }

    setUsernameSignal(username);
  };

  return (
    <SessionContext.Provider value={{ username, setUsername }}>
      {props.children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useSession must be used within a SessionProvider");
  }

  return context;
}
