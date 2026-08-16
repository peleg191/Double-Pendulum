"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

declare const __PAGES_BUILD__: boolean;

type OrbitRecord = { id: string; energy: number; period: number; family_id: string; trajectory: string; mat?: string; video?: string };
type FamilyRecord = { id: string; label: string; saddle_energy: number; orbit_count: number };
type Manifest = { schema_version: number; generated_at?: string; families: FamilyRecord[]; orbits: OrbitRecord[] };
type OrbitData = {
  schema_version: number;
  metadata: { energy: number; period: number; family_id: string; sample_count: number; data_status?: string };
  parameters: { m1?: number; m2?: number; l1?: number; l2?: number; g?: number };
  trajectory: { t: number[]; theta1: number[]; theta2: number[]; p1?: number[]; p2?: number[] };
};
type ThemeMode = "light" | "dark";
type CanvasPalette = {
  background: string; foreground: string; muted: string; guide: string;
  pendulum1: string; pendulum1Glow: string; pendulum1Trail: string;
  pendulum2: string; pendulum2Glow: string; pendulum2Trail: string;
  phasePath: string; grid: string; forbidden: string; forbiddenBoundary: string;
};

const TAU = Math.PI * 2;
const includeMatDownloads = typeof __PAGES_BUILD__ === "undefined" || !__PAGES_BUILD__;
const assetUrl = (path: string) => new URL(path.replace(/^\/+/, ""), document.baseURI).toString();
const wrapAngle = (angle: number) => ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
const wrapAnglePositive = (angle: number) => ((angle % TAU) + TAU) % TAU;

const canvasPalette = (theme: ThemeMode): CanvasPalette => theme === "dark" ? {
  background: "#08090d", foreground: "#ebeFFF", muted: "#9ea8c7", guide: "#2e3047",
  pendulum1: "#9e59ff", pendulum1Glow: "#381473", pendulum1Trail: "#7338d9",
  pendulum2: "#ffc72e", pendulum2Glow: "#734708", pendulum2Trail: "#f29414",
  phasePath: "#404561", grid: "#33384f", forbidden: "rgba(204, 26, 31, .28)", forbiddenBoundary: "#ff8c59",
} : {
  background: "#fbfaf7", foreground: "#202033", muted: "#6f7080", guide: "#ddd9e3",
  pendulum1: "#7540d1", pendulum1Glow: "#ddd0f6", pendulum1Trail: "#9a74df",
  pendulum2: "#c98100", pendulum2Glow: "#f5ddb0", pendulum2Trail: "#d99b2d",
  phasePath: "#a9a8b4", grid: "#dedbe5", forbidden: "rgba(204, 26, 31, .16)", forbiddenBoundary: "#b83f2f",
};

function sampleOrbit(orbit: OrbitData, phase: number) {
  const { t, theta1, theta2 } = orbit.trajectory;
  const target = phase * orbit.metadata.period;
  let low = 0;
  let high = t.length - 1;
  while (high - low > 1) {
    const mid = (low + high) >> 1;
    if (t[mid] <= target) low = mid;
    else high = mid;
  }
  const span = t[high] - t[low];
  const mix = span > 0 ? (target - t[low]) / span : 0;
  return {
    theta1: theta1[low] + (theta1[high] - theta1[low]) * mix,
    theta2: theta2[low] + (theta2[high] - theta2[low]) * mix,
  };
}

function useCanvas(draw: (ctx: CanvasRenderingContext2D, width: number, height: number) => void, dependencies: unknown[]) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const render = () => {
      const bounds = canvas.getBoundingClientRect();
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.max(1, Math.round(bounds.width * ratio));
      canvas.height = Math.max(1, Math.round(bounds.height * ratio));
      const context = canvas.getContext("2d");
      if (!context) return;
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      draw(context, bounds.width, bounds.height);
    };
    render();
    const observer = new ResizeObserver(render);
    observer.observe(canvas);
    return () => observer.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, dependencies);
  return ref;
}

