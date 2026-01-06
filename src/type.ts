import { Context } from "hono";

export type Env = { GITHUB_TOKEN: string };

export type HonoContext = Context<{ Bindings: Env }>;

export type Options = {
  username: string;
  token: string;
  to: Date;
  from: Date;
};

export namespace Contributions {
  export type Activity = { count: number; level: number; date: string };
  export type Week = Activity[];
  export type Data = {
    to: string;
    from: string;
    activities: Activity[];
    total: number;
  };
}

export namespace QueryResponse {
  export type Day = { count: number; date: string; contributionLevel: string };
  export type Week = { days: Day[] };
  export type Calendar = { total: number; weeks: Week[] };
  export type Collection = { contributionCalendar: Calendar };
  export type User = { contributionsCollection: Collection };
  export type Data = { data: { user: User } };
}
