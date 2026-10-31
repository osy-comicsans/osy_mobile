import { createStore } from 'zustand/vanilla';

import type { CrashEvent } from '@/features/crash-detection/types/crash.types';

// Waited one after another, so a driver has three minutes in total to answer.
export const CHECK_IN_ROUNDS_SECONDS = [30, 60, 90];

export type CheckInStatus = 'idle' | 'waiting' | 'escalated' | 'confirmed';
export type EscalationTrigger = 'user_requested' | 'check_in_timeout';

export interface CheckInState {
  status: CheckInStatus;
  round: number;
  endsAt: number | null;
  event: CrashEvent | null;
}

interface CheckInOptions {
  escalate: (trigger: EscalationTrigger, event: CrashEvent | null) => void;
  // Called at the start of each round after the first.
  remind: () => void;
  // "I'm OK" after escalating, which takes the request for help back.
  cancelEscalation?: () => void;
  now?: () => number;
  getCountdownSeconds?: () => number;
}

const idle: CheckInState = { status: 'idle', round: 0, endsAt: null, event: null };

export function createCheckInService({ escalate, remind, cancelEscalation, getCountdownSeconds, now = Date.now }: CheckInOptions) {
  const store = createStore<CheckInState>(() => idle);
  let timer: ReturnType<typeof setTimeout> | undefined;
  let rounds = [...CHECK_IN_ROUNDS_SECONDS];

  const schedule = () => {
    clearTimeout(timer);
    const { endsAt } = store.getState();
    if (endsAt !== null) timer = setTimeout(sync, Math.max(0, endsAt - now()));
  };

  const finish = (trigger: EscalationTrigger) => {
    clearTimeout(timer);
    const { event } = store.getState();
    store.setState({ status: 'escalated', endsAt: null });
    escalate(trigger, event);
  };

  // Timers stop while the app is suspended, so a return to the app catches up
  // from the clock. Rounds that passed unseen count as unanswered.
  function sync() {
    const state = store.getState();
    if (state.status !== 'waiting' || state.endsAt === null || now() < state.endsAt) return;

    let { round, endsAt } = state;
    while (endsAt <= now()) {
      round += 1;
      if (round >= rounds.length) {
        finish('check_in_timeout');
        return;
      }
      endsAt += rounds[round] * 1000;
    }
    store.setState({ round, endsAt });
    schedule();
    remind();
  }

  return {
    store,
    sync,
    roundDuration: () => rounds[store.getState().round],

    // A second crash during a check-in must not hand the driver more time.
    begin(event: CrashEvent | null = null) {
      const { status } = store.getState();
      if (status === 'waiting' || status === 'escalated') return;
      const total = getCountdownSeconds?.() ?? 180;
      const safeTotal = [60, 120, 180].includes(total) ? total : 180;
      rounds = [safeTotal / 6, safeTotal / 3, safeTotal / 2];
      store.setState({
        status: 'waiting',
        round: 0,
        endsAt: now() + rounds[0] * 1000,
        event,
      });
      schedule();
    },

    confirmOk() {
      clearTimeout(timer);
      if (store.getState().status === 'escalated') cancelEscalation?.();
      store.setState({ ...idle, status: 'confirmed' });
    },

    needHelp() {
      if (store.getState().status !== 'escalated') finish('user_requested');
    },
  };
}

export type CheckInService = ReturnType<typeof createCheckInService>;
