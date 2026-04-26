#!/usr/bin/env python3
import argparse
import csv
import re
from dataclasses import dataclass
from pathlib import Path

import pdfplumber


PDF_PATH = Path("data/raw/nhc/nhc-ws-t-423-2022.pdf")
CSV_DIR = Path("data/csv/nhc")
CSV_HEADER = ["x", "neg3", "neg2", "neg1", "median", "pos1", "pos2", "pos3"]


@dataclass(frozen=True)
class TableConfig:
    filename: str
    title: str
    x_kind: str


TABLES = [
    TableConfig("weight-for-age-male.csv", "表B.1 7岁以下男童年龄别体重的标准差数值", "age"),
    TableConfig("weight-for-age-female.csv", "表B.2 7岁以下女童年龄别体重的标准差数值", "age"),
    TableConfig("height-for-age-male.csv", "表B.3 7岁以下男童年龄别身长/身高的标准差数值", "age"),
    TableConfig("height-for-age-female.csv", "表B.4 7岁以下女童年龄别身长/身高的标准差数值", "age"),
    TableConfig("weight-for-length-male.csv", "表B.5 0～2岁以下男童身长别体重的标准差数值", "measure"),
    TableConfig("weight-for-length-female.csv", "表B.6 0～2岁以下女童身长别体重的标准差数值", "measure"),
    TableConfig("weight-for-height-male.csv", "表B.7 2～7岁以下男童身高别体重的标准差数值", "measure"),
    TableConfig("weight-for-height-female.csv", "表B.8 2～7岁以下女童身高别体重的标准差数值", "measure"),
    TableConfig("bmi-for-age-male.csv", "表B.9 7岁以下男童年龄别BMI的标准差数值", "age"),
    TableConfig("bmi-for-age-female.csv", "表B.10 7岁以下女童年龄别BMI的标准差数值", "age"),
    TableConfig("head-for-age-male.csv", "表B.11 0～3岁男童年龄别头围的标准差数值", "age"),
    TableConfig("head-for-age-female.csv", "表B.12 0～3岁女童年龄别头围的标准差数值", "age"),
]

SKIP_LINE_RE = [
    re.compile(r"^WS/T "),
    re.compile(r"^表B\.\d+"),
    re.compile(r"^单位"),
    re.compile(r"^注："),
    re.compile(r"^年龄 .*SD"),
    re.compile(r"^-3SD "),
    re.compile(r"^身长$"),
    re.compile(r"^身高$"),
    re.compile(r"^cm$"),
    re.compile(r"^_+$"),
]

NUM_RE = r"-?\d+(?:\.\d+)?"
AGE_ROW_RE = re.compile(
    rf"^(?P<x>\d+岁\d+月|\d+岁|\d+月)\s+"
    rf"(?P<neg3>{NUM_RE})\s+(?P<neg2>{NUM_RE})\s+(?P<neg1>{NUM_RE})\s+"
    rf"(?P<median>{NUM_RE})\s+(?P<pos1>{NUM_RE})\s+(?P<pos2>{NUM_RE})\s+(?P<pos3>{NUM_RE})"
)
MEASURE_ROW_RE = re.compile(
    rf"^(?P<x>\d+(?:\.\d+)?)\s+"
    rf"(?P<neg3>{NUM_RE})\s+(?P<neg2>{NUM_RE})\s+(?P<neg1>{NUM_RE})\s+"
    rf"(?P<median>{NUM_RE})\s+(?P<pos1>{NUM_RE})\s+(?P<pos2>{NUM_RE})\s+(?P<pos3>{NUM_RE})"
)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Extract Appendix B SD tables from NHC WS/T 423-2022.")
    parser.add_argument("--verify", action="store_true", help="Re-read generated CSVs and validate them.")
    return parser.parse_args()


def age_to_months(label: str) -> int:
    match = re.fullmatch(r"(?:(\d+)岁)?(?:(\d+)月)?", label)
    if not match:
        raise ValueError(f"Unrecognized age label: {label}")
    years = int(match.group(1) or 0)
    months = int(match.group(2) or 0)
    return years * 12 + months


def normalize_number(value: str) -> str:
    if "." in value:
        value = value.rstrip("0").rstrip(".")
    return value


def normalize_x(label: str, x_kind: str) -> str:
    if x_kind == "age":
        return str(age_to_months(label))
    return normalize_number(label)


def locate_titles(page_lines: list[list[str]]) -> dict[str, tuple[int, int]]:
    locations: dict[str, tuple[int, int]] = {}
    for table in TABLES:
        for page_index, lines in enumerate(page_lines):
            for line_index, line in enumerate(lines):
                if table.title in line:
                    locations[table.title] = (page_index, line_index)
                    break
            if table.title in locations:
                break
        if table.title not in locations:
            raise ValueError(f"Could not find table title in PDF: {table.title}")
    return locations


