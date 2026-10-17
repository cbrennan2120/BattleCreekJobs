#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { SpreadsheetFile, Workbook } from "@oai/artifact-tool";

function parseArgs(argv) {
  const result = {};
  for (let i = 2; i < argv.length; i += 2) {
    const key = argv[i]?.replace(/^--/, "");
    result[key] = argv[i + 1];
  }
  if (!result["input-json"] || !result.output || !result["preview-dir"]) {
    throw new Error("Usage: build_report.mjs --input-json normalized.json --output report.xlsx --preview-dir previews");
  }
  return result;
}

const options = parseArgs(process.argv);
const payload = JSON.parse(await fs.readFile(options["input-json"], "utf8"));
const meta = payload.metadata;
const records = payload.records;
const grand = records.find((row) => row.kind === "grand_total");
const departments = records.filter((row) => row.kind === "department");
const categories = records.filter((row) => ["department", "subdepartment", "class"].includes(row.kind));
const products = records.filter((row) => row.kind === "product");
if (!grand) throw new Error("Normalized data has no grand total");

const FLAT = 0.005;
const PRODUCT_DOLLARS = 100;
const PRODUCT_UNITS = 3;
const CATEGORY_DOLLARS = 500;
const CATEGORY_SHARE = 0.0025;
const EPSILON = 0.01;

const COLORS = {
  navy: "#1F4E78", blue: "#D9EAF7", strongGreen: "#548235", lightGreen: "#E2F0D9",
  strongRed: "#C00000", lightRed: "#FCE4D6", amber: "#FFF2CC", gray: "#E7E6E6",
  text: "#1F1F1F", white: "#FFFFFF", line: "#C9D2DA", stripe: "#F7F9FB",
};
const NF = {
  currency: '$#,##0;-$#,##0', currencyVar: '+$#,##0;-$#,##0;$0', pct: '0.0%',
  pp: '+0.0 "pp";-0.0 "pp";0.0 "pp"', units: '#,##0', unitsVar: '+#,##0;-#,##0;0',
};

