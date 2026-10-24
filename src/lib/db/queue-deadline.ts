/**
 * A deadline on the wait for a free pool connection.
 *
 * postgres-js queues a query in memory, with no timer, when every connection
 * of the pool is busy (see the KNOWN GAP note in ./client). Under a burst that
 * wait has no end: requests hang until Vercel kills the function. This bounds
 * it. A query still queued when the deadline passes is cancelled, which takes
 * it off the queue and rejects it with Postgres's "canceling statement" error,
 * so the caller's existing catch answers instead of the request hanging.
 *
 * Only a query that has NOT been given a connection is ever cancelled. A
 * running one is left to `statement_timeout`: cancelling it from here would
 * send a cancel request through the transaction pooler, where the backend it
 * names may already be running someone else's statement.
 *
 * Drizzle runs every non-transaction query through `client.unsafe()`, and
 * postgres-js queries are lazy (they start on `then`), so the wrapper only
 * observes the query: it returns the very same object, `.values()` and all,
 * and clears its timer once the query settles.
 */

/** The parts of a postgres-js query this relies on. */
export interface QueueableQuery extends PromiseLike<unknown> {
  /** Set by postgres-js when a connection takes the query. */
  state?: unknown;
  cancel(): unknown;
}

export function withQueueDeadline<T extends { unsafe: (...args: never[]) => QueueableQuery }>(client: T, deadlineMs: number): T {
  return new Proxy(client, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (property !== "unsafe" || typeof value !== "function") return value;
      return (...args: never[]) => {
        const query = (value as T["unsafe"]).apply(target, args);
        const timer = setTimeout(() => {
          if (!query.state) void query.cancel();
        }, deadlineMs);
        (timer as { unref?: () => void }).unref?.();
        const originalThen = query.then;
        query.then = function then(onFulfilled, onRejected) {
          return originalThen.call(
            this,
            (result) => {
              clearTimeout(timer);
              return onFulfilled ? onFulfilled(result) : result;
            },
            (error: unknown) => {
              clearTimeout(timer);
              if (onRejected) return onRejected(error);
              throw error;
            },
          ) as never;
        };
        return query;
      };
    },
  });
}
