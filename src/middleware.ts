import { createMiddleware } from "@solidjs/start/middleware";

// Middleware no longer manages user creation
// Username registration happens via client-side modal + server action
export default createMiddleware({
  onRequest: async (event) => {
    // Allow all requests to proceed
    // Username modal will handle auth on client side
  },
});
