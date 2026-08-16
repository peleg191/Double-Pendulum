import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(new Request("http://localhost/", { headers: { accept: "text/html" } }), {
    ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) },
  }, { waitUntil() {}, passThroughOnException() {} });
}

test("server-renders the scientific viewer", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<title>Saddle Orbit For the Egalitarian Double Pendulum<\/title>/i);
  assert.match(html, /Egalitarian Double Pendulum/);
  assert.doesNotMatch(html, /Periodic residual/i);
  assert.match(html, /Coordinate convention/);
  assert.match(html, /Loading trajectory/);
  assert.match(html, /Orbit family/);
  assert.match(html, /id="energy-slider"/i);
  assert.doesNotMatch(html, /linear energy scale/i);
  assert.match(html, /stored levels/i);
  assert.match(html, /id="energy-select"/i);
  assert.match(html, /Light mode/);
  assert.doesNotMatch(html, /Demonstration dataset/);
  assert.doesNotMatch(html, /codex-preview|react-loading-skeleton/i);
});

test("exported orbit obeys the documented structural contract", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/data/manifest.json", import.meta.url), "utf8"));
  assert.equal(manifest.families.length, 2);
  assert.equal(manifest.orbits.length, 108);
  const data = JSON.parse(await readFile(new URL(`../public/${manifest.orbits[0].trajectory}`, import.meta.url), "utf8"));
  assert.equal(data.schema_version, 1);
  const { t, theta1, theta2 } = data.trajectory;
  assert.equal(t.length, data.metadata.sample_count);
  assert.equal(theta1.length, t.length);
  assert.equal(theta2.length, t.length);
  assert.ok(t.every((value, index) => index === 0 || value > t[index - 1]));
  assert.equal(t.at(0), 0);
  assert.ok(Math.abs(t.at(-1) - data.metadata.period) < 1e-12);
});

test("exported trajectories stay outside the energetically forbidden region", async () => {
  const manifest = JSON.parse(await readFile(new URL("../public/data/manifest.json", import.meta.url), "utf8"));
  for (const record of manifest.orbits) {
    const data = JSON.parse(await readFile(new URL(`../public/${record.trajectory}`, import.meta.url), "utf8"));
    const { theta1, theta2 } = data.trajectory;
    const maximumViolation = theta1.reduce((maximum, value, index) => {
      const potential = 3 - 2 * Math.cos(value) - Math.cos(theta2[index]);
      return Math.max(maximum, potential - data.metadata.energy);
    }, -Infinity);
    assert.ok(maximumViolation < 1e-6, `${record.id} enters V > E by ${maximumViolation}`);
  }
});
