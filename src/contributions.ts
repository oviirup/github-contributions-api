import { z } from "zod";
import { HonoContext, Options } from "./type";

const zQueryParams = z.object({
  from: z.iso
    .date("'from' must be in valid iso date format (YYYY-MM-DD)")
    .optional(),
  to: z.iso
    .date("'to' must be in valid iso date format (YYYY-MM-DD)")
    .optional(),
  d: z.coerce
    .number("'d' (days) must be an integer")
    .int("'d' (days) must be an integer")
    .min(1, "'d' (days) must be greater than 1")
    .optional(),
  w: z.coerce
    .number("'w' (weeks) must be an integer")
    .int("'w' (weeks) must be an integer")
    .min(1, "'w' (weeks) must be greater than 1")
    .optional(),
  m: z.coerce
    .number("'m' (months) must be an integer")
    .int("'m' (months) must be an integer")
    .min(1, "'m' (months) must be greater than 1")
    .optional(),
  y: z.coerce
    .number("'y' (year) must be an integer")
    .int("'y' (year) must be an integer")
    .min(1, "'y' (year) must be greater than 1")
    .default(1)
    .optional(),
});

export async function getContributionsRoute(c: HonoContext) {
  const url = new URL(c.req.url);
  const params = Object.fromEntries(url.searchParams);
  // validate query params, return invalid on error
  const parsed = zQueryParams.safeParse(params);
  if (!parsed.success) {
    const message = parsed.error.issues[0].message;
    return c.json({ error: "Invalid options", message }, 400);
  }
  // get fetch, parse, and organize contributions
  try {
    const username = c.req.param("username");
    const token = c.env.GITHUB_TOKEN;
    const dates = resolveDates(parsed.data);
    const result = await getContributions({ username, token, ...dates });
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: "Server error", message }, 500);
  }
}

async function getContributions({ username, token, to, from }: Options) {
  const variables = { username, from, to };
  const query = `
  query($username:String!, $from: DateTime, $to: DateTime ) {
    user(login: $username){
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          total: totalContributions
          weeks { days: contributionDays { count: contributionCount date contributionLevel } }
        }
      }
    }
  }`;
  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "User-Agent": "Chrome/118.0.5975.80 Safari/537.36",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    const json: any = await res.json();
    return json.data.user.contributionsCollection.contributionCalendar;
  } catch {
    throw new Error("Failed to fetch contributions data from GitHub");
  }
}

function resolveDates(opts: z.output<typeof zQueryParams>) {
  const to = opts.to ? new Date(opts.to) : new Date();
  const from = opts.from ? new Date(opts.from) : new Date(to);
  // Calculate fromDate based on duration by priority
  if (opts.d) from.setDate(from.getDate() - opts.d);
  else if (opts.w) from.setDate(from.getDate() - opts.w * 7);
  else if (opts.m) from.setMonth(from.getMonth() - opts.m);
  else if (opts.y) from.setMonth(from.getMonth() - opts.y * 12);
  return { to, from };
}
