import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

type Sex = 'male' | 'female'
type Model = 'lms' | 'sd-table'
type Indicator =
  | 'height-for-age'
  | 'weight-for-age'
  | 'bmi-for-age'
  | 'head-for-age'
  | 'weight-for-length'
  | 'weight-for-height'
type AxisUnit = 'days' | 'months' | 'cm'
type AxisType = 'age' | 'length' | 'height'

type LmsRow = {
  x: number
  L: number
  M: number
  S: number
}

type SdRow = {
  x: number
  sds: {
    neg3: number
    neg2: number
    neg1: number
    median: number
    pos1: number
    pos2: number
    pos3: number
  }
}

type StandardIndicatorData =
  | {
      model: 'lms'
      xUnit: AxisUnit
      xType: AxisType
      male: LmsRow[]
      female: LmsRow[]
    }
  | {
      model: 'sd-table'
      xUnit: AxisUnit
      xType: AxisType
      male: SdRow[]
      female: SdRow[]
    }

type StandardDataset = {
  source: string
  version: string
  url: string
  indicators: Partial<Record<Indicator, StandardIndicatorData>>
}

type TsvLmsConfig = {
  indicator: Indicator
  xKey: string
  xUnit: AxisUnit
  xType: AxisType
}

type CsvLmsConfig = {
  indicator: Indicator
  xColumn: string
  xUnit: AxisUnit
  xType: AxisType
}

type SdConfig = {
  indicator: Indicator
  sex: Sex
  xUnit: AxisUnit
  xType: AxisType
}

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const repoRoot = path.resolve(__dirname, '..')
const standardsDir = path.join(repoRoot, 'packages/core/src/standards')

const who2006SourceDir = '/tmp/groowooth-research/anthro/data-raw/growthstandards'
const who2007SourceDir =
  '/tmp/groowooth-research/pygrowthstandards/data/raw/who-growth-reference-data'
const nhcSourceDir = path.join(repoRoot, 'data/csv/nhc')

const who2006Configs: Record<string, TsvLmsConfig> = {
  'lenanthro.txt': {
    indicator: 'height-for-age',
    xKey: 'age',
    xUnit: 'days',
    xType: 'age'
  },
  'weianthro.txt': {
    indicator: 'weight-for-age',
    xKey: 'age',
    xUnit: 'days',
    xType: 'age'
  },
  'bmianthro.txt': {
    indicator: 'bmi-for-age',
    xKey: 'age',
    xUnit: 'days',
    xType: 'age'
  },
  'hcanthro.txt': {
    indicator: 'head-for-age',
    xKey: 'age',
    xUnit: 'days',
    xType: 'age'
  },
  'wflanthro.txt': {
    indicator: 'weight-for-length',
    xKey: 'length',
    xUnit: 'cm',
    xType: 'length'
  },
  'wfhanthro.txt': {
    indicator: 'weight-for-height',
    xKey: 'height',
    xUnit: 'cm',
    xType: 'height'
  }
}

const who2007Configs: Record<string, CsvLmsConfig> = {
  'who-growth-height-m.csv': {
    indicator: 'height-for-age',
    xColumn: 'Month',
    xUnit: 'months',
    xType: 'age'
  },
  'who-growth-height-f.csv': {
    indicator: 'height-for-age',
    xColumn: 'Month',
    xUnit: 'months',
    xType: 'age'
  },
  'who-growth-weight-m.csv': {
    indicator: 'weight-for-age',
    xColumn: 'Month',
    xUnit: 'months',
    xType: 'age'
  },
  'who-growth-weight-f.csv': {
    indicator: 'weight-for-age',
    xColumn: 'Month',
    xUnit: 'months',
    xType: 'age'
  },
  'who-growth-body_mass_index-m.csv': {
    indicator: 'bmi-for-age',
    xColumn: 'Month',
    xUnit: 'months',
    xType: 'age'
  },
  'who-growth-body_mass_index-f.csv': {
    indicator: 'bmi-for-age',
    xColumn: 'Month',
    xUnit: 'months',
    xType: 'age'
  }
}

