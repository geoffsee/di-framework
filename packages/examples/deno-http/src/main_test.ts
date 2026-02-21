import { assertEquals } from "@std/assert";
import { router } from "./main.ts";

Deno.test("GET / returns nonsense with 5 sentences", async () => {
  const res = await router.fetch(new Request("http://localhost/"));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(typeof body.nonsense, "string");
  const sentences = body.nonsense.split(". ").filter(Boolean);
  assertEquals(sentences.length, 5);
});

Deno.test("GET /:count returns the requested number of sentences", async () => {
  const res = await router.fetch(new Request("http://localhost/3"));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.count, 3);
  const sentences = body.nonsense.split(". ").filter(Boolean);
  assertEquals(sentences.length, 3);
});

Deno.test("GET /:count falls back to 5 for non-numeric input", async () => {
  const res = await router.fetch(new Request("http://localhost/abc"));
  assertEquals(res.status, 200);
  const body = await res.json();
  assertEquals(body.count, 5);
  const sentences = body.nonsense.split(". ").filter(Boolean);
  assertEquals(sentences.length, 5);
});

Deno.test("GET / returns JSON content-type", async () => {
  const res = await router.fetch(new Request("http://localhost/"));
  assertEquals(res.headers.get("content-type"), "application/json; charset=utf-8");
});
