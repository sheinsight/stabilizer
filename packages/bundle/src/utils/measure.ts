export async function measure<T>(fn: () => Promise<T>) {
  const start = performance.now();
  const result = await fn();
  return { result, duration: (performance.now() - start).toFixed(2) };
}
