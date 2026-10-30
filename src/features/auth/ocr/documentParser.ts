import type { DocumentFieldKey, DocumentFields, DocumentType } from '../types/auth.schemas';
import { parseMrz } from './mrz';
import type { OcrLine } from './paddle/pipeline';

export interface OcrResult {
  fields: DocumentFields;
  lowConfidence: DocumentFieldKey[];
}

const CONFIDENT = 0.85;

interface Candidate {
  value: string;
  confidence: number;
}

const ARABIC = /[؀-ۿ]/;

function isRealPastDate(text: string): boolean {
  const [day, month, year] = text.split('.').map(Number);
  const date = new Date(year, month - 1, day);
  return date.getDate() === day && date.getMonth() === month - 1 && date < new Date();
}

const validators: Partial<Record<DocumentFieldKey, (value: string) => boolean>> = {
  nin: (value) => /^\d{18}$/.test(value),
  dateOfBirth: (value) => /^\d{2}\.\d{2}\.\d{4}$/.test(value) && isRealPastDate(value),
  registrationNumber: (value) => /^\d{5,6} ?\d{3} ?\d{2}$/.test(value),
  previousNumber: (value) => /^\d{5,6} ?\d{2,3} ?\d{2}$/.test(value),
  seats: (value) => /^\d{1,3}$/.test(value),
  power: (value) => /^\d+$/.test(value),
  grossWeight: (value) => /^\d+$/.test(value),
  payload: (value) => /^\d+$/.test(value),
  firstRegistrationYear: (value) => /^\d{4}$/.test(value) && Number(value) <= new Date().getFullYear(),
};

const digitsOnly = (value: string) => value.replace(/\D/g, '');
const plateNumber = (value: string) => value.replace(/[.:,\-\s]+/g, ' ').trim();

const normalizers: Partial<Record<DocumentFieldKey, (value: string) => string>> = {
  serialNumber: (value) => value.replace(/\s/g, '').toUpperCase(),
  registrationNumber: plateNumber,
  previousNumber: plateNumber,
  power: digitsOnly,
  seats: digitsOnly,
  grossWeight: digitsOnly,
  payload: digitsOnly,
  firstRegistrationYear: digitsOnly,
  energy: (value) => value.replace(/[^A-Za-z]/g, '').toUpperCase(),
  nin: (value) => value.replace(/\s/g, ''),
};

// Unreadable or invalid values stay empty and flagged, never a guess shown as certain.
function buildResult(keys: readonly DocumentFieldKey[], found: Partial<Record<DocumentFieldKey, Candidate>>): OcrResult {
  const fields: DocumentFields = {};
  const lowConfidence: DocumentFieldKey[] = [];

  for (const key of keys) {
    const candidate = found[key];
    const value = candidate ? (normalizers[key]?.(candidate.value) ?? candidate.value).trim() : '';
    const valid = !!value && (validators[key]?.(value) ?? true);
    if (valid) fields[key] = value;
    if (!valid || (candidate?.confidence ?? 0) < CONFIDENT || ARABIC.test(value)) lowConfidence.push(key);
  }
  return { fields, lowConfidence };
}

function firstMatch(lines: OcrLine[], pattern: RegExp): Candidate | undefined {
  for (const line of lines) {
    const match = line.latin.match(pattern);
    if (match) return { value: match[1] ?? match[0], confidence: line.confidence };
  }
  return undefined;
}

// Finds the text printed after a numbered marker, on the same line or the same row.
function afterMarker(lines: OcrLine[], marker: string): OcrLine | undefined {
  const pattern = new RegExp(`^${marker}[.:\\s]+\\S`);
  const inline = lines.find((line) => pattern.test(line.latin));
  if (inline) return { ...inline, latin: inline.latin.replace(new RegExp(`^${marker}[.:\\s]+`), '') };

  const label = lines.find((line) => new RegExp(`^${marker}[.:]?$`).test(line.latin.trim()));
  return label && nextOnRow(lines, label);
}

function nextOnRow(lines: OcrLine[], label: OcrLine): OcrLine | undefined {
  const middle = label.y + label.height / 2;
  return lines
    .filter((line) => line !== label && line.y < middle && line.y + line.height > middle)
    .sort((a, b) => a.x - b.x)
    .find((line) => line.x >= label.x + label.width - 2);
}

function belowLabel(lines: OcrLine[], label: OcrLine): OcrLine | undefined {
  const bottom = label.y + label.height;
  return lines
    .filter((line) => line.y >= bottom - 2 && line.y < bottom + label.height * 2 && line.x + line.width > label.x && line.x < label.x + label.width)
    .sort((a, b) => a.y - b.y)[0];
}

