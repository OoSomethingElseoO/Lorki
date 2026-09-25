# Storefront features

The storefront includes a public originals catalogue, artwork detail routes,
artist pages, campaign/impact pages, shared artwork modals, checkout screens,
and responsive gallery presentation.

Artwork cards and modals use the same public artwork data contract, preserve
image dimensions to avoid layout shifts, and expose share actions through the
shared analytics component. Purchase actions lead into the order lifecycle
documented in `COMMERCE_LIFECYCLE.md`.

Admin-controlled hero headline word pools are validated server-side and kept
separate from fixed punctuation and sentence structure. Reduced-motion behavior
is supported for animated headline and gallery components.

The originals catalogue uses paginated API data and a client-side continuation
pattern. It must retain fixed image slots while loading new records so newly
appended artwork does not resize or reshuffle already-visible cards.

Relevant implementation areas:

- `app/originals/` and `components/originals-grid.tsx`.
- `components/shared-artwork-modal.tsx` and `components/artwork-lightbox.tsx`.
- `components/share-button.tsx`.
- `app/checkout/` and `components/buy-button.tsx`.
- `components/hero.tsx` and `components/hero-headline.tsx`.
