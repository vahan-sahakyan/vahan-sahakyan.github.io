// shape.ts - a single gradient shape on a transparent webgl2 canvas, rendered offline by tools/art for the card art

import { VERT, FRAG } from "./shaders";

export type Preset = {
  shape: "blob" | "torus";
  // icosphere subdivisions, or torus segments [around, tube]
  detail: number | [number, number];
  palette: [string, string, string, string, string];
  amp: number;
  freq: number;
  scale: number;
  // radians
  tilt: [number, number, number];
  hue: number;
  flat?: boolean;
  // ribbon: ring radius, [half-width, half-thickness, full twists]
  ring?: number;
  tube?: [number, number, number];
};

export const PRESETS = {
  ribbon: {
    shape: "torus",
    detail: [420, 64],
    palette: ["#dfe4ff", "#ffffff", "#ffd9c2", "#ff8a5c", "#ff5a2a"],
    amp: 0.05,
    freq: 0.9,
    scale: 1.0,
    tilt: [1.0, 0.25, 0.45],
    hue: 0.3,
    ring: 0.78,
    tube: [0.34, 0.05, 1],
  },
  prism: {
    shape: "blob",
    detail: 1,
    palette: ["#c9d1ff", "#ffffff", "#ffe2cf", "#ff9a6c", "#ff6a3d"],
    amp: 0.14,
    freq: 0.9,
    scale: 0.92,
    tilt: [0.5, 0.6, 0.2],
    hue: 0.36,
    flat: true,
  },
} satisfies Record<string, Preset>;

export type PresetName = keyof typeof PRESETS;

// ---------- geometry ----------
function icosphere(subdiv: number) {
  const t = (1 + Math.sqrt(5)) / 2;
  let pos: number[] = [-1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, 0, 0, -1, t, 0, 1, t, 0, -1, -t, 0, 1, -t, t, 0, -1, t, 0, 1, -t, 0, -1, -t, 0, 1];
  let idx: number[] = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
  const norm = (i: number) => {
    const l = Math.hypot(pos[i * 3], pos[i * 3 + 1], pos[i * 3 + 2]);
    pos[i * 3] /= l;
    pos[i * 3 + 1] /= l;
    pos[i * 3 + 2] /= l;
  };
  for (let i = 0; i < pos.length / 3; i++) norm(i);
  for (let s = 0; s < subdiv; s++) {
    const cache = new Map<number, number>();
    const mid = (a: number, b: number) => {
      const key = a < b ? a * 1e6 + b : b * 1e6 + a;
      let m = cache.get(key);
      if (m === undefined) {
        m = pos.length / 3;
        pos.push((pos[a * 3] + pos[b * 3]) / 2, (pos[a * 3 + 1] + pos[b * 3 + 1]) / 2, (pos[a * 3 + 2] + pos[b * 3 + 2]) / 2);
        norm(m);
        cache.set(key, m);
      }
      return m;
    };
    const next: number[] = [];
    for (let i = 0; i < idx.length; i += 3) {
      const [a, b, c] = [idx[i], idx[i + 1], idx[i + 2]];
      const ab = mid(a, b);
      const bc = mid(b, c);
      const ca = mid(c, a);
      next.push(a, ab, ca, b, bc, ab, c, ca, bc, ab, bc, ca);
    }
    idx = next;
  }
  return { pos: new Float32Array(pos), idx: new Uint32Array(idx) };
}

// (u, v) grid; the vertex shader wraps it into a torus
function torusGrid(nu: number, nv: number) {
  const pos = new Float32Array((nu + 1) * (nv + 1) * 3);
  const idx = new Uint32Array(nu * nv * 6);
  let p = 0;
  for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) ((pos[p++] = i / nu), (pos[p++] = j / nv), (pos[p++] = 0));
  let k = 0;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = i * (nv + 1) + j;
      const b = a + nv + 1;
      idx.set([a, b, a + 1, b, b + 1, a + 1], k);
      k += 6;
    }
  }
  return { pos, idx };
}