const LICENCE_KEYS = ['category', 'nin', 'licenseNumber', 'lastName', 'firstName', 'dateOfBirth', 'placeOfBirth'] as const;

function parseLicence(pages: OcrLine[][]): OcrResult {
  const lines = pages.flat();
  const mrz = parseMrz(lines.map((line) => line.latin));
  const trusted = mrz?.checksPass ? 1 : 0.5;
  const marked = (marker: string): Candidate | undefined => {
    const line = afterMarker(lines, marker);
    return line && { value: line.latin, confidence: line.confidence };
  };
  const birthLine = lines.find((line) => /\d{2}\.\d{2}\.\d{4}/.test(line.latin));
  const birthPlace = birthLine && nextOnRow(lines, birthLine);

  return buildResult(LICENCE_KEYS, {
    category: firstMatch(lines, /^5[.:\s]+([A-Z0-9]{1,3}(?:[ ,][A-Z0-9]{1,3})*)$/),
    nin: firstMatch(lines, /(?:^|\D)((?:\d\s?){18})(?:\D|$)/),
    licenseNumber: mrz ? { value: mrz.documentNumber, confidence: trusted } : firstMatch(lines, /^([A-Z]\d{6,9})$/),
    lastName: mrz ? { value: mrz.lastName, confidence: trusted } : marked('1'),
    firstName: mrz ? { value: mrz.firstName, confidence: trusted } : marked('2'),
    dateOfBirth: mrz ? { value: mrz.dateOfBirth, confidence: trusted } : firstMatch(lines, /(\d{2}\.\d{2}\.\d{4})/),
    placeOfBirth: birthPlace && { value: birthPlace.arabic, confidence: birthPlace.confidence },
  });
}

const REGISTRATION_LABELS: Partial<Record<DocumentFieldKey, string[]>> = {
  genre: ['GENRE'],
  brand: ['MARQUE'],
  type: ['TYPE'],
  serialNumber: ['N DANS LA SERIE DU TYPE'],
  bodyType: ['CARROSSERIE'],
  energy: ['ENERGIE'],
  power: ['PUISSANCE'],
  seats: ['PLACES ASSISES', 'PLACES'],
  grossWeight: ['POIDS TOTAL EN CHARGE', 'POIDS TOTAL'],
  payload: ['CHARGE UTILE', 'CHARGE'],
  registrationNumber: ['N D IMMATRICULATION', 'NUMERO D IMMATRICULATION'],
  previousNumber: ['PRECEDENT NUMERO'],
  firstRegistrationYear: ['ANNEE DE PREMIERE MISE EN CIRCULATION', 'ANNEE DE PREMIERE'],
};

const ARABIC_ONLY: readonly DocumentFieldKey[] = ['genre', 'brand', 'bodyType'];
const NUMERIC: readonly DocumentFieldKey[] = ['power', 'seats', 'grossWeight', 'payload', 'firstRegistrationYear'];
const LABEL_SIMILARITY = 0.72;
const MIN_ARABIC_CONFIDENCE = 0.75;
const PLATE = /\d{5,6}[.:,\-\s]+\d{2,3}[.:,\-\s]+\d{2}/;

const labelText = (text: string) => text
  .normalize('NFD')
  .replace(/\p{M}/gu, '')
  .toUpperCase()
  .replace(/[^A-Z0-9]+/g, ' ')
  .trim();

function similarity(a: string, b: string): number {
  if (!a || !b) return 0;
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const next = [i];
    for (let j = 1; j <= b.length; j += 1) {
      next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    row = next;
  }
  return 1 - row[b.length] / Math.max(a.length, b.length);
}

// Small misreads are common on printed labels, so the closest reading wins.
function labelScore(line: OcrLine, names: string[]): number {
  const readings = [labelText(line.latin), labelText(line.arabic)];
  return Math.max(...names.flatMap((name) => readings.map((reading) => {
    const prefix = reading.split(':')[0];
    return Math.max(similarity(prefix, name), similarity(prefix.slice(0, name.length), name) - 0.02);
  })));
}

function findLabels(lines: OcrLine[], keys: DocumentFieldKey[]) {
  const scored = keys.flatMap((key) => lines.map((line) => ({
    key, line, score: labelScore(line, REGISTRATION_LABELS[key] as string[]),
  }))).filter(({ score }) => score >= LABEL_SIMILARITY).sort((a, b) => b.score - a.score);

  const labels = new Map<DocumentFieldKey, OcrLine>();
  const used = new Set<OcrLine>();
  for (const { key, line } of scored) {
    if (labels.has(key) || used.has(line)) continue;
    labels.set(key, line);
    used.add(line);
  }
  return { labels, used };
}

