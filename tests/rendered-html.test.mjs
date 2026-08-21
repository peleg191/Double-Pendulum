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
  assert.match(html, />DP<\/div>/i);
  assert.doesNotMatch(html, /precomputed trajectories · schema v1/i);
  assert.doesNotMatch(html, /Periodic residual/i);
  assert.doesNotMatch(html, /Coordinate convention/);
  assert.doesNotMatch(html, /Source MAT file/);
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

test("mathematical labels use semantic MathML", async () => {
  const source = await readFile(new URL("../app/OrbitViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /<math[^>]*className="math-expression"/);
  assert.match(source, /<msub>/);
  assert.match(source, /<mfrac>/);
  for (const label of ["theta-1", "theta-2", "mass-1", "mass-2", "length-1", "length-2", "gravity"]) {
    assert.match(source, new RegExp(`schematic-${label}[^>]*><MathVariable`));
  }
});

test("source MAT download is attached to the energy control", async () => {
  const source = await readFile(new URL("../app/OrbitViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /className="mat-download"[^>]*download/);
  assert.match(source, /aria-describedby="mat-download-tooltip"/);
  assert.match(source, /role="tooltip"/);
  assert.doesNotMatch(source, /className="method-note"/);
});

test("energy changes preserve the viewer while the next trajectory loads", async () => {
  const source = await readFile(new URL("../app/OrbitViewer.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /setOrbit\(null\)/);
  assert.match(source, /new AbortController\(\)/);
  assert.match(source, /signal: controller\.signal/);
  assert.match(source, /return \(\) => controller\.abort\(\)/);
});

test("GitHub Pages uses self-hosted Geist for both UI font stacks", async () => {
  const css = await readFile(new URL("../pages-src/pages.css", import.meta.url), "utf8");
  assert.match(css, /font-family: "Geist"/);
  assert.match(css, /url\("\.\/fonts\/geist-latin\.woff2"\)/);
  assert.match(css, /--font-geist-mono: "Geist", Arial, sans-serif/);
  assert.doesNotMatch(css, /Geist Mono|GeistMonoPages|geist-mono-latin/);
  assert.ok((await readFile(new URL("../pages-src/fonts/geist-latin.woff2", import.meta.url))).byteLength > 20_000);
  const pagesHtml = await readFile(new URL("../pages-src/index.html", import.meta.url), "utf8");
  assert.doesNotMatch(pagesHtml, /geist-mono-latin/);
});

test("playback canvases toggle animation and default to double speed", async () => {
  const source = await readFile(new URL("../app/OrbitViewer.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(source, /interpolated state/i);
  assert.match(source, /const \[speed, setSpeed\] = useState\(2\)/);
  assert.equal([...source.matchAll(/role="button" tabIndex=\{0\} aria-pressed=\{playing\}/g)].length, 2);
  assert.equal([...source.matchAll(/onClick=\{onTogglePlayback\}/g)].length, 2);
  assert.equal([...source.matchAll(/event\.key === "Enter" \|\| event\.key === " "/g)].length, 2);
});

test("family and energy selectors are top-aligned", async () => {
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(css, /\.selection-controls\s*\{[^}]*align-items:\s*start/);
});

test("physical-model drawer chevron stays vertically centered", async () => {
  const source = await readFile(new URL("../app/OrbitViewer.tsx", import.meta.url), "utf8");
  const css = await readFile(new URL("../app/globals.css", import.meta.url), "utf8");
  assert.match(source, /<span className="drawer-icon" aria-hidden="true" \/>/);
  assert.match(css, /\.drawer-icon\s*\{[^}]*height:\s*14px[^}]*transform-origin:\s*50% 50%/);
  assert.match(css, /\.drawer-icon::before, \.drawer-icon::after\s*\{[^}]*top:\s*50%/);
});

test("GoatCounter records visits and renders the site total in the footer", async () => {
  const source = await readFile(new URL("../app/OrbitViewer.tsx", import.meta.url), "utf8");
  assert.match(source, /https:\/\/doublependulum\.goatcounter\.com\/count/);
  assert.match(source, /https:\/\/doublependulum\.goatcounter\.com\/counter\/TOTAL\.json/);
  assert.match(source, /https:\/\/gc\.zgo\.at\/count\.js/);
  assert.match(source, /<footer className="site-footer">/);
  assert.match(source, /className="visitor-count"[^>]*aria-live="polite"/);
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