function PendulumCanvas({ orbit, phase, theme }: { orbit: OrbitData; phase: number; theme: ThemeMode }) {
  const state = sampleOrbit(orbit, phase);
  const ref = useCanvas((ctx, width, height) => {
    const colors = canvasPalette(theme);
    ctx.fillStyle = colors.background; ctx.fillRect(0, 0, width, height);
    const l1 = orbit.parameters.l1 ?? 1;
    const l2 = orbit.parameters.l2 ?? 1;
    const outerPadding = 24;
    const availableDiameter = Math.max(1, Math.min(width, height) - outerPadding * 2);
    const scale = availableDiameter / (2 * (l1 + l2));
    const origin = { x: width / 2, y: height / 2 };
    const p1 = { x: origin.x + scale * l1 * Math.sin(state.theta1), y: origin.y + scale * l1 * Math.cos(state.theta1) };
    const p2 = { x: p1.x + scale * l2 * Math.sin(state.theta2), y: p1.y + scale * l2 * Math.cos(state.theta2) };

    ctx.strokeStyle = colors.guide; ctx.lineWidth = .8; ctx.setLineDash([5, 6]);
    [l1, l1 + l2].forEach((length) => { ctx.beginPath(); ctx.arc(origin.x, origin.y, scale * length, 0, TAU); ctx.stroke(); });
    ctx.setLineDash([]); ctx.lineWidth = .6;
    ctx.beginPath(); ctx.moveTo(origin.x - scale * (l1 + l2), origin.y); ctx.lineTo(origin.x + scale * (l1 + l2), origin.y); ctx.moveTo(origin.x, origin.y - scale * (l1 + l2)); ctx.lineTo(origin.x, origin.y + scale * (l1 + l2)); ctx.stroke();

    const trail1: Array<{ x: number; y: number }> = [];
    const trail2: Array<{ x: number; y: number }> = [];
    for (let index = 0; index < 90; index++) {
      const trailPhase = (phase - .13 + .13 * index / 89 + 1) % 1;
      const trailState = sampleOrbit(orbit, trailPhase);
      const first = { x: origin.x + scale * l1 * Math.sin(trailState.theta1), y: origin.y + scale * l1 * Math.cos(trailState.theta1) };
      trail1.push(first);
      trail2.push({ x: first.x + scale * l2 * Math.sin(trailState.theta2), y: first.y + scale * l2 * Math.cos(trailState.theta2) });
    }
    const drawTrail = (points: Array<{ x: number; y: number }>, color: string) => { ctx.strokeStyle = color; ctx.lineWidth = 1.8; ctx.beginPath(); points.forEach((point, index) => index ? ctx.lineTo(point.x, point.y) : ctx.moveTo(point.x, point.y)); ctx.stroke(); };
    drawTrail(trail1, colors.pendulum1Trail); drawTrail(trail2, colors.pendulum2Trail);

    ctx.lineCap = "round";
    ctx.strokeStyle = colors.pendulum1Glow; ctx.lineWidth = 12; ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    ctx.strokeStyle = colors.pendulum2Glow; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.strokeStyle = colors.pendulum1; ctx.lineWidth = 4.2; ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    ctx.strokeStyle = colors.pendulum2; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.fillStyle = colors.pendulum1Glow; ctx.beginPath(); ctx.arc(p1.x, p1.y, 17, 0, TAU); ctx.fill();
    ctx.fillStyle = colors.pendulum2Glow; ctx.beginPath(); ctx.arc(p2.x, p2.y, 19, 0, TAU); ctx.fill();
    ctx.fillStyle = colors.pendulum1; ctx.strokeStyle = colors.foreground; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(p1.x, p1.y, 10, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.pendulum2; ctx.beginPath(); ctx.arc(p2.x, p2.y, 12, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.guide; ctx.beginPath(); ctx.arc(origin.x, origin.y, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = colors.foreground; ctx.beginPath(); ctx.arc(origin.x, origin.y, 4, 0, TAU); ctx.fill();
  }, [orbit, phase, state.theta1, state.theta2, theme]);
  return <canvas ref={ref} aria-label="Animated physical double pendulum" role="img" />;
}

function SystemSchematic({ theme }: { theme: ThemeMode }) {
  const ref = useCanvas((ctx, width, height) => {
    const colors = canvasPalette(theme);
    ctx.fillStyle = colors.background;
    ctx.fillRect(0, 0, width, height);

    const scale = Math.min(width, height);
    const origin = { x: width * .38, y: height * .16 };
    const rodLength = scale * .29;
    const theta1 = .48;
    const theta2 = .66;
    const p1 = { x: origin.x + rodLength * Math.sin(theta1), y: origin.y + rodLength * Math.cos(theta1) };
    const p2 = { x: p1.x + rodLength * Math.sin(theta2), y: p1.y + rodLength * Math.cos(theta2) };

    ctx.strokeStyle = colors.guide;
    ctx.lineWidth = 1;
    ctx.setLineDash([5, 6]);
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(origin.x, origin.y + rodLength * .82); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p1.x, p1.y + rodLength * .76); ctx.stroke();
    ctx.setLineDash([]);

    const drawRightAngle = (center: { x: number; y: number }, angleMagnitude: number, radius: number, label: string) => {
      ctx.strokeStyle = colors.muted; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(center.x, center.y, radius, Math.PI / 2 - angleMagnitude, Math.PI / 2); ctx.stroke();
      ctx.fillStyle = colors.muted; ctx.font = `italic ${Math.max(12, scale * .035)}px serif`; ctx.textAlign = "center";
      ctx.fillText(label, center.x + Math.sin(angleMagnitude / 2) * radius * 1.45, center.y + Math.cos(angleMagnitude / 2) * radius * 1.45);
    };
    drawRightAngle(origin, theta1, scale * .09, "θ₁");
    drawRightAngle(p1, theta2, scale * .08, "θ₂");

    ctx.lineCap = "round";
    ctx.strokeStyle = colors.pendulum1Glow; ctx.lineWidth = 11; ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    ctx.strokeStyle = colors.pendulum2Glow; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.strokeStyle = colors.pendulum1; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    ctx.strokeStyle = colors.pendulum2; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();

    const drawMass = (point: { x: number; y: number }, radius: number, fill: string, label: string) => {
      ctx.fillStyle = fill; ctx.strokeStyle = colors.foreground; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(point.x, point.y, radius, 0, TAU); ctx.fill(); ctx.stroke();
      ctx.fillStyle = colors.foreground; ctx.font = `600 ${Math.max(11, scale * .031)}px monospace`; ctx.textAlign = "right";
      ctx.fillText(label, point.x - radius - 9, point.y + 4);
    };
    drawMass(p1, scale * .026, colors.pendulum1, "m₁ = 1");
    drawMass(p2, scale * .031, colors.pendulum2, "m₂ = 1");
    ctx.fillStyle = colors.foreground; ctx.beginPath(); ctx.arc(origin.x, origin.y, scale * .012, 0, TAU); ctx.fill();

    ctx.fillStyle = colors.muted; ctx.font = `${Math.max(11, scale * .029)}px monospace`; ctx.textAlign = "center";
    ctx.fillText("L₁ = 1", (origin.x + p1.x) / 2 + 46, (origin.y + p1.y) / 2);
    ctx.fillText("L₂ = 1", (p1.x + p2.x) / 2 + 48, (p1.y + p2.y) / 2);

    const gx = width * .87, gy = height * .25, arrowLength = scale * .18;
    ctx.strokeStyle = colors.pendulum2; ctx.fillStyle = colors.pendulum2; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(gx, gy); ctx.lineTo(gx, gy + arrowLength); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(gx, gy + arrowLength); ctx.lineTo(gx - 6, gy + arrowLength - 10); ctx.lineTo(gx + 6, gy + arrowLength - 10); ctx.closePath(); ctx.fill();
    ctx.font = `600 ${Math.max(11, scale * .03)}px monospace`; ctx.textAlign = "right";
    ctx.fillText("g = 1", gx - 12, gy + arrowLength * .58);
  }, [theme]);
  return <canvas ref={ref} aria-label="Double pendulum system schematic with unit lengths, masses, and gravity" role="img" />;
}

function ConfigurationCanvas({ orbit, phase, theme }: { orbit: OrbitData; phase: number; theme: ThemeMode }) {
  const state = sampleOrbit(orbit, phase);
  const ref = useCanvas((ctx, width, height) => {
    const colors = canvasPalette(theme);
    ctx.fillStyle = colors.background; ctx.fillRect(0, 0, width, height);
    const isE2Family = orbit.metadata.family_id === "saddle_E2";
    const wrapX = isE2Family ? wrapAngle : wrapAnglePositive;
    const wrapY = isE2Family ? wrapAnglePositive : wrapAngle;
    const normalizeX = (value: number) => isE2Family ? (wrapX(value) + Math.PI) / TAU : wrapX(value) / TAU;
    const normalizeY = (value: number) => isE2Family ? wrapY(value) / TAU : (wrapY(value) + Math.PI) / TAU;
    const xTicks = isE2Family ? ["−π", "−π/2", "0", "π/2", "+π"] : ["0", "π/2", "π", "3π/2", "2π"];
    const yTicks = isE2Family ? ["2π", "3π/2", "π", "π/2", "0"] : ["+π", "π/2", "0", "−π/2", "−π"];
    const margin = { left: 62, right: 24, top: 22, bottom: 42 };
    const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
    const x = (value: number) => margin.left + normalizeX(value) * plotW;
    const y = (value: number) => margin.top + (1 - normalizeY(value)) * plotH;

    ctx.fillStyle = colors.background; ctx.fillRect(margin.left, margin.top, plotW, plotH);
    const cell = 4;
    const xLower = isE2Family ? -Math.PI : 0;
    const yLower = isE2Family ? 0 : -Math.PI;
    ctx.fillStyle = colors.forbidden;
    for (let px = 0; px < plotW; px += cell) for (let py = 0; py < plotH; py += cell) {
      const theta1 = xLower + ((px + cell / 2) / plotW) * TAU;
      const theta2 = yLower + (1 - (py + cell / 2) / plotH) * TAU;
      const potential = 3 - 2 * Math.cos(theta1) - Math.cos(theta2);
      if (potential > orbit.metadata.energy) ctx.fillRect(margin.left + px, margin.top + py, cell + .5, cell + .5);
    }

    ctx.strokeStyle = colors.grid; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const gx = margin.left + plotW * i / 4; const gy = margin.top + plotH * i / 4; ctx.beginPath(); ctx.moveTo(gx, margin.top); ctx.lineTo(gx, margin.top + plotH); ctx.stroke(); ctx.beginPath(); ctx.moveTo(margin.left, gy); ctx.lineTo(margin.left + plotW, gy); ctx.stroke(); }
    ctx.strokeStyle = colors.foreground; ctx.lineWidth = 1.1; ctx.strokeRect(margin.left, margin.top, plotW, plotH);

    const drawPath = (theta1Values: number[], theta2Values: number[], color: string, lineWidth: number) => {
      ctx.strokeStyle = color; ctx.lineWidth = lineWidth; ctx.beginPath();
      let previous: { x: number; y: number } | null = null;
      theta1Values.forEach((value, index) => { const point = { x: x(value), y: y(theta2Values[index]) }; if (!previous || Math.abs(point.x - previous.x) > plotW * .5 || Math.abs(point.y - previous.y) > plotH * .5) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y); previous = point; });
      ctx.stroke();
    };
    drawPath(orbit.trajectory.theta1, orbit.trajectory.theta2, colors.phasePath, 1.5);

    const trailTheta1: number[] = [], trailTheta2: number[] = [];
    for (let index = 0; index < 120; index++) { const trailState = sampleOrbit(orbit, (phase - .12 + .12 * index / 119 + 1) % 1); trailTheta1.push(trailState.theta1); trailTheta2.push(trailState.theta2); }
    drawPath(trailTheta1, trailTheta2, colors.pendulum1, 2.3);

    if (orbit.metadata.energy < 6) {
      const drawBoundary = (upperBranch: boolean) => { ctx.strokeStyle = colors.forbiddenBoundary; ctx.lineWidth = 1.4; ctx.beginPath(); let previousY: number | null = null; for (let px = 0; px <= Math.round(plotW); px++) { const theta1 = xLower + px / plotW * TAU; const cosineTheta2 = 3 - 2 * Math.cos(theta1) - orbit.metadata.energy; if (cosineTheta2 < -1 || cosineTheta2 > 1) { previousY = null; continue; } const principal = Math.acos(cosineTheta2); const theta2 = upperBranch ? principal : TAU - principal; const screenY = y(theta2); if (previousY === null || Math.abs(screenY - previousY) > plotH * .5) ctx.moveTo(margin.left + px, screenY); else ctx.lineTo(margin.left + px, screenY); previousY = screenY; } ctx.stroke(); };
      drawBoundary(true); drawBoundary(false);
    }

    const marker = { x: x(state.theta1), y: y(state.theta2) };
    ctx.fillStyle = colors.pendulum2Glow; ctx.beginPath(); ctx.arc(marker.x, marker.y, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = colors.pendulum2; ctx.strokeStyle = colors.foreground; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(marker.x, marker.y, 6.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = colors.muted; ctx.font = "11px monospace"; ctx.textAlign = "center";
    xTicks.forEach((label, i) => ctx.fillText(label, margin.left + plotW * i / 4, height - 17));
    ctx.textAlign = "right";
    yTicks.forEach((label, i) => ctx.fillText(label, margin.left - 9, margin.top + plotH * i / 4 + 4));
    ctx.save(); ctx.translate(15, margin.top + plotH / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = "center"; ctx.fillText("θ₂ (mod 2π)", 0, 0); ctx.restore();
    ctx.textAlign = "center";
    ctx.fillText("θ₁ (mod 2π)", margin.left + plotW / 2, height - 2);
    if (orbit.metadata.energy < 6) { const label = `Forbidden: V > E = ${orbit.metadata.energy.toFixed(3)}`; ctx.font = "bold 10px monospace"; ctx.textAlign = "left"; const labelWidth = ctx.measureText(label).width + 16; ctx.fillStyle = colors.background; ctx.fillRect(margin.left + 8, margin.top + plotH - 27, labelWidth, 20); ctx.strokeStyle = colors.grid; ctx.strokeRect(margin.left + 8, margin.top + plotH - 27, labelWidth, 20); ctx.fillStyle = colors.forbiddenBoundary; ctx.fillText(label, margin.left + 16, margin.top + plotH - 13); }
  }, [orbit, phase, state.theta1, state.theta2, theme]);
  return <canvas ref={ref} aria-label="Configuration-space orbit with current-state marker" role="img" />;
}

export function OrbitViewer() {
  const [manifest, setManifest] = useState<Manifest | null>(null);
  const [orbit, setOrbit] = useState<OrbitData | null>(null);
  const [selectedFamilyId, setSelectedFamilyId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [phase, setPhase] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [isSystemDrawerOpen, setIsSystemDrawerOpen] = useState(true);
  const [error, setError] = useState("");
  const lastFrame = useRef<number | null>(null);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("orbit-viewer-theme");
    if (savedTheme === "light" || savedTheme === "dark") setTheme(savedTheme);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("orbit-viewer-theme", theme);
  }, [theme]);

  useEffect(() => {
    fetch(assetUrl("data/manifest.json")).then((response) => {
      if (!response.ok) throw new Error("Manifest unavailable");
      return response.json();
    }).then((data: Manifest) => {
      if (data.schema_version !== 1 || !data.orbits.length) throw new Error("Unsupported or empty manifest");
      setManifest(data);
      const requested = new URLSearchParams(window.location.search).get("orbit");
      const initialOrbit = data.orbits.find((item) => item.id === requested) ?? data.orbits[0];
      setSelectedFamilyId(initialOrbit.family_id);
      setSelectedId(initialOrbit.id);
    }).catch(() => setError("Orbit data could not be loaded."));
  }, []);

  useEffect(() => {
    if (!manifest || !selectedId) return;
    const record = manifest.orbits.find((item) => item.id === selectedId);
    if (!record) return;
    setOrbit(null); setError(""); setPlaying(false); setPhase(0);
    fetch(assetUrl(record.trajectory)).then((response) => {
      if (!response.ok) throw new Error("Orbit unavailable");
      return response.json();
    }).then((data: OrbitData) => {
      const lengths = [data.trajectory.t.length, data.trajectory.theta1.length, data.trajectory.theta2.length];
      if (data.schema_version !== 1 || Math.min(...lengths) < 2 || new Set(lengths).size !== 1) throw new Error("Malformed orbit");
      setOrbit(data);
      const url = new URL(window.location.href); url.searchParams.set("orbit", selectedId); window.history.replaceState({}, "", url);
    }).catch(() => setError("The selected trajectory is missing or malformed."));
  }, [manifest, selectedId]);

  const tick = useCallback((time: number) => {
    if (lastFrame.current !== null && orbit) setPhase((value) => (value + ((time - lastFrame.current!) / 1000) * speed / orbit.metadata.period) % 1);
    lastFrame.current = time;
  }, [orbit, speed]);

  useEffect(() => {
    if (!playing) { lastFrame.current = null; return; }
    let frame = 0;
    const loop = (time: number) => { tick(time); frame = requestAnimationFrame(loop); };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [playing, tick]);

  const record = useMemo(() => manifest?.orbits.find((item) => item.id === selectedId), [manifest, selectedId]);
  const familyOrbits = useMemo(() => manifest?.orbits.filter((item) => item.family_id === selectedFamilyId) ?? [], [manifest, selectedFamilyId]);
  const selectedOrbitIndex = Math.max(0, familyOrbits.findIndex((item) => item.id === selectedId));
  const selectedOrbitRecord = familyOrbits[selectedOrbitIndex];
  const chooseFamily = (familyId: string) => {
    setSelectedFamilyId(familyId);
    const firstOrbit = manifest?.orbits.find((item) => item.family_id === familyId);
    if (firstOrbit) setSelectedId(firstOrbit.id);
  };
  return (
    <main className="site-shell">
      <header className="masthead"><div className="masthead-inner"><div className="identity"><div className="monogram">LO</div><div className="identity-copy">Double Pendulum <span>Supplementary Material</span></div></div><div className="masthead-actions"><div className="masthead-note">precomputed trajectories · schema v1</div><button className="theme-toggle" type="button" aria-pressed={theme === "dark"} onClick={() => setTheme((value) => value === "dark" ? "light" : "dark")}><span aria-hidden="true">{theme === "dark" ? "☼" : "◐"}</span>{theme === "dark" ? "Light mode" : "Dark mode"}</button></div></div></header>
      <div className="content">
        <section className="hero"><div><p className="eyebrow">Interactive scientific viewer</p><h1>Saddle Orbit For the Egalitarian Double Pendulum</h1></div><div className="hero-note"><strong>Explore periodic motion near a saddle.</strong><br />Every curve shown here is loaded from a stored trajectory. The browser synchronizes and renders the data; it does not solve the dynamics.</div></section>
        <aside className={`system-drawer${isSystemDrawerOpen ? " is-open" : ""}`} aria-labelledby="system-heading">
          <div className="system-drawer-bar"><div><p className="eyebrow">Mechanical model</p><h2 id="system-heading">Egalitarian double pendulum</h2></div><button className="drawer-toggle" type="button" aria-expanded={isSystemDrawerOpen} aria-controls="system-drawer-content" onClick={() => setIsSystemDrawerOpen((value) => !value)}><span className="drawer-icon" aria-hidden="true">⌃</span>{isSystemDrawerOpen ? "Minimize" : "Expand"}</button></div>
          <div className="system-drawer-reveal" aria-hidden={!isSystemDrawerOpen}><div className="system-drawer-content" id="system-drawer-content"><div className="system-diagram"><SystemSchematic theme={theme} /></div><div className="system-copy"><p>Both links and both point masses are identical. Angles are measured from the downward vertical, and the dimensionless gravitational acceleration is fixed at unity.</p><dl className="parameter-grid"><div><dt>L<sub>1</sub></dt><dd>1</dd></div><div><dt>L<sub>2</sub></dt><dd>1</dd></div><div><dt>m<sub>1</sub></dt><dd>1</dd></div><div><dt>m<sub>2</sub></dt><dd>1</dd></div><div><dt>g</dt><dd>1</dd></div></dl></div></div></div>
        </aside>
        <section className="viewer" aria-label="Lyapunov orbit viewer">
          <div className="viewer-toolbar"><div className="selection-controls"><fieldset className="family-fieldset"><legend>Orbit family</legend><div className="family-tabs">{manifest?.families.map((family) => <label className={`family-option${selectedFamilyId === family.id ? " is-selected" : ""}`} key={family.id}><input type="radio" name="orbit-family" value={family.id} checked={selectedFamilyId === family.id} onChange={() => chooseFamily(family.id)} /><span className="family-name">{family.label}</span><span className="family-count">{family.orbit_count} orbits</span></label>)}</div></fieldset><div className="energy-control"><div className="energy-heading"><label htmlFor="energy-slider">Computed energy</label><output htmlFor="energy-slider">{selectedOrbitRecord ? <>E = {selectedOrbitRecord.energy.toFixed(3)}</> : "—"}</output></div><input id="energy-slider" className="energy-slider" type="range" min="0" max={Math.max(0, familyOrbits.length - 1)} step="1" value={selectedOrbitIndex} disabled={!familyOrbits.length} aria-valuetext={selectedOrbitRecord ? `Energy ${selectedOrbitRecord.energy.toFixed(3)}` : "No orbit selected"} onChange={(event) => { const selected = familyOrbits[Number(event.target.value)]; if (selected) setSelectedId(selected.id); }} /><div className="energy-scale"><span>{familyOrbits.length ? `E = ${familyOrbits[0].energy.toFixed(3)}` : "—"}</span><span>{familyOrbits.length} precomputed levels</span><span>{familyOrbits.length ? `E = ${familyOrbits.at(-1)!.energy.toFixed(3)}` : "—"}</span></div></div></div></div>
          {error ? <div className="error" role="alert">{error}</div> : !orbit ? <div className="loading" role="status">Loading trajectory…</div> : <>
            <div className="visual-grid"><article className="panel"><div className="panel-heading"><h2>Physical pendulum</h2><span>interpolated state</span></div><div className="canvas-wrap"><PendulumCanvas orbit={orbit} phase={phase} theme={theme} /></div></article><article className="panel"><div className="panel-heading"><h2>Configuration space</h2><span>V(θ<sub>1</sub>, θ<sub>2</sub>) ≤ E</span></div><div className="canvas-wrap"><ConfigurationCanvas orbit={orbit} phase={phase} theme={theme} /></div></article></div>
            <div className="transport"><button className="primary" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause orbit" : "Play orbit"}>{playing ? "Pause" : "Play"}</button><input className="phase-slider" type="range" min="0" max="1" step="0.0005" value={phase} aria-label="Normalized orbit phase" onChange={(event) => { setPlaying(false); setPhase(Number(event.target.value)); }} /><span className="phase-label">t/T = {phase.toFixed(3)}</span><select className="speed-select" aria-label="Playback speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{[.25, .5, 1, 2].map((value) => <option key={value} value={value}>{value}×</option>)}</select><button type="button" onClick={() => { setPlaying(false); setPhase(0); }}>Restart</button></div>
            <dl className="data-strip"><div className="datum"><dt>Energy</dt><dd>{orbit.metadata.energy.toFixed(3)}</dd></div><div className="datum"><dt>Period</dt><dd>{orbit.metadata.period.toFixed(4)}</dd></div><div className="datum"><dt>Family</dt><dd>{orbit.metadata.family_id}</dd></div><div className="datum"><dt>Samples</dt><dd>{orbit.metadata.sample_count}</dd></div></dl>
          </>}
        </section>
        <section className="method-note"><div><h2>Coordinate convention</h2><p>Angles are measured from the downward vertical. {selectedFamilyId === "saddle_E4" ? <>For this family, θ<sub>1</sub> ∈ [0, 2π] and θ<sub>2</sub> ∈ [−π, π].</> : <>For this family, θ<sub>1</sub> ∈ [−π, π] and θ<sub>2</sub> ∈ [0, 2π].</>} Paths are broken where they cross a plotted torus boundary.</p></div><div><h2>Numerical provenance</h2><p>MATLAB-generated <code>.mat</code> trajectories are the authoritative research data. A preprocessing step validates them and exports the web representation discovered through the manifest.</p>{includeMatDownloads && record?.mat && <p><a href={assetUrl(record.mat)}>Download source MAT</a></p>}</div></section>
      </div>
    </main>
  );
}
