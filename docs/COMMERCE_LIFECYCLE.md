# Commerce lifecycle

## Scope

Lorki uses one order lifecycle for fixed-price purchases, inquiries, offers,
and auction-style sales. Payment providers are adapters underneath the order;
they do not create separate fulfillment systems.

## Lifecycle

1. A visitor submits an inquiry, purchase request, or offer.
2. The server validates the artwork, price, currency, and availability.
3. A one-of-one artwork is reserved transactionally to prevent double sale.
4. An original can remain pending admin review; a configured instant item can
   move directly to payment.
5. Admin approves or rejects the request. Rejection releases the reservation.
6. An approved request creates a payment session or a manual-payment record.
7. Provider webhooks are verified, idempotent, and reconcile the local order.
8. A paid order can move through shipping and delivery, while the artwork is
   marked sold.

## Offers and auctions

Offers are accepted under a row lock. The server checks the closing time,
minimum increment, current highest offer, and tie-break timestamp inside the
transaction. The latest highest amount is denormalized on the artwork for fast
public reads while the full offer history remains admin-only.

The public view shows the original price, current highest offer, and closing
time. A bidder sees only their own offer status. Admins see all offers. Offer
acceptance records the acting administrator, amount, and affected order in the
audit ledger.

## Payment adapters

The order layer supports online payment and manual settlement. Stripe and
Flutterwave webhook events are recorded separately from orders, then matched by
provider identity, amount, and currency. A webhook retry must not create a
second local order.

## Relevant implementation

- `prisma/schema.prisma`: `Order`, `Offer`, payment and payout relations.
- `app/api/offers/`: offer submission and winner handling.
- `app/api/checkout/`: checkout session creation.
- `app/api/webhooks/stripe/` and `app/api/webhooks/flutterwave/`:
  provider callbacks.
- `app/checkout/`: customer checkout screens.
- `app/admin/(dashboard)/offers/`: admin offer review.
