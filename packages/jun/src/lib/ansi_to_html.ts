/**
 * ansi-to-html
 * =============
 * Convert ANSI escape sequences to HTML.
 *
 * Source: https://github.com/rburns/ansi-to-html/
 * Stripped-down, strongly-typed ESM version without XML escaping.
 */

/**
 * AnsiColorMap 类型定义，用于存储 ANSI 颜色代码到十六进制颜色的映射。
 */
type AnsiColorMap = Record<number, string>;

/**
 * StackTag 类型定义，表示 HTML 标签名称。
 */
type StackTag = "b" | "i" | "u" | "strike" | "blink" | "span";

/**
 * Stack 类型定义，用于存储当前打开的 HTML 标签栈。
 */
type Stack = StackTag[];

/**
 * TokenType 类型定义，表示 `tokenize` 函数回调中识别出的 ANSI 令牌类型。
 */
type TokenType = "text" | "display" | "xterm256Foreground" | "xterm256Background" | "rgb";

/**
 * TokenData 类型定义，表示与 `TokenType` 关联的数据。
 * - 'text': string
 * - 'display': number (ANSI display code)
 * - 'xterm256Foreground': number (256色码)
 * - 'xterm256Background': number (256色码)
 * - 'rgb': string (e.g., "38;2;R;G;Bm" or "48;2;R;G;Bm")
 */
type TokenData = string | number;

/**
 * StickyStackElement 类型定义，用于流模式下保存样式状态。
 */
interface StickyStackElement {
  token: TokenType;
  data: TokenData;
  category: string | null;
}

/**
 * ConverterOptions 接口，定义了构造函数的可用选项。
 */
export interface ConverterOptions {
  /** The default foreground color used when reset color codes are encountered. */
  fg?: string;
  /** The default background color used when reset color codes are encountered. */
  bg?: string;
  /** Convert newline characters to `<br/>`. */
  newline?: boolean;
  /** Save style state across invocations of `toHtml()`. */
  stream?: boolean;
  /** Can override specific colors or the entire ANSI palette. */
  colors?: string[] | AnsiColorMap;
}

/**
 * InternalConverterOptions 接口，定义了经过默认值合并后的内部选项。
 */
interface InternalConverterOptions {
  fg: string;
  bg: string;
  newline: boolean;
  stream: boolean;
  colors: AnsiColorMap;
}

/**
 * 默认选项。
 */
const defaults: InternalConverterOptions = {
  fg: "#FFF",
  bg: "#000",
  newline: false,
  stream: false,
  colors: getDefaultColors(),
};

/**
 * 获取默认的 ANSI 颜色映射。
 * @returns AnsiColorMap
 */
function getDefaultColors(): AnsiColorMap {
  const colors: AnsiColorMap = {
    0: "#000",
    1: "#A00",
    2: "#0A0",
    3: "#A50",
    4: "#00A",
    5: "#A0A",
    6: "#0AA",
    7: "#AAA",
    8: "#555",
    9: "#F55",
    10: "#5F5",
    11: "#FF5",
    12: "#55F",
    13: "#F5F",
    14: "#5FF",
    15: "#FFF",
  };

  range(0, 5).forEach((red) => {
    range(0, 5).forEach((green) => {
      range(0, 5).forEach((blue) => setStyleColor(red, green, blue, colors));
    });
  });

  range(0, 23).forEach(function (gray) {
    const c = gray + 232;
    const l = toHexString(gray * 10 + 8);

    colors[c] = "#" + l + l + l;
  });

  return colors;
}

/**
 * 设置 256 色彩盘中的样式颜色。
 * @param red 红色值 (0-5)
 * @param green 绿色值 (0-5)
 * @param blue 蓝色值 (0-5)
 * @param colors 颜色映射对象
 */
function setStyleColor(red: number, green: number, blue: number, colors: AnsiColorMap): void {
  const c = 16 + red * 36 + green * 6 + blue;
  const r = red > 0 ? red * 40 + 55 : 0;
  const g = green > 0 ? green * 40 + 55 : 0;
  const b = blue > 0 ? blue * 40 + 55 : 0;

  colors[c] = toColorHexString([r, g, b]);
}

