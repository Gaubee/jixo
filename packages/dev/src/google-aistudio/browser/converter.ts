import {match, P} from "ts-pattern";
import {z} from "zod";

// --------------------------------------------------------------------------
// 1. TYPE DEFINITIONS
// --------------------------------------------------------------------------

// --- Target Schema and Types ---
const TargetPartSchema = z.union([
  z.object({text: z.string()}),
  z.object({
    inlineData: z.object({
      mimeType: z.string(),
      data: z.string(),
    }),
  }),
  z.object({
    function_call: z.object({
      name: z.string(),
      args: z.any(),
    }),
  }),
  z.object({
    function_response: z.object({
      name: z.string(),
      response: z.any(),
    }),
  }),
]);

const TargetMessageSchema = z.object({
  role: z.string(),
  parts: z.array(TargetPartSchema),
});

export const FinalOutputSchema = z.array(TargetMessageSchema);

type TargetPart = z.infer<typeof TargetPartSchema>;
type TargetMessage = z.infer<typeof TargetMessageSchema>;

// --- Source Data Types ---
interface SourceBaseMessage {
  id: string;
  role: "user" | "model";
  Ua: "text" | "image" | "function_call";
  Ya: number;
  tokenCount: number;
}

interface SourceTextMessage extends SourceBaseMessage {
  Ua: "text";
  text: string;
  thought?: boolean;
}

// Updated to handle both embedded (Wd) and blob (Ta/zd) image formats
interface SourceImageMessage extends SourceBaseMessage {
  Ua: "image";
  Wd?: {
    mimeType: string;
    Dc: string; // Base64 data
  };
  Ta?: {
    id: string;
    name: string;
    mimeType: string;
  };
  zd?: string; // blob URL
}

// (Function call types are unchanged)
type FunctionCallPartsArray = [null, null, null, null, null, null, null, null, null, null, [string, [[(string | [string, any[]])[]]]], ...any[]];
interface FunctionCallPartsNc {
  Nc: any[];
}
interface SourceFunctionCallMessage extends SourceBaseMessage {
  Ua: "function_call";
  parts: [FunctionCallPartsArray] | [FunctionCallPartsNc];
  Qg: {response: any};
}

type SourceMessage = SourceTextMessage | SourceImageMessage | SourceFunctionCallMessage;

interface GroupedMessage {
  role: "user" | "model";
  items: SourceMessage[];
}

// --------------------------------------------------------------------------
// 2. ASYNC HELPER FOR BLOB FETCHING (BROWSER-ONLY)
// --------------------------------------------------------------------------

/**
 * Fetches a blob URL and converts it to a Base64 string.
 * NOTE: This function only works in a browser environment.
 * @param blobUrl The `blob:...` URL to fetch.
 * @returns A Promise resolving to the Base64 encoded data string.
 */
