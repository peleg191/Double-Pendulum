# Saddle Orbit For the Egalitarian Double Pendulum

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

The exporter validates finite values, equal array lengths, strictly increasing time, and period endpoints. It writes one JSON file per orbit, copies the source MAT files into the local download area, and regenerates `public/data/manifest.json`.

## Scientific boundary

The browser does not integrate the equations of motion, search for periodic orbits, parse MAT files, or interpolate between energy levels. Selecting an energy always selects one computed trajectory from the generated manifest.

## Main project areas

- `matlab/` — validation and web export
- `trajectories*/` — authoritative research results
- `public/data/` — generated browser trajectories and manifest
- `public/mat/` — downloadable source MAT files
- `app/` — viewer interface and synchronized renderers
- `tests/` — page and data-contract checks

## Publish with GitHub Pages

The Pages build is deliberately lean: it contains the static viewer and `public/data/` only. MATLAB sources, raw trajectories, downloadable MAT files, tests, development dependencies, and the server build are not uploaded as the Pages artifact.

Test the Pages build locally:

```powershell
npm ci
npm run build:pages
npm run preview:pages
```

Then create an empty GitHub repository and connect this checkout:

```powershell
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin master
```

On GitHub, open **Settings → Pages** and set **Source** to **GitHub Actions**. The included workflow builds and deploys the site on every push to `master` or `main`; it can also be run manually from the **Actions** tab.

The normal `npm run build` command remains the local/server build. For GitHub Pages, use `npm run build:pages`; after the repository is connected, GitHub Actions runs it automatically.
