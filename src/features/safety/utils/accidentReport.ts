import type { IncidentRequest } from '../types/safety.schemas';

export const ACCIDENT_TYPES = ['collision', 'pedestrian', 'rollover', 'fire', 'other'] as const;
export const ACCIDENT_SEVERITIES = ['minor', 'serious', 'critical'] as const;
export const INJURY_ANSWERS = ['yes', 'no', 'unsure'] as const;
export const MAX_REPORT_PHOTO_BYTES = 10 * 1024 * 1024;
export const MAX_REPORT_NOTE_LENGTH = 500;
// An older fix may be somewhere else entirely, so the driver places the pin instead.
const MAX_FIX_AGE_MS = 5 * 60_000;

export type AccidentType = (typeof ACCIDENT_TYPES)[number];
export type AccidentSeverity = (typeof ACCIDENT_SEVERITIES)[number];
export type InjuryAnswer = (typeof INJURY_ANSWERS)[number];

export interface ReportLocation {
  latitude: number;
  longitude: number;
}

export interface AccidentReportForm {
  location: ReportLocation | null;
  type: AccidentType | null;
  severity: AccidentSeverity | null;
  injuries: InjuryAnswer | null;
  note: string;
}

export const canSubmitReport = ({ location, type, severity }: AccidentReportForm) => (
  location !== null && type !== null && severity !== null
);

export function isFreshFix(fix: { timestamp: number } | null, now: number) {
  return fix !== null && now - fix.timestamp <= MAX_FIX_AGE_MS;
}

export function toIncidentRequest(form: AccidentReportForm, id: string, now: number): IncidentRequest {
  const { location, type, severity, injuries, note } = form;
  if (!location || !type || !severity) throw new Error('The report is incomplete.');
  return {
    id,
    source: 'user_report',
    location: { latitude: location.latitude, longitude: location.longitude },
    occurredAt: new Date(now).toISOString(),
    type,
    severity,
    injuriesVisible: injuries === 'unsure' || injuries === null ? null : injuries === 'yes',
    note: note.trim() || null,
  };
}

export const reportPhotoName = (id: string, mimeType: string) => `${id}.${mimeType === 'image/png' ? 'png' : 'jpg'}`;
