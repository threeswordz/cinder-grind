// Only an identical committed command may be replayed. Never rewrite history.
export function reversalReplayState(
  row: { reversedAt: Date | null; reversalKey: string | null; reversalReason: string | null },
  key: string,
  reason: string,
): 'NOT_REPLAY' | 'MATCH' | 'CONFLICT' {
  if (!row.reversedAt || row.reversalKey !== key) return 'NOT_REPLAY';
  return row.reversalReason === reason ? 'MATCH' : 'CONFLICT';
}
