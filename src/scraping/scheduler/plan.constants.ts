export const SCRAPE_INTERVAL_MINUTES = { FREE: 180, PRO: 60 } as const;
export const PLAN_LIMITS = {
  FREE: { maxTrackedItems: 5, queuePriority: 2 as const },
  PRO:  { maxTrackedItems: Infinity, queuePriority: 1 as const },
} as const;