const horizontalOverlap = (a: OcrLine, b: OcrLine) => Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));

const isDirectlyAbove = (line: OcrLine, label: OcrLine) => (
  horizontalOverlap(line, label) >= Math.min(line.width, label.width) * 0.4
);

// A short value can sit off-centre in its box, just beside the label's column.
const isBesideColumn = (line: OcrLine, label: OcrLine) => (
  Math.max(line.x - (label.x + label.width), label.x - (line.x + line.width)) <= label.height
);

// On the card each value is printed in its box, directly above its label.
function linesAbove(
  lines: OcrLine[],
  label: OcrLine,
  labelLines: Set<OcrLine>,
  inColumn: (line: OcrLine, label: OcrLine) => boolean,
): OcrLine[] {
  const reach = label.height * 4;
  return lines
    .filter((line) => {
      const bottom = line.y + line.height;
      return !labelLines.has(line) && line !== label
        && bottom <= label.y + label.height / 2 && bottom >= label.y - reach
        && inColumn(line, label);
    })
    .sort((a, b) => b.y + b.height - (a.y + a.height));
}

function valueFor(key: DocumentFieldKey, lines: OcrLine[], label: OcrLine, labelLines: Set<OcrLine>): Candidate | undefined {
  const above = linesAbove(lines, label, labelLines, isDirectlyAbove);
  const arabicOnly = ARABIC_ONLY.includes(key);
  const reading = (line: OcrLine) => (arabicOnly ? line.arabic : line.latin);

  if (key === 'serialNumber') {
    const parts = above.filter((line) => /[A-Z0-9]{4,}/.test(line.latin)).slice(0, 2).reverse();
    if (parts.length > 0) {
      return { value: parts.map((line) => line.latin).join(''), confidence: Math.min(...parts.map((line) => line.confidence)) };
    }
  }
  // Printed Arabic labels share these boxes, so a Latin field skips Arabic lines.
  const numeric = NUMERIC.includes(key);
  const usable = (line: OcrLine) => (numeric
    ? /\d/.test(line.latin) && !PLATE.test(line.latin)
    : reading(line).trim() && (arabicOnly || !ARABIC.test(line.text)));
  const beside = key === 'type' ? linesAbove(lines, label, labelLines, isBesideColumn) : [];
  const nearest = above.find(usable) ?? beside.find(usable);
  if (nearest) {
    // Arabic-only values have no check digits or format, so a weak reading is left empty.
    if (arabicOnly && nearest.confidence < MIN_ARABIC_CONFIDENCE) return undefined;
    return { value: reading(nearest), confidence: nearest.confidence };
  }

  const inline = label.latin.split(/[:：]/).slice(1).join(':').trim();
  if (inline) return { value: inline, confidence: label.confidence };

  const next = nextOnRow(lines, label) ?? belowLabel(lines, label);
  return next && !labelLines.has(next) ? { value: reading(next), confidence: next.confidence } : undefined;
}

function plateNear(lines: OcrLine[], label: OcrLine | undefined): Candidate | undefined {
  const plates = lines.filter((line) => PLATE.test(line.latin));
  const distance = (line: OcrLine) => (label ? Math.abs(line.x - label.x) + Math.abs(line.y - label.y) : line.y);
  const best = [...plates].sort((a, b) => distance(a) - distance(b) || b.confidence - a.confidence)[0];
  const match = best?.latin.match(PLATE);
  return match ? { value: match[0], confidence: best.confidence } : undefined;
}

function parseRegistration(pages: OcrLine[][]): OcrResult {
  const lines = pages.flat();
  const keys = Object.keys(REGISTRATION_LABELS) as DocumentFieldKey[];
  const { labels, used } = findLabels(lines, keys);
  const found: Partial<Record<DocumentFieldKey, Candidate>> = {};

  for (const [key, label] of labels) found[key] = valueFor(key, lines, label, used);

  const previous = labels.get('previousNumber');
  const unused = lines.filter((line) => !used.has(line));
  const previousPlate = previous && plateNear(unused.filter((line) => horizontalOverlap(line, previous) > 0), previous);
  if (previousPlate) found.previousNumber = previousPlate;
  const others = unused.filter((line) => !previousPlate || !line.latin.includes(previousPlate.value));
  found.registrationNumber = plateNear(others, labels.get('registrationNumber')) ?? found.registrationNumber;

  return buildResult(keys, found);
}

export function parseDocument(type: DocumentType, pages: OcrLine[][]): OcrResult {
  return type === 'driver_license' ? parseLicence(pages) : parseRegistration(pages);
}