/**
 * 将数字转换为两位十六进制字符串。
 * @param num 数字
 * @returns 十六进制字符串
 */
function toHexString(num: number): string {
  let str = num.toString(16);

  while (str.length < 2) {
    str = "0" + str;
  }

  return str;
}

/**
 * 将 RGB 数组转换为十六进制颜色字符串。
 * @param ref [red, green, blue] 数组
 * @returns 十六进制颜色字符串 (例如 '#FFFFFF')
 */
function toColorHexString(ref: [number, number, number]): string {
  const results: string[] = [];

  for (const r of ref) {
    results.push(toHexString(r));
  }

  return "#" + results.join("");
}

/**
 * 根据 ANSI 令牌和数据生成 HTML 输出。
 * @param stack 标签栈
 * @param token 令牌类型
 * @param data 令牌数据
 * @param options 转换选项
 * @returns 生成的 HTML 字符串或 undefined
 */
function generateOutput(stack: Stack, token: TokenType, data: TokenData, options: InternalConverterOptions): string | undefined {
  let result: string | undefined;

  if (token === "text") {
    result = pushText(data as string); // data for 'text' is string
  } else if (token === "display") {
    result = handleDisplay(stack, data as number, options); // data for 'display' is number
  } else if (token === "xterm256Foreground") {
    result = pushForegroundColor(stack, options.colors[data as number]); // data for 'xterm256Foreground' is number
  } else if (token === "xterm256Background") {
    result = pushBackgroundColor(stack, options.colors[data as number]); // data for 'xterm256Background' is number
  } else if (token === "rgb") {
    result = handleRgb(stack, data as string); // data for 'rgb' is string
  }

  return result;
}

/**
 * 处理 RGB 颜色代码。
 * @param stack 标签栈
 * @param data RGB 颜色字符串 (e.g., "38;2;R;G;Bm")
 * @returns 生成的 HTML 字符串
 */
function handleRgb(stack: Stack, data: string): string {
  // data 的类型现在已经明确为 string
  // data is already in the format "38;2;R;G;B" or "48;2;R;G;B"
  const parts = (data as string).split(";"); // 确保 data 是 string 类型
  const operation = parseInt(parts[0], 10); // 38 for foreground, 48 for background
  // parts[1] is '2' for true color, not directly used for color component
  const r = parseInt(parts[2], 10);
  const g = parseInt(parts[3], 10);
  const b = parseInt(parts[4], 10); // 修复：移除 .slice(0, -1)

  const hexR = ("0" + r.toString(16)).slice(-2);
  const hexG = ("0" + g.toString(16)).slice(-2);
  const hexB = ("0" + b.toString(16)).slice(-2);
  const rgbColor = hexR + hexG + hexB;

  return pushStyle(stack, (operation === 38 ? "color:#" : "background-color:#") + rgbColor);
}

/**
 * 处理 ANSI 显示代码 (SGR 参数)。
 * @param stack 标签栈
 * @param code 显示代码
 * @param options 转换选项
 * @returns 生成的 HTML 字符串或 undefined
 */
function handleDisplay(stack: Stack, code: number, options: InternalConverterOptions): string | undefined {
  code = parseInt(String(code), 10); // Ensure code is a number

  const codeMap: Record<number, () => string | undefined> = {
    "-1": () => (options.newline ? "<br/>" : undefined), // Only produce <br/> if newline option is true
    0: () => (stack.length ? resetStyles(stack) : undefined),
    1: () => pushTag(stack, "b"),
    3: () => pushTag(stack, "i"),
    4: () => pushTag(stack, "u"),
    8: () => pushStyle(stack, "display:none"),
    9: () => pushTag(stack, "strike"),
    22: () => pushStyle(stack, "font-weight:normal;text-decoration:none;font-style:normal"),
    23: () => closeTag(stack, "i"),
    24: () => closeTag(stack, "u"),
    39: () => pushForegroundColor(stack, options.fg),
    49: () => pushBackgroundColor(stack, options.bg),
    53: () => pushStyle(stack, "text-decoration:overline"),
  };

  let result: string | undefined;
  if (codeMap[code]) {
    result = codeMap[code]();
  } else if (4 < code && code < 7) {
    result = pushTag(stack, "blink");
  } else if (29 < code && code < 38) {
    result = pushForegroundColor(stack, options.colors[code - 30]);
  } else if (39 < code && code < 48) {
    result = pushBackgroundColor(stack, options.colors[code - 40]);
  } else if (89 < code && code < 98) {
    result = pushForegroundColor(stack, options.colors[8 + (code - 90)]);
  } else if (99 < code && code < 108) {
    result = pushBackgroundColor(stack, options.colors[8 + (code - 100)]);
  }

  return result;
}

