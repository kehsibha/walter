export type Preference = {
  topic: string;
  category?: string | null;
  geographic_scope?: string | null;
  priority: number;
};

export function pickTopTopics(preferences: Preference[], max = 5) {
  // Basic, deterministic ranking for demo:
  // - highest priority first
  // - attempt category diversity
  const prefs = [...preferences].sort((a, b) => b.priority - a.priority);
  const picked: Preference[] = [];
  const usedCategories = new Set<string>();

  for (const p of prefs) {
    if (picked.length >= max) break;
    const cat = (p.category ?? "").trim().toLowerCase();
    if (cat && usedCategories.has(cat) && picked.length < Math.max(1, max - 1)) continue;
    picked.push(p);
    if (cat) usedCategories.add(cat);
  }

  // Fill remaining slots even if categories repeat.
  for (const p of prefs) {
    if (picked.length >= max) break;
    if (picked.some((x) => x.topic === p.topic)) continue;
    picked.push(p);
  }

  return picked;
}