const blobUrlToBase64 = (blobUrl: string): Promise<string> => {
  return new Promise(async (resolve, reject) => {
    try {
      const response = await fetch(blobUrl);
      if (!response.ok) {
        throw new Error(`Failed to fetch blob: ${response.statusText}`);
      }
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = () => {
        // result is a data URL (e.g., "data:image/png;base64,iVBORw...")
        // We need to strip the prefix to get just the Base64 data
        const base64Data = (reader.result as string).split(",")[1];
        resolve(base64Data);
      };
      reader.onerror = (error) => {
        reject(error);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      reject(error);
    }
  });
};

// --- (All other helpers for function calls are unchanged) ---
// (normalizeNcValue, normalizeNcMapToCanonicalArray, getCanonicalFunctionCall, parseArgValue, parseFunctionArgs)
let normalizeNcMapToCanonicalArray: (map: Map<string, {Nc: any[]}>) => [string, any[]][];
const normalizeNcValue = (ncWrapper: {Nc: any[]}): any[] => {
  const ncArray = ncWrapper.Nc;
  return match(ncArray)
    .with([P.any, P.any, P.any, P.any, {Nc: [P.select(P.instanceOf(Map))]}], (innerMap) => {
      const processedMapArray = normalizeNcMapToCanonicalArray(innerMap as Map<any, any>);
      return [null, null, null, null, [processedMapArray]];
    })
    .otherwise(() => ncArray);
};
normalizeNcMapToCanonicalArray = (map: Map<string, {Nc: any[]}>): [string, any[]][] => {
  return Array.from(map.entries()).map(([key, valueWrapper]) => {
    const canonicalValueArray = normalizeNcValue(valueWrapper);
    return [key, canonicalValueArray];
  });
};
interface CanonicalFunctionCall {
  name: string;
  argsArray: [string, any[]][];
}
const getCanonicalFunctionCall = (msg: SourceFunctionCallMessage): CanonicalFunctionCall => {
  return match(msg.parts[0])
    .with(P.array(), (part) => ({name: (part[10] as any)[0], argsArray: (part[10] as any)[1][0]}))
    .with({Nc: P.array()}, (part) => {
      const functionCallData = part.Nc[10].Nc;
      const name = functionCallData[0] as string;
      const argsMap = functionCallData[1].Nc[0] as Map<string, {Nc: any[]}>;
      return {name, argsArray: normalizeNcMapToCanonicalArray(argsMap)};
    })
    .otherwise(() => {
      throw new Error("Unknown function_call structure encountered.");
    });
};
const parseArgValue = (arg: any): any => {
  if (!Array.isArray(arg)) return arg;
  return match(arg)
    .with([P.any, P.any, P.any, P.any, P.select(P.array())], (nestedPairs) => parseFunctionArgs(nestedPairs[0] as any))
    .with([P.any, P.any, P.any, 1], () => true)
    .with([P.any, P.any, P.any, 0], () => false)
    .with([P.any, P.any, P.select(P.string)], (val) => val)
    .with([P.any, P.select(P.number)], (val) => val)
    .otherwise(() => null);
};
const parseFunctionArgs = (argList: [string, any[]][]): Record<string, any> => {
  if (!Array.isArray(argList)) return {};
  return Object.fromEntries(argList.map(([key, value]) => [key, parseArgValue(value)]));
};

// --------------------------------------------------------------------------
// 5. MAIN CONVERSION FUNCTION (NOW ASYNC)
// --------------------------------------------------------------------------

/**
 * Converts the source message format to the target format.
 * This function is now ASYNCHRONOUS because it may need to fetch blob data.
 * @param sourceMessages - An array of messages in the original format.
 * @returns A Promise resolving to an array of messages in the new, cleaner format.
 */
export const convertMessages = async (sourceMessages: any[]): Promise<TargetMessage[]> => {
  // Step 1: Group messages (synchronous)
  const groupedMessages = sourceMessages.reduce<GroupedMessage[]>((acc, msg) => {
    const lastGroup = acc[acc.length - 1];
    const prevMessage = lastGroup?.items[lastGroup.items.length - 1];
    if (lastGroup && lastGroup.role === msg.role && prevMessage?.Ua !== "function_call") {
      lastGroup.items.push(msg as SourceMessage);
    } else {
      acc.push({role: msg.role, items: [msg as SourceMessage]});
    }
    return acc;
  }, []);

  // Step 2: Process each group into a target message (asynchronous)
  const finalMessages: TargetMessage[] = [];
  for (const group of groupedMessages) {
    let functionResponseData = null as {name: string; response: any} | null;

    // Asynchronously create parts for the current group
    const partsPromises = group.items.map(async (item): Promise<TargetPart | null> => {
      return match(item)
        .with({Ua: "text", text: P.string}, (msg) => {
          return msg.text.length > 0 ? {text: msg.text} : null;
        })
        .with({Ua: "image", Wd: P.not(undefined).select()}, (wd) => {
          // Handle embedded image data (sync)
          return {inlineData: {mimeType: wd.mimeType, data: wd.Dc}};
        })
        .with({Ua: "image", Ta: P.not(undefined).select("ta"), zd: P.not(undefined).select("zd")}, async ({ta, zd}) => {
          // Handle blob image data (async)
          try {
            const data = await blobUrlToBase64(zd);
            return {inlineData: {mimeType: ta.mimeType, data}};
          } catch (error) {
            console.error(`Failed to process blob URL ${zd}:`, error);
            return null;
          }
        })
        .with({Ua: "function_call"}, (msg) => {
          try {
            const {name, argsArray} = getCanonicalFunctionCall(msg);
            const args = parseFunctionArgs(argsArray);
            if (msg.Qg?.response) {
              functionResponseData = {name, response: msg.Qg.response};
            }
            return {function_call: {name, args}};
          } catch (error) {
            console.error("Failed to parse function call:", error, item);
            return null;
          }
        })
        .otherwise(() => null);
    });

    // Wait for all parts to be processed and filter out nulls
    const parts = (await Promise.all(partsPromises)).filter((p): p is TargetPart => p !== null);

    // Step 3: Construct the final message(s) for this group
    if (parts.length > 0) {
      finalMessages.push({role: group.role, parts});
    }
    if (functionResponseData) {
      finalMessages.push({
        role: "user",
        parts: [
          {
            function_response: {
              name: functionResponseData.name,
              response: {output: functionResponseData.response},
            },
          },
        ],
      });
    }
  }

  // Step 4: Add the final user input placeholder
  finalMessages.push({
    role: "user",
    parts: [{text: "INSERT_INPUT_HERE"}],
  });

  return finalMessages;
};
