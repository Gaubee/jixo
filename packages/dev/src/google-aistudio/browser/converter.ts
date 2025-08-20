import {match, P} from "ts-pattern";
import {z} from "zod";

// --------------------------------------------------------------------------
// 1. TYPE DEFINITIONS
// --------------------------------------------------------------------------

let __TYPE_KEY = "__TYPE_KEY__";
let __CONTENT_KEY = "__CONTENT_KEY__";
let __BLOB_URL_KEY = "__BLOB_URL_KEY__";
let __IMAGE_CONTENT_KEY = "__IMAGE_CONTENT_KEY__";
let __IMAGE_INLINE_CONTENT_KEY = "__IMAGE_INLINE_CONTENT_KEY__";
let __FILE_CONTENT_KEY = "__FILE_CONTENT_KEY__";
let __FC_RESPONSE_KEY = "__FC_RESPONSE_KEY__";
let sm = [] as any[];
const KEYS = {
  get TYPE_KEY(): "__TYPE_KEY__" {
    if (__TYPE_KEY === "__TYPE_KEY__") {
      const msg = sm.at(-1);
      for (const key in msg) {
        if (/^(role|text|grounding|id|isJson|parts|tokenCount)$/.test(key)) {
          continue;
        }

        const val = msg[key];
        if (/^(text|image|function_call|file)$/.test(val)) {
          __TYPE_KEY = key;
          break;
        }
      }
    }
    return __TYPE_KEY as "__TYPE_KEY__";
  },
  get CONTENT_KEY(): "__CONTENT_KEY__" {
    if (__CONTENT_KEY === "__CONTENT_KEY__") {
      msgLabel: for (const msg of sm) {
        const parts = msg.parts;
        if (Array.isArray(parts) && parts.length > 0) {
          const part = parts[0];
          for (const key in part) {
            const val = part[key];
            if (Array.isArray(val)) {
              __CONTENT_KEY = key;
              break msgLabel;
            }
            break;
          }
        }
      }
    }
    return __CONTENT_KEY as "__CONTENT_KEY__";
  },
  get BLOB_URL_KEY(): "__BLOB_URL_KEY__" {
    prepareImageKeys();
    return __BLOB_URL_KEY as "__BLOB_URL_KEY__";
  },
  get IMAGE_CONTENT_KEY(): "__IMAGE_CONTENT_KEY__" {
    prepareImageKeys();
    return __IMAGE_CONTENT_KEY as "__IMAGE_CONTENT_KEY__";
  },
  get IMAGE_INLINE_CONTENT_KEY(): "__IMAGE_INLINE_CONTENT_KEY__" {
    prepareImageKeys();
    return __IMAGE_INLINE_CONTENT_KEY as "__IMAGE_INLINE_CONTENT_KEY__";
  },
  get FILE_CONTENT_KEY(): "__FILE_CONTENT_KEY__" {
    if (__FILE_CONTENT_KEY === "__FILE_CONTENT_KEY__") {
      for (const msg of sm) {
        if ("file" === msg[KEYS.TYPE_KEY]) {
          for (const key in msg) {
            if (/^(role|text|grounding|id|isJson|parts|tokenCount)$/.test(key)) {
              continue;
            }
            const val = msg[key];
            if (typeof val === "object" && val && "mimeType" in val) {
              __FILE_CONTENT_KEY = key;
            }
          }
        }
      }
    }
    return __FILE_CONTENT_KEY as "__FILE_CONTENT_KEY__";
  },
  get FC_RESPONSE_KEY(): "__FC_RESPONSE_KEY__" {
    if (__FC_RESPONSE_KEY === "__FC_RESPONSE_KEY__") {
      for (const msg of sm) {
        if ("function_call" === msg[KEYS.TYPE_KEY]) {
          for (const key in msg) {
            if (/^(role|text|grounding|id|isJson|parts|tokenCount)$/.test(key)) {
              continue;
            }
            const val = msg[key];
            if (typeof val === "object" && val && "response" in val) {
              __FC_RESPONSE_KEY = key;
            }
          }
        }
      }
    }
    return __FC_RESPONSE_KEY as "__FC_RESPONSE_KEY__";
  },
};
const prepareImageKeys = () => {
  if (__BLOB_URL_KEY === "__BLOB_URL_KEY__" || __IMAGE_CONTENT_KEY === "__IMAGE_CONTENT_KEY__" || __IMAGE_INLINE_CONTENT_KEY === "__IMAGE_INLINE_CONTENT_KEY__") {
    for (const msg of sm) {
      if ("image" === msg[KEYS.TYPE_KEY]) {
        for (const key in msg) {
          if (/^(role|text|grounding|id|isJson|parts|tokenCount)$/.test(key)) {
            continue;
          }
          const val = msg[key];
          if (typeof val === "object" && val && "mimeType" in val) {
            if ("id" in val) {
              __IMAGE_CONTENT_KEY = key;
            } else {
              __IMAGE_INLINE_CONTENT_KEY = key;
            }
          } else if (typeof val === "string" && val.startsWith("blob:")) {
            __BLOB_URL_KEY = key;
          }
        }
      }
    }
  }
};

