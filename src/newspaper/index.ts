import type { HeadlineCandidate, NewspaperEdition, NewspaperState } from '../types/newspaper.js';

/**
 * A headline collector function. Games register these to generate domain-specific headlines.
 * Each collector pushes candidates into the pool with priorities.
 */
export type HeadlineCollector<S> = (state: S, pool: HeadlineCandidate[]) => void;

/**
 * Generate a newspaper edition from pluggable headline collectors.
 *
 * Collectors push HeadlineCandidates into a pool. Engine sorts by priority
 * and picks the top N. Games provide collectors for their domain
 * (e.g. AI milestones, content launches, subscriber thresholds).
 */
export function generateNewspaper<S>(
  state: S,
  collectors: HeadlineCollector<S>[],
  maxHeadlines: number = 4,
  fallback?: HeadlineCandidate,
): { text: string; body: string; category: string }[] {
  const pool: HeadlineCandidate[] = [];

  for (const collect of collectors) {
    collect(state, pool);
  }

  pool.sort((a, b) => b.priority - a.priority);

  const headlines = pool.slice(0, maxHeadlines).map(({ text, body, category }) => ({
    text,
    body,
    category,
  }));

  if (headlines.length === 0 && fallback) {
    headlines.push({ text: fallback.text, body: fallback.body, category: fallback.category });
  }

  return headlines;
}

/** Create an edition record for storage. */
export function createEdition(
  headlines: { text: string; body: string; category: string }[],
  day: number,
  year: number,
  quarter: number,
): NewspaperEdition {
  return { headlines, publishedOnDay: day, year, quarter };
}

/** Create initial newspaper state. */
export function createNewspaperState(): NewspaperState {
  return { editions: [], currentEdition: null };
}
