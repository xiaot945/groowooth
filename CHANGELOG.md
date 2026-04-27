# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-04-27

First public release.

### Features

- **`@groowooth/core`** — pure-TS growth assessment library
  - LMS Box-Cox z-score for WHO 2006 (0–5 y) and WHO 2007 (5–19 y)
  - SD-table linear interpolation for China NHC WS/T 423-2022 (0–7 y)
  - `assess`, `lookup`, `interpret`, `renderChart`, `loadStandard`
  - Out-of-range / out-of-plausible-range typed errors
  - Standard data dynamically imported per dataset (main bundle ~25 kB)
  - 47 unit tests covering LMS, SD-table, assess, lookup, interpret, chart SVG
- **`@groowooth/web`** — React + Vite PWA
  - Multi-child support with IndexedDB v2 schema (children + measurements + meta)
  - Add / edit / delete measurements with atomic conflict + missing guards
  - Four growth charts: height-for-age, weight-for-age, BMI-for-age, head-for-age
  - Latest-record summary with statistical (non-clinical) wording and disclaimer
  - JSON export / import with strict YYYY-MM-DD schema validation and ageMonths recompute
  - Reset-all-data with type-to-confirm guard
  - Top-level error boundary with backup export fallback
  - PWA installable, offline-capable, prompt-style update flow
  - Manual chunking: who-2006 / who-2007 / nhc-2022 / react-vendor split
- **`@groowooth/mcp`** — Model Context Protocol stdio server
  - `assess_growth`, `get_growth_chart`, `interpret_growth`
  - Single-file bundle (`tsup` `noExternal: ['@groowooth/core']`)
  - Claude Desktop / Cursor / Cline ready

### Design Rationale

- **Privacy-first**: web stores all data locally in IndexedDB; the MCP server is stateless. No accounts, no cloud, no telemetry.
- **Two compute paths unified**: NHC publishes only percentile + SD points (no L/M/S), so we use SD-table linear interpolation for it; WHO publishes full LMS so we use Box-Cox there. A discriminated union (`StandardIndicatorData`) keeps the surface uniform.
- **No clinical labels**: outputs are statistical only ("位于第 62 百分位") and every response carries a `DISCLAIMER`. Diagnosis is out of scope by design.
- **Dynamic-import standards**: a default-locale (NHC) user only downloads ~95 kB gzip; WHO 2006 is the heavy chunk and only loads when selected.

### Notes & Caveats

- v1 assumes term-born infants. Preterm correction and Fenton 2013 are roadmapped for v1.1.
- `who-2006` length-for-age vs. height-for-age switchover (24 mo) is honored where the underlying dataset distinguishes them.
- Standard dataset modules are large but tree-shakable per indicator only at the package level — full file is loaded once a standard is requested.

### Repository

- https://github.com/xiaot945/groowooth
