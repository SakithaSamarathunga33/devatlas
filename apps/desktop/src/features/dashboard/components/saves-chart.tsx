import { AreaChart, Area } from "@/components/charts/area-chart";
import { Grid } from "@/components/charts/grid";
import { ChartTooltip } from "@/components/charts/tooltip/chart-tooltip";
import { XAxis } from "@/components/charts/x-axis";

export interface MonthlySaves {
  /** First day of the month. */
  date: Date;
  saved: number;
}

/** Resources saved per month, as a Bklit area chart in the theme's chart colours. */
export function SavesChart({ months }: { months: readonly MonthlySaves[] }) {
  const total = months.reduce((sum, month) => sum + month.saved, 0);
  return (
    <figure className="min-w-0">
      <figcaption className="sr-only">
        Resources saved per month:{" "}
        {months
          .map(
            (month) =>
              `${month.date.toLocaleString("en", { month: "short" })} ${String(month.saved)}`,
          )
          .join(", ")}
        . {total} in total.
      </figcaption>
      <div aria-hidden>
        <AreaChart
          data={months.map((month) => ({ date: month.date, saved: month.saved }))}
          // A fixed height, not a ratio: the chart's column is much wider on mid-size windows.
          aspectRatio="auto"
          style={{ height: 88 }}
          margin={{ top: 8, right: 8, bottom: 22, left: 8 }}
        >
          <Grid horizontal numTicksRows={3} />
          <Area
            dataKey="saved"
            fill="var(--chart-line-primary)"
            stroke="var(--chart-line-primary)"
            fillOpacity={0.35}
            strokeWidth={2}
          />
          <XAxis numTicks={4} />
          <ChartTooltip showDatePill={false} />
        </AreaChart>
      </div>
    </figure>
  );
}
