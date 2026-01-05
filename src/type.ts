import { Context } from "hono";

export type Env = { GITHUB_TOKEN: string };

export type HonoContext = Context<{ Bindings: Env }>;

export type Options = {
  username: string;
  token: string;
  to: Date;
  from: Date;
};
