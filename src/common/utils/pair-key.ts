/** Order-independent key for a pair of users, e.g. for "one open friend chat per pair". */
export const pairKey = (a: string, b: string) => (a < b ? `${a}:${b}` : `${b}:${a}`);
