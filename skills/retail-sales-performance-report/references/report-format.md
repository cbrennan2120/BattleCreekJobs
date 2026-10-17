# Retail sales report format

## Contents

1. Workbook structure
2. Classification and materiality
3. Required analysis
4. Visual system
5. Quality control

## Workbook structure

Create exactly these primary sheets in this order:

1. `Executive Dashboard`
2. `Category Performance`
3. `Product Winners & Losers`
4. `Product Detail`
5. `Data Notes`

The dashboard must be understandable in under two minutes and contain no more than eight KPI cards, two charts, six takeaways, ten exceptions, and five actions.

## Classification and materiality

Use a flat threshold of ±0.5% unless the user overrides it.

- Strong Growth: sales change above 5% and material dollar impact.
- Growth: sales change from 0.5% through 5%.
- Stable: sales change from -0.5% through 0.5%.
- Watch: sales change from -5% through -0.5%.
- Material Decline: sales change below -5% and material dollar impact.
- Margin Concern: sales are favorable while margin dollars fall or margin rate erodes by more than 1 percentage point.

Default product materiality: at least $100 in current or comparison sales, or at least 3 units in either period.

Default category materiality: at least $500 in current or comparison sales, or at least 0.25% of total sales.

Diagnose sales and units together:

- Volume-Led Growth: sales and units increase.
- Price/Mix-Led Growth: sales increase while units are flat or down.
- Volume Decline: sales and units decrease.
- Price/Mix Pressure: units increase while sales are flat or down.
- Stable: both are within the neutral threshold.
- Mixed Result: sales, units, and margin conflict.

## Required analysis

Dashboard KPIs: Net Sales, Sales $ Change, Sales % Change, Units Sold, Unit Change, Net Margin $, Net Margin %, and Margin Rate Change.

Include:

- Department performance table.
- Top three category gains and declines.
- Top five product gains and declines.
- Department sales-change chart.
- Largest positive and negative category-contribution chart.
- Four to six quantified takeaways.
- Exceptions Requiring Attention.
- Three to five data-supported management actions.

Category Performance must show hierarchy level, category, current and comparison sales, sales change, current and comparison units, unit change, current and comparison margin, margin change, current and comparison margin rate, margin-rate change in percentage points, sales share, contribution to total change, diagnosis, status, and management note.

Product Winners & Losers must include separate ranked sections for sales-dollar gains, sales-dollar declines, unit gains, unit declines, margin-dollar opportunities, and high-sales products with deteriorating margin rate. Apply materiality before ranking percentage changes.

Product Detail must contain every product row, separate Item ID and description, preserve the full hierarchy, and include formula-driven differences and ratios.

Data Notes must record dates, source view, applied filters, comparison method, thresholds, excluded hierarchy rows, definitions, reconciliation, missing fields, and warnings.

## Visual system

Use a professional retail-management style and these colors consistently:

- Header navy `#1F4E78` with white text.
- Informational blue `#D9EAF7`.
- Strong favorable `#548235` with `▲`.
- Favorable `#E2F0D9` with `▲`.
- Stable `#E7E6E6` with `→`.
- Unfavorable `#FCE4D6` with `▼`.
- Material unfavorable `#C00000` with `▼` and white text.
- Warning `#FFF2CC` with `⚠`.
- Body text `#1F1F1F`.

Never use color alone. Include an arrow or warning, sign, value, and status label. Use pale fills for tables, alternating row shading, restrained borders, frozen panes, filters, readable widths, and explicit number formats.

Formats:

- Currency: `$#,##0;-$#,##0`
- Currency variance: `+$#,##0;-$#,##0;$0`
- Percent: `0.0%`
- Percentage-point change: `+0.0 "pp";-0.0 "pp";0.0 "pp"`
- Units: `#,##0`
- Unit variance: `+#,##0;-#,##0;0`

Add the legend `▲ Favorable   ▼ Unfavorable   → Stable   ⚠ Warning or mixed result`.

## Quality control

Before delivery:

1. Confirm current and comparison dates.
2. Reconcile department totals and product totals to the grand total without double-counting hierarchy subtotals.
3. Confirm rankings use the correct comparison and materiality thresholds.
4. Scan formulas for `#REF!`, `#DIV/0!`, `#VALUE!`, `#NAME?`, and `#N/A`.
5. Confirm every arrow and fill agrees with the underlying result.
6. Confirm margin-rate differences use percentage points.
7. Render and inspect every sheet.
8. Verify chart sources, labels, units, and placement.
9. Confirm the dashboard is readable at normal zoom and in grayscale.
