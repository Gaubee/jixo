import {binary_to_base64_string, str_to_base64_binary} from "@gaubee/util/encoding";
import {SuperJSON} from "superjson";

export const superjson = new SuperJSON();

superjson.registerCustom<ArrayBuffer | SharedArrayBuffer, string>(
  {
    isApplicable: typeof SharedArrayBuffer !== "undefined" ? (v: any) => v instanceof ArrayBuffer || v instanceof SharedArrayBuffer : (v: any) => v instanceof ArrayBuffer,
    serialize: (v) => binary_to_base64_string(new Uint8Array(v)),
    deserialize: (v) => str_to_base64_binary(v).buffer,
  },
  "ArrayBuffer",
);
superjson.registerCustom<DataView, string>(
  {
    isApplicable: (v) => v instanceof DataView,
    serialize: (v) => {
      return binary_to_base64_string(new Uint8Array(v.buffer, v.byteOffset, v.byteLength));
    },
    deserialize: (v) => {
      const buf = str_to_base64_binary(v);
      return new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
    },
  },
  "DataView",
);
// 自定义 Date，使用 number 替代默认的 string，避免异常，同时在数据库中也可以对其进行排序
superjson.registerCustom(
  {
    isApplicable: (v) => v instanceof Date,
    serialize: (v) => {
      const time = +v;
      return Number.isNaN(time) ? null : time;
    },
    deserialize: (v) => new Date(v == null ? NaN : +v),
  },
  "Date",
);
(
  [
    "Int8Array",
    "Uint8Array",
    "Uint8ClampedArray",
    "Int16Array",
    "Uint16Array",
    "Int32Array",
    "Uint32Array",
    "Float32Array",
    "Float64Array",
    "BigInt64Array",
    "BigUint64Array",
  ] as const
).forEach((TypedArrayCtorName) => {
  const TypedArrayCtor = globalThis[TypedArrayCtorName];
  if (typeof TypedArrayCtor !== "function") {
    return;
  }
  type Instance = InstanceType<typeof TypedArrayCtor>;
  superjson.registerCustom<Instance, string>(
    {
      isApplicable: (v): v is Instance => {
        // 这里不使用 instanceof，为了避免类似 Buffer 这种扩展类型的误判
        // 因为这里只处理最原始的 TypedArray
        return (
          /// 先判断 ArrayBuffer.isView，避免 Object.getPrototypeOf 出错
          ArrayBuffer.isView(v) && Object.getPrototypeOf(v) === TypedArrayCtor.prototype
        );
      },
      serialize: (v) => {
        return `${v.byteLength},${binary_to_base64_string(v instanceof Uint8Array ? v : new Uint8Array(v.buffer, v.byteOffset, v.byteLength))}`;
      },
      deserialize: (v) => {
        const splitIndex = v.indexOf(",");
        const len = +v.slice(splitIndex);
        const base64 = v.slice(splitIndex + 1);
        if (TypedArrayCtor === Uint8Array) {
          return str_to_base64_binary(base64) as Instance;
        }
        const res = new TypedArrayCtor(len);
        const u8a = new Uint8Array(res.buffer);
        u8a.set(str_to_base64_binary(base64));
        return res;
      },
    },
    TypedArrayCtorName,
  );
});
