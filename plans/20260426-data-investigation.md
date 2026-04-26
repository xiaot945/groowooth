# NHC + WHO 数据源调研

**Date**: 2026-04-26
**Status**: ✅ NHC extraction complete (2026-04-26)
**Outcome**: 全部数据源就位；NHC 计算路径与 WHO 不同（见下）

## Appendix B Extraction Summary

| filename | row count | x range |
| --- | ---: | --- |
| `weight-for-age-male.csv` | 44 | 0..81 |
| `weight-for-age-female.csv` | 44 | 0..81 |
| `height-for-age-male.csv` | 44 | 0..81 |
| `height-for-age-female.csv` | 44 | 0..81 |
| `weight-for-length-male.csv` | 56 | 45..100 |
| `weight-for-length-female.csv` | 56 | 45..100 |
| `weight-for-height-male.csv` | 56 | 75..130 |
| `weight-for-height-female.csv` | 56 | 75..130 |
| `bmi-for-age-male.csv` | 44 | 0..81 |
| `bmi-for-age-female.csv` | 44 | 0..81 |
| `head-for-age-male.csv` | 29 | 0..36 |
| `head-for-age-female.csv` | 29 | 0..36 |

## 数据源清单

### WHO 2006（0-5 岁）— ✓ 直接可用
- 来源：`/tmp/groowooth-research/anthro/data-raw/growthstandards/*.txt`
  - `lenanthro.txt` (length/height-for-age, 3655 行)
  - `weianthro.txt` (weight-for-age, 3655 行)
  - `bmianthro.txt` (BMI-for-age, 3655 行)
  - `hcanthro.txt` (head-for-age, 3655 行)
  - `wflanthro.txt` (weight-for-length, 1303 行)
  - `wfhanthro.txt` (weight-for-height, 1103 行)
- 格式：tab-separated，每行 `sex(1=M,2=F) age(days/months/cm) L M S [loh]`
- 来源仓库 GPL，但**数据本身是 WHO 公有**，可自由打包

### WHO 2007（5-19 岁）— ✓ 直接可用
- 来源：`/tmp/groowooth-research/pygrowthstandards/data/raw/who-growth-reference-data/*.csv`
  - `who-growth-height-{m,f}.csv`
  - `who-growth-weight-{m,f}.csv`（仅到 10 岁）
  - `who-growth-body_mass_index-{m,f}.csv`
- 格式：CSV，含 L/M/S 列
- 上游 MIT（pygrowthstandards），数据公有

### NHC WS/T 423-2022（0-7 岁）— ⚠️ 需要不同的计算路径
- 来源：`/data/code/groowooth/data/raw/nhc/nhc-ws-t-423-2022.pdf` (官方 nhc.gov.cn 下载)
- 包含 12 张表（6 个 indicator × 男/女）：
  - Appendix A 百分位表：P3, P10, P25, P50, P75, P90, P97
  - Appendix B 标准差表：-3SD, -2SD, -1SD, 中位数, +1SD, +2SD, +3SD
- **关键发现：PDF 中无 L/M/S 三参数**——只有 quantile 点

## 计算路径决策

**WHO（有 L/M/S）→ 精确 Box-Cox 公式**：
```
value = M * (1 + L*S*z)^(1/L)   when L ≠ 0
value = M * exp(S*z)             when L = 0
z = ((value/M)^L - 1) / (L*S)    inverse, when L ≠ 0
z = ln(value/M) / S              inverse, when L = 0
```

**NHC（无 L/M/S）→ v1 用 SD 表分段线性内插**：
- 输入 (age, sex, indicator, value)
- 在 SD 表中找相邻两个 SD 点 (z_lo, value_lo) 和 (z_hi, value_hi)
- 在两点间线性内插：`z = z_lo + (value - value_lo) / (value_hi - value_lo)`
- 优势：在 |z| ≤ 2 的正常区间精度足够（家长关心的范围）；与官方表 100% 对齐
- 局限：在 z > 3 或 z < -3 区间需要外推（v1 直接 clamp 或返回"超出 ±3SD"）
- v2 升级路径：用 7 个 SD 点最小二乘拟合 L, M, S

## NHC PDF 抠表方案

**pdfplumber 文本抽取已验证可行**——表格是规则的空格分隔，行结构清晰：
```
年龄    P3    P10   P25   P50   P75   P90   P97
0月    2.8   3.0   3.2   3.5   3.7   4.0   4.2
1月    3.7   3.9   4.2   4.6   4.9   5.2   5.6
```

页面分布：
- p7-22：Appendix A 百分位表（12 张）
- p25-40：Appendix B SD 表（12 张）

抠表脚本（`scripts/extract-nhc.py`）伪代码：
```python
for page_num in nhc_table_pages:
    page = pdf.pages[page_num - 1]
    text = page.extract_text()
    rows = parse_table_rows(text)  # 处理 "0月" / "1岁2月" 等中文年龄
    age_months = parse_chinese_age(row[0])
    values = [float(x) for x in row[1:]]
    write_csv(...)
```

**人工核校**：随机抽 10 行，与 PDF 原表对照。

## 已知约束 / 风险

1. **NHC 内插法的精度边界**：v1 在 |z| > 2 区间不如 WHO 精确。文档明确标注；UI 在 |z| > 2 时显示"超出常见范围，建议咨询医生"。
2. **儿研所李辉团队是否发布过 L/M/S？** 学术论文可能有；v2 可深挖。v1 用 PDF 公开数据已合规。
3. **WHO 2006 中 wfl/wfh 维度不是 age**：是 length/height。代码需把 indicator 抽象成 `<x_var, indicator>` 而不是固定 age。

## 决策

**v1 实现两条计算路径并存**：
- `LmsBased`: WHO 2006/2007 走 Box-Cox 公式
- `SdTableBased`: NHC 2022 走分段线性内插

`assess()` 根据 `standard` 参数派发。`@groowooth/core` 内部封装两条路径，对外是统一接口。

## Next

→ Bootstrap monorepo + 实现 core LMS（WHO）+ SdTable（NHC）双路径，由 codex 接手。
