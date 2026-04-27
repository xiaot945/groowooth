# @groowooth/core

[![npm](https://img.shields.io/npm/v/@groowooth/core.svg)](https://www.npmjs.com/package/@groowooth/core) [![license](https://img.shields.io/badge/license-MIT-blue)](https://github.com/xiaot945/groowooth/blob/master/LICENSE)

Headless TypeScript toolkit for child growth assessment.

- **WHO 2006** (0–5 y) and **WHO 2007** (5–19 y) — LMS Box-Cox z-score
- **NHC WS/T 423-2022** (0–7 y) — SD-table linear interpolation
- `assess`, `lookup`, `interpret`, `renderChart` — pure functions, zero side effects
- Standard data is dynamically imported on demand (~25 kB main bundle, full WHO 2006 ~ 600 kB lazy chunk)
- Only runtime dependency: `zod`

## Install

```bash
npm install @groowooth/core
# or pnpm add @groowooth/core
```

## Quick start

```ts
import { assess, interpret, loadStandard, lookup, renderChart } from '@groowooth/core'

// Optional: warm up if you know which standard you'll use
await loadStandard('nhc-2022')

const result = await assess({
  ageMonths: 24,
  sex: 'female',
  heightCm: 86,
  weightKg: 12,
  standard: 'nhc-2022'
})
// → { assessments: [...], standard, standardVersion, disclaimer }

const curves = await lookup({
  standard: 'who-2006',
  indicator: 'height-for-age',
  sex: 'male',
  xRange: [0, 60],
  percentiles: [3, 15, 50, 85, 97]
})

const svg = await renderChart({
  standard: 'nhc-2022',
  indicator: 'height-for-age',
  sex: 'female',
  measurements: [{ x: 24, value: 86 }]
})

const text = await interpret({
  zScore: 0.31,
  indicator: 'height-for-age',
  sex: 'female',
  ageMonths: 24,
  standard: 'nhc-2022'
})
```

## Disclaimer

This package returns purely statistical descriptions (e.g. "P62"). It does **not** issue clinical labels and is not a medical device. See the project [README](https://github.com/xiaot945/groowooth#readme) for details.

## License

MIT © yuxuan
