import { Context } from "hono";

export type Env = { GITHUB_TOKEN: string };

export type HonoContext = Context<{ Bindings: Env }>;
