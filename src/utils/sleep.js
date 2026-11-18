export const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export async function runPool(items, limit, worker) {
  let next = 0;
  const run = async () => {
    while (next < items.length) {
      const item = items[next++];
      try {
        await worker(item);
      } catch {
        // the worker records its own failures
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
}
