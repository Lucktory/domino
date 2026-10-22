/** Element at `index`, or throws: an out-of-range index here is a bug, never a valid state. */
export function getAt<T>(items: readonly T[], index: number): T {
  const item = items[index];
  if (item === undefined) throw new Error(`Index ${index} out of range (length ${items.length})`);
  return item;
}

export function replaceAt<T>(items: readonly T[], index: number, value: T): T[] {
  getAt(items, index);
  return items.map((item, i) => (i === index ? value : item));
}
