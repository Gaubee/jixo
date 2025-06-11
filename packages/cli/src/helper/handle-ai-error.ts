import {gray, red, yellow, type Spinner} from "@gaubee/nodekit";
import {delay} from "@gaubee/util";
import {APICallError, RetryError} from "ai";
import ms from "ms";
import {match} from "ts-pattern";
import z from "zod";
type Loading = Pick<Spinner, "prefixText" | "text">;

export const handleError = async (error: unknown, loading: Loading) => {
  for (const handle of [handleAPICallError, handleRetryError]) {
    const matched = await handle(error, loading);
    if (matched) {
      return true;
    }
  }
};

const handleRetryError = async (error: unknown, loading: Loading) => {
  if (!RetryError.isInstance(error)) {
    return;
  }
  for (const inner_error of error.errors) {
    const matched = await handleAPICallError(inner_error, loading);
    if (matched) {
      return true;
    }
  }
};

const handleAPICallError = async (error: unknown, loading: Loading) => {
  if (!APICallError.isInstance(error)) {
    return;
  }
  try {
    if (error.isRetryable) {
      const safeData = geminiErrorSchema.safeParse(JSON.parse(error.responseBody!));
      if (!safeData.success) {
        throw safeData.error;
      }
      const retryDetail = safeData.data.error.details.find((d) => "retryDelay" in d);
      if (retryDetail) {
        const retryDelay = ms(retryDetail.retryDelay as ms.StringValue);

        if (typeof retryDelay === "number") {
          await waitRetryDelay(loading, retryDelay, (loading.text = yellow(error.message)));
          return true;
        }
      }
    } else {
      const safeData = commonErrorSchema.safeParse(error.data);
      if (!safeData.success) {
        throw safeData.error;
      }
      await match(safeData.data.error)
        /// 余额不足
        .with({message: "Insufficient Balance"}, async () => {
          /// 30s重试
          await waitRetryDelay(loading, 1000 * 30, (loading.text = red("Insufficient Balance") + "\n" + red(error.url)));
        })
        .otherwise(() => {
          throw error;
        });
      return true;
    }
  } catch {
    console.error("\nQAQ unknown error", error);
  }
};

const commonErrorSchema = z.object({
  error: z.object({
    message: z.string(),
    type: z.string(),
    param: z.any(),
    code: z.string(),
  }),
});

const geminiErrorSchema = z.object({
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

const waitRetryDelay = async (loading: Loading, retryDelay: number, message: string) => {
  const {prefixText, text} = loading;
  let remainingDelay = retryDelay;
  const tickInterval = 1000;
  const tick = () => {
    loading.prefixText = "⏲️ ";
    loading.text = [
      //
      message,
      " " + gray("─".repeat(Math.max(4, process.stdout.columns - 2))),
      `Retrying in ${ms(remainingDelay)}...`,
    ].join("\n");
    remainingDelay -= tickInterval;
  };
  tick();

  const ti = setInterval(tick, tickInterval);
  await delay(retryDelay);
  clearInterval(ti);

  // 回滚
  loading.prefixText = prefixText;
  loading.text = text;
};
