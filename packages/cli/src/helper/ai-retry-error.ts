import {gray, yellow, type Spinner} from "@gaubee/nodekit";
import {delay, str_trim_indent} from "@gaubee/util";
import {APICallError, RetryError} from "ai";
import ms from "ms";
import z from "zod";
export const handleRetryError = async (error: unknown, loading: Spinner) => {
  if (!RetryError.isInstance(error)) {
    return;
  }
  for (const inner_error of error.errors) {
    if (!APICallError.isInstance(inner_error)) {
      continue;
    }
    if (!inner_error.isRetryable) {
      continue;
    }

    try {
      const response = errorSchema.parse(JSON.parse(inner_error.responseBody ?? "{}"));
      const retryDetail = response.error.details.find((d) => "retryDelay" in d);
      if (retryDetail) {
        const retryDelay = ms(retryDetail.retryDelay as ms.StringValue);

        if (typeof retryDelay === "number") {
          const {prefixText, text} = loading;
          let remainingDelay = retryDelay;
          const tickInterval = 1000;
          const tick = () => {
            loading.prefixText = "⏲️ ";
            loading.text = str_trim_indent(`
            ${yellow(inner_error.message)}
            ${" " + gray("─".repeat(Math.max(4, process.stdout.columns - 2)))}
            Retrying in ${ms(remainingDelay)}...`);
            remainingDelay -= tickInterval;
          };
          tick();

          const ti = setInterval(tick, tickInterval);
          await delay(retryDelay);
          clearInterval(ti);

          // 回滚
          loading.prefixText = prefixText;
          loading.text = text;
        }
      }
    } catch {
      console.error("\nQAQ unknown error", error);
    }
  }
};

const errorSchema = z.object({
  error: z.object({
    code: z.number(),
    message: z.string(),
    status: z.string(),
    details: z.array(
      z.union([
        z.object({
          "@type": z.string(),
          violations: z.array(
            z.object({
              quotaMetric: z.string(),
              quotaId: z.string(),
              quotaDimensions: z.object({
                location: z.string(),
                model: z.string(),
              }),
              quotaValue: z.string(),
            }),
          ),
        }),
        z.object({
          "@type": z.string(),
          links: z.array(z.object({description: z.string(), url: z.string()})),
        }),
        z.object({"@type": z.string(), retryDelay: z.string()}),
      ]),
    ),
  }),
});
