import { createStore, type StoreApi } from 'zustand/vanilla';

import type { CrashEvent } from '@/features/crash-detection/types/crash.types';
import type { LocationState } from '@/features/location/types/location.types';

import type {
  EscalationRequest, EscalationResponse, IncidentRequest,
} from '../types/safety.schemas';
import type { EscalationTrigger } from './checkInService';

export type EscalationStatus = 'idle' | 'sending' | 'sent' | 'waitingForSignal' | 'noLocation' | 'canceled';
export type AuditAction = 'requested' | 'sent' | 'retry' | 'canceled';

export interface AuditEntry {
  action: AuditAction;
  at: number;
}

export interface EscalationState {
  status: EscalationStatus;
  liveLocationUrl: string | null;
  audit: AuditEntry[];
}

interface PendingEscalation {
  incident: IncidentRequest;
  escalation: EscalationRequest;
  sent: boolean;
  audit: AuditEntry[];
}

interface EscalationApi {
  createIncident(request: IncidentRequest): Promise<unknown>;
  escalate(request: EscalationRequest): Promise<EscalationResponse>;
  shareLocation(id: string, location: { latitude: number; longitude: number }): Promise<void>;
  cancelEscalation(id: string): Promise<unknown>;
}

interface EscalationOptions {
  api: EscalationApi;
  location: StoreApi<LocationState>;
  currentRoad: () => { name: string | null; refs: string[] } | null;
  storage: {
    getItem(key: string): Promise<string | null>;
    setItem(key: string, value: string): Promise<void>;
    removeItem(key: string): Promise<void>;
  };
  createId: () => string;
  now?: () => number;
  shareMedicalInfo?: () => boolean;
}

const STORAGE_KEY = 'osy.escalation.pending';
const RETRY_MS = 15_000;
const SHARE_LOCATION_MS = 30_000;

export function createEscalationService({ api, location, currentRoad, storage, createId, shareMedicalInfo, now = Date.now }: EscalationOptions) {
  const store = createStore<EscalationState>(() => ({ status: 'idle', liveLocationUrl: null, audit: [] }));
  let pending: PendingEscalation | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | undefined;
  let shareTimer: ReturnType<typeof setInterval> | undefined;
  let sending = false;

  const record = (action: AuditAction) => {
    const entry = { action, at: now() };
    if (pending) pending.audit = [...pending.audit, entry];
    store.setState((state) => ({ audit: [...state.audit, entry] }));
  };

  // Survives a dead battery or a closed app, so a request for help is not lost.
  const save = () => (pending
    ? storage.setItem(STORAGE_KEY, JSON.stringify(pending))
    : storage.removeItem(STORAGE_KEY)).catch(() => undefined);

  const shareLocation = () => {
    const { fix } = location.getState();
    if (!pending || !fix) return;
    const { latitude, longitude } = fix;
    api.shareLocation(pending.escalation.id, { latitude, longitude }).catch(() => undefined);
  };

  const stopSharing = () => {
    clearInterval(shareTimer);
    shareTimer = undefined;
  };

  // Retries reuse the same ids, so the server treats them as one request.
  const send = async () => {
    if (!pending || sending) return;
    sending = true;
    clearTimeout(retryTimer);
    const current = pending;
    try {
      await api.createIncident(current.incident);
      if (shareMedicalInfo) current.escalation.shareMedicalInfo = shareMedicalInfo();
      const { liveLocationUrl } = await api.escalate(current.escalation);
      if (pending !== current) return;
      current.sent = true;
      record('sent');
      store.setState({ status: 'sent', liveLocationUrl });
      await save();
      stopSharing();
      shareTimer = setInterval(shareLocation, SHARE_LOCATION_MS);
    } catch {
      if (pending !== current) return;
      record('retry');
      store.setState({ status: 'waitingForSignal' });
      await save();
      retryTimer = setTimeout(() => void send(), RETRY_MS);
    } finally {
      sending = false;
    }
  };

  return {
    store,

    // Picks up a request that had not reached the server when the app closed.
    async restore() {
      const saved = await storage.getItem(STORAGE_KEY).catch(() => null);
      if (!saved || pending) return;
      pending = JSON.parse(saved) as PendingEscalation;
      store.setState({ status: pending.sent ? 'sent' : 'sending', audit: pending.audit });
      if (pending.sent) shareTimer = setInterval(shareLocation, SHARE_LOCATION_MS);
      else await send();
    },

    async start(trigger: EscalationTrigger, event: CrashEvent | null) {
      if (pending) return;
      const { fix } = location.getState();
      const place = event?.snapshot.location ?? fix;
      if (!place) {
        store.setState({ status: 'noLocation', liveLocationUrl: null, audit: [] });
        return;
      }

      const road = currentRoad();
      const coordinate = { latitude: place.latitude, longitude: place.longitude };
      const incidentId = createId();
      pending = {
        sent: false,
        audit: [],
        incident: {
          id: incidentId,
          source: event ? 'crash_detected' : 'user_report',
          location: coordinate,
          occurredAt: new Date(event?.detectedAt ?? now()).toISOString(),
          type: 'crash',
          severity: 'serious',
          injuriesVisible: null,
          note: null,
        },
        escalation: {
          id: createId(),
          incidentId,
          trigger,
          location: coordinate,
          speedBeforeImpactKmh: event?.snapshot.speedBeforeKmh ?? null,
          roadName: road?.name ?? null,
          roadNumber: road?.refs[0] ?? null,
          shareMedicalInfo: shareMedicalInfo?.() ?? false,
        },
      };
      store.setState({ status: 'sending', liveLocationUrl: null, audit: [] });
      record('requested');
      await save();
      await send();
    },

    // "I'm OK" after escalating. An unsent request simply never goes out.
    async cancel() {
      const current = pending;
      if (!current) {
        store.setState({ status: 'idle', liveLocationUrl: null, audit: [] });
        return;
      }
      clearTimeout(retryTimer);
      stopSharing();
      record('canceled');
      pending = null;
      store.setState({ status: 'canceled', liveLocationUrl: null });
      await save();
      if (current.sent) await api.cancelEscalation(current.escalation.id).catch(() => undefined);
    },

    stop() {
      clearTimeout(retryTimer);
      stopSharing();
    },
  };
}

export type EscalationService = ReturnType<typeof createEscalationService>;
