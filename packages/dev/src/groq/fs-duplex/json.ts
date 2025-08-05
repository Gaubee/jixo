/**
 * An interface abstracting JSON-like serialization and deserialization.
 * This allows for dependency injection of different serializers like
 * standard `JSON`, `superjson`, `devalue`, etc.
 */
export interface JsonLike {
  /**
   * Converts a JavaScript value to a JSON string.
   * @param value A JavaScript value, usually an object or array, to be converted.
   */
  stringify(value: any): string;

  /**
   * Parses a JSON string, constructing the JavaScript value or object described by the string.
   * @param text The string to parse as JSON.
   */
  parse<T = unknown>(text: string): T;
}
