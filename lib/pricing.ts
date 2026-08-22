// Stripe rejects card charges below $0.50 USD outright, and letting a $0 or
// negative price through would put an artwork on the storefront that can
// never actually be bought — a real liability gap, not a hypothetical one.
export const MIN_PRICE_CENTS = 50;

export function isPriceTooLow(priceCents: number): boolean {
  return priceCents < MIN_PRICE_CENTS;
}

// Flat rate charged on top of the print price at checkout — previously
// checkout charged nothing for shipping at all, meaning the business ate
// 100% of the shipping cost on every print sale. Originals never reach this
// constant: they're arranged personally, where a real freight/insurance
// quote is worked out case by case rather than a flat fee.
export const PRINT_SHIPPING_CENTS = 999;
