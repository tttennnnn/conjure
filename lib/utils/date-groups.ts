interface Dated {
  createdAt: string;
}

interface DateGroup<T> {
  label: string;
  items: T[];
}

export function groupByDate<T extends Dated>(items: T[]): DateGroup<T>[] {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart.getTime() - 86400000);
  const weekStart = new Date(todayStart.getTime() - 7 * 86400000);

  const today: T[] = [];
  const yesterday: T[] = [];
  const week: T[] = [];
  const older: T[] = [];

  for (const item of items) {
    const date = new Date(item.createdAt);
    if (date >= todayStart) today.push(item);
    else if (date >= yesterdayStart) yesterday.push(item);
    else if (date >= weekStart) week.push(item);
    else older.push(item);
  }

  const buckets: [string, T[]][] = [
    ["Today", today],
    ["Yesterday", yesterday],
    ["Previous 7 days", week],
    ["Older", older],
  ];

  return buckets
    .filter(([, items]) => items.length > 0)
    .map(([label, items]) => ({ label, items }));
}

export function relativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
