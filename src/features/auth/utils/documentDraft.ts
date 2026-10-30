import { createStore } from 'zustand/vanilla';

import type { CapturedPage, DocumentFields, DocumentSource, DocumentType } from '../types/auth.schemas';

export interface DocumentDraft {
  type: DocumentType | null;
  source: DocumentSource | null;
  pages: CapturedPage[];
  fields: DocumentFields;
  rejectionReason: string | null;
}

const empty: DocumentDraft = { type: null, source: null, pages: [], fields: {}, rejectionReason: null };

// Kept in memory only: passwords and document data are never written to storage.
export const documentDraft = createStore<DocumentDraft>(() => empty);

export function startDraft(type: DocumentType, rejectionReason: string | null) {
  documentDraft.setState({ ...empty, type, rejectionReason });
}

export function resetDraftPages(rejectionReason: string | null = null) {
  documentDraft.setState({ source: null, pages: [], fields: {}, rejectionReason });
}

// Set when the user accepts the notice, and sent with each document.
let consentedAt = '';

export function recordConsent() {
  consentedAt = new Date().toISOString();
}

export function getConsentedAt() {
  return consentedAt;
}

export function pageUris() {
  return documentDraft.getState().pages.map((page) => page.uri);
}