const nhcConfigs: Record<string, SdConfig> = {
  'weight-for-age-male.csv': {
    indicator: 'weight-for-age',
    sex: 'male',
    xUnit: 'months',
    xType: 'age'
  },
  'weight-for-age-female.csv': {
    indicator: 'weight-for-age',
    sex: 'female',
    xUnit: 'months',
    xType: 'age'
  },
  'height-for-age-male.csv': {
    indicator: 'height-for-age',
    sex: 'male',
    xUnit: 'months',
    xType: 'age'
  },
  'height-for-age-female.csv': {
    indicator: 'height-for-age',
    sex: 'female',
    xUnit: 'months',
    xType: 'age'
  },
  'weight-for-length-male.csv': {
    indicator: 'weight-for-length',
    sex: 'male',
    xUnit: 'cm',
    xType: 'length'
  },
  'weight-for-length-female.csv': {
    indicator: 'weight-for-length',
    sex: 'female',
    xUnit: 'cm',
    xType: 'length'
  },
  'weight-for-height-male.csv': {
    indicator: 'weight-for-height',
    sex: 'male',
    xUnit: 'cm',
    xType: 'height'
  },
  'weight-for-height-female.csv': {
    indicator: 'weight-for-height',
    sex: 'female',
    xUnit: 'cm',
    xType: 'height'
  },
  'bmi-for-age-male.csv': {
    indicator: 'bmi-for-age',
    sex: 'male',
    xUnit: 'months',
    xType: 'age'
  },
  'bmi-for-age-female.csv': {
    indicator: 'bmi-for-age',
    sex: 'female',
    xUnit: 'months',
    xType: 'age'
  },
  'head-for-age-male.csv': {
    indicator: 'head-for-age',
    sex: 'male',
    xUnit: 'months',
    xType: 'age'
  },
  'head-for-age-female.csv': {
    indicator: 'head-for-age',
    sex: 'female',
    xUnit: 'months',
    xType: 'age'
  }
}

