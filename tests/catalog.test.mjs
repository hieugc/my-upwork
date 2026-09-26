import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const products = JSON.parse(await readFile(new URL("../data/products.json", import.meta.url), "utf8"));

test("portfolio contains exactly eight products", () => {
  assert.equal(products.length, 8);
});

test("product slugs are unique and required fields exist", () => {
  const slugs = new Set(products.map((product) => product.slug));
  assert.equal(slugs.size, products.length);
  for (const product of products) {
    assert.ok(product.name);
    assert.ok(product.category);
    assert.ok(product.tagline);
    assert.match(product.accent, /^#[0-9a-f]{6}$/i);
  }
});


test("every product has a distinct visual tone and three portfolio signals", () => {
  const tones = new Set(products.map((product) => product.tone));
  assert.equal(tones.size, products.length);
  for (const product of products) {
    assert.equal(product.services.length, 3);
    assert.equal(product.proof.length, 3);
    assert.ok(product.summary.length >= 40);
  }
});

test("catalog contains no duplicate product names", () => {
  const names = new Set(products.map((product) => product.name.toLowerCase()));
  assert.equal(names.size, products.length);
});