def collect_table_lines(
    page_lines: list[list[str]],
    title_locations: dict[str, tuple[int, int]],
    table: TableConfig,
    next_table: TableConfig | None,
) -> tuple[list[str], tuple[int, int]]:
    start_page, start_line = title_locations[table.title]
    if next_table is None:
        end_page = len(page_lines) - 1
        end_line = len(page_lines[end_page])
    else:
        end_page, end_line = title_locations[next_table.title]

    lines: list[str] = []
    for page_index in range(start_page, end_page + 1):
        line_start = start_line if page_index == start_page else 0
        line_end = end_line if page_index == end_page and next_table is not None else len(page_lines[page_index])
        page_slice = page_lines[page_index][line_start:line_end]
        if line_end == len(page_lines[page_index]):
            while page_slice and re.fullmatch(r"\d{1,2}", page_slice[-1].strip()):
                page_slice = page_slice[:-1]
            while page_slice and re.fullmatch(r"_+", page_slice[-1].strip()):
                page_slice = page_slice[:-1]
        lines.extend(page_slice)
    return lines, (start_page + 1, end_page + 1)


def should_skip_line(lines: list[str], index: int) -> bool:
    line = re.sub(r"\s+", " ", lines[index].strip())
    if not line:
        return True
    for pattern in SKIP_LINE_RE:
        if pattern.match(line):
            return True

    prev_line = re.sub(r"\s+", " ", lines[index - 1].strip()) if index > 0 else ""
    next_line = re.sub(r"\s+", " ", lines[index + 1].strip()) if index + 1 < len(lines) else ""
    if re.fullmatch(r"\d{1,2}", line) and (re.fullmatch(r"_+", prev_line) or re.fullmatch(r"_+", next_line)):
        return True
    return False


def parse_table_rows(raw_lines: list[str], table: TableConfig, page_range: tuple[int, int]) -> list[list[str]]:
    row_re = AGE_ROW_RE if table.x_kind == "age" else MEASURE_ROW_RE
    filtered_lines = [
        re.sub(r"\s+", " ", raw_lines[index].strip())
        for index in range(len(raw_lines))
        if not should_skip_line(raw_lines, index)
    ]

    rows: list[list[str]] = []
    buffer = ""
    for line in filtered_lines:
        buffer = f"{buffer} {line}".strip() if buffer else line
        while buffer:
            match = row_re.match(buffer)
            if not match:
                break
            row = [normalize_x(match.group("x"), table.x_kind)]
            row.extend(normalize_number(match.group(column)) for column in CSV_HEADER[1:])
            rows.append(row)
            buffer = buffer[match.end() :].strip()

    if buffer.strip():
        raise ValueError(
            f"Unparsed content for {table.filename} on PDF pages {page_range[0]}-{page_range[1]}: {buffer[:160]}"
        )

    if not rows:
        raise ValueError(f"No rows parsed for {table.filename} on PDF pages {page_range[0]}-{page_range[1]}")
    return rows


def validate_rows(rows: list[list[str]], table: TableConfig) -> None:
    previous_x: float | None = None
    for row in rows:
        x_value = float(row[0])
        if previous_x is not None and x_value <= previous_x:
            raise ValueError(f"x values are not strictly increasing in {table.filename}: {row[0]}")
        previous_x = x_value

        numeric_values = [float(value) for value in row[1:]]
        if any(left > right for left, right in zip(numeric_values, numeric_values[1:])):
            raise ValueError(f"SD values are not monotonic in {table.filename}: {row}")


def write_csv(rows: list[list[str]], output_path: Path) -> None:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.writer(handle)
        writer.writerow(CSV_HEADER)
        writer.writerows(rows)


def read_csv_rows(path: Path) -> list[list[str]]:
    with path.open("r", encoding="utf-8", newline="") as handle:
        reader = csv.reader(handle)
        header = next(reader, None)
        if header != CSV_HEADER:
            raise ValueError(f"Unexpected CSV header in {path}: {header}")
        return [row for row in reader]


def summarize(rows: list[list[str]]) -> str:
    first_x = normalize_number(rows[0][0])
    last_x = normalize_number(rows[-1][0])
    return f"{len(rows)} rows, x={first_x}..{last_x}"


def extract() -> list[tuple[TableConfig, list[list[str]]]]:
    with pdfplumber.open(PDF_PATH) as pdf:
        page_lines = [(page.extract_text() or "").splitlines() for page in pdf.pages]

    title_locations = locate_titles(page_lines)
    results: list[tuple[TableConfig, list[list[str]]]] = []
    for index, table in enumerate(TABLES):
        next_table = TABLES[index + 1] if index + 1 < len(TABLES) else None
        raw_lines, page_range = collect_table_lines(page_lines, title_locations, table, next_table)
        rows = parse_table_rows(raw_lines, table, page_range)
        validate_rows(rows, table)
        write_csv(rows, CSV_DIR / table.filename)
        print(f"{table.filename}: {summarize(rows)}")
        results.append((table, rows))
    return results


def verify() -> list[tuple[TableConfig, list[list[str]]]]:
    results: list[tuple[TableConfig, list[list[str]]]] = []
    for table in TABLES:
        path = CSV_DIR / table.filename
        if not path.exists():
            raise FileNotFoundError(f"Missing CSV for verification: {path}")
        rows = read_csv_rows(path)
        validate_rows(rows, table)
        print(f"verified {table.filename}: {summarize(rows)}")
        results.append((table, rows))
    return results


def main() -> None:
    args = parse_args()
    if args.verify:
        verify()
    else:
        extract()


if __name__ == "__main__":
    main()
