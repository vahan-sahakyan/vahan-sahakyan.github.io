// 3d simplex noise by Ian McEwan and Stefan Gustavson (Ashima Arts), MIT license
const NOISE = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }
float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(i.z + vec4(0.0, i1.z, i2.z, 1.0)) + i.y + vec4(0.0, i1.y, i2.y, 1.0)) + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}
`;

// aPos is a unit-sphere point for the blob, or (u, v, 0) in [0, 1] for the torus
export const VERT = /* glsl */ `#version 300 es
precision highp float;
in vec3 aPos;
uniform mat4 uProj;
uniform mat4 uModelView;
uniform float uTime;
uniform float uAmp;
uniform float uFreq;
uniform float uShape;
uniform float uBulge;
uniform vec3 uPointer;
uniform float uRing;
uniform vec3 uTube;
out vec3 vNormal;
out vec3 vView;
out vec3 vObj;
out float vDisp;
${NOISE}
vec3 basePos(vec3 a, out vec3 n) {
  if (uShape < 0.5) {
    n = normalize(a);
    return n;
  }
  // a flat band around a ring: elliptical cross-section (uTube.x wide, uTube.y thick),
  // rotated uTube.z full turns along the ring so the seam closes
  float u = a.x * 6.2831853;
  float v = a.y * 6.2831853;
  float th = u * uTube.z;
  vec3 e1 = vec3(cos(u), sin(u), 0.0);
  vec3 e2 = vec3(0.0, 0.0, 1.0);
  vec2 q = vec2(uTube.x * cos(v), uTube.y * sin(v));
  vec2 m = normalize(vec2(cos(v) / uTube.x, sin(v) / uTube.y));
  mat2 r = mat2(cos(th), sin(th), -sin(th), cos(th));
  q = r * q;
  m = r * m;
  n = normalize(e1 * m.x + e2 * m.y);
  return e1 * (uRing + q.x) + e2 * q.y;
}
float disp(vec3 p) {
  float t = uTime;
  float d = snoise(p * uFreq + vec3(0.0, 0.0, t)) * uAmp;
  d += snoise(p * uFreq * 2.3 - vec3(t * 0.7, 0.0, t * 0.4)) * uAmp * 0.12;
  float facing = max(dot(normalize(p), uPointer), 0.0);
  return d + facing * facing * facing * uBulge;
}
vec3 displaced(vec3 a, out float d) {
  vec3 n;
  vec3 p = basePos(a, n);
  d = disp(p);
  return p + n * d;
}
void main() {
  float d, dA, dB;
  vec3 P = displaced(aPos, d);
  vec3 A;
  vec3 B;
  if (uShape < 0.5) {
    vec3 n = normalize(aPos);
    vec3 t1 = normalize(cross(n, abs(n.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0)));
    vec3 t2 = cross(n, t1);
    A = displaced(normalize(aPos + t1 * 0.01), dA);
    B = displaced(normalize(aPos + t2 * 0.01), dB);
  } else {
    A = displaced(aPos + vec3(0.002, 0.0, 0.0), dA);
    B = displaced(aPos + vec3(0.0, 0.002, 0.0), dB);
  }
  vec3 N = normalize(cross(A - P, B - P));
  vec4 mv = uModelView * vec4(P, 1.0);
  vNormal = normalize(mat3(uModelView) * N);
  vView = mv.xyz;
  vObj = P;
  vDisp = d;
  gl_Position = uProj * mv;
}
`;

export const FRAG = /* glsl */ `#version 300 es
precision highp float;
in vec3 vNormal;
in vec3 vView;
in vec3 vObj;
in float vDisp;
uniform vec3 uC[5];
uniform float uTime;
uniform float uFlat;
uniform float uHue;
out vec4 outColor;

vec3 ramp(float x) {
  x = clamp(x, 0.0, 1.0) * 4.0;
  if (x < 1.0) return mix(uC[0], uC[1], x);
  if (x < 2.0) return mix(uC[1], uC[2], x - 1.0);
  if (x < 3.0) return mix(uC[2], uC[3], x - 2.0);
  return mix(uC[3], uC[4], x - 3.0);
}

void main() {
  vec3 N = normalize(vNormal);
  if (uFlat > 0.5) N = normalize(cross(dFdx(vView), dFdy(vView)));
  vec3 V = normalize(-vView);
  // visible points of a closed surface face the camera
  if (dot(N, V) < 0.0) N = -N;
  float ndv = clamp(dot(N, V), 0.0, 1.0);
  float fres = pow(1.0 - ndv, 2.2);

  // gradient flows over the surface with height, facing and displacement
  float k = uHue + 0.34 * vObj.y - 0.18 * vObj.x + 0.2 * N.x + 0.9 * vDisp + 0.05 * sin(uTime * 0.6 + vObj.z * 3.0);
  vec3 base = ramp(k);
  vec3 film = ramp(k + 0.35 + fres * 0.5);
  vec3 col = mix(base, film, fres * 0.85);

  vec3 L = normalize(vec3(-0.45, 0.75, 0.55));
  float diff = 0.5 + 0.5 * dot(N, L);
  col *= mix(0.72, 1.12, diff);
  vec3 H = normalize(L + V);
  float nh = max(dot(N, H), 0.0);
  col += vec3(1.0) * (pow(nh, 70.0) * 0.6 + pow(nh, 9.0) * 0.14);
  // soft back light keeps the far rim from going muddy
  col += ramp(k + 0.6) * pow(max(dot(N, normalize(vec3(0.6, -0.5, -0.4))), 0.0), 2.0) * 0.25;
  col = mix(col, vec3(1.0, 0.97, 0.99), fres * 0.3);
  outColor = vec4(col, 1.0);
}
`;