function lines(text: string): string[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function toRecord(header: string[], row: string[], file: string): Record<string, string> {
  if (header.length !== row.length) {
    throw new Error(`Unexpected column count in ${file}: expected ${header.length}, got ${row.length}`)
  }

  return Object.fromEntries(header.map((column, index) => [column, row[index]]))
}

function parseNumber(value: string, context: string): number {
  const parsed = Number(value)
  if (!Number.isFinite(parsed)) {
    throw new Error(`Expected finite number for ${context}, received "${value}"`)
  }
  return parsed
}

function upsertIndicator<Row extends LmsRow | SdRow>(
  indicators: Partial<Record<Indicator, StandardIndicatorData>>,
  indicator: Indicator,
  model: Model,
  xUnit: AxisUnit,
  xType: AxisType,
  sex: Sex,
  rows: Row[]
): void {
  const existing = indicators[indicator]

  if (!existing) {
    indicators[indicator] =
      model === 'lms'
        ? { model, xUnit, xType, male: sex === 'male' ? (rows as LmsRow[]) : [], female: sex === 'female' ? (rows as LmsRow[]) : [] }
        : {
            model,
            xUnit,
            xType,
            male: sex === 'male' ? (rows as SdRow[]) : [],
            female: sex === 'female' ? (rows as SdRow[]) : []
          }
    return
  }

  if (existing.model !== model || existing.xUnit !== xUnit || existing.xType !== xType) {
    throw new Error(`Conflicting indicator metadata for ${indicator}`)
  }

  if (sex === 'male') {
    existing.male = rows as never
  } else {
    existing.female = rows as never
  }
}

async function parseWho2006(): Promise<StandardDataset> {
  const indicators: Partial<Record<Indicator, StandardIndicatorData>> = {}

  for (const [filename, config] of Object.entries(who2006Configs)) {
    const sourcePath = path.join(who2006SourceDir, filename)
    const content = await readFile(sourcePath, 'utf8')
    const [headerLine, ...rowLines] = lines(content)
    const header = headerLine.split('\t')

    const rowsBySex: Record<Sex, LmsRow[]> = { male: [], female: [] }

    for (const rowLine of rowLines) {
      const record = toRecord(header, rowLine.split('\t'), filename)
      const sex = record.sex === '1' ? 'male' : record.sex === '2' ? 'female' : null
      if (!sex) {
        throw new Error(`Unexpected sex code in ${filename}: ${record.sex}`)
      }

      rowsBySex[sex].push({
        x: parseNumber(record[config.xKey], `${filename}:${config.xKey}`),
        L: parseNumber(record.l, `${filename}:l`),
        M: parseNumber(record.m, `${filename}:m`),
        S: parseNumber(record.s, `${filename}:s`)
      })
    }

    upsertIndicator(
      indicators,
      config.indicator,
      'lms',
      config.xUnit,
      config.xType,
      'male',
      rowsBySex.male.sort((left, right) => left.x - right.x)
    )
    upsertIndicator(
      indicators,
      config.indicator,
      'lms',
      config.xUnit,
      config.xType,
      'female',
      rowsBySex.female.sort((left, right) => left.x - right.x)
    )
  }

  return {
    source: 'WHO Child Growth Standards, 2006',
    version: '2006',
    url: 'https://www.who.int/tools/child-growth-standards',
    indicators
  }
}

async function parseWho2007(): Promise<StandardDataset> {
  const indicators: Partial<Record<Indicator, StandardIndicatorData>> = {}

  for (const [filename, config] of Object.entries(who2007Configs)) {
    const sourcePath = path.join(who2007SourceDir, filename)
    const content = await readFile(sourcePath, 'utf8')
    const [headerLine, ...rowLines] = lines(content)
    const header = headerLine.split(',')
    const sex: Sex = filename.endsWith('-m.csv') ? 'male' : 'female'
    const rows: LmsRow[] = rowLines.map((rowLine) => {
      const record = toRecord(header, rowLine.split(','), filename)
      return {
        x: parseNumber(record[config.xColumn], `${filename}:${config.xColumn}`),
        L: parseNumber(record.L, `${filename}:L`),
        M: parseNumber(record.M, `${filename}:M`),
        S: parseNumber(record.S, `${filename}:S`)
      }
    })

    upsertIndicator(
      indicators,
      config.indicator,
      'lms',
      config.xUnit,
      config.xType,
      sex,
      rows.sort((left, right) => left.x - right.x)
    )
  }

  return {
    source: 'WHO Growth Reference Data, 2007',
    version: '2007',
    url: 'https://www.who.int/tools/growth-reference-data-for-5to19-years',
    indicators
  }
}

async function parseNhc2022(): Promise<StandardDataset> {
  const indicators: Partial<Record<Indicator, StandardIndicatorData>> = {}

  for (const [filename, config] of Object.entries(nhcConfigs)) {
    const sourcePath = path.join(nhcSourceDir, filename)
    const content = await readFile(sourcePath, 'utf8')
    const [headerLine, ...rowLines] = lines(content)
    const header = headerLine.split(',')
    const rows: SdRow[] = rowLines.map((rowLine) => {
      const record = toRecord(header, rowLine.split(','), filename)
      return {
        x: parseNumber(record.x, `${filename}:x`),
        sds: {
          neg3: parseNumber(record.neg3, `${filename}:neg3`),
          neg2: parseNumber(record.neg2, `${filename}:neg2`),
          neg1: parseNumber(record.neg1, `${filename}:neg1`),
          median: parseNumber(record.median, `${filename}:median`),
          pos1: parseNumber(record.pos1, `${filename}:pos1`),
          pos2: parseNumber(record.pos2, `${filename}:pos2`),
          pos3: parseNumber(record.pos3, `${filename}:pos3`)
        }
      }
    })

    upsertIndicator(
      indicators,
      config.indicator,
      'sd-table',
      config.xUnit,
      config.xType,
      config.sex,
      rows.sort((left, right) => left.x - right.x)
    )
  }

  return {
    source: 'NHC WS/T 423-2022, 7岁以下儿童生长标准',
    version: '2022',
    url: 'https://www.nhc.gov.cn/',
    indicators
  }
}

function serializeConstant(name: string, dataset: StandardDataset): string {
  return `import type { StandardDataset } from '../types'\n\nexport const ${name} = ${JSON.stringify(
    dataset,
    null,
    2
  )} as const satisfies StandardDataset\n`
}

async function writeDataset(filename: string, exportName: string, dataset: StandardDataset): Promise<void> {
  await writeFile(path.join(standardsDir, filename), serializeConstant(exportName, dataset), 'utf8')
}

async function writeBarrel(): Promise<void> {
  const content = [
    "export { WHO_2006 } from './who-2006'",
    "export { WHO_2007 } from './who-2007'",
    "export { NHC_2022 } from './nhc-2022'"
  ].join('\n')

  await writeFile(path.join(standardsDir, 'index.ts'), `${content}\n`, 'utf8')
}

async function main(): Promise<void> {
  await mkdir(standardsDir, { recursive: true })

  const [who2006, who2007, nhc2022] = await Promise.all([parseWho2006(), parseWho2007(), parseNhc2022()])

  await writeDataset('who-2006.ts', 'WHO_2006', who2006)
  await writeDataset('who-2007.ts', 'WHO_2007', who2007)
  await writeDataset('nhc-2022.ts', 'NHC_2022', nhc2022)
  await writeBarrel()

  console.log('Generated packages/core/src/standards/{who-2006,who-2007,nhc-2022,index}.ts')
}

await main()