/**
 * 清除所有样式，关闭所有打开的 HTML 标签。
 * @param stack 标签栈
 * @returns 关闭标签的 HTML 字符串
 */
function resetStyles(stack: Stack): string {
  const stackClone = stack.slice(0); // Create a shallow copy

  stack.length = 0; // Clear the original stack

  return stackClone
    .reverse()
    .map(function (tag) {
      return "</" + tag + ">";
    })
    .join("");
}

/**
 * 创建一个从 low 到 high 的数字数组 (包含 low 和 high)。
 * @param low 起始数字
 * @param high 结束数字
 * @returns 数字数组
 * @example range(3, 7); // creates [3, 4, 5, 6, 7]
 */
function range(low: number, high: number): number[] {
  const results: number[] = [];

  for (let j = low; j <= high; j++) {
    results.push(j);
  }

  return results;
}

/**
 * 返回一个函数，该函数在值与给定类别不同时返回 true。
 * @param category 类别字符串或 null
 * @returns 过滤函数
 */
function notCategory(category: string | null): (e: StickyStackElement) => boolean {
  return function (e: StickyStackElement): boolean {
    return (category === null || e.category !== category) && category !== "all";
  };
}

/**
 * 将 ANSI 代码转换为其对应的类别字符串。
 * @param code ANSI 代码
 * @returns 类别字符串或 null
 */
function categoryForCode(code: number | string): string | null {
  code = parseInt(String(code), 10); // Ensure code is a number
  let result: string | null = null;

  if (code === 0) {
    result = "all";
  } else if (code === 1) {
    result = "bold";
  } else if (2 < code && code < 5) {
    // 3 (italic), 4 (underline)
    result = "underline"; // This groups italic and underline together which might be unexpected based on common usage of "underline" category, but aligns with original logic
  } else if (4 < code && code < 7) {
    // 5 (blink), 6 (rapid blink)
    result = "blink";
  } else if (code === 8) {
    result = "hide";
  } else if (code === 9) {
    result = "strike";
  } else if ((29 < code && code < 38) || code === 39 || (89 < code && code < 98)) {
    result = "foreground-color";
  } else if ((39 < code && code < 48) || code === 49 || (99 < code && code < 108)) {
    result = "background-color";
  }

  return result;
}

/**
 * 处理文本内容。
 * @param text 文本
 * @returns 原始文本 (escapeXML 已移除)
 */
function pushText(text: string): string {
  // Requirement 3: escapeXML 选项已移除，所以直接返回文本。
  return text;
}

/**
 * 将 HTML 标签推入栈并返回打开标签的 HTML 字符串。
 * @param stack 标签栈
 * @param tag 标签名称
 * @param style 样式字符串 (可选)
 * @returns 打开标签的 HTML 字符串
 */
function pushTag(stack: Stack, tag: StackTag, style: string = ""): string {
  stack.push(tag);

  return `<${tag}${style ? ` style="${style}"` : ""}>`;
}

/**
 * 将带有样式的 `<span>` 标签推入栈并返回 HTML 字符串。
 * @param stack 标签栈
 * @param style 样式字符串
 * @returns `<span>` 标签的 HTML 字符串
 */
function pushStyle(stack: Stack, style: string): string {
  return pushTag(stack, "span", style);
}

/**
 * 将带有前景色样式的 `<span>` 标签推入栈并返回 HTML 字符串。
 * @param stack 标签栈
 * @param color 颜色字符串
 * @returns `<span>` 标签的 HTML 字符串
 */
function pushForegroundColor(stack: Stack, color: string): string {
  return pushTag(stack, "span", "color:" + color);
}

