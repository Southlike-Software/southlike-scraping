declare module "google-trends-api" {
  interface TrendsOptions {
    keyword: string | string[];
    startTime?: Date;
    endTime?: Date;
    geo?: string;
    hl?: string;
    timezone?: number;
    category?: number;
    property?: "images" | "news" | "youtube" | "froogle";
    resolution?: "COUNTRY" | "REGION" | "CITY" | "DMA";
    granularTimeResolution?: boolean;
  }

  interface GoogleTrends {
    autoComplete(
      options: { keyword: string; hl?: string },
      callback?: (err: Error | null, results: string) => void
    ): Promise<string>;

    dailyTrends(
      options: { geo?: string; trendDate?: Date; hl?: string },
      callback?: (err: Error | null, results: string) => void
    ): Promise<string>;

    interestOverTime(
      options: TrendsOptions,
      callback?: (err: Error | null, results: string) => void
    ): Promise<string>;

    interestByRegion(
      options: TrendsOptions,
      callback?: (err: Error | null, results: string) => void
    ): Promise<string>;

    realTimeTrends(
      options: { geo?: string; hl?: string; category?: string },
      callback?: (err: Error | null, results: string) => void
    ): Promise<string>;

    relatedQueries(
      options: TrendsOptions,
      callback?: (err: Error | null, results: string) => void
    ): Promise<string>;

    relatedTopics(
      options: TrendsOptions,
      callback?: (err: Error | null, results: string) => void
    ): Promise<string>;
  }

  const googleTrends: GoogleTrends;
  export default googleTrends;
}

