import type { CurrentRoad, MatchResponse, NearestResponse } from '../types/osrm.schemas';

export const MIN_MATCH_CONFIDENCE = 0.3;

// One road can carry several numbers, such as `RN 63; CW 111`.
export function splitRefs(ref: string | undefined): string[] {
  return (ref ?? '').split(/[;,]/).map((part) => part.trim()).filter(Boolean);
}

export function isSameRoad(a: CurrentRoad, b: CurrentRoad): boolean {
  return a.name === b.name && a.refs.join() === b.refs.join();
}

// The driver is on the last named step of the newest stretch of the trace.
export function roadFromMatch(response: MatchResponse, now: number): CurrentRoad | null {
  const matching = response.matchings[response.matchings.length - 1];
  if (!matching || matching.confidence < MIN_MATCH_CONFIDENCE) return null;

  const leg = matching.legs[matching.legs.length - 1];
  const step = [...(leg?.steps ?? [])].reverse().find(({ name, ref }) => name || ref);
  if (!step) return null;

  return {
    name: step.name || null,
    refs: splitRefs(step.ref),
    osmNodeIds: leg?.annotation?.nodes ?? [],
    updatedAt: now,
  };
}

// `nearest` has no road numbers, so it only fills in until a trace can be matched.
export function roadFromNearest(response: NearestResponse, now: number): CurrentRoad | null {
  const [waypoint] = response.waypoints;
  if (!waypoint?.name) return null;
  return { name: waypoint.name, refs: [], osmNodeIds: waypoint.nodes, updatedAt: now };
}