const prepareKey = (sourceMessages: any[]) => {
  if (sourceMessages.length === 0) {
    return;
  }
  sm = sourceMessages;
};

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
type SourceBaseMessage = {
  id: string;
  role: "user" | "model";
  tokenCount: number;
} & {
  [key in typeof KEYS.TYPE_KEY]: "text" | "image" | "function_call" | "file";
};

type SourceTextMessage = SourceBaseMessage & {
  text: string;
  thought?: boolean;
} & {
  [key in typeof KEYS.TYPE_KEY]: "text";
};

// Updated to handle both embedded (Wd) and blob (Ta/zd) image formats
type SourceImageMessage = SourceBaseMessage & {
  [KEYS.IMAGE_INLINE_CONTENT_KEY]?: {
    mimeType: string;
    Dc: string; // Base64 data
  };
  [KEYS.IMAGE_CONTENT_KEY]?: {
    id: string;
    name: string;
    mimeType: string;
    thumbnailLink?: string;
  };
  [KEYS.BLOB_URL_KEY]?: string; // blob URL
} & {
  [key in typeof KEYS.TYPE_KEY]: "image";
};

// (Function call types are unchanged)
type FunctionCallPartsArray = [null, null, null, null, null, null, null, null, null, null, [string, [[(string | [string, any[]])[]]]], ...any[]];
type FunctionCallPartsNc = {
  [key in typeof KEYS.CONTENT_KEY]: any[];
};
type SourceFunctionCallMessage = SourceBaseMessage & {
  parts: [FunctionCallPartsArray] | [FunctionCallPartsNc];
} & {
  [key in typeof KEYS.FC_RESPONSE_KEY]: {response: any};
} & {
  [key in typeof KEYS.CONTENT_KEY]: "function_call";
};

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
    .with({[KEYS.CONTENT_KEY]: P.array()}, (part) => {
      const functionCallData = part[KEYS.CONTENT_KEY][10].Nc;
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
  prepareKey(sourceMessages);
  // Step 1: Group messages (synchronous)
  const groupedMessages = sourceMessages.reduce<GroupedMessage[]>((acc, msg) => {
    const lastGroup = acc[acc.length - 1];
    const prevMessage = lastGroup?.items[lastGroup.items.length - 1];
    if (lastGroup && lastGroup.role === msg.role && prevMessage?.[KEYS.TYPE_KEY] !== "function_call") {
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
        .with({[KEYS.TYPE_KEY]: "text", text: P.string}, (msg) => {
          return msg.text.length > 0 ? {text: msg.text} : null;
        })
        .with({[KEYS.TYPE_KEY]: "image"}, async (img) => {
          if (KEYS.IMAGE_INLINE_CONTENT_KEY in img) {
            const inlineContent = img[KEYS.IMAGE_INLINE_CONTENT_KEY]!;
            // Handle embedded image data (sync)
            return {inlineData: {mimeType: inlineContent.mimeType, data: inlineContent.Dc}};
          }
          if (KEYS.BLOB_URL_KEY in img && KEYS.IMAGE_CONTENT_KEY in img) {
            const imageConent = img[KEYS.IMAGE_CONTENT_KEY]!;
            const blobUrl = img[KEYS.BLOB_URL_KEY]!;
            // Handle blob image data (async)
            try {
              const data = await blobUrlToBase64(blobUrl);
              return {inlineData: {mimeType: imageConent.mimeType, data}};
            } catch (error) {
              console.error(`Failed to process blob URL ${blobUrl}:`, error);
              return null;
            }
          }
          return null;
        })
        .with({[KEYS.TYPE_KEY]: "function_call"}, (msg) => {
          try {
            const {name, argsArray} = getCanonicalFunctionCall(msg);
            const args = parseFunctionArgs(argsArray);
            if (msg[KEYS.FC_RESPONSE_KEY]?.response) {
              functionResponseData = {name, response: msg[KEYS.FC_RESPONSE_KEY].response};
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