const num = (value) => Number.isFinite(Number(value)) ? Number(value) : 0;
const change = (row) => num(row.currentSales) - num(row.comparisonSales);
const salesPct = (row) => num(row.comparisonSales) === 0 ? (num(row.currentSales) === 0 ? 0 : 1) : change(row) / Math.abs(num(row.comparisonSales));
const unitChange = (row) => num(row.currentUnits) - num(row.comparisonUnits);
const marginChange = (row) => num(row.currentMargin) - num(row.comparisonMargin);
const marginRateChange = (row) => num(row.currentMarginPct) - num(row.comparisonMarginPct);
const totalChange = change(grand);
const share = (row) => num(grand.currentSales) ? num(row.currentSales) / num(grand.currentSales) : 0;
const contribution = (row) => Math.abs(totalChange) < EPSILON ? null : change(row) / totalChange;
const money = (value) => `${value < 0 ? "-" : value > 0 ? "+" : ""}$${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const integer = (value) => `${value < 0 ? "-" : value > 0 ? "+" : ""}${Math.abs(value).toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
const percent = (value) => `${value < 0 ? "-" : value > 0 ? "+" : ""}${Math.abs(value * 100).toFixed(1)}%`;
const pp = (value) => `${value < 0 ? "-" : value > 0 ? "+" : ""}${Math.abs(value * 100).toFixed(1)} pp`;
const arrow = (value, threshold = FLAT) => value > threshold ? "▲" : value < -threshold ? "▼" : "→";

function categoryName(row) {
  if (row.kind === "department") return row.department;
  if (row.kind === "subdepartment") return `${row.department} › ${row.subdepartment}`;
  return `${row.department} › ${row.subdepartment} › ${row.class}`;
}

function status(row, dollars = CATEGORY_DOLLARS) {
  const pct = salesPct(row);
  const delta = change(row);
  if (delta > 0 && (marginChange(row) < 0 || marginRateChange(row) < -0.01)) return "⚠ Margin Concern";
  if (pct > 0.05 && Math.abs(delta) >= dollars) return "▲ Strong Growth";
  if (pct > FLAT) return "▲ Growth";
  if (pct >= -FLAT) return "→ Stable";
  if (pct < -0.05 && Math.abs(delta) >= dollars) return "▼ Material Decline";
  return "▼ Watch";
}

function diagnosis(row) {
  const s = change(row), u = unitChange(row);
  const salesNeutral = Math.abs(salesPct(row)) <= FLAT;
  const unitPct = num(row.comparisonUnits) ? u / Math.abs(num(row.comparisonUnits)) : (u === 0 ? 0 : 1);
  if (salesNeutral && Math.abs(unitPct) <= FLAT) return "Stable";
  if (s > 0 && u > 0) return "Volume-Led Growth";
  if (s > 0 && u <= 0) return "Price/Mix-Led Growth";
  if (s < 0 && u < 0) return "Volume Decline";
  if (s <= 0 && u > 0) return "Price/Mix Pressure";
  return "Mixed Result";
}

function managementNote(row) {
  const name = row.kind === "product" ? `${row.itemId} ${row.description}` : categoryName(row);
  if (change(row) < 0 && unitChange(row) < 0) return `Review availability, placement, and assortment for ${name}; sales ${money(change(row))} and units ${integer(unitChange(row))}.`;
  if (change(row) > 0 && marginRateChange(row) < -0.01) return `${name} added ${money(change(row))}, but margin rate changed ${pp(marginRateChange(row))}; review price and promotion mix.`;
  if (change(row) > 0 && unitChange(row) > 0) return `Support ${name}; sales ${money(change(row))} with ${integer(unitChange(row))} more units.`;
  if (change(row) > 0 && unitChange(row) <= 0) return `${name} grew ${money(change(row))} while units changed ${integer(unitChange(row))}; validate price/mix sustainability.`;
  return `${name} is stable; maintain execution and monitor material changes.`;
}

const productEligible = (row) => Math.max(Math.abs(num(row.currentSales)), Math.abs(num(row.comparisonSales))) >= PRODUCT_DOLLARS || Math.max(Math.abs(num(row.currentUnits)), Math.abs(num(row.comparisonUnits))) >= PRODUCT_UNITS;
const categoryEligible = (row) => Math.max(Math.abs(num(row.currentSales)), Math.abs(num(row.comparisonSales))) >= CATEGORY_DOLLARS || share(row) >= CATEGORY_SHARE;
const eligibleProducts = products.filter(productEligible);
const eligibleCategories = categories.filter(categoryEligible);
const sorted = (rows, fn, descending = true) => [...rows].sort((a, b) => descending ? fn(b) - fn(a) : fn(a) - fn(b));
const topProductGains = sorted(eligibleProducts.filter((r) => change(r) > 0), change).slice(0, 15);
const topProductDeclines = sorted(eligibleProducts.filter((r) => change(r) < 0), change, false).slice(0, 15);
const topUnitGains = sorted(eligibleProducts.filter((r) => unitChange(r) > 0), unitChange).slice(0, 10);
const topUnitDeclines = sorted(eligibleProducts.filter((r) => unitChange(r) < 0), unitChange, false).slice(0, 10);
const marginOpportunities = sorted(eligibleProducts.filter((r) => marginChange(r) < 0), marginChange, false).slice(0, 10);
const highSalesMarginConcern = sorted(eligibleProducts.filter((r) => num(r.currentSales) >= PRODUCT_DOLLARS && (marginChange(r) < 0 || marginRateChange(r) < -0.01)), (r) => num(r.currentSales)).slice(0, 10);
const categoryGains = sorted(eligibleCategories.filter((r) => change(r) > 0), change);
const categoryDeclines = sorted(eligibleCategories.filter((r) => change(r) < 0), change, false);

const departmentReconciliation = departments.reduce((sum, row) => sum + num(row.currentSales), 0) - num(grand.currentSales);
const productReconciliation = products.reduce((sum, row) => sum + num(row.currentSales), 0) - num(grand.currentSales);
const reconciliationTolerance = Math.max(1, Math.abs(num(grand.currentSales)) * 0.001);

const biggestDepartment = sorted(departments, (r) => Math.abs(change(r)))[0];
const biggestGain = categoryGains[0];
const biggestDecline = categoryDeclines[0];
const biggestProductGain = topProductGains[0];
const biggestProductDecline = topProductDeclines[0];

const takeaways = [
  `${arrow(salesPct(grand))} Overall sales were ${money(change(grand))} (${percent(salesPct(grand))}) versus the Power BI prior-year comparison; units changed ${integer(unitChange(grand))}.`,
  `${arrow(marginChange(grand), 0)} Net margin dollars changed ${money(marginChange(grand))}; margin rate moved ${pp(marginRateChange(grand))} to ${(num(grand.currentMarginPct) * 100).toFixed(1)}%.`,
  biggestDepartment ? `${arrow(salesPct(biggestDepartment))} ${biggestDepartment.department} had the largest department impact: ${money(change(biggestDepartment))} (${percent(salesPct(biggestDepartment))}), with units ${integer(unitChange(biggestDepartment))}.` : "",
  biggestGain ? `▲ Largest category gain: ${categoryName(biggestGain)} added ${money(change(biggestGain))} and ${integer(unitChange(biggestGain))} units.` : "",
  biggestDecline ? `▼ Largest category decline: ${categoryName(biggestDecline)} lost ${money(change(biggestDecline))} and ${integer(unitChange(biggestDecline))} units.` : "",
  biggestProductDecline ? `⚠ Largest product decline: ${biggestProductDecline.itemId} ${biggestProductDecline.description} changed ${money(change(biggestProductDecline))} with units ${integer(unitChange(biggestProductDecline))}.` : "",
].filter(Boolean).slice(0, 6);

const exceptionCandidates = [];
for (const row of eligibleProducts) {
  if (change(row) > 0 && marginChange(row) < 0) exceptionCandidates.push({ impact: Math.abs(marginChange(row)), text: `⚠ ${row.itemId}: sales ${money(change(row))}, but margin dollars ${money(marginChange(row))}.` });
  else if (change(row) > 0 && marginRateChange(row) < -0.01) exceptionCandidates.push({ impact: Math.abs(change(row)), text: `⚠ ${row.itemId}: sales ${money(change(row))}, margin rate ${pp(marginRateChange(row))}.` });
  else if (num(row.comparisonSales) >= PRODUCT_DOLLARS && num(row.currentSales) === 0) exceptionCandidates.push({ impact: Math.abs(change(row)), text: `⚠ ${row.itemId}: prior sales $${num(row.comparisonSales).toLocaleString("en-US", { maximumFractionDigits: 0 })}, no current sales; investigate availability.` });
  else if (num(row.currentSales) < 0 || num(row.currentUnits) < 0) exceptionCandidates.push({ impact: Math.abs(num(row.currentSales)), text: `⚠ ${row.itemId}: negative sales or movement may reflect returns or corrections.` });
}
if (Math.abs(departmentReconciliation) > reconciliationTolerance) exceptionCandidates.push({ impact: 1e12, text: `⚠ Department totals differ from grand total by ${money(departmentReconciliation)}.` });
if (Math.abs(productReconciliation) > reconciliationTolerance) exceptionCandidates.push({ impact: 1e12 - 1, text: `⚠ Product rows differ from grand total by ${money(productReconciliation)}.` });
const exceptions = exceptionCandidates.sort((a, b) => b.impact - a.impact).slice(0, 10).map((x) => x.text);

const actions = [];
if (biggestDecline) actions.push(`Investigate ${categoryName(biggestDecline)}. Sales changed ${money(change(biggestDecline))} (${percent(salesPct(biggestDecline))}) and units ${integer(unitChange(biggestDecline))}; check availability, shelf execution, assortment, and recent promotion changes.`);
if (biggestProductDecline) actions.push(`Review Item ${biggestProductDecline.itemId}. Sales changed ${money(change(biggestProductDecline))} and units ${integer(unitChange(biggestProductDecline))}; confirm on-hand inventory and placement before attributing the decline to demand.`);
if (biggestGain) actions.push(`Support ${categoryName(biggestGain)}. It added ${money(change(biggestGain))} with margin dollars ${money(marginChange(biggestGain))}; protect in-stock position and validate whether additional facings are warranted.`);
if (marginRateChange(grand) < 0) actions.push(`Address margin-rate erosion of ${pp(marginRateChange(grand))}. Review the highest-sales products with deteriorating margin and material scanback changes.`);
else actions.push(`Protect the ${pp(marginRateChange(grand))} margin-rate improvement while correcting the largest avoidable product declines.`);
if (biggestProductGain) actions.push(`Validate sustainability of Item ${biggestProductGain.itemId}, which added ${money(change(biggestProductGain))} and ${integer(unitChange(biggestProductGain))} units; maintain availability without overstocking.`);

const workbook = Workbook.create();
const dashboard = workbook.worksheets.add("Executive Dashboard");
const categorySheet = workbook.worksheets.add("Category Performance");
const winnersSheet = workbook.worksheets.add("Product Winners & Losers");
const detailSheet = workbook.worksheets.add("Product Detail");
const notesSheet = workbook.worksheets.add("Data Notes");
for (const sheet of [dashboard, categorySheet, winnersSheet, detailSheet, notesSheet]) sheet.showGridLines = false;

function titleBand(sheet, range, text) {
  const target = sheet.getRange(range);
  target.merge();
  target.values = [[text]];
  target.format = { fill: COLORS.navy, font: { bold: true, color: COLORS.white, size: 16 }, verticalAlignment: "center", horizontalAlignment: "left" };
}
function sectionHeader(sheet, range, text) {
  const target = sheet.getRange(range);
  target.merge();
  target.values = [[text]];
  target.format = { fill: COLORS.navy, font: { bold: true, color: COLORS.white, size: 11 }, verticalAlignment: "center" };
}
function applyHeader(range) {
  range.format = { fill: COLORS.navy, font: { bold: true, color: COLORS.white }, wrapText: true, verticalAlignment: "center", borders: { preset: "outside", style: "thin", color: COLORS.line } };
}
function styleBody(range) {
  range.format = { font: { color: COLORS.text, size: 9 }, verticalAlignment: "top", borders: { insideHorizontal: { style: "thin", color: "#E3E8ED" } } };
}
function applyStatusFormatting(range) {
  range.conditionalFormats.add("containsText", { text: "Strong Growth", format: { fill: COLORS.strongGreen, font: { color: COLORS.white, bold: true } } });
  range.conditionalFormats.add("containsText", { text: "Growth", format: { fill: COLORS.lightGreen, font: { color: COLORS.text } } });
  range.conditionalFormats.add("containsText", { text: "Stable", format: { fill: COLORS.gray, font: { color: COLORS.text } } });
  range.conditionalFormats.add("containsText", { text: "Watch", format: { fill: COLORS.lightRed, font: { color: COLORS.text } } });
  range.conditionalFormats.add("containsText", { text: "Material Decline", format: { fill: COLORS.strongRed, font: { color: COLORS.white, bold: true } } });
  range.conditionalFormats.add("containsText", { text: "Margin Concern", format: { fill: COLORS.amber, font: { color: COLORS.text, bold: true } } });
}
function applyVarianceFormatting(range) {
  range.conditionalFormats.add("cellIs", { operator: "greaterThan", formula: 0, format: { fill: COLORS.lightGreen, font: { color: "#375623" } } });
  range.conditionalFormats.add("cellIs", { operator: "lessThan", formula: 0, format: { fill: COLORS.lightRed, font: { color: "#9C0006" } } });
  range.conditionalFormats.add("cellIs", { operator: "equal", formula: 0, format: { fill: COLORS.gray, font: { color: COLORS.text } } });
}

// Data Notes and auditable source totals.
titleBand(notesSheet, "A1:H2", "Retail Sales Performance Report — Data Notes");
notesSheet.getRange("A4:B18").values = [
  ["Current date range", `${meta.currentStart} through ${meta.currentEnd}`],
  ["Comparison date range", `${meta.comparisonStart} through ${meta.comparisonEnd}`],
  ["Source view", meta.sourceView],
  ["Comparison method", meta.comparisonMethod],
  ["Flat-performance threshold", FLAT],
  ["Product materiality", `$${PRODUCT_DOLLARS} sales or ${PRODUCT_UNITS} units in either period`],
  ["Category materiality", `$${CATEGORY_DOLLARS} sales or ${(CATEGORY_SHARE * 100).toFixed(2)}% of store sales`],
  ["Source worksheet", meta.sheet],
  ["Applied filters", meta.appliedFilters || "Not provided in export"],
  ["Hierarchy exclusions", `${meta.recordCounts.subclass || 0} subclass totals excluded from category ranking; all parent totals excluded from product analysis`],
  ["Department reconciliation", departmentReconciliation],
  ["Product reconciliation", productReconciliation],
  ["Movement definition", "Units sold; not inventory on hand"],
  ["Margin-rate definition", "Current margin rate minus comparison margin rate, expressed in percentage points"],
  ["Data-quality warning", Math.abs(departmentReconciliation) > reconciliationTolerance || Math.abs(productReconciliation) > reconciliationTolerance ? "Material reconciliation difference detected; see reconciliation rows." : "Grand total, department totals, and product rows reconcile within tolerance."],
];
notesSheet.getRange("A4:A18").format = { fill: COLORS.blue, font: { bold: true, color: COLORS.text }, wrapText: true };
notesSheet.getRange("B4:B18").format = { wrapText: true, font: { color: COLORS.text } };
notesSheet.getRange("B8").format.numberFormat = NF.pct;
notesSheet.getRange("B14:B15").format.numberFormat = NF.currencyVar;
sectionHeader(notesSheet, "A20:B20", "Source totals and formula controls");
notesSheet.getRange("A21:B35").values = [
  ["Current Sales", num(grand.currentSales)], ["Comparison Sales", num(grand.comparisonSales)], ["Sales $ Change", null], ["Sales % Change", null],
  ["Current Units", num(grand.currentUnits)], ["Comparison Units", num(grand.comparisonUnits)], ["Unit Change", null],
  ["Current Margin $", num(grand.currentMargin)], ["Comparison Margin $", num(grand.comparisonMargin)], ["Margin $ Change", null],
  ["Current Margin %", num(grand.currentMarginPct)], ["Comparison Margin %", num(grand.comparisonMarginPct)], ["Margin Rate Change", null],
  ["Current Avg Unit Retail", null], ["Comparison Avg Unit Retail", null],
];
notesSheet.getRange("B23").formulas = [["=B21-B22"]];
notesSheet.getRange("B24").formulas = [["=IF(B22=0,IF(B21=0,0,1),B23/ABS(B22))"]];
notesSheet.getRange("B27").formulas = [["=B25-B26"]];
notesSheet.getRange("B30").formulas = [["=B28-B29"]];
notesSheet.getRange("B33").formulas = [["=(B31-B32)*100"]];
notesSheet.getRange("B34").formulas = [["=IF(B25=0,0,B21/B25)"]];
notesSheet.getRange("B35").formulas = [["=IF(B26=0,0,B22/B26)"]];
notesSheet.getRange("A21:A35").format = { fill: COLORS.stripe, font: { bold: true } };
notesSheet.getRange("B21:B23").format.numberFormat = NF.currency;
notesSheet.getRange("B24").format.numberFormat = NF.pct;
notesSheet.getRange("B25:B27").format.numberFormat = NF.units;
notesSheet.getRange("B28:B30").format.numberFormat = NF.currency;
notesSheet.getRange("B31:B32").format.numberFormat = NF.pct;
notesSheet.getRange("B33").format.numberFormat = NF.pp;
notesSheet.getRange("B34:B35").format.numberFormat = NF.currency;

// Chart helper ranges on Data Notes.
const deptChart = sorted(departments, change, false);
notesSheet.getRange(`D1:E${deptChart.length + 1}`).values = [["Department", "Sales $ Change"], ...deptChart.map((r) => [r.department, change(r)])];
const contributorChart = [...categoryDeclines.slice(0, 5), ...categoryGains.slice(0, 5)].sort((a, b) => change(a) - change(b));
notesSheet.getRange(`G1:H${contributorChart.length + 1}`).values = [["Category", "Sales $ Change"], ...contributorChart.map((r) => [categoryName(r), change(r)])];
applyHeader(notesSheet.getRange("D1:E1"));
applyHeader(notesSheet.getRange("G1:H1"));
notesSheet.getRange(`E2:E${deptChart.length + 1}`).format.numberFormat = NF.currencyVar;
notesSheet.getRange(`H2:H${contributorChart.length + 1}`).format.numberFormat = NF.currencyVar;
notesSheet.freezePanes.freezeRows(2);
notesSheet.getRange("A1:A35").format.columnWidth = 28;
notesSheet.getRange("B1:B35").format.columnWidth = 70;
notesSheet.getRange("D1:D15").format.columnWidth = 22;
notesSheet.getRange("G1:G15").format.columnWidth = 48;

// Executive Dashboard.
titleBand(dashboard, "A1:L2", "Retail Sales Performance Report");
dashboard.getRange("A3:L3").merge();
dashboard.getRange("A3:L3").values = [[`${meta.store}  |  Current: ${meta.currentStart} to ${meta.currentEnd}  |  Comparison: ${meta.comparisonStart} to ${meta.comparisonEnd}  |  Generated: ${new Date().toISOString().slice(0, 10)}`]];
dashboard.getRange("A3:L3").format = { fill: COLORS.blue, font: { bold: true, color: COLORS.text }, verticalAlignment: "center" };

const cardDefs = [
  { range: "A5:C8", label: "Net Sales", current: "='Data Notes'!B21", comparison: `Comparison $${num(grand.comparisonSales).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, variance: `${arrow(salesPct(grand))} ${money(change(grand))} | ${percent(salesPct(grand))}`, favorable: salesPct(grand) },
  { range: "D5:F8", label: "Sales $ Change", current: "='Data Notes'!B23", comparison: "Current less comparison", variance: `${arrow(change(grand), 0)} ${money(change(grand))}`, favorable: change(grand) },
  { range: "G5:I8", label: "Sales % Change", current: "='Data Notes'!B24", comparison: "Neutral band ±0.5%", variance: `${arrow(salesPct(grand))} ${percent(salesPct(grand))}`, favorable: salesPct(grand) },
  { range: "J5:L8", label: "Units Sold", current: "='Data Notes'!B25", comparison: `Comparison ${num(grand.comparisonUnits).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, variance: `${arrow(unitChange(grand), 0)} ${integer(unitChange(grand))}`, favorable: unitChange(grand) },
  { range: "A10:C13", label: "Unit Change", current: "='Data Notes'!B27", comparison: "Current less comparison", variance: `${arrow(unitChange(grand), 0)} ${integer(unitChange(grand))}`, favorable: unitChange(grand) },
  { range: "D10:F13", label: "Net Margin $", current: "='Data Notes'!B28", comparison: `Comparison $${num(grand.comparisonMargin).toLocaleString("en-US", { maximumFractionDigits: 0 })}`, variance: `${arrow(marginChange(grand), 0)} ${money(marginChange(grand))}`, favorable: marginChange(grand) },
  { range: "G10:I13", label: "Net Margin %", current: "='Data Notes'!B31", comparison: `Comparison ${(num(grand.comparisonMarginPct) * 100).toFixed(1)}%`, variance: `${arrow(marginRateChange(grand), 0)} ${pp(marginRateChange(grand))}`, favorable: marginRateChange(grand) },
  { range: "J10:L13", label: "Margin Rate Change", current: "='Data Notes'!B33", comparison: "Percentage-point change", variance: `${arrow(marginRateChange(grand), 0)} ${pp(marginRateChange(grand))}`, favorable: marginRateChange(grand) },
];
for (const card of cardDefs) {
  const match = /([A-Z]+)(\d+):([A-Z]+)(\d+)/.exec(card.range);
  const [, c1, r1s, c2, r2s] = match;
  const r1 = Number(r1s), r2 = Number(r2s);
  const labelRange = dashboard.getRange(`${c1}${r1}:${c2}${r1}`); labelRange.merge(); labelRange.values = [[card.label]];
  const valueRange = dashboard.getRange(`${c1}${r1 + 1}:${c2}${r1 + 1}`); valueRange.merge(); valueRange.formulas = [[card.current]];
  const compRange = dashboard.getRange(`${c1}${r1 + 2}:${c2}${r1 + 2}`); compRange.merge(); compRange.values = [[card.comparison]];
  const varRange = dashboard.getRange(`${c1}${r2}:${c2}${r2}`); varRange.merge(); varRange.values = [[card.variance]];
  const fill = card.favorable > 0 ? COLORS.lightGreen : card.favorable < 0 ? COLORS.lightRed : COLORS.gray;
  dashboard.getRange(card.range).format = { fill, font: { color: COLORS.text }, horizontalAlignment: "center", verticalAlignment: "center", borders: { preset: "outside", style: "medium", color: COLORS.line } };
  labelRange.format.font = { bold: true, color: COLORS.navy, size: 10 };
  valueRange.format.font = { bold: true, color: COLORS.text, size: 16 };
  compRange.format.font = { color: "#5A6570", size: 9 };
  varRange.format.font = { bold: true, color: COLORS.text, size: 9 };
}
dashboard.getRange("A6:F6").format.numberFormat = NF.currency;
dashboard.getRange("G6:I6").format.numberFormat = NF.pct;
dashboard.getRange("J6:L6").format.numberFormat = NF.units;
dashboard.getRange("A11:C11").format.numberFormat = NF.unitsVar;
dashboard.getRange("D11:F11").format.numberFormat = NF.currency;
dashboard.getRange("G11:I11").format.numberFormat = NF.pct;
dashboard.getRange("J11:L11").format.numberFormat = NF.pp;

sectionHeader(dashboard, "A15:L15", "Executive Performance Statement");
dashboard.getRange("A16:L17").merge();
dashboard.getRange("A16:L17").values = [[takeaways[0] + " " + takeaways[1]]];
dashboard.getRange("A16:L17").format = { fill: COLORS.blue, font: { color: COLORS.text, bold: true }, wrapText: true, verticalAlignment: "center" };
sectionHeader(dashboard, "A19:L19", "Executive Takeaways");
dashboard.getRange("A20:L25").values = takeaways.map((text) => [text, ...Array(11).fill(null)]);
for (let row = 20; row <= 25; row++) dashboard.getRange(`A${row}:L${row}`).merge();
dashboard.getRange("A20:L25").format = { wrapText: true, font: { color: COLORS.text, size: 9 }, fill: COLORS.stripe };

sectionHeader(dashboard, "A27:F27", "Department Performance");
dashboard.getRange(`A28:F${28 + departments.length}`).values = [
  ["Department", "Current Sales", "Comparison Sales", "Sales Change", "Sales %", "Status"],
  ...sorted(departments, (r) => Math.abs(change(r))).map((r) => [r.department, num(r.currentSales), num(r.comparisonSales), change(r), salesPct(r), status(r)]),
];
applyHeader(dashboard.getRange("A28:F28"));
styleBody(dashboard.getRange(`A29:F${28 + departments.length}`));
dashboard.getRange(`B29:D${28 + departments.length}`).format.numberFormat = NF.currency;
dashboard.getRange(`E29:E${28 + departments.length}`).format.numberFormat = NF.pct;
applyStatusFormatting(dashboard.getRange(`F29:F${28 + departments.length}`));

sectionHeader(dashboard, "H27:L27", "Top Category Contributors");
const dashboardContributors = [...categoryGains.slice(0, 3), ...categoryDeclines.slice(0, 3)];
dashboard.getRange(`H28:L${28 + dashboardContributors.length}`).values = [
  ["Category", "Sales Change", "Sales %", "Units", "Status"],
  ...dashboardContributors.map((r) => [categoryName(r), change(r), salesPct(r), unitChange(r), status(r)]),
];
applyHeader(dashboard.getRange("H28:L28"));
styleBody(dashboard.getRange(`H29:L${28 + dashboardContributors.length}`));
dashboard.getRange(`I29:I${28 + dashboardContributors.length}`).format.numberFormat = NF.currencyVar;
dashboard.getRange(`J29:J${28 + dashboardContributors.length}`).format.numberFormat = NF.pct;
dashboard.getRange(`K29:K${28 + dashboardContributors.length}`).format.numberFormat = NF.unitsVar;
applyStatusFormatting(dashboard.getRange(`L29:L${28 + dashboardContributors.length}`));

sectionHeader(dashboard, "A39:F39", "Exceptions Requiring Attention");
const paddedExceptions = (exceptions.length ? exceptions : ["→ No material exceptions detected by the default rules."]).slice(0, 10);
dashboard.getRange(`A40:F${39 + paddedExceptions.length}`).values = paddedExceptions.map((text) => [text, null, null, null, null, null]);
for (let row = 40; row <= 39 + paddedExceptions.length; row++) dashboard.getRange(`A${row}:F${row}`).merge();
dashboard.getRange(`A40:F${39 + paddedExceptions.length}`).format = { fill: COLORS.amber, font: { color: COLORS.text }, wrapText: true };
sectionHeader(dashboard, "G39:L39", "Recommended Management Actions");
dashboard.getRange(`G40:L${39 + actions.length}`).values = actions.slice(0, 5).map((text) => [text, null, null, null, null, null]);
for (let row = 40; row <= 39 + Math.min(5, actions.length); row++) dashboard.getRange(`G${row}:L${row}`).merge();
dashboard.getRange(`G40:L${39 + Math.min(5, actions.length)}`).format = { fill: COLORS.lightGreen, font: { color: COLORS.text }, wrapText: true };

const deptChartObject = dashboard.charts.add("bar", { chartType: "bar", title: "Sales Change by Department ($)", hasLegend: false });
const deptSeries = deptChartObject.series.add("Sales $ Change");
deptSeries.categoryFormula = `'Data Notes'!$D$2:$D$${deptChart.length + 1}`;
deptSeries.formula = `'Data Notes'!$E$2:$E$${deptChart.length + 1}`;
deptSeries.fill = COLORS.navy;
deptChartObject.title = "Sales Change by Department ($)";
deptChartObject.hasLegend = false;
deptChartObject.xAxis = { axisType: "textAxis", textStyle: { fontSize: 9 } };
deptChartObject.yAxis = { numberFormatCode: "$#,##0" };
deptChartObject.setPosition("A52", "F69");
const contribChartObject = dashboard.charts.add("bar", { chartType: "bar", title: "Largest Category Contributions ($)", hasLegend: false });
const contribSeries = contribChartObject.series.add("Sales $ Change");
contribSeries.categoryFormula = `'Data Notes'!$G$2:$G$${contributorChart.length + 1}`;
contribSeries.formula = `'Data Notes'!$H$2:$H$${contributorChart.length + 1}`;
contribSeries.fill = "#5B9BD5";
contribChartObject.title = "Largest Category Contributions ($)";
contribChartObject.hasLegend = false;
contribChartObject.xAxis = { axisType: "textAxis", textStyle: { fontSize: 8 } };
contribChartObject.yAxis = { numberFormatCode: "$#,##0" };
contribChartObject.setPosition("G52", "L69");
dashboard.getRange("A71:L71").merge();
dashboard.getRange("A71:L71").values = [["▲ Favorable    ▼ Unfavorable    → Stable    ⚠ Warning or mixed result"]];
dashboard.getRange("A71:L71").format = { fill: COLORS.gray, font: { bold: true, color: COLORS.text }, horizontalAlignment: "center" };
dashboard.freezePanes.freezeRows(3);
dashboard.getRange("A1:L71").format.rowHeight = 20;
dashboard.getRange("A40:L49").format.rowHeight = 36;
for (const column of ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L"]) dashboard.getRange(`${column}1:${column}71`).format.columnWidth = 15;
dashboard.getRange("A1:A71").format.columnWidth = 22;
dashboard.getRange("H1:H71").format.columnWidth = 32;

// Category Performance.
titleBand(categorySheet, "A1:T2", "Category Performance");
categorySheet.getRange("A3:T3").merge();
categorySheet.getRange("A3:T3").values = [[`Current ${meta.currentStart} to ${meta.currentEnd} | Comparison ${meta.comparisonStart} to ${meta.comparisonEnd} | Sorted by hierarchy and absolute sales impact`]];
categorySheet.getRange("A3:T3").format = { fill: COLORS.blue, font: { bold: true, color: COLORS.text } };
const categoryHeaders = ["Level", "Category", "Current Sales", "Comparison Sales", "Sales $ Change", "Sales % Change", "Current Units", "Comparison Units", "Unit Change", "Current Margin $", "Comparison Margin $", "Margin $ Change", "Current Margin %", "Comparison Margin %", "Margin Rate Change", "Share of Sales", "Contribution to Change", "Diagnosis", "Status", "Management Note"];
const categoryOrdered = [...categories].sort((a, b) => {
  const keyA = `${a.department}|${a.subdepartment}|${a.class}`;
  const keyB = `${b.department}|${b.subdepartment}|${b.class}`;
  return keyA.localeCompare(keyB) || Math.abs(change(b)) - Math.abs(change(a));
});
categorySheet.getRange(`A5:T${5 + categoryOrdered.length}`).values = [categoryHeaders, ...categoryOrdered.map((r) => [
  r.kind === "department" ? "Department" : r.kind === "subdepartment" ? "SubDepartment" : "Class", categoryName(r),
  num(r.currentSales), num(r.comparisonSales), null, null, num(r.currentUnits), num(r.comparisonUnits), null,
  num(r.currentMargin), num(r.comparisonMargin), null, num(r.currentMarginPct), num(r.comparisonMarginPct), null,
  null, null, null, null, managementNote(r),
])];
const categoryFormulaRows = categoryOrdered.map((_, i) => {
  const row = 6 + i;
  return [
    `=C${row}-D${row}`, `=IF(D${row}=0,IF(C${row}=0,0,1),E${row}/ABS(D${row}))`, null, null,
    `=G${row}-H${row}`, null, null, `=J${row}-K${row}`, null, null, `=(M${row}-N${row})*100`,
    `=IF('Data Notes'!$B$21=0,0,C${row}/'Data Notes'!$B$21)`, `=IF(ABS('Data Notes'!$B$23)<0.01,"",E${row}/'Data Notes'!$B$23)`,
    `=IF(AND(ABS(F${row})<='Data Notes'!$B$8,ABS(IF(H${row}=0,0,I${row}/ABS(H${row})))<='Data Notes'!$B$8),"Stable",IF(AND(E${row}>0,I${row}>0),"Volume-Led Growth",IF(AND(E${row}>0,I${row}<=0),"Price/Mix-Led Growth",IF(AND(E${row}<0,I${row}<0),"Volume Decline",IF(AND(E${row}<=0,I${row}>0),"Price/Mix Pressure","Mixed Result")))))`,
    `=IF(AND(E${row}>0,OR(L${row}<0,O${row}<-1)),"⚠ Margin Concern",IF(AND(F${row}>0.05,ABS(E${row})>=${CATEGORY_DOLLARS}),"▲ Strong Growth",IF(F${row}>${FLAT},"▲ Growth",IF(F${row}>=-${FLAT},"→ Stable",IF(AND(F${row}<-0.05,ABS(E${row})>=${CATEGORY_DOLLARS}),"▼ Material Decline","▼ Watch")))))`,
  ];
});
categorySheet.getRange(`E6:S${5 + categoryOrdered.length}`).formulas = categoryFormulaRows;
applyHeader(categorySheet.getRange("A5:T5"));
styleBody(categorySheet.getRange(`A6:T${5 + categoryOrdered.length}`));
categorySheet.getRange(`C6:E${5 + categoryOrdered.length}`).format.numberFormat = NF.currency;
categorySheet.getRange(`F6:F${5 + categoryOrdered.length}`).format.numberFormat = NF.pct;
categorySheet.getRange(`G6:I${5 + categoryOrdered.length}`).format.numberFormat = NF.units;
categorySheet.getRange(`J6:L${5 + categoryOrdered.length}`).format.numberFormat = NF.currency;
categorySheet.getRange(`M6:N${5 + categoryOrdered.length}`).format.numberFormat = NF.pct;
categorySheet.getRange(`O6:O${5 + categoryOrdered.length}`).format.numberFormat = NF.pp;
categorySheet.getRange(`P6:Q${5 + categoryOrdered.length}`).format.numberFormat = NF.pct;
applyVarianceFormatting(categorySheet.getRange(`E6:E${5 + categoryOrdered.length}`));
applyStatusFormatting(categorySheet.getRange(`S6:S${5 + categoryOrdered.length}`));
categorySheet.tables.add(`A5:T${5 + categoryOrdered.length}`, true, "CategoryPerformanceTable");
categorySheet.freezePanes.freezeRows(5); categorySheet.freezePanes.freezeColumns(2);
categorySheet.getRange(`A1:A${5 + categoryOrdered.length}`).format.columnWidth = 16;
categorySheet.getRange(`B1:B${5 + categoryOrdered.length}`).format.columnWidth = 42;
for (const c of ["C","D","E","F","G","H","I","J","K","L","M","N","O","P","Q"]) categorySheet.getRange(`${c}1:${c}${5 + categoryOrdered.length}`).format.columnWidth = 14;
categorySheet.getRange(`R1:S${5 + categoryOrdered.length}`).format.columnWidth = 22;
categorySheet.getRange(`T1:T${5 + categoryOrdered.length}`).format.columnWidth = 64;
categorySheet.getRange(`T6:T${5 + categoryOrdered.length}`).format.wrapText = true;

// Product Detail.
titleBand(detailSheet, "A1:Y2", "Product Detail");
detailSheet.getRange("A3:Y3").merge(); detailSheet.getRange("A3:Y3").values = [[`Complete product-level dataset | Current ${meta.currentStart} to ${meta.currentEnd} | Comparison ${meta.comparisonStart} to ${meta.comparisonEnd}`]];
detailSheet.getRange("A3:Y3").format = { fill: COLORS.blue, font: { bold: true, color: COLORS.text } };
const detailHeaders = ["Item ID", "Product Description", "Department", "SubDepartment", "Class", "SubClass", "Current Sales", "Comparison Sales", "Sales $ Change", "Sales % Change", "Current Units", "Comparison Units", "Unit Change", "Current Margin $", "Comparison Margin $", "Margin $ Change", "Current Margin %", "Comparison Margin %", "Margin Rate Change", "Scanback", "Current Avg Unit Retail", "Comparison Avg Unit Retail", "Contribution to Change", "Diagnosis", "Status"];
detailSheet.getRange(`A5:Y${5 + products.length}`).values = [detailHeaders, ...products.map((r) => [
  String(r.itemId), r.description, r.department, r.subdepartment, r.class, r.subclass,
  num(r.currentSales), num(r.comparisonSales), null, null, num(r.currentUnits), num(r.comparisonUnits), null,
  num(r.currentMargin), num(r.comparisonMargin), null, num(r.currentMarginPct), num(r.comparisonMarginPct), null,
  num(r.scanback), num(r.currentAvgUnitRetail), num(r.comparisonAvgUnitRetail), null, null, null,
])];
const productFormulaRows = products.map((_, i) => {
  const row = 6 + i;
  return [
    `=G${row}-H${row}`, `=IF(H${row}=0,IF(G${row}=0,0,1),I${row}/ABS(H${row}))`, null, null, `=K${row}-L${row}`, null, null,
    `=N${row}-O${row}`, null, null, `=(Q${row}-R${row})*100`, null, null, null,
    `=IF(ABS('Data Notes'!$B$23)<0.01,"",I${row}/'Data Notes'!$B$23)`,
    `=IF(AND(ABS(J${row})<='Data Notes'!$B$8,ABS(IF(L${row}=0,0,M${row}/ABS(L${row})))<='Data Notes'!$B$8),"Stable",IF(AND(I${row}>0,M${row}>0),"Volume-Led Growth",IF(AND(I${row}>0,M${row}<=0),"Price/Mix-Led Growth",IF(AND(I${row}<0,M${row}<0),"Volume Decline",IF(AND(I${row}<=0,M${row}>0),"Price/Mix Pressure","Mixed Result")))))`,
    `=IF(AND(I${row}>0,OR(P${row}<0,S${row}<-1)),"⚠ Margin Concern",IF(AND(J${row}>0.05,ABS(I${row})>=${PRODUCT_DOLLARS}),"▲ Strong Growth",IF(J${row}>${FLAT},"▲ Growth",IF(J${row}>=-${FLAT},"→ Stable",IF(AND(J${row}<-0.05,ABS(I${row})>=${PRODUCT_DOLLARS}),"▼ Material Decline","▼ Watch")))))`,
  ];
});
detailSheet.getRange(`I6:Y${5 + products.length}`).formulas = productFormulaRows;
applyHeader(detailSheet.getRange("A5:Y5"));
styleBody(detailSheet.getRange(`A6:Y${5 + products.length}`));
detailSheet.getRange(`G6:I${5 + products.length}`).format.numberFormat = NF.currency;
detailSheet.getRange(`J6:J${5 + products.length}`).format.numberFormat = NF.pct;
detailSheet.getRange(`K6:M${5 + products.length}`).format.numberFormat = NF.units;
detailSheet.getRange(`N6:P${5 + products.length}`).format.numberFormat = NF.currency;
detailSheet.getRange(`Q6:R${5 + products.length}`).format.numberFormat = NF.pct;
detailSheet.getRange(`S6:S${5 + products.length}`).format.numberFormat = NF.pp;
detailSheet.getRange(`T6:V${5 + products.length}`).format.numberFormat = NF.currency;
detailSheet.getRange(`W6:W${5 + products.length}`).format.numberFormat = NF.pct;
applyVarianceFormatting(detailSheet.getRange(`I6:I${5 + products.length}`));
applyStatusFormatting(detailSheet.getRange(`Y6:Y${5 + products.length}`));
detailSheet.tables.add(`A5:Y${5 + products.length}`, true, "ProductDetailTable");
detailSheet.freezePanes.freezeRows(5); detailSheet.freezePanes.freezeColumns(2);
detailSheet.getRange(`A1:A${5 + products.length}`).format.columnWidth = 14;
detailSheet.getRange(`B1:B${5 + products.length}`).format.columnWidth = 58;
for (const c of ["C","D","E","F"]) detailSheet.getRange(`${c}1:${c}${5 + products.length}`).format.columnWidth = 18;
for (const c of ["G","H","I","J","K","L","M","N","O","P","Q","R","S","T","U","V","W"]) detailSheet.getRange(`${c}1:${c}${5 + products.length}`).format.columnWidth = 14;
detailSheet.getRange(`X1:Y${5 + products.length}`).format.columnWidth = 22;

// Product Winners & Losers.
titleBand(winnersSheet, "A1:N2", "Product Winners & Losers");
winnersSheet.getRange("A3:N3").merge(); winnersSheet.getRange("A3:N3").values = [[`Materiality: at least $${PRODUCT_DOLLARS} sales or ${PRODUCT_UNITS} units in either period. Rankings prioritize dollar and unit impact.`]];
winnersSheet.getRange("A3:N3").format = { fill: COLORS.blue, font: { bold: true, color: COLORS.text } };
const rankingHeaders = ["Item ID", "Product Description", "Department", "SubDepartment", "Current Sales", "Comparison Sales", "Sales $ Change", "Sales % Change", "Current Units", "Unit Change", "Margin %", "Margin Rate Change", "Avg Unit Retail", "Contribution"];
function writeRanking(title, startRow, rows) {
  sectionHeader(winnersSheet, `A${startRow}:N${startRow}`, title);
  winnersSheet.getRange(`A${startRow + 1}:N${startRow + 1 + rows.length}`).values = [rankingHeaders, ...rows.map((r) => [
    String(r.itemId), r.description, r.department, r.subdepartment, num(r.currentSales), num(r.comparisonSales), change(r), salesPct(r), num(r.currentUnits), unitChange(r), num(r.currentMarginPct), marginRateChange(r) * 100, num(r.currentAvgUnitRetail), contribution(r),
  ])];
  applyHeader(winnersSheet.getRange(`A${startRow + 1}:N${startRow + 1}`));
  if (rows.length) styleBody(winnersSheet.getRange(`A${startRow + 2}:N${startRow + 1 + rows.length}`));
  winnersSheet.getRange(`E${startRow + 2}:G${startRow + 1 + rows.length}`).format.numberFormat = NF.currency;
  winnersSheet.getRange(`H${startRow + 2}:H${startRow + 1 + rows.length}`).format.numberFormat = NF.pct;
  winnersSheet.getRange(`I${startRow + 2}:J${startRow + 1 + rows.length}`).format.numberFormat = NF.units;
  winnersSheet.getRange(`K${startRow + 2}:K${startRow + 1 + rows.length}`).format.numberFormat = NF.pct;
  winnersSheet.getRange(`L${startRow + 2}:L${startRow + 1 + rows.length}`).format.numberFormat = NF.pp;
  winnersSheet.getRange(`M${startRow + 2}:M${startRow + 1 + rows.length}`).format.numberFormat = NF.currency;
  winnersSheet.getRange(`N${startRow + 2}:N${startRow + 1 + rows.length}`).format.numberFormat = NF.pct;
  if (rows.length) applyVarianceFormatting(winnersSheet.getRange(`G${startRow + 2}:G${startRow + 1 + rows.length}`));
  return startRow + rows.length + 4;
}
let rankingRow = 5;
rankingRow = writeRanking("Top 15 Products by Sales-Dollar Increase", rankingRow, topProductGains);
rankingRow = writeRanking("Bottom 15 Products by Sales-Dollar Decline", rankingRow, topProductDeclines);
rankingRow = writeRanking("Top 10 Products by Unit Increase", rankingRow, topUnitGains);
rankingRow = writeRanking("Bottom 10 Products by Unit Decline", rankingRow, topUnitDeclines);
rankingRow = writeRanking("Top 10 Margin-Dollar Opportunities", rankingRow, marginOpportunities);
rankingRow = writeRanking("High-Sales Products with Deteriorating Margin", rankingRow, highSalesMarginConcern);
winnersSheet.freezePanes.freezeRows(3); winnersSheet.freezePanes.freezeColumns(2);
winnersSheet.getRange(`A1:A${rankingRow}`).format.columnWidth = 14;
winnersSheet.getRange(`B1:B${rankingRow}`).format.columnWidth = 56;
winnersSheet.getRange(`C1:D${rankingRow}`).format.columnWidth = 18;
for (const c of ["E","F","G","H","I","J","K","L","M","N"]) winnersSheet.getRange(`${c}1:${c}${rankingRow}`).format.columnWidth = 14;

// Compact verification before export.
const dashboardCheck = await workbook.inspect({ kind: "table", sheetId: "Executive Dashboard", range: "A1:L45", include: "values,formulas", tableMaxRows: 45, tableMaxCols: 12, maxChars: 12000 });
console.log("---DASHBOARD CHECK---");
console.log(dashboardCheck.ndjson);
const formulaErrors = await workbook.inspect({ kind: "match", searchTerm: "#REF!|#DIV/0!|#VALUE!|#NAME\\?|#N/A", options: { useRegex: true, maxResults: 300 }, summary: "final formula error scan", maxChars: 6000 });
console.log("---FORMULA ERROR SCAN---");
console.log(formulaErrors.ndjson);

await fs.mkdir(options["preview-dir"], { recursive: true });
const previews = [
  ["Executive Dashboard", "A1:L71", "01-executive-dashboard.png"],
  ["Category Performance", "A1:T35", "02-category-performance.png"],
  ["Product Winners & Losers", "A1:N40", "03-product-winners-losers.png"],
  ["Product Detail", "A1:Y35", "04-product-detail.png"],
  ["Data Notes", "A1:H35", "05-data-notes.png"],
];
for (const [sheetName, range, fileName] of previews) {
  const preview = await workbook.render({ sheetName, range, scale: 1, format: "png" });
  await fs.writeFile(path.join(options["preview-dir"], fileName), new Uint8Array(await preview.arrayBuffer()));
}

await fs.mkdir(path.dirname(options.output), { recursive: true });
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(options.output);
console.log(JSON.stringify({ output: path.resolve(options.output), previewDir: path.resolve(options["preview-dir"]), rows: { departments: departments.length, categories: categories.length, products: products.length }, reconciliation: { department: departmentReconciliation, product: productReconciliation } }));
