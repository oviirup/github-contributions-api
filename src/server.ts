import { Hono } from "hono";
import { cache } from "hono/cache";
import { cors } from "hono/cors";
import { version } from "../package.json";
import { getContributionsRoute } from "./contributions";

const app = new Hono();

app.use("*", cors());

app.get("/", (c) => {
  return c.json({
    message: "Welcome to the GitHub Contributions API.",
    version,
    docs: "https://github.com/oviirup/github-contributions-api",
  });
});

const cacheConfig: Parameters<typeof cache>[0] = {
  cacheName: (c) => `cache::${c.req.path}`,
  cacheControl: "public, max-age=3600, stale-while-revalidate=600",
};

app.get("/:username", cache(cacheConfig), getContributionsRoute);

export default app;
