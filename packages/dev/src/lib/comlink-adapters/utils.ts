export const isObject = (val: unknown): val is object =>
    (typeof val === 'object' && val !== null) || typeof val === 'function';

export const generateUUID = () => crypto.randomUUID()