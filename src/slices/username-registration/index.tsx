import { createSignal, Show } from "solid-js";
import { useAction, useSubmission } from "@solidjs/router";
import { registerUsername } from "~/server/actions";

export function UsernameRegistration(props: {
  onSuccess: (username: string) => void;
}) {
  const [username, setUsername] = createSignal("");
  const [error, setError] = createSignal("");
  const register = useAction(registerUsername);
  const submission = useSubmission(registerUsername);

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

    setError("");

    try {
      const formData = new FormData();
      formData.append("username", value);
      const result = await register(formData);

      console.log("[UsernameRegistration] Result:", result);

      if (!result) {
        setError("No response from server");
        return;
      }

      if (result.error) {
        setError(result.error);
      } else if (result.success && result.username) {
        // Set cookie
        document.cookie = `pc_username=${result.username}; path=/; max-age=${
          60 * 60 * 24 * 365
        }; SameSite=Lax`;
        props.onSuccess(result.username);
      } else {
        setError("Unexpected response from server");
      }
    } catch (err: any) {
      console.error("[UsernameRegistration] Error:", err);
      setError(err?.message || "Failed to register username");
    }
  };

  return (
    <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div class="bg-white rounded-lg p-6 max-w-md w-full mx-4">
        <h2 class="text-2xl font-bold text-gray-900 mb-2">
          Welcome to PowerChat
        </h2>
        <p class="text-gray-600 mb-4">Choose a username to get started</p>

        <form onSubmit={handleSubmit}>
          <input
            type="text"
            value={username()}
            onInput={(e) => setUsername(e.currentTarget.value)}
            placeholder="Enter username"
            class="w-full px-4 py-2 border border-gray-300 rounded text-gray-900 placeholder-gray-400 mb-2"
            disabled={submission.pending}
            autofocus
          />

          <Show when={error()}>
            <p class="text-red-600 text-sm mb-2">{error()}</p>
          </Show>

          <button
            type="submit"
            disabled={submission.pending || username().trim().length < 3}
            class="w-full px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {submission.pending ? "Creating..." : "Continue"}
          </button>
        </form>

        <p class="text-xs text-gray-500 mt-4">
          Username must be 3-30 characters and can only contain letters,
          numbers, hyphens, and underscores.
        </p>
      </div>
    </div>
  );
}
