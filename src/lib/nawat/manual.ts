export const MANUAL_PAGES = 120;
export const CONTENTS_PAGES = [2, 3, 4] as const;
export const GROUP_START_PAGE = 101;
export function manualPage(value: number) {
  return Number.isFinite(value) ? Math.max(1, Math.min(MANUAL_PAGES, Math.trunc(value))) : 1;
}