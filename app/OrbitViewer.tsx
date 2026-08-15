"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type OrbitRecord = { id: string; energy: number; period: number; family_id: string; trajectory: string; mat?: string; video?: string };
type FamilyRecord = { id: string; label: string; saddle_energy: number; orbit_count: number };
type Manifest = { schema_version: number; generated_at?: string; families: FamilyRecord[]; orbits: OrbitRecord[] };
type OrbitData = {
  schema_version: number;
  metadata: { energy: number; period: number; family_id: string; sample_count: number; data_status?: string };
  parameters: { m1?: number; m2?: number; l1?: number; l2?: number; g?: number };
  trajectory: { t: number[]; theta1: number[]; theta2: number[]; p1?: number[]; p2?: number[] };
  validation?: { periodic_residual: number };
};

const TAU = Math.PI * 2;
const wrapAngle = (angle: number) => ((angle + Math.PI) % TAU + TAU) % TAU - Math.PI;

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

function PendulumCanvas({ orbit, phase }: { orbit: OrbitData; phase: number }) {
  const state = sampleOrbit(orbit, phase);
  const ref = useCanvas((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    const l1 = orbit.parameters.l1 ?? 1;
    const l2 = orbit.parameters.l2 ?? 1;
    const scale = Math.min(width * 0.2, height * 0.32) / Math.max(l1, l2);
    const origin = { x: width / 2, y: height * 0.2 };
    const p1 = { x: origin.x + scale * l1 * Math.sin(state.theta1), y: origin.y + scale * l1 * Math.cos(state.theta1) };
    const p2 = { x: p1.x + scale * l2 * Math.sin(state.theta2), y: p1.y + scale * l2 * Math.cos(state.theta2) };
    ctx.strokeStyle = "#d9d6cf"; ctx.lineWidth = 1;
    ctx.setLineDash([4, 5]); ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(origin.x, height - 24); ctx.stroke(); ctx.setLineDash([]);
    ctx.strokeStyle = "#16233a"; ctx.lineWidth = 5; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(origin.x, origin.y); ctx.lineTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke();
    ctx.fillStyle = "#101b2c"; ctx.beginPath(); ctx.arc(origin.x, origin.y, 6, 0, TAU); ctx.fill();
    ctx.fillStyle = "#3a91a8"; ctx.beginPath(); ctx.arc(p1.x, p1.y, 12, 0, TAU); ctx.fill();
    ctx.fillStyle = "#d35e35"; ctx.beginPath(); ctx.arc(p2.x, p2.y, 15, 0, TAU); ctx.fill();
    ctx.fillStyle = "#657086"; ctx.font = "11px monospace"; ctx.fillText("pivot", origin.x + 12, origin.y - 7);
  }, [orbit, state.theta1, state.theta2]);
  return <canvas ref={ref} aria-label="Animated physical double pendulum" role="img" />;
}

