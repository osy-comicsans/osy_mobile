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
  now?: () => number;
}

const idle: CheckInState = { status: 'idle', round: 0, endsAt: null, event: null };

export function createCheckInService({ escalate, remind, now = Date.now }: CheckInOptions) {
  const store = createStore<CheckInState>(() => idle);
  let timer: ReturnType<typeof setTimeout> | undefined;

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
      if (round >= CHECK_IN_ROUNDS_SECONDS.length) {
        finish('check_in_timeout');
        return;
      }
      endsAt += CHECK_IN_ROUNDS_SECONDS[round] * 1000;
    }
    store.setState({ round, endsAt });
    schedule();
    remind();
  }

  return {
    store,
    sync,

    // A second crash during a check-in must not hand the driver more time.
    begin(event: CrashEvent | null = null) {
      const { status } = store.getState();
      if (status === 'waiting' || status === 'escalated') return;
      store.setState({
        status: 'waiting',
        round: 0,
        endsAt: now() + CHECK_IN_ROUNDS_SECONDS[0] * 1000,
        event,
      });
      schedule();
    },

    confirmOk() {
      clearTimeout(timer);
      store.setState({ ...idle, status: 'confirmed' });
    },

    needHelp() {
      if (store.getState().status !== 'escalated') finish('user_requested');
    },
  };
}

export type CheckInService = ReturnType<typeof createCheckInService>;
