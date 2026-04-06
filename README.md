# Looker Studio — Y/Y Clustered Stacked Bar Chart

A custom **Looker Studio Community Visualization** that combines clustered and stacked bar charts in one view. Built to solve a gap in Looker Studio's native charting — showing Year-over-Year (LY vs TY) comparison with multiple metrics stacked inside each bar.

---

## The Problem

Looker Studio's built-in bar chart can do **stacked** (metrics on top of each other) or **clustered** (bars side by side) — but not both at the same time. For our use case, we needed:

- Weeks on the X-axis
- Two bars per week: **Last Year (LY)** and **This Year (TY)** side by side
- Multiple revenue metrics **stacked inside** each bar (X Revenue, Y Revenue, Z Revenue)
- Same brand colors for both bars, with LY faded and TY solid

No native Looker chart supports this layout.

---

## The Solution

A custom community visualization built with **JavaScript**, **Chart.js**, and Google's **@google/dscc** library. It renders inside Looker Studio like any native chart — users drag and drop their data fields, customize styles from the property panel, and interact with tooltips.

### Features

- **Clustered + Stacked** — comparison groups (LY/TY) side by side, metrics stacked inside each bar
- **Brand Colors** — Freeosk palette with per-metric color pickers in the style panel
- **LY Opacity Control** — adjustable transparency to visually distinguish last year from this year
- **Looker-Native Tooltip** — white background, color squares, per-metric breakdown with currency formatting, and a total row
- **Full Style Panel** — matches native Looker chart options: chart title, bar width, colors, Y-axis, X-axis, grid, legend, background and border
- **Separate Axis Controls** — independent show/hide for X-axis labels, Y-axis labels, axis lines, font, rotation
- **Currency Formatting** — $, €, £ support on Y-axis ticks, tooltips, and data labels
- **Responsive** — adapts to any chart size in the dashboard

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Looker Studio                        │
│                                                         │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │  Data Source  │───>│  Community Visualization     │   │
│  │  (BigQuery,   │    │  (loaded from GCS bucket)    │   │
│  │   Sheets,     │    │                              │   │
│  │   etc.)       │    │  manifest.json -> viz.js     │   │
│  └──────────────┘    │  viz-config.json -> viz.css  │   │
│                       └──────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                              ^
                              | reads files from
                              |
                    ┌─────────┴──────────┐
                    │   GCS Bucket       │
                    │   (public-read)    │
                    │                    │
                    │   manifest.json    │
                    │   viz.js           │
                    │   viz-config.json  │
                    │   viz.css          │
                    └────────────────────┘
                              ^
                              | deployed by
                              |
                    ┌─────────┴──────────┐
                    │   This Repo        │
                    │   src/ -> webpack  │
                    │        -> dist/    │
                    │        -> gsutil   │
                    └────────────────────┘
```

**Security Note:** The GCS bucket must be public, but it only contains the chart rendering code and configuration — **no data is stored or exposed**. All data stays in Looker Studio's data source and is never sent to the bucket.

---

## Project Structure

```
Looker-stacked-clustered-bar-chart/
├── src/
│   ├── index.js            <- Main visualization code (Chart.js + dscc)
│   ├── manifest.json       <- Looker Studio reads this first (entry point)
│   ├── viz-config.json     <- Defines dimensions, metrics, and style panel
│   └── viz.css             <- Base layout and error state styles
├── dist/                   <- Webpack output (deployed to GCS)
│   ├── viz.js              <- Bundled JS (dscc + Chart.js + index.js)
│   ├── manifest.json       <- Copied from src/
│   ├── viz-config.json     <- Copied from src/
│   └── viz.css             <- Copied from src/
├── test/
│   └── local-preview.html  <- Browser preview with mock data
├── webpack.config.js       <- Bundles everything into one viz.js
├── package.json            <- npm scripts: build, deploy
├── .gitignore
└── README.md               <- You are here
```

### What Each File Does

| File | Purpose |
|------|---------|
| `src/index.js` | The visualization logic. Receives data from Looker via `dscc.subscribeToData()`, reads style options, builds Chart.js datasets, renders the clustered stacked bar chart, handles tooltips and legends. |
| `src/manifest.json` | Tells Looker Studio where to find the JS, config, and CSS files. Must be named exactly `manifest.json`. Contains the component `id` (required since Nov 2025). |
| `src/viz-config.json` | Defines the data schema (2 dimensions + up to 10 metrics) and all style panel options (title, bars, colors, Y-axis, X-axis, grid, legend, background). |
| `src/viz.css` | Minimal CSS for the chart container and error states. Most styling is handled by Chart.js in the JS. |
| `webpack.config.js` | Bundles `@google/dscc` + `chart.js` + `src/index.js` into a single `dist/viz.js` file. Copies the other 3 files to `dist/`. |
| `test/local-preview.html` | Lets you test the chart in a browser without Looker Studio, using mock data. |

---

## Tech Stack

| Layer | Technology | Why |
|-------|-----------|-----|
| Charting | **Chart.js v4** | Native clustered-stacked support via `stack` groups. `categoryPercentage` and `barPercentage` control LY/TY spacing. |
| Looker API | **@google/dscc** | Official helper library. Provides `subscribeToData()` to receive data and styles from Looker Studio. |
| Bundler | **Webpack 5** | Bundles all JS into one file as required by Looker Studio community viz spec. |
| Transpiler | **Babel** | Ensures compatibility across environments. |
| Language | **JavaScript** | Using `require()` syntax for compatibility with Node v25+ and webpack. |
| Hosting | **Google Cloud Storage** | Required by Looker Studio. Files must be in a `gs://` bucket. |
| Version Control | **GitHub** | Source code and deployment pipeline. |