/**
 * 将带有背景色样式的 `<span>` 标签推入栈并返回 HTML 字符串。
 * @param stack 标签栈
 * @param color 颜色字符串
 * @returns `<span>` 标签的 HTML 字符串
 */
function pushBackgroundColor(stack: Stack, color: string): string {
  return pushTag(stack, "span", "background-color:" + color);
}

/**
 * 关闭栈中与给定样式匹配的最后一个标签。
 * @param stack 标签栈
 * @param style 标签名称 (例如 'i' 或 'span')
 * @returns 关闭标签的 HTML 字符串或 undefined
 */
function closeTag(stack: Stack, style: StackTag | "span"): string | undefined {
  let last: StackTag | undefined;

  // Find the last matching tag and remove it from stack
  const index = stack.lastIndexOf(style);
  if (index > -1) {
    last = stack[index];
    stack.splice(index, 1); // Remove from its position
  }

  if (last) {
    return "</" + style + ">";
  }
  return undefined;
}

/**
 * 将输入文本标记化，并为每个识别出的 ANSI 序列或文本片段调用回调函数。
 * @param text 输入文本
 * @param options 转换选项
 * @param callback 处理每个令牌的回调函数
 */
function tokenize(text: string, options: InternalConverterOptions, callback: (token: TokenType, data: TokenData) => void): void {
  let ansiMatch = false;
  const ansiHandler = 3; // Index of the main ANSI SGR handler in `tokens` array

  const remove = (): string => "";

  const removeXterm256Foreground = (m: string, g1: string): string => {
    callback("xterm256Foreground", parseInt(g1, 10));
    return "";
  };

  const removeXterm256Background = (m: string, g1: string): string => {
    callback("xterm256Background", parseInt(g1, 10));
    return "";
  };

  const newline = (m: string): string => {
    if (options.newline) {
      callback("display", -1);
    } else {
      callback("text", m);
    }
    return "";
  };

  const ansiMess = (m: string, g1: string): string => {
    ansiMatch = true;
    let codes = g1.trim();
    if (codes.length === 0) {
      codes = "0"; // Default to reset if no codes are specified
    }

    codes.split(";").forEach((g: string) => {
      callback("display", parseInt(g, 10));
    });
    return "";
  };

  const realText = (m: string): string => {
    callback("text", m);
    return "";
  };

  const rgb = (m: string): string => {
    // m example: '\x1b[38;2;255;0;0m'
    const strippedM = m.slice(2, -1); // Remove '\x1b[' and 'm'
    callback("rgb", strippedM);
    return "";
  };

  /* eslint-disable no-control-regex */
  // 定义 ANSI 序列和文本的正则表达式模式及其处理函数
  const tokens = [
    {
      pattern: /^\x08+/, // Backspace
      sub: remove,
    },
    {
      pattern: /^\x1b\[[012]?K/, // Erase in Line
      sub: remove,
    },
    {
      pattern: /^\x1b\[\(B/, // Designate G0 character set
      sub: remove,
    },
    {
      pattern: /^\x1b\[(38|48);2;(\d+);(\d+);(\d+)m/, // RGB true color (foreground/background)
      sub: rgb,
    },
    {
      pattern: /^\x1b\[38;5;(\d+)m/, // 256 foreground color
      sub: removeXterm256Foreground,
    },
    {
      pattern: /^\x1b\[48;5;(\d+)m/, // 256 background color
      sub: removeXterm256Background,
    },
    {
      pattern: /^\n/, // Newline
      sub: newline,
    },
    {
      pattern: /^\r+\n/, // Carriage Return + Newline
      sub: newline,
    },
    {
      pattern: /^\r/, // Carriage Return
      sub: newline,
    },
    {
      pattern: /^\x1b\[((?:\d{1,3};?)+|)m/, // ANSI Select Graphic Rendition (SGR)
      sub: ansiMess,
    },
    {
      // CSI n J
      // ED - Erase in Display Clears part of the screen.
      pattern: /^\x1b\[\d?J/,
      sub: remove,
    },
    {
      // CSI n ; m f
      // HVP - Horizontal Vertical Position Same as CUP
      pattern: /^\x1b\[\d{0,3};\d{0,3}f/,
      sub: remove,
    },
    {
      // catch-all for CSI sequences?
      pattern: /^\x1b\[?[\d;]{0,3}/, // General CSI sequences, might need refinement for other specific CSI codes
      sub: remove,
    },
    {
      /**
       * Extracts real text - not containing:
       * - `\x1b` - ESC - escape (Ascii 27)
       * - `\x08` - BS - backspace (Ascii 8)
       * - `\n` - Newline - linefeed (LF) (ascii 10)
       * - `\r` - Windows Carriage Return (CR)
       */
      pattern: /^(([^\x1b\x08\r\n])+)/,
      sub: realText,
    },
  ];
  /* eslint-enable no-control-regex */

  function process(handler: {pattern: RegExp; sub: (...args: string[]) => string}, i: number): void {
    if (i > ansiHandler && ansiMatch) {
      return;
    }

    ansiMatch = false;

    text = text.replace(handler.pattern, handler.sub as (...args: string[]) => string);
  }

  let initialLength = text.length;

  outer: while (text.length > 0) {
    for (let i = 0; i < tokens.length; i++) {
      const handler = tokens[i];
      process(handler, i);

      if (text.length !== initialLength) {
        // If text length changed, a token was matched and removed.
        // We need to re-evaluate from the start of the tokens for the new text.
        initialLength = text.length;
        continue outer;
      }
    }

    if (text.length === initialLength) {
      // No token matched, break to avoid infinite loop
      break;
    }
  }
}

/**
 * 如果是流模式，更新粘性栈 (stickyStack) 以保持样式状态。
 * @param stickyStack 粘性栈
 * @param token 令牌类型
 * @param data 令牌数据
 * @returns 更新后的粘性栈
 */
function updateStickyStack(stickyStack: StickyStackElement[], token: TokenType, data: TokenData): StickyStackElement[] {
  if (token !== "text") {
    const category = categoryForCode(data);
    stickyStack = stickyStack.filter(notCategory(category));
    stickyStack.push({token, data, category});
  }

  return stickyStack;
}

/**
 * Convert 类将 ANSI 转义码转换为 HTML。
 */
class Convert {
  private options: InternalConverterOptions;
  private stack: Stack;
  private stickyStack: StickyStackElement[];

  /**
   * 构造函数。
   * @param options 转换选项
   */
  constructor(options?: ConverterOptions) {
    options = options || {};

    const mergedColors: AnsiColorMap = {...defaults.colors};
    if (options.colors) {
      // If options.colors is an array, it likely means a simple override of first 16 colors.
      // If it's an object, it's a specific mapping.
      if (Array.isArray(options.colors)) {
        options.colors.forEach((color, index) => {
          mergedColors[index] = color;
        });
      } else {
        Object.assign(mergedColors, options.colors);
      }
    }

    this.options = {...defaults, ...options, colors: mergedColors};
    this.stack = [];
    this.stickyStack = [];
  }

  /**
   * 将包含 ANSI 转义码的字符串或字符串数组转换为 HTML 字符串。
   * @param input 包含 ANSI 转义码的输入字符串或字符串数组
   * @returns 转换后的 HTML 字符串
   */
  toHtml(input: string | string[]): string {
    const fullInput = typeof input === "string" ? input : input.join("");
    const {stack, options} = this;
    const buf: string[] = [];

    // Apply sticky stack styles if in stream mode
    if (options.stream) {
      // Clear current stack to rebuild from stickyStack
      stack.length = 0;
      this.stickyStack.forEach((element) => {
        const output = generateOutput(stack, element.token, element.data, options);
        if (output) {
          buf.push(output);
        }
      });
    } else {
      // If not stream mode, ensure stack is cleared for fresh conversion
      stack.length = 0;
    }

    tokenize(fullInput, options, (token, data) => {
      const output = generateOutput(stack, token, data, options);

      if (output) {
        buf.push(output);
      }

      if (options.stream) {
        this.stickyStack = updateStickyStack(this.stickyStack, token, data);
      }
    });

    if (stack.length) {
      buf.push(resetStyles(stack));
    }

    return buf.join("");
  }
}

export default Convert;
