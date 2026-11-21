// env.ts - motion and device capability checks shared by every script

const mq = (q: string) => matchMedia(q);

export const reducedMotion = mq("(prefers-reduced-motion: reduce)").matches;
export const finePointer = mq("(hover: hover) and (pointer: fine)").matches;

export function onSchemeChange(fn: () => void) {
  mq("(prefers-color-scheme: dark)").addEventListener("change", fn);
}

export const idle = (fn: () => void, timeout = 1500) =>
  "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 200);
