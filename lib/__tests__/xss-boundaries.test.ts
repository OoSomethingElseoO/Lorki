import test from "node:test";
import assert from "node:assert/strict";
import { validateImageUrl, validateUrl } from "@/lib/validation";

test("URL validation rejects script and data schemes", () => {
  assert.match(validateUrl("javascript:alert(1)") ?? "", /HTTP\(S\)/i);
  assert.match(validateUrl("data:text/html,<script>alert(1)</script>") ?? "", /HTTP\(S\)/i);
});

test("image URL validation does not allow a dangerous scheme to masquerade as an image", () => {
  assert.match(validateImageUrl("javascript:alert(1).jpg") ?? "", /HTTP\(S\)/i);
  assert.equal(validateImageUrl("https://cdn.example.test/artwork.webp?width=1200"), null);
});
