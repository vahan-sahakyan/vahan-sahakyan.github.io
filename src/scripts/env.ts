// env.ts - motion and device capability checks shared by every script

const mq = (q: string) => matchMedia(q);

export const reducedMotion = mq("(prefers-reduced-motion: reduce)").matches;
export const finePointer = mq("(hover: hover) and (pointer: fine)").matches;

type NavigatorHints = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } };

// live webgl only on devices that can hold 60fps without draining a phone: no reduced motion,
// no save-data, 4+ cores and 4+ GB where reported, and a hardware renderer
export function canRunGl(): boolean {
  if (reducedMotion) return false;
  const n = navigator as NavigatorHints;
  if (n.connection?.saveData) return false;
  if ((n.deviceMemory ?? 8) < 4) return false;
  if ((n.hardwareConcurrency ?? 8) < 4) return false;
  const gl = document.createElement("canvas").getContext("webgl2");
  if (!gl) return false;
  const info = gl.getExtension("WEBGL_debug_renderer_info");
  const renderer = info ? String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL)) : "";
  gl.getExtension("WEBGL_lose_context")?.loseContext();
  return !/swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
}

export function onSchemeChange(fn: () => void) {
  mq("(prefers-color-scheme: dark)").addEventListener("change", fn);
}

export const idle = (fn: () => void, timeout = 1500) =>
  "requestIdleCallback" in window ? requestIdleCallback(fn, { timeout }) : setTimeout(fn, 200);
