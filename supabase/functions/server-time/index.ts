// Returns the server's current time so the client can reconcile its local-monotonic life
// timer against real time when it reconnects (src/core/economy.ts's `regenerateLives` takes
// `now` as a parameter precisely so either source can drive it).
Deno.serve(() => {
  return new Response(JSON.stringify({ nowMs: Date.now() }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
