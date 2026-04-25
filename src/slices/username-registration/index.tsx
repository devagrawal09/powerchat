import { asc } from "drizzle-orm";
import { clientDb, liveQuery, users } from "~/db/client";
import { createSignal, Show } from "solid-js";
import { useQuery } from "~/lib/powersync-solid/hooks/useQuery";
import { useSession } from "~/lib/session";
import { connectPowerSync } from "~/lib/powersync";

export function UsernameRegistration(props: {
  onSuccess: (username: string) => void;
}) {
  const session = useSession();
  const [username, setUsername] = createSignal("");
  const [error, setError] = createSignal("");
  const [submitting, setSubmitting] = createSignal(false);

  const existingUsers = useQuery(
    () =>
      liveQuery(
        clientDb.select({ id: users.id }).from(users).orderBy(asc(users.id)),
      ),
  );

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    const value = username().trim();

    if (value.length < 3) {
      setError("Username must be at least 3 characters");
      return;
    }

    if (value.length > 30) {
      setError("Username must be less than 30 characters");
      return;
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(value)) {
      setError(
        "Username can only contain letters, numbers, hyphens, and underscores"
      );
      return;
    }

    const duplicate = (existingUsers().data || []).find(
      (u) => u.id.toLowerCase() === value.toLowerCase(),
    );
    if (duplicate) {
      setError("Username already taken");
      return;
    }

    setError("");
    setSubmitting(true);

    try {
      session.setUsername(value);
      await connectPowerSync();

      const now = new Date().toISOString();
      await clientDb.insert(users).values({ id: value, createdAt: now });

      props.onSuccess(value);
    } catch (err: any) {
      console.error("[UsernameRegistration] Error:", err);
      setError(err?.message || "Failed to register username");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      class="fixed inset-0 flex items-center justify-center z-50"
      style={{
        background: "linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)",
        "background-size": "cover",
      }}
    >
      {/* Subtle grid overlay */}
      <div
        class="absolute inset-0 opacity-[0.07]"
        style={{
          "background-image":
            "linear-gradient(rgba(255,255,255,.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.1) 1px, transparent 1px)",
          "background-size": "40px 40px",
        }}
      />

      <div class="relative bg-white rounded-xl shadow-2xl p-8 max-w-md w-full mx-4">
        <h2 class="text-2xl font-bold text-gray-900 mb-1">
          Welcome to PowerChat
        </h2>
        <p class="text-gray-500 mb-6">Choose a username to get started</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            placeholder="Enter username"
            class="input mb-3"
            disabled={submitting()}
            autofocus
          />

          <Show when={error()}>
            <p class="text-red-600 text-sm mb-2">{error()}</p>
          </Show>

          <button
            type="submit"
            disabled={submitting() || username().trim().length < 3}
            class="btn btn-primary w-full py-2.5"
          >
            {submitting() ? "Creating..." : "Continue"}
          </button>
        </form>

        <p class="text-xs text-gray-400 mt-4 text-center">
          Username must be 3-30 characters: letters, numbers, hyphens, and underscores.
        </p>
      </div>
    </div>
  );
}
