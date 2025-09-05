import {clsx, type ClassValue} from "clsx";
import {twMerge} from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * 深度比较两个对象是否在内容上相等，忽略属性的顺序。
 * @param objA 第一个对象。
 * @param objB 第二个对象。
 * @returns 如果两个对象在规范化后相等，则返回 true。
 */
export function isEqualCanonical(objA: any, objB: any): boolean {
  if (objA === objB) return true;
  if (typeof objA !== "object" || objA === null || typeof objB !== "object" || objB === null) {
    return false;
  }

  const deepSort = (obj: any): any => {
    if (Array.isArray(obj)) {
      return obj.map(deepSort);
    }
    if (typeof obj === "object" && obj !== null) {
      const sortedKeys = Object.keys(obj).sort();
      const newObj: Record<string, any> = {};
      for (const key of sortedKeys) {
        newObj[key] = deepSort(obj[key]);
      }
      return newObj;
    }
    return obj;
  };

  try {
    const sortedA = deepSort(objA);
    const sortedB = deepSort(objB);
    return JSON.stringify(sortedA) === JSON.stringify(sortedB);
  } catch (e) {
    // 如果 stringify 失败（例如循环引用），则认为它们不相等
    return false;
  }
}
