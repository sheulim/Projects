// Fixed-date moments that recur on the same calendar date every year.
// Lunar and regional festivals (Diwali, Holi, Eid, Navratri…) change yearly and
// will come from a holiday data feed in the moments calendar stage, not from here.
export type Moment = { month: number; day: number; name: string; market: "India" | "Global" };

const FIXED: Moment[] = [
  { month: 1, day: 1, name: "New Year's Day", market: "Global" },
  { month: 1, day: 26, name: "Republic Day", market: "India" },
  { month: 2, day: 14, name: "Valentine's Day", market: "Global" },
  { month: 3, day: 8, name: "International Women's Day", market: "Global" },
  { month: 5, day: 1, name: "Labour Day", market: "Global" },
  { month: 6, day: 21, name: "International Yoga Day", market: "Global" },
  { month: 8, day: 15, name: "Independence Day", market: "India" },
  { month: 9, day: 5, name: "Teachers' Day", market: "India" },
  { month: 10, day: 2, name: "Gandhi Jayanti", market: "India" },
  { month: 10, day: 31, name: "Halloween", market: "Global" },
  { month: 11, day: 14, name: "Children's Day", market: "India" },
  { month: 12, day: 25, name: "Christmas", market: "Global" },
  { month: 12, day: 31, name: "New Year's Eve", market: "Global" },
];

export type UpcomingMoment = Moment & { date: Date; daysAway: number };

export function upcomingMoments(from: Date = new Date(), count = 5): UpcomingMoment[] {
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const DAY = 86_400_000;
  return FIXED.map((m) => {
    let date = new Date(start.getFullYear(), m.month - 1, m.day);
    if (date < start) date = new Date(start.getFullYear() + 1, m.month - 1, m.day);
    return { ...m, date, daysAway: Math.round((date.getTime() - start.getTime()) / DAY) };
  })
    .sort((a, b) => a.daysAway - b.daysAway)
    .slice(0, count);
}
