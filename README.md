# Lyapunov Orbit Viewer

A static scientific viewer for precomputed double-pendulum Lyapunov periodic orbits. MATLAB `.mat` trajectories are the authoritative numerical results; the web application only loads, interpolates in time, and visualizes exported trajectories.

## Local development

```powershell
npm install
npm run dev
```

Open `http://localhost:3000/`.

## Data workflow

The repository contains two source families:

- `trajectories/` — family associated with the saddle at `E = 2`
- `trajectories_E4_saddle/` — family associated with the saddle at `E = 4`

Regenerate the browser data from MATLAB:

```matlab
cd matlab
export_orbits_for_web
```

The exporter validates finite values, equal array lengths, strictly increasing time, period endpoints, and state closure with angular differences evaluated modulo `2π`. It writes one JSON file per orbit, copies the source MAT files into the download area, and regenerates `public/data/manifest.json`.

## Scientific boundary

The browser does not integrate the equations of motion, search for periodic orbits, parse MAT files, or interpolate between energy levels. Selecting an energy always selects one computed trajectory from the generated manifest.

## Main project areas

- `matlab/` — validation and web export
- `trajectories*/` — authoritative research results
- `public/data/` — generated browser trajectories and manifest
- `public/mat/` — downloadable source MAT files
- `app/` — viewer interface and synchronized renderers
- `tests/` — page and data-contract checks
