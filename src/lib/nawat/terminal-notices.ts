/** Emit a recurring connection condition once, until the condition changes. */
export function createTerminalNoticeGate() {
  let previous: string | null = null;
  return {
    shouldEmit(key: string) {
      if (key === previous) return false;
      previous = key;
      return true;
    },
    reset() {
      previous = null;
    },
  };
}