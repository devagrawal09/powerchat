import { useSession } from "~/lib/session";

export function UsernameCheck() {
  const session = useSession();

  return {
    username: session.username,
    hasUsername: () => !!session.username(),
    checking: () => false,
  };
}
