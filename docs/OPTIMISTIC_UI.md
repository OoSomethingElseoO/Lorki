# Optimistic UI

Optimistic UI is used only where the visible change is reversible and the
server remains authoritative. The shared implementation is
`lib/use-owned-mutation.ts` backed by `lib/owned-mutation-core.ts`.

## State machine

```text
idle → optimistic/pending → confirmed
                         └→ rollback/error
```

`useOwnedMutation.run`:

1. Aborts the previous in-flight request.
2. Increments a generation token.
3. Applies the optional optimistic callback.
4. Sends the request with an `AbortSignal`.
5. Applies success only if the generation is still current.
6. Runs rollback for a current failure.
7. Discards stale responses, even if the server ignored the browser abort.

The generation check is the correctness boundary. AbortController is only a
resource optimisation; cancellation cannot undo a server-side mutation.

## Current usage

The pattern is used for reversible admin status changes, including inquiry and
security-case actions, and has been extended to other non-financial admin
status mutations where rollback is well-defined. The UI disables duplicate
submission while pending and surfaces the error through the admin toast/error
state.

## Deliberately pessimistic flows

Do not optimistically claim success for:

- artwork reservation or availability;
- checkout/payment creation;
- refunds, payouts, or marking money paid;
- shipping/delivery state that triggers fulfillment;
- auction acceptance or offer amounts.

These flows must wait for the server response because a rollback can leave the
user believing that inventory or money changed when it did not. The UI can show
a pending indicator, but authoritative state changes only after confirmation.

## Implementing a new mutation

```tsx
const mutation = useOwnedMutation();
const previous = current;
const result = await mutation.run(
  (signal) => fetch(url, { method: "PATCH", signal }).then(parseResponse),
  { optimistic: () => setCurrent(next), rollback: () => setCurrent(previous) },
);
```

The rollback must restore the exact previous state, not recompute from a stale
closure. Refresh or revalidate after confirmation when server-derived fields
may have changed.

## Verification

```bash
npx tsx --test lib/__tests__/owned-mutation.test.ts
```

Test at least: success, current failure with rollback, superseded request,
explicit cancellation, and unmount cleanup. In a browser, click an action,
confirm pending state appears immediately, force a `4xx/5xx`, confirm rollback,
then issue two rapid changes and confirm the older response cannot overwrite the
newer state.

## Accessibility and failure UX

Pending controls need an accessible disabled/busy state. Errors must remain
visible after focus moves and must not rely only on color. Optimistic changes
should be announced or clearly represented where the action is not visually
obvious.
