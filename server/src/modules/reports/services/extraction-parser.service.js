/**
 * BET-12.11/12.12/12.13 — Medical Result Parser.
 *
 * Raw OCR text -> structured `parameters[]`. Deliberately
 * conservative: a line is only turned into a parameter when a test
 * name AND a value are both actually present in the text. A unit or
 * reference range is only attached when it is *also* actually
 * present in that same line — never invented (master prompt
 * §BET-12.12: "the system must not invent missing information").
 * Lines that don't confidently match are returned separately as
 * `unparsedLines` for manual review, never force-parsed.
 *
 * This is a heuristic, not a clinical-grade parser — every parameter
 * it produces gets `confidence: 'LOW'` or `'MEDIUM'` (never `'HIGH'`,
 * that tier is reserved for values a human has since confirmed via
 * the verification workflow) and starts `verification.status:
 * 'PENDING'`, so nothing it emits is ever treated as verified
 * clinical data on its own (BET-12.14).
 */

// "Hemoglobin 11.2 g/dL 12.0-15.5" / "WBC: 8400 /uL (4000-11000)" /
// "Platelets  245,000  /µL" style lines. Captures, in order:
// name, value (numeric, commas allowed), unit (optional), reference
// range low/high (optional).
const LAB_LINE_PATTERN =
  /^\s*(?<name>[A-Za-z][A-Za-z0-9 ,/().%'-]{1,60}?)\s*[:\-]?\s+(?<value>-?\d[\d,]*\.?\d*)\s*(?<unit>%|[a-zA-Zµ/]{1,15}(?:\/[a-zA-Zµ]{1,15})?)?\s*(?:[\[(]?\s*(?<refLow>\d+\.?\d*)\s*(?:-|–|to)\s*(?<refHigh>\d+\.?\d*)\s*[\])]?)?\s*$/;

// A line that is purely a qualitative result: "HIV: Negative",
// "Pregnancy Test - Positive". Requires an explicit qualitative
// keyword so we don't swallow arbitrary label:text lines.
const QUALITATIVE_LINE_PATTERN =
  /^\s*(?<name>[A-Za-z][A-Za-z0-9 ,/().%'-]{1,60}?)\s*[:\-]\s*(?<value>positive|negative|reactive|non-reactive|nonreactive|not detected|detected|normal|abnormal)\s*$/i;

const NOISE_LINE_PATTERN = /^\s*(page \d+|-+|=+|\*+)\s*$/i;

/**
 * Explicit, exhaustive map of every qualitative value
 * `QUALITATIVE_LINE_PATTERN` can capture to its abnormal flag.
 * Deliberately a lookup table, not a substring/regex test against the
 * raw value — a substring test (the previous implementation) matches
 * "reactive" *inside* "non-reactive"/"nonreactive" and "detected"
 * inside "not detected", which silently mis-flagged three of the most
 * common *negative* clinical results (STI/pregnancy screens) as
 * ABNORMAL. Every key here matches one branch of
 * `QUALITATIVE_LINE_PATTERN` exactly, so there is no ambiguity left to
 * resolve with pattern matching (BET-12 audit fix, 2026-08-13).
 */
const QUALITATIVE_ABNORMAL_FLAGS = Object.freeze({
  positive: 'ABNORMAL',
  reactive: 'ABNORMAL',
  detected: 'ABNORMAL',
  abnormal: 'ABNORMAL',
  negative: 'NORMAL',
  'non-reactive': 'NORMAL',
  nonreactive: 'NORMAL',
  'not detected': 'NORMAL',
  normal: 'NORMAL',
});

const classifyQualitativeFlag = (value) =>
  QUALITATIVE_ABNORMAL_FLAGS[String(value).trim().toLowerCase()] ?? 'UNKNOWN';

const classifyAbnormalFlag = ({ numericValue, refLow, refHigh }) => {
  if (numericValue === null || refLow === null || refHigh === null) {
    return 'UNKNOWN';
  }
  if (numericValue < refLow) return 'LOW';
  if (numericValue > refHigh) return 'HIGH';
  return 'NORMAL';
};

const toNumericOrNull = (raw) => {
  if (raw === undefined || raw === null || raw === '') return null;
  const n = Number(String(raw).replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};

/**
 * @param {string} text raw OCR/extracted text
 * @returns {{ parameters: object[], unparsedLines: string[] }}
 */
export const parseLabStyleText = (text, { source = 'OCR', confidence: defaultConfidence = null } = {}) => {
  const parameters = [];
  const unparsedLines = [];

  if (!text || typeof text !== 'string') {
    return { parameters, unparsedLines };
  }

  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !NOISE_LINE_PATTERN.test(l));

  for (const line of lines) {
    const labMatch = line.match(LAB_LINE_PATTERN);

    if (labMatch?.groups?.name && labMatch?.groups?.value) {
      const { name, value, unit, refLow, refHigh } = labMatch.groups;
      const numericValue = toNumericOrNull(value);
      const refLowNum = toNumericOrNull(refLow);
      const refHighNum = toNumericOrNull(refHigh);

      const hasUnit = Boolean(unit);
      const hasRange = refLowNum !== null && refHighNum !== null;
      const confidence = hasRange ? 'MEDIUM' : hasUnit ? 'MEDIUM' : 'LOW';

      parameters.push({
        name: name.trim(),
        value: value.trim(),
        numericValue,
        unit: hasUnit ? unit.trim() : null,
        referenceRange: hasRange ? `${refLow}-${refHigh}` : null,
        abnormalFlag: classifyAbnormalFlag({
          numericValue,
          refLow: refLowNum,
          refHigh: refHighNum,
        }),
        source,
        confidence: defaultConfidence || confidence,
        extraction: {
          rawValue: value.trim(),
          rawUnit: hasUnit ? unit.trim() : null,
          rawReferenceRange: hasRange ? `${refLow}-${refHigh}` : null,
          confidence,
          sourceLine: line,
        },
      });
      continue;
    }

    const qualMatch = line.match(QUALITATIVE_LINE_PATTERN);
    if (qualMatch?.groups?.name && qualMatch?.groups?.value) {
      const { name, value } = qualMatch.groups;
      parameters.push({
        name: name.trim(),
        value: value.trim(),
        numericValue: null,
        unit: null,
        referenceRange: null,
        abnormalFlag: classifyQualitativeFlag(value),
        source,
        confidence: defaultConfidence || 'LOW',
        extraction: {
          rawValue: value.trim(),
          rawUnit: null,
          rawReferenceRange: null,
          confidence: 'LOW',
          sourceLine: line,
        },
      });
      continue;
    }

    unparsedLines.push(line);
  }

  return { parameters, unparsedLines };
};

/**
 * BET-12.22 — non-laboratory report types don't have a "test: value"
 * table to parse at all; forcing them through `parseLabStyleText`
 * would produce noise. For these, extraction only ever stores the
 * raw text as `structuredSections.rawText` and leaves genuine
 * structuring (findings/impression, adequacy/interpretation, etc.)
 * to manual entry / doctor authorship — never auto-guessed from OCR.
 */
export const REPORT_TYPES_WITH_LAB_PARSING = Object.freeze(['LABORATORY']);

export const shouldAttemptLabParsing = (reportType) => REPORT_TYPES_WITH_LAB_PARSING.includes(reportType);
