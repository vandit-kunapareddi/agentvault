export interface Forecast {
  avgDaily: number;
  projected7d: number;
  projected30d: number;
  capRatio: number;
  willExceedCap: boolean;
  nearCap: boolean;
}

const NEAR_CAP_RATIO = 0.7;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeForecast(args: {
  recentApprovedAmounts: number[];
  windowDays: number;
  dailyCap: number;
}): Forecast {
  const total = args.recentApprovedAmounts.reduce((s, a) => s + a, 0);
  const avgDaily = args.windowDays > 0 ? total / args.windowDays : 0;
  const projected7d = avgDaily * 7;
  const projected30d = avgDaily * 30;
  const capRatio = args.dailyCap > 0 ? avgDaily / args.dailyCap : 0;
  return {
    avgDaily: round2(avgDaily),
    projected7d: round2(projected7d),
    projected30d: round2(projected30d),
    capRatio,
    willExceedCap: args.dailyCap > 0 && avgDaily > args.dailyCap,
    nearCap:
      args.dailyCap > 0 &&
      avgDaily >= args.dailyCap * NEAR_CAP_RATIO &&
      avgDaily <= args.dailyCap,
  };
}
