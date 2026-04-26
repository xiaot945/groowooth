import { assess, interpret, renderChart, type Indicator, type Standard } from '@groowooth/core'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js'
import { z } from 'zod'

type PublicStandard = 'who' | 'nhc'
type ChartIndicator = 'height' | 'weight' | 'head' | 'bmi'

export const assessGrowthInputSchema = z.object({
  ageMonths: z.number().min(0).max(228),
  sex: z.enum(['male', 'female']),
  heightCm: z.number().min(30).max(250).optional(),
  weightKg: z.number().min(0.5).max(200).optional(),
  headCircumferenceCm: z.number().min(25).max(70).optional(),
  standard: z.enum(['who', 'nhc']).default('nhc')
})

export const getGrowthChartInputSchema = z.object({
  measurements: z.array(
    z.object({
      date: z.string(),
      ageMonths: z.number().min(0).max(228),
      value: z.number()
    })
  ),
  indicator: z.enum(['height', 'weight', 'head', 'bmi']),
  sex: z.enum(['male', 'female']),
  standard: z.enum(['who', 'nhc']).default('nhc')
})

export const interpretGrowthInputSchema = z.object({
  zScore: z.number(),
  indicator: z.enum(['height-for-age', 'weight-for-age', 'bmi-for-age', 'head-for-age']),
  ageMonths: z.number().min(0).max(228),
  sex: z.enum(['male', 'female']),
  standard: z.enum(['who', 'nhc']).default('nhc')
})

export type ToolDefinition<TSchema extends z.ZodTypeAny = z.ZodTypeAny> = {
  name: string
  description: string
  inputSchema: TSchema
  handler: (input: z.infer<TSchema>) => Promise<CallToolResult> | CallToolResult
}

function toErrorResult(error: unknown): CallToolResult {
  const message = error instanceof Error ? error.message : String(error)

  return {
    content: [{ type: 'text', text: `Error: ${message}` }],
    isError: true
  }
}

function toJsonResult(value: unknown): CallToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(value, null, 2) }]
  }
}

function toSvgResult(svg: string): CallToolResult {
  return {
    content: [{ type: 'text', text: svg }]
  }
}

function resolveAssessStandard(standard: PublicStandard, ageMonths: number): Standard {
  if (standard === 'nhc') {
    return 'nhc-2022'
  }

  return ageMonths <= 60 ? 'who-2006' : 'who-2007'
}

function resolveChartStandard(standard: PublicStandard, measurements: Array<{ ageMonths: number }>): Standard {
  if (standard === 'nhc') {
    return 'nhc-2022'
  }

  const hasInfantRange = measurements.some((measurement) => measurement.ageMonths <= 60)
  const hasOlderRange = measurements.some((measurement) => measurement.ageMonths > 60)

  if (hasInfantRange && hasOlderRange) {
    throw new RangeError('WHO charts cannot mix measurements on both sides of 60 months in one request.')
  }

  return hasOlderRange ? 'who-2007' : 'who-2006'
}

function toAgeBasedIndicator(indicator: ChartIndicator): Indicator {
  switch (indicator) {
    case 'height':
      return 'height-for-age'
    case 'weight':
      return 'weight-for-age'
    case 'head':
      return 'head-for-age'
    case 'bmi':
      return 'bmi-for-age'
  }
}

export const tools: ToolDefinition[] = [
  {
    name: 'assess_growth',
    description:
      '基于 WHO 或中国卫健委标准评估儿童生长发育，返回各 indicator 的 z-score、百分位、范围标签（统计语言，不含临床诊断）',
    inputSchema: assessGrowthInputSchema,
    handler: async (input: z.infer<typeof assessGrowthInputSchema>) => {
      try {
        const result = await assess({
          ...input,
          standard: resolveAssessStandard(input.standard, input.ageMonths)
        })

        return toJsonResult(result)
      } catch (error) {
        return toErrorResult(error)
      }
    }
  },
  {
    name: 'get_growth_chart',
    description: '生成 SVG 成长曲线图（含百分位带和孩子数据点）',
    inputSchema: getGrowthChartInputSchema,
    handler: async (input: z.infer<typeof getGrowthChartInputSchema>) => {
      try {
        const standard = resolveChartStandard(input.standard, input.measurements)
        const indicator = toAgeBasedIndicator(input.indicator)
        const svg = await renderChart({
          standard,
          indicator,
          sex: input.sex,
          measurements: input.measurements.map((measurement) => ({
            date: measurement.date,
            x: measurement.ageMonths,
            value: measurement.value
          }))
        })

        return toSvgResult(svg)
      } catch (error) {
        return toErrorResult(error)
      }
    }
  },
  {
    name: 'interpret_growth',
    description: '把 z-score 翻译成家长友好的中文统计描述（不含行动建议或临床诊断）',
    inputSchema: interpretGrowthInputSchema,
    handler: async (input: z.infer<typeof interpretGrowthInputSchema>) => {
      try {
        const result = await interpret({
          ...input,
          standard: resolveAssessStandard(input.standard, input.ageMonths)
        })

        return toJsonResult(result)
      } catch (error) {
        return toErrorResult(error)
      }
    }
  }
]

export function registerTools(server: McpServer): void {
  for (const tool of tools) {
    server.registerTool(
      tool.name,
      {
        description: tool.description,
        inputSchema: tool.inputSchema
      },
      tool.handler
    )
  }
}