function ConfigurationCanvas({ orbit, phase }: { orbit: OrbitData; phase: number }) {
  const state = sampleOrbit(orbit, phase);
  const ref = useCanvas((ctx, width, height) => {
    ctx.clearRect(0, 0, width, height);
    const margin = { left: 54, right: 24, top: 22, bottom: 42 };
    const plotW = width - margin.left - margin.right, plotH = height - margin.top - margin.bottom;
    const x = (v: number) => margin.left + ((wrapAngle(v) + Math.PI) / TAU) * plotW;
    const y = (v: number) => margin.top + (1 - (wrapAngle(v) + Math.PI) / TAU) * plotH;
    ctx.strokeStyle = "#e3e0d9"; ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) { const gx = margin.left + plotW * i / 4; const gy = margin.top + plotH * i / 4; ctx.beginPath(); ctx.moveTo(gx, margin.top); ctx.lineTo(gx, margin.top + plotH); ctx.stroke(); ctx.beginPath(); ctx.moveTo(margin.left, gy); ctx.lineTo(margin.left + plotW, gy); ctx.stroke(); }
    ctx.strokeStyle = "#16233a"; ctx.lineWidth = 1.5; ctx.strokeRect(margin.left, margin.top, plotW, plotH);
    ctx.strokeStyle = "#3a91a8"; ctx.lineWidth = 2.4; ctx.beginPath();
    let previous: { x: number; y: number } | null = null;
    orbit.trajectory.theta1.forEach((value, index) => {
      const point = { x: x(value), y: y(orbit.trajectory.theta2[index]) };
      if (!previous || Math.abs(point.x - previous.x) > plotW * .5 || Math.abs(point.y - previous.y) > plotH * .5) ctx.moveTo(point.x, point.y); else ctx.lineTo(point.x, point.y);
      previous = point;
    }); ctx.stroke();
    const marker = { x: x(state.theta1), y: y(state.theta2) };
    ctx.fillStyle = "#fffdfa"; ctx.strokeStyle = "#d35e35"; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(marker.x, marker.y, 6.5, 0, TAU); ctx.fill(); ctx.stroke();
    ctx.fillStyle = "#657086"; ctx.font = "11px monospace"; ctx.textAlign = "center";
    ["−π", "0", "+π"].forEach((label, i) => ctx.fillText(label, margin.left + plotW * i / 2, height - 17));
    ctx.save(); ctx.translate(16, margin.top + plotH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText("θ₂ (mod 2π)", 0, 0); ctx.restore();
    ctx.fillText("θ₁ (mod 2π)", margin.left + plotW / 2, height - 2);
  }, [orbit, state.theta1, state.theta2]);
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
  const [error, setError] = useState("");
  const lastFrame = useRef<number | null>(null);

  useEffect(() => {
    fetch("/data/manifest.json").then((response) => {
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
    fetch(`/${record.trajectory}`).then((response) => {
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
  const selectedFamily = useMemo(() => manifest?.families.find((item) => item.id === selectedFamilyId), [manifest, selectedFamilyId]);
  const chooseFamily = (familyId: string) => {
    setSelectedFamilyId(familyId);
    const firstOrbit = manifest?.orbits.find((item) => item.family_id === familyId);
    if (firstOrbit) setSelectedId(firstOrbit.id);
  };
  return (
    <main className="site-shell">
      <header className="masthead"><div className="masthead-inner"><div className="identity"><div className="monogram">LO</div><div className="identity-copy">Double Pendulum <span>Supplementary Material</span></div></div><div className="masthead-note">precomputed trajectories · schema v1</div></div></header>
      <div className="content">
        <section className="hero"><div><p className="eyebrow">Interactive scientific viewer</p><h1>Lyapunov<br />Orbit Atlas</h1></div><div className="hero-note"><strong>Explore periodic motion near a saddle.</strong><br />Every curve shown here is loaded from a stored trajectory. The browser synchronizes and renders the data; it does not solve the dynamics.</div></section>
        <section className="viewer" aria-label="Lyapunov orbit viewer">
          <div className="viewer-toolbar"><div className="selector-wrap"><label className="field-label" htmlFor="family-select">Family</label><select id="family-select" value={selectedFamilyId} onChange={(event) => chooseFamily(event.target.value)} disabled={!manifest}>{manifest?.families.map((family) => <option key={family.id} value={family.id}>{family.label}</option>)}</select><label className="field-label" htmlFor="orbit-select">Energy</label><select id="orbit-select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)} disabled={!manifest}>{familyOrbits.map((item) => <option key={item.id} value={item.id}>E = {item.energy.toFixed(3)}</option>)}</select></div><div className="readout"><strong>{selectedFamily?.orbit_count ?? 0}</strong> computed orbits</div></div>
          {error ? <div className="error" role="alert">{error}</div> : !orbit ? <div className="loading" role="status">Loading trajectory…</div> : <>
            <div className="visual-grid"><article className="panel"><div className="panel-heading"><h2>Physical pendulum</h2><span>interpolated state</span></div><div className="canvas-wrap"><PendulumCanvas orbit={orbit} phase={phase} /></div></article><article className="panel"><div className="panel-heading"><h2>Configuration space</h2><span>complete γ<sub>E</sub></span></div><div className="canvas-wrap"><ConfigurationCanvas orbit={orbit} phase={phase} /></div></article></div>
            <div className="transport"><button className="primary" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? "Pause orbit" : "Play orbit"}>{playing ? "Pause" : "Play"}</button><input className="phase-slider" type="range" min="0" max="1" step="0.0005" value={phase} aria-label="Normalized orbit phase" onChange={(event) => { setPlaying(false); setPhase(Number(event.target.value)); }} /><span className="phase-label">t/T = {phase.toFixed(3)}</span><select className="speed-select" aria-label="Playback speed" value={speed} onChange={(event) => setSpeed(Number(event.target.value))}>{[.25, .5, 1, 2].map((value) => <option key={value} value={value}>{value}×</option>)}</select><button type="button" onClick={() => { setPlaying(false); setPhase(0); }}>Restart</button></div>
            <dl className="data-strip"><div className="datum"><dt>Energy</dt><dd>{orbit.metadata.energy.toFixed(3)}</dd></div><div className="datum"><dt>Period</dt><dd>{orbit.metadata.period.toFixed(4)}</dd></div><div className="datum"><dt>Family</dt><dd>{orbit.metadata.family_id}</dd></div><div className="datum"><dt>Samples</dt><dd>{orbit.metadata.sample_count}</dd></div><div className="datum"><dt>Periodic residual</dt><dd>{orbit.validation?.periodic_residual.toExponential(2) ?? "—"}</dd></div></dl>
          </>}
        </section>
        <section className="method-note"><div><h2>Coordinate convention</h2><p>Angles are measured from the downward vertical. The physical view uses continuous angles; configuration space wraps both coordinates to [−π, π] and breaks the path at torus boundaries.</p></div><div><h2>Numerical provenance</h2><p>MATLAB-generated <code>.mat</code> trajectories are the authoritative research data. A preprocessing step validates them and exports the web representation discovered through the manifest.</p>{record?.mat && <p><a href={`/${record.mat}`}>Download source MAT</a></p>}</div></section>
      </div>
    </main>
  );
}
