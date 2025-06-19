export type RemedySuggestion = {
  tool_name: string;
  description: string;
};

export class McpToolError extends Error {
  override readonly name: string = "McpToolError";

  constructor(
    /// 为了字段能被JSON.stringify，所以需要重写字段到this对象上
    override readonly message: string,
    readonly remedy_tool_suggestions?: RemedySuggestion[],
  ) {
    super(message);
  }
}
