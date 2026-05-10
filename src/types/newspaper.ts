export interface HeadlineCandidate {
  text: string;
  body: string;
  category: string;
  /** Higher priority = more likely to appear */
  priority: number;
}

export interface NewspaperEdition {
  headlines: { text: string; body: string; category: string }[];
  publishedOnDay: number;
  year: number;
  quarter: number;
}

export interface NewspaperState {
  editions: NewspaperEdition[];
  currentEdition: NewspaperEdition | null;
}