---

## Prerequisites

- **Node.js** v18+ — [nodejs.org](https://nodejs.org)
- **npm** — comes with Node.js
- **Google Cloud SDK** — [cloud.google.com/sdk](https://cloud.google.com/sdk/install) (only needed for deployment)
- **A GCP project** with a Cloud Storage bucket
- **Looker Studio** access

---

## Setup — Step by Step

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/Looker-stacked-clustered-bar-chart.git
cd Looker-stacked-clustered-bar-chart
```

### 2. Install dependencies

```bash
npm install
```

This installs `@google/dscc`, `chart.js`, `webpack`, `babel-loader`, and other build tools.

### 3. Build

```bash
npm run build:dev
```

Creates the `dist/` folder with 4 files: `viz.js` (bundled), `manifest.json`, `viz-config.json`, `viz.css`.

### 4. Test locally

Open `test/local-preview.html` in your browser:

```bash
open test/local-preview.html
```

You should see the Y/Y bar chart with mock data (Week 1-6, LY vs TY, three metrics stacked).

### 5. Set up GCP (one time)

```bash
gcloud auth login
gcloud config set project YOUR_PROJECT_ID
gsutil mb gs://YOUR_BUCKET_NAME
gsutil iam ch allUsers:objectViewer gs://YOUR_BUCKET_NAME
```

### 6. Update deploy config

Edit `package.json` and replace `YOUR_BUCKET` in the deploy scripts with your actual bucket name.

Edit `src/manifest.json` and update the `resource` paths to use your full `gs://` bucket paths.

### 7. Deploy

```bash
npm run deploy:dev
```

### 8. Add to Looker Studio

1. Open your report in **Edit** mode
2. **Add a chart** -> **Community visualizations and components**
3. **Explore more** -> **Build your own visualization**
4. Enter Manifest Path:
   ```
   gs://YOUR_BUCKET_NAME/yoy-bar-chart-dev
   ```
5. Click **Submit** -> click the card to add it
6. Map your data fields (see below)

---

## Data Field Mapping

In the Looker Studio **Data** panel:

| Field | What to drag here | Example |
|-------|-------------------|---------|
| **Time Period (X-Axis)** | Your week/month/quarter field | `Retailer Week` (set type to **Text**) |
| **Comparison Group** | Your year/period field | `Year` (values like "LY", "TY") |
| **Stacked Metrics** | Your revenue/value fields | `X Revenue`, `Y Revenue`, `Z Revenue` |

### Expected Data Shape

Your data source should have rows like this:

| Week | Year | X Revenue | Y Revenue | Z Revenue |
|------|------|---------------|---------------|----------------------|
| Week 1 | LY | xxx | xxx     | xxx   |
| Week 1 | TY | xxx | xxx,xxx | xxx   |
| Week 2 | LY | xxx | xxx,xxx | xxx   |
| Week 2 | TY | xxx | xxx     | xxx   |

**Tip:** If the X-axis shows numbers (1, 2, 3) instead of text (Week 1, Week 2), click the pencil icon next to the Time Period field in Looker and change the **Type** to `Text`.

---

## Style Panel Options

The visualization exposes a full style panel in Looker Studio:

### Chart Title
Show/hide title, title text, font family, size, color

### Bar Chart
Group bar width (narrow to full), show data labels, bar corner radius, currency symbol ($, EUR, GBP, or none)

### Colors
Individual color picker for each metric (up to 5), LY bar opacity slider

### Y-Axis
Show/hide axis title, show/hide axis labels, show/hide axis line, axis min (auto), axis max (auto), custom tick interval (auto), font family, size, color

### X-Axis
Show/hide axis title, show/hide axis labels, show/hide axis line, font family, size, color, label rotation (0 to 90 degrees)

### Grid
Show/hide X-axis gridlines, show/hide Y-axis gridlines, gridline color

### Legend
Show/hide legend, position (top/bottom/left/right), font family, size, color

### Background and Border
Background color, opacity, border color, border radius

---

## How the Clustered + Stacked Layout Works

Chart.js uses a `stack` property on each dataset:

```
Each comparison group (LY, TY) gets a unique stack ID.
All metrics within a group share the same stack ID.

Metrics with the same stack ID    = stacked vertically
Different stack IDs               = placed side by side (clustered)

Week 1:
  [stack_0: LY Revenue + LY Units + LY Returns]  [stack_1: TY Revenue + TY Units + TY Returns]
```

The LY/TY bar spacing is controlled by `categoryPercentage` (0.9) and `barPercentage` (0.95). Same color is used for both LY and TY per metric — LY just has reduced opacity.

---

## npm Scripts

| Command | What it does |
|---------|-------------|
| `npm run build:dev` | Webpack development build (not minified) |
| `npm run build:prod` | Webpack production build (minified) |
| `npm run deploy:dev` | Build + upload to GCS dev path |
| `npm run deploy:prod` | Build + upload to GCS prod path |
| `npm start` | Webpack watch mode (rebuilds on file changes) |

---

## Deployment Workflow

```
Edit src/index.js or src/viz-config.json
         |
         v
  npm run deploy:dev
         |
         |-- webpack bundles src/ -> dist/
         |
         +-- gsutil uploads dist/ -> GCS bucket
                    |
                    v
         Hard-refresh Looker Studio (Cmd+Shift+R)
         (devMode: true disables caching)
```

### Going to Production

1. Edit `src/manifest.json` — change `"devMode": true` to `"devMode": false`
2. Update the `resource` paths to point to your prod GCS path
3. Run `npm run deploy:prod`
4. Update your Looker Studio report to use the prod manifest path

---

## Moving to Company GCP

This project is currently deployed to a personal GCP bucket. To move to the company environment:

1. Create a bucket in the company's GCP project
2. Make it public: `gsutil iam ch allUsers:objectViewer gs://COMPANY_BUCKET`
3. Update the bucket name in `package.json` deploy scripts
4. Update the `resource` paths in `src/manifest.json`
5. Run `npm run deploy:dev`
6. Update the manifest path in Looker Studio reports

**Security note:** The public bucket only contains the chart rendering code (JavaScript, JSON config, CSS). No data is stored in or served from the bucket. All data remains in Looker Studio's data source.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Viz won't load in Looker Studio | Check `devMode: true` in manifest.json, hard-refresh (Cmd+Shift+R) |
| "Error requesting config resource" | Verify `resource` paths in manifest.json use full `gs://` paths |
| X-axis shows numbers instead of text | Change the Time Period field type to **Text** in Looker Studio |
| Bars overlap or have too much gap | Adjust "Group Bar Width" in the Style panel |
| Tooltip gets cut off | Updated in latest version — tooltip auto-repositions above cursor |
| Old version still showing after deploy | `devMode` must be `true` during development |
| `npm run deploy:dev` permission error | Run `gsutil iam ch allUsers:objectViewer gs://BUCKET` |
| webpack build fails | Run `npm install` first, check Node v18+ |
| Manifest path rejected in Looker | Use `gs://` prefix, not `https://`. No `/manifest.json` at the end |
| `import` errors during build | Use `require()` syntax instead of `import` in index.js |

---

## References

- [Looker Studio Community Visualizations — Developer Docs](https://developers.google.com/looker-studio/visualization)
- [Community Visualization Config Reference](https://developers.google.com/looker-studio/visualization/config-reference)
- [dscc Library Reference](https://developers.google.com/looker-studio/visualization/library-reference)
- [Chart.js Bar Chart Documentation](https://www.chartjs.org/docs/latest/charts/bar.html)
- [googledatastudio/community-visualizations (GitHub)](https://github.com/googledatastudio/community-visualizations)

---

## License

MIT