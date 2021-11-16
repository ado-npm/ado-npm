/**
 * Make a flattened (one level) array out of any value(s) or arrays of values.
 */
export function array<T>(...values: (T | T[])[]): T[] {
  return ([] as T[]).concat(...values);
}

/**
 * Remove duplicate (and null-ish) entries from an array, without losing the
 * current element order.
 */
export function unique<T>(values: (null | undefined | T)[]): Exclude<T, null | undefined>[] {
  return values.filter((current, i, arr) => {
    return current != null && arr.findIndex((other, j) => j < i && other != null && other === current);
  }) as Exclude<T, null | undefined>[];
}
