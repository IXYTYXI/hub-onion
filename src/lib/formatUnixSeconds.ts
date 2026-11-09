/** Format API Unix-seconds timestamps for local display. */
export function formatUnixSeconds(sec: number | null | undefined): string {
  if (sec == null || !Number.isFinite(sec) || sec <= 0) return "—";
  return new Date(sec * 1000).toLocaleString();
}
