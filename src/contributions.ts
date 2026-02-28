import { z } from "zod";
import { Contributions, HonoContext, Options, QueryResponse } from "./type";

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
  format: z
    .enum(["json", "csv"], "'format' must be 'json' or 'csv'")
    .default("json")
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
    const calendar = await getContributions({ username, token, ...dates });
    const activities = mapContributions(calendar);
    const format = parsed.data.format ?? "json";

    // if format is csv, return csv
    if (format === "csv") {
      const csv = toCsv(activities);
      return c.text(csv, 200, { "Content-Type": "text/csv;charset=utf-8" });
    }

    // return json by default
    const data: Contributions.Data = {
      to: toIsoDate(dates.to),
      from: toIsoDate(dates.from),
      total: calendar.total,
      activities,
    };
    return c.json(data);
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
    const json = (await res.json()) as QueryResponse.Data;
    return json.data.user.contributionsCollection.contributionCalendar;
  } catch {
    throw new Error("Failed to fetch contributions data from GitHub");
  }
}

function mapContributions(calendar: QueryResponse.Calendar) {
  const activities: Contributions.Activity[] = [];
  for (const week of calendar.weeks) {
    for (const act of week.days) {
      activities.push({
        count: act.count,
        date: act.date,
        level: mapActivityLevel(act.contributionLevel),
      });
    }
  }
  return activities;
}

function mapActivityLevel(level: string): number {
  // biome-ignore format: keep the entries as is, do not sort them
  const map = ["NONE","FIRST_QUARTILE","SECOND_QUARTILE","THIRD_QUARTILE","FOURTH_QUARTILE"];
  return map.includes(level) ? map.indexOf(level) : 0;
}

function toIsoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toCsv(activities: Contributions.Activity[]): string {
  const header = "date,count,level";
  const rows = activities.map((a) => `${a.date},${a.count},${a.level}`);
  return [header, ...rows].join("\n");
}

function resolveDates(opts: z.output<typeof zQueryParams>) {
  const to = opts.to ? new Date(opts.to) : new Date();
  const from = opts.from ? new Date(opts.from) : new Date(to);
  // Calculate fromDate based on duration by priority
  if (opts.d) from.setDate(from.getDate() - opts.d);
  else if (opts.w) from.setDate(from.getDate() - opts.w * 7);
  else if (opts.m) from.setMonth(from.getMonth() - opts.m);
  else if (opts.y) from.setMonth(from.getMonth() - opts.y * 12);
  // Adjust `from` date to be the previous Sunday (or keep if already Sunday)
  const fromDayIndex = from.getDay();
  if (fromDayIndex !== 0) from.setDate(from.getDate() - fromDayIndex);
  return { to, from };
}