// ---------- math ----------
type M4 = Float32Array;
const perspective = (fov: number, aspect: number, near: number, far: number): M4 => {
  const f = 1 / Math.tan(fov / 2);
  const nf = 1 / (near - far);
  return new Float32Array([f / aspect, 0, 0, 0, 0, f, 0, 0, 0, 0, (far + near) * nf, -1, 0, 0, 2 * far * near * nf, 0]);
};
const mul = (a: M4, b: M4): M4 => {
  const o = new Float32Array(16);
  for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
  return o;
};
const rotX = (t: number): M4 => new Float32Array([1, 0, 0, 0, 0, Math.cos(t), Math.sin(t), 0, 0, -Math.sin(t), Math.cos(t), 0, 0, 0, 0, 1]);
const rotY = (t: number): M4 => new Float32Array([Math.cos(t), 0, -Math.sin(t), 0, 0, 1, 0, 0, Math.sin(t), 0, Math.cos(t), 0, 0, 0, 0, 1]);
const rotZ = (t: number): M4 => new Float32Array([Math.cos(t), Math.sin(t), 0, 0, -Math.sin(t), Math.cos(t), 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
const hexToRgb = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);

export type ShapeState = {
  time: number;
  // -1..1, smoothed by the caller
  pointer: [number, number];
  // 0..1 progress of the host section scrolling away
  scroll: number;
  morph: number;
  spin: number;
  tilt: number;
  bulge: number;
};

export function createShape(canvas: HTMLCanvasElement, preset: Preset, { preserve = false, maxDpr = 2 } = {}) {
  const gl = canvas.getContext("webgl2", { alpha: true, premultipliedAlpha: true, antialias: true, preserveDrawingBuffer: preserve });
  if (!gl) return null;

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? "shader");
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prog) ?? "link");
  gl.useProgram(prog);

  const geo = preset.shape === "blob" ? icosphere(preset.detail as number) : torusGrid(...(preset.detail as [number, number]));
  const vao = gl.createVertexArray();
  gl.bindVertexArray(vao);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, geo.pos, gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, "aPos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 3, gl.FLOAT, false, 0, 0);
  const ibo = gl.createBuffer();
  gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo);
  gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, geo.idx, gl.STATIC_DRAW);

  const u = (n: string) => gl.getUniformLocation(prog, n);
  const U = {
    proj: u("uProj"),
    mv: u("uModelView"),
    time: u("uTime"),
    amp: u("uAmp"),
    freq: u("uFreq"),
    shape: u("uShape"),
    bulge: u("uBulge"),
    pointer: u("uPointer"),
    ring: u("uRing"),
    tube: u("uTube"),
    c: u("uC"),
    flat: u("uFlat"),
    hue: u("uHue"),
  };
  gl.uniform1f(U.freq, preset.freq);
  gl.uniform1f(U.shape, preset.shape === "blob" ? 0 : 1);
  gl.uniform1f(U.ring, preset.ring ?? 0.8);
  gl.uniform3fv(U.tube, preset.tube ?? [0.3, 0.3, 0]);
  gl.uniform3fv(U.c, new Float32Array(preset.palette.flatMap(hexToRgb)));
  gl.uniform1f(U.flat, preset.flat ? 1 : 0);
  gl.uniform1f(U.hue, preset.hue);
  gl.enable(gl.DEPTH_TEST);
  // the torus grid's winding isn't outward everywhere, so only the sphere culls
  if (preset.shape === "blob") gl.enable(gl.CULL_FACE);
  gl.clearColor(0, 0, 0, 0);

  let dpr = Math.min(devicePixelRatio || 1, maxDpr);
  let aspect = 1;
  const resize = () => {
    const { width, height } = canvas.getBoundingClientRect();
    if (!width || !height) return;
    const w = Math.round(width * dpr);
    const h = Math.round(height * dpr);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    aspect = width / height;
    gl.viewport(0, 0, w, h);
    gl.uniformMatrix4fv(U.proj, false, perspective(0.52, aspect, 0.1, 20));
  };
  resize();

  function render(s: ShapeState) {
    const [px, py] = s.pointer;
    const [tx, ty, tz] = preset.tilt;
    // the camera sits back further on tall canvases so the shape never clips
    const dist = 4.8 / Math.min(aspect, 1);
    const rot = mul(
      rotZ(tz + px * 0.08),
      mul(rotX(tx + py * s.tilt + s.scroll * 0.4), rotY(ty + s.time * 0.06 + px * s.tilt + s.scroll * s.spin))
    );
    const sc = preset.scale;
    const model = mul(new Float32Array([1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, -dist, 1]), mul(rot, new Float32Array([sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, sc, 0, 0, 0, 0, 1])));
    // pointer as a direction in model space: the inverse rotation is its transpose
    const v = [px * 0.9, py * 0.9, 0.7];
    const l = Math.hypot(v[0], v[1], v[2]);
    const pm = [0, 1, 2].map((i) => (rot[i * 4] * v[0] + rot[i * 4 + 1] * v[1] + rot[i * 4 + 2] * v[2]) / l);

    gl!.uniformMatrix4fv(U.mv, false, model);
    gl!.uniform1f(U.time, s.time * s.morph);
    gl!.uniform1f(U.amp, preset.amp * (1 + s.scroll * 0.35));
    gl!.uniform1f(U.bulge, s.bulge * Math.min(1, Math.hypot(px, py) * 1.4));
    gl!.uniform3fv(U.pointer, pm);
    gl!.clear(gl!.COLOR_BUFFER_BIT | gl!.DEPTH_BUFFER_BIT);
    gl!.drawElements(gl!.TRIANGLES, geo.idx.length, gl!.UNSIGNED_INT, 0);
  }

  return {
    render,
    resize,
    setDpr(next: number) {
      dpr = next;
      resize();
    },
    get dpr() {
      return dpr;
    },
    destroy() {
      gl.getExtension("WEBGL_lose_context")?.loseContext();
    },
  };
}
