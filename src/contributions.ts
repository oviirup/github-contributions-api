import { z } from "zod";
import { HonoContext } from "./type";

const zQueryParams = z.object({
  from: z.iso.date("'from' is not a valid date (YYYY-MM-DD)").optional(),
  to: z.iso.date("'from' is not a valid date (YYYY-MM-DD)").optional(),
  durationInDays: z.coerce
    .number("'durationInDays' must be an integer")
    .int("'durationInDays' must be an integer")
    .min(1, "'durationInDays' must be greater than 1")
    .optional(),
  durationInWeeks: z.coerce
    .number("'durationInWeeks' must be an integer")
    .int("'durationInWeeks' must be an integer")
    .min(1, "'durationInWeeks' must be greater than 1")
    .optional(),
  durationInMonths: z.coerce
    .number("'durationInMonths' must be an integer")
    .int("'durationInMonths' must be an integer")
    .min(1, "'durationInMonths' must be greater than 1")
    .optional(),
});

const chromeUserAgent = `Mozilla/5.0 (Windows Server 2012 R2 Standard; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.5975.80 Safari/537.36`;

type QueryParams = z.output<typeof zQueryParams>;
type Options = QueryParams & { username: string; accessToken: string };

export async function getContributionsRoute(c: HonoContext) {
  const url = new URL(c.req.url);
  const username = c.req.param("username");
  const params = Object.fromEntries(url.searchParams);
  const accessToken = c.env.GITHUB_TOKEN;

  // validate query params, return invalid on error
  const parsed = zQueryParams.safeParse({ username, ...params });
  if (!parsed.success) {
    const message = parsed.error.issues[0].message;
    return c.json({ error: "Invalid options", message }, 400);
  }

  try {
    const options: Options = { username, accessToken, ...parsed.data };
    const result = await getContributions(options);
    return c.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return c.json({ error: "Server error", message }, 500);
  }
}

async function getContributions({ username, accessToken, ...opts }: Options) {
  const { fromDate, toDate } = resolveDuration(opts);

  const query = `
  query($userName:String!, $from: DateTime, $to: DateTime ) {
    user(login: $userName){
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          total: totalContributions
          weeks { days: contributionDays { count: contributionCount date contributionLevel } }
        }
      }
    }
  }`;

  const variables = {
    userName: username,
    from: fromDate,
    to: toDate,
  };

  try {
    const res = await fetch("https://api.github.com/graphql", {
      method: "POST",
      headers: {
        "User-Agent": chromeUserAgent,
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ query, variables }),
    });
    const json = await res.json();
    return json;
  } catch (err) {
    console.error(err);
    throw new Error("Failed to fetch contributions data from GitHub");
  }
}

function resolveDuration(opts: QueryParams) {
  const toDate = opts.to ? new Date(opts.to) : new Date();
  const fromDate = opts.from ? new Date(opts.from) : new Date(toDate);
  // Default to 12 months
  opts.durationInMonths ??= 12;
  // Calculate fromDate based on duration by priority
  if (opts.durationInDays) {
    fromDate.setDate(fromDate.getDate() - opts.durationInDays);
  } else if (opts.durationInWeeks) {
    fromDate.setDate(fromDate.getDate() - opts.durationInWeeks * 7);
  } else if (opts.durationInMonths) {
    fromDate.setMonth(fromDate.getMonth() - opts.durationInMonths);
  }
  return { fromDate, toDate };
}
