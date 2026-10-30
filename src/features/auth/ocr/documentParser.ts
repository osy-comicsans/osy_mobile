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
  seats: (value) => /^\d+$/.test(value),
  power: (value) => /^\d+$/.test(value),
  grossWeight: (value) => /^\d+$/.test(value),
  payload: (value) => /^\d+$/.test(value),
  firstRegistrationYear: (value) => /^\d{4}$/.test(value) && Number(value) <= new Date().getFullYear(),
};

const normalizers: Partial<Record<DocumentFieldKey, (value: string) => string>> = {
  serialNumber: (value) => value.replace(/\s/g, '').toUpperCase(),
  registrationNumber: (value) => value.replace(/[.\-\s]+/g, ' ').trim(),
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

const REGISTRATION_LABELS: Partial<Record<DocumentFieldKey, RegExp>> = {
  genre: /^genre/i,
  brand: /^marque/i,
  type: /^type/i,
  serialNumber: /^n.{0,3}dans la s/i,
  bodyType: /^carrosserie/i,
  energy: /^[eé]nergie/i,
  power: /^puissance/i,
  seats: /^places/i,
  grossWeight: /^poids/i,
  payload: /^charge/i,
  registrationNumber: /^n.{0,3}d.?immatriculation/i,
  previousNumber: /^pr[eé]c[eé]dent/i,
  firstRegistrationYear: /^ann[eé]e/i,
};

const ARABIC_ONLY: readonly DocumentFieldKey[] = ['genre', 'brand', 'bodyType'];

function labelledValue(lines: OcrLine[], key: DocumentFieldKey, label: RegExp): Candidate | undefined {
  const labelLine = lines.find((line) => label.test(line.latin.trim()));
  if (!labelLine) return undefined;

  const inline = labelLine.latin.split(/[:：]/).slice(1).join(':').trim();
  if (inline) return { value: inline, confidence: labelLine.confidence };

  const value = nextOnRow(lines, labelLine) ?? belowLabel(lines, labelLine);
  return value && { value: ARABIC_ONLY.includes(key) ? value.arabic : value.latin, confidence: value.confidence };
}

function parseRegistration(pages: OcrLine[][]): OcrResult {
  const lines = pages.flat();
  const keys = Object.keys(REGISTRATION_LABELS) as DocumentFieldKey[];
  const found = Object.fromEntries(keys.flatMap((key) => {
    const candidate = labelledValue(lines, key, REGISTRATION_LABELS[key] as RegExp);
    return candidate ? [[key, candidate]] : [];
  }));
  return buildResult(keys, found);
}

export function parseDocument(type: DocumentType, pages: OcrLine[][]): OcrResult {
  return type === 'driver_license' ? parseLicence(pages) : parseRegistration(pages);
}
