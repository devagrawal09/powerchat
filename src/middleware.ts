import { createMiddleware } from "@solidjs/start/middleware";
import { getCookie, setCookie } from "vinxi/http";

function ensureAnonymousUser(event: any) {
  const existing = getCookie(event.nativeEvent, "pc_uid");
  if (!existing) {
    const uid = crypto.randomUUID();
    setCookie(event.nativeEvent, "pc_uid", uid, {
      httpOnly: false,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365, // 12 months
    });
  }
}

export default createMiddleware({
  onRequest: (event) => {
    ensureAnonymousUser(event);
  },
});
