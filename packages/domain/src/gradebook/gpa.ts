/**
 * GPA on a 4.0 scale, as in the original app: 90%+ is 4.0, each band of 10 points
 * below that adds a tenth per point above the band's floor, and below 60% it is p/60.
 */
export function gpaFromPercentage(percentage: number): number {
  if (percentage >= 90) return 4;
  if (percentage >= 80) return 3 + (percentage - 80) / 10;
  if (percentage >= 70) return 2 + (percentage - 70) / 10;
  if (percentage >= 60) return 1 + (percentage - 60) / 10;
  return percentage / 60;
}
