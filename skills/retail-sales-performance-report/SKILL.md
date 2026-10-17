---
name: retail-sales-performance-report
description: Export a user-selected date range from the Power BI Retail Sales Item Summary report and create a polished Excel management report with executive KPIs, category and product drivers, margin and unit analysis, contribution-to-change, warnings, ranked winners and losers, management actions, and color-coded accessible formatting. Use when the user asks for a retail sales performance report, sales review by date range, Power BI merchandise analysis, category or SKU performance, or a management-ready Excel report from a Power BI Retail Sales export.
---

# Retail Sales Performance Report

Create one management-ready Excel workbook from the Power BI Retail Sales export.

## Required inputs

- Require a start date and end date. Ask one short question only if either is ambiguous.
- Default to Power BI's prior-year comparison. When the export uses fiscal LY measures, label the comparison as fiscal-aligned and derive display dates with a 364-day offset unless the report states exact dates.
- Default the store label to `Pet Supplies Plus #212 — Battle Creek, MI` when the signed-in account or export confirms Store 0212.

## Workflow

1. Read [references/report-format.md](references/report-format.md) before generating a workbook.
2. Use the Browser skill and the user's signed-in Power BI session. Keep the workflow read-only except for the download the user requested.
3. Open `Retail Sales`, select `Item Summary`, set the exact current dates, retain the requested retail-type filters, and verify the visible date labels.
4. Select the product-level Item View or the export view that includes Department, SubDepartment, Class, SubClass, ItemId-Desc, current results, and LY results.
5. Export the data to Excel. Do not alter or overwrite the downloaded source export.
6. Load workspace dependencies. Use the bundled Python runtime for source extraction and `@oai/artifact-tool` for workbook authoring.
7. Run `scripts/extract_powerbi_export.py` to classify hierarchy levels and create normalized JSON. Never aggregate mixed hierarchy levels.
8. Run `scripts/build_report.mjs` to create the final workbook. Pass the exact dates, store, source view, and output path.
9. Inspect key ranges, scan formula errors, render every sheet, and correct material visual defects.
10. Deliver only the final `.xlsx` unless the user requests supporting files.

## Commands

Create a writable run directory and a `node_modules` junction to the dependency path returned by `load_workspace_dependencies`.
Copy `scripts/build_report.mjs` into that run directory before executing it; Node resolves the bundled `@oai/artifact-tool` dependency from the script's directory.

```powershell
python scripts/extract_powerbi_export.py `
  --input <powerbi-export.xlsx> `
  --json <normalized.json> `
  --start YYYY-MM-DD `
  --end YYYY-MM-DD `
  --comparison-start YYYY-MM-DD `
  --comparison-end YYYY-MM-DD `
  --store "Pet Supplies Plus #212 — Battle Creek, MI"

Copy-Item scripts/build_report.mjs <run-directory>\build_report.mjs

node <run-directory>\build_report.mjs `
  --input-json <normalized.json> `
  --output <retail-sales-performance.xlsx> `
  --preview-dir <preview-directory>
```

## Integrity requirements

- Use the grand-total row only for overall KPIs.
- Use department rows only for department analysis, subdepartment rows only for subdepartment analysis, and product rows only for SKU analysis.
- Treat Movement as units sold, never inventory on hand.
- Derive comparison units as `Movement - YoY Movement` when an explicit LY Movement field is absent.
- Derive comparison margin rate as `Current Margin % - YoY Net Margin %` when the YoY field is a percentage-point change.
- Reconcile department sales to the grand total and product sales to the grand total. Report material differences.
- Never claim an out-of-stock without inventory or availability data.
- Preserve identifiers as text and metrics as numeric cells.
- Express margin-rate changes in percentage points.

## Completion standard

Do not finish until the workbook contains the five required sheets, formulas have no obvious errors, rankings use materiality filters, arrows and colors agree, totals reconcile or are disclosed, every sheet has been rendered, and the Executive Dashboard is readable at normal zoom.
