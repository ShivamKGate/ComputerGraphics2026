// Alien Planet 18
// Shivam Sinay Kharangate

// initialising the canvas and webgl
const canvas = document.getElementById('c');
const gl = canvas.getContext('webgl');
if (!gl) {
  alert('WebGL is not available in this browser.');
  throw new Error('WebGL unavailable');
}

// vertex shader
const vertexShaderSource = `
  attribute vec3 aPosition;
  attribute vec3 aColor;
  attribute vec3 aNormal;

  uniform mat4 uModel;
  uniform mat4 uView;
  uniform mat4 uProjection;

  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vViewDepth;

  void main() {
    vColor = aColor;
    vec4 world = uModel * vec4(aPosition, 1.0);
    vWorldPos = world.xyz;
    vNormal = normalize(mat3(uModel) * aNormal);
    vec4 viewPos = uView * world;
    vViewDepth = -viewPos.z;
    gl_Position = uProjection * viewPos;
  }
`;

// fragment shader — directional + up to 4 dynamic point lights + fog + emissive
const fragmentShaderSource = `
  precision highp float;

  uniform vec3 uTint;
  uniform float uEmissive;     // 0 = lit surface, 1 = glowing crystal
  uniform vec3 uAmbient;
  uniform vec3 uDirLightDir;
  uniform vec3 uDirLightColor;
  uniform vec3 uFogColor;
  uniform float uFogDensity;

  // Dynamic crystal / lava point lights (Level 4)
  uniform vec3 uL0Pos; uniform vec3 uL0Color; uniform float uL0Range;
  uniform vec3 uL1Pos; uniform vec3 uL1Color; uniform float uL1Range;
  uniform vec3 uL2Pos; uniform vec3 uL2Color; uniform float uL2Range;
  uniform vec3 uL3Pos; uniform vec3 uL3Color; uniform float uL3Range;
  uniform float uUsePointLights; // 1 on Level 4, else 0

  // Level 4 additions. The sky is still a cube; its inside is procedurally colored.
  uniform float uTime;
  uniform float uSkyMode;
  uniform vec3 uCameraPos;

  varying vec3 vColor;
  varying vec3 vNormal;
  varying vec3 vWorldPos;
  varying float vViewDepth;

  // Simple value noise and fractal noise for clouds in the alien nebula.
  float hash3(vec3 p) {
    p = fract(p * 0.1031);
    p += dot(p, p.yxz + 33.33);
    return fract((p.x + p.y) * p.z);
  }
  float noise3(vec3 p) {
    vec3 i = floor(p), f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    float a = mix(hash3(i), hash3(i + vec3(1,0,0)), f.x);
    float b = mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x);
    float c = mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x);
    float d = mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x);
    return mix(mix(a,b,f.y),mix(c,d,f.y),f.z);
  }
  vec3 alienSky(vec3 ray) {
    float h = clamp(ray.y * 0.5 + 0.5, 0.0, 1.0);
    vec3 horizon = vec3(0.35, 0.075, 0.35);
    vec3 zenith = vec3(0.018, 0.012, 0.10);
    vec3 sky = mix(horizon, zenith, smoothstep(0.13, 0.95, h));

    // Two drifting, multi-scale nebula bands (not a flat skybox color).
    vec3 q = ray * 5.5;
    float cloud = noise3(q + vec3(uTime * 0.008, 0.0, 0.0)) * 0.55;
    cloud += noise3(q * 2.8 - vec3(0.0, uTime * 0.014, 0.0)) * 0.30;
    cloud += noise3(q * 6.0) * 0.15;
    float band = pow(max(0.0, 1.0 - abs(ray.y - 0.20 - 0.25 * sin(ray.x * 3.5 + ray.z * 2.0))), 3.0);
    float nebula = smoothstep(0.39, 0.78, cloud) * band;
    sky += vec3(0.44, 0.065, 0.50) * nebula;
    sky += vec3(0.02, 0.28, 0.35) * nebula * (0.5 + 0.5 * sin(ray.x * 12.0));

    // Curtains of aurora light that slowly undulate near the horizon.
    float wave = sin(ray.x * 14.0 + ray.z * 6.0 + uTime * 0.20) * 0.07;
    float aurora = exp(-pow((ray.y - 0.23 - wave) * 8.0, 2.0));
    aurora *= 0.45 + 0.55 * noise3(ray * 8.0 + vec3(0.0, uTime * 0.025, 0.0));
    sky += mix(vec3(0.08,0.70,0.65), vec3(0.45,0.13,0.72), 0.5+0.5*sin(ray.x*9.0)) * aurora * 0.30;

    // Tiny, sparse stars from angular 3D cells, with independent twinkle.
    vec3 cells = floor(ray * 280.0);
    float star = hash3(cells);
    float sparkle = smoothstep(0.994, 0.9998, star);
    sparkle *= 0.70 + 0.30 * sin(uTime * (0.8 + hash3(cells + 7.0) * 3.0) + star * 60.0);
    sky += mix(vec3(0.40,0.82,1.0), vec3(1.0,0.68,0.95), hash3(cells + 12.0)) * sparkle * 1.2;

    // Two distant planets, with soft atmospheric edge and a rim halo.
    vec3 moonDir = normalize(vec3(-0.66, 0.42, -0.70));
    float m = dot(ray, moonDir);
    float disc = smoothstep(0.996, 0.997, m);
    float rim = smoothstep(0.989, 0.996, m) * (1.0 - disc);
    sky = mix(sky, vec3(0.40,0.66,0.98) * (0.65 + 0.35 * noise3(ray * 45.0)), disc);
    sky += vec3(0.30,0.50,0.95) * rim * 0.22;
    vec3 smallMoon = normalize(vec3(0.76, 0.32, 0.57));
    float m2 = dot(ray, smallMoon);
    sky = mix(sky, vec3(0.92,0.35,0.70), smoothstep(0.9991, 0.99945, m2));
    return sky;
  }

  vec3 pointLight(vec3 pos, vec3 col, float range, vec3 N, vec3 worldPos) {
    vec3 toL = pos - worldPos;
    float dist = length(toL);
    float atten = 1.0 - clamp(dist / range, 0.0, 1.0);
    atten *= atten; // soft falloff
    vec3 L = normalize(toL);
    float ndotl = max(dot(N, L), 0.0);
    // wrap a little so nearby cubes get a glow on more faces (bioluminescent bleed)
    float wrap = ndotl * 0.75 + 0.25;
    return col * wrap * atten;
  }

  void main() {
    if (uSkyMode > 0.5) {
      gl_FragColor = vec4(alienSky(normalize(vWorldPos - uCameraPos)), 1.0);
      return;
    }
    vec3 N = normalize(vNormal);
    vec3 base = vColor * uTint;

    // Emissive cubes (crystals) skip most shading and bloom through fog a bit.
    if (uEmissive > 0.5) {
      vec3 glow = base * 1.35;
      float fogFactor = 1.0 - exp(-uFogDensity * vViewDepth * 0.55);
      fogFactor = clamp(fogFactor, 0.0, 0.65);
      gl_FragColor = vec4(mix(glow, uFogColor, fogFactor), 1.0);
      return;
    }

    vec3 lit = uAmbient;
    lit += uDirLightColor * max(dot(N, normalize(uDirLightDir)), 0.0);

    if (uUsePointLights > 0.5) {
      lit += pointLight(uL0Pos, uL0Color, uL0Range, N, vWorldPos);
      lit += pointLight(uL1Pos, uL1Color, uL1Range, N, vWorldPos);
      lit += pointLight(uL2Pos, uL2Color, uL2Range, N, vWorldPos);
      lit += pointLight(uL3Pos, uL3Color, uL3Range, N, vWorldPos);
    }

    vec3 color = base * lit;
    // Level 4: color-shifting mineral strata and luminous veins across the terrain.
    if (uUsePointLights > 0.5 && vWorldPos.y < 7.0 && N.y > 0.3) {
      float swirls = sin(vWorldPos.x * 0.43 + sin(vWorldPos.z * 0.31) * 2.0);
      float veins = pow(max(0.0, sin(vWorldPos.x * 1.7 + vWorldPos.z * 1.15 + sin(vWorldPos.z*0.6))), 28.0);
      vec3 tint = mix(vec3(0.85, 0.63, 1.12), vec3(0.52, 1.19, 1.20), swirls * 0.5 + 0.5);
      color *= tint;
      color += vec3(0.02, 0.28, 0.30) * veins * (0.4 + 0.35*sin(uTime*1.6 + vWorldPos.x));
    }
    float fogFactor = 1.0 - exp(-uFogDensity * vViewDepth);
    fogFactor = clamp(fogFactor, 0.0, 1.0);
    color = mix(color, uFogColor, fogFactor);
    gl_FragColor = vec4(color, 1.0);
  }
`;

// compiling the shader
function compileShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    throw new Error(gl.getShaderInfoLog(shader));
  }
  return shader;
}

// creating the program
const program = gl.createProgram();
gl.attachShader(program, compileShader(gl.VERTEX_SHADER, vertexShaderSource));
gl.attachShader(program, compileShader(gl.FRAGMENT_SHADER, fragmentShaderSource));
gl.linkProgram(program);
if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
  throw new Error(gl.getProgramInfoLog(program));
}
gl.useProgram(program);

// getting the attributes and uniforms
const aPosition = gl.getAttribLocation(program, 'aPosition');
const aColor = gl.getAttribLocation(program, 'aColor');
const aNormal = gl.getAttribLocation(program, 'aNormal');
const uModel = gl.getUniformLocation(program, 'uModel');
const uView = gl.getUniformLocation(program, 'uView');
const uProjection = gl.getUniformLocation(program, 'uProjection');
const uTint = gl.getUniformLocation(program, 'uTint');
const uEmissive = gl.getUniformLocation(program, 'uEmissive');
const uAmbient = gl.getUniformLocation(program, 'uAmbient');
const uDirLightDir = gl.getUniformLocation(program, 'uDirLightDir');
const uDirLightColor = gl.getUniformLocation(program, 'uDirLightColor');
const uFogColor = gl.getUniformLocation(program, 'uFogColor');
const uFogDensity = gl.getUniformLocation(program, 'uFogDensity');
const uUsePointLights = gl.getUniformLocation(program, 'uUsePointLights');
const uTime = gl.getUniformLocation(program, 'uTime');
const uSkyMode = gl.getUniformLocation(program, 'uSkyMode');
const uCameraPos = gl.getUniformLocation(program, 'uCameraPos');
const uL0Pos = gl.getUniformLocation(program, 'uL0Pos');
const uL0Color = gl.getUniformLocation(program, 'uL0Color');
const uL0Range = gl.getUniformLocation(program, 'uL0Range');
const uL1Pos = gl.getUniformLocation(program, 'uL1Pos');
const uL1Color = gl.getUniformLocation(program, 'uL1Color');
const uL1Range = gl.getUniformLocation(program, 'uL1Range');
const uL2Pos = gl.getUniformLocation(program, 'uL2Pos');
const uL2Color = gl.getUniformLocation(program, 'uL2Color');
const uL2Range = gl.getUniformLocation(program, 'uL2Range');
const uL3Pos = gl.getUniformLocation(program, 'uL3Pos');
const uL3Color = gl.getUniformLocation(program, 'uL3Color');
const uL3Range = gl.getUniformLocation(program, 'uL3Range');

// basic default lighting for Levels 0–3
function setBasicLighting() {
  gl.uniform3fv(uAmbient, [0.35, 0.35, 0.35]);
  gl.uniform3fv(uDirLightDir, [0.4, 1.0, 0.25]);
  gl.uniform3fv(uDirLightColor, [0.65, 0.65, 0.65]);
  gl.uniform3fv(uFogColor, [0.05, 0.03, 0.1]);
  gl.uniform1f(uFogDensity, 0.0);
  gl.uniform1f(uUsePointLights, 0.0);
  gl.uniform1f(uSkyMode, 0.0);
  gl.uniform1f(uEmissive, 0.0);
}

// face definitions of unit cube with the vertices and the normals
const FACE_DEFS = [
  // front +z
  { n: [0, 0, 1], verts: [[-0.5, 0, 0.5], [0.5, 0, 0.5], [0.5, 1, 0.5], [-0.5, 0, 0.5], [0.5, 1, 0.5], [-0.5, 1, 0.5]] },
  // back -z
  { n: [0, 0, -1], verts: [[-0.5, 0, -0.5], [0.5, 1, -0.5], [0.5, 0, -0.5], [-0.5, 0, -0.5], [-0.5, 1, -0.5], [0.5, 1, -0.5]] },
  // top +y
  { n: [0, 1, 0], verts: [[-0.5, 1, -0.5], [-0.5, 1, 0.5], [0.5, 1, 0.5], [-0.5, 1, -0.5], [0.5, 1, 0.5], [0.5, 1, -0.5]] },
  // bottom -y
  { n: [0, -1, 0], verts: [[-0.5, 0, -0.5], [0.5, 0, 0.5], [-0.5, 0, 0.5], [-0.5, 0, -0.5], [0.5, 0, -0.5], [0.5, 0, 0.5]] },
  // right +x
  { n: [1, 0, 0], verts: [[0.5, 0, -0.5], [0.5, 1, -0.5], [0.5, 1, 0.5], [0.5, 0, -0.5], [0.5, 1, 0.5], [0.5, 0, 0.5]] },
  // left -x
  { n: [-1, 0, 0], verts: [[-0.5, 0, -0.5], [-0.5, 1, 0.5], [-0.5, 1, -0.5], [-0.5, 0, -0.5], [-0.5, 0, 0.5], [-0.5, 1, 0.5]] },
];

// number of vertices in the cube
const VERTEX_COUNT = 36;
const FLOATS_PER_VERTEX = 9; // position 3 + color 3 + normal 3
const BYTES_PER_FLOAT = 4;
const stride = FLOATS_PER_VERTEX * BYTES_PER_FLOAT;

const cubeBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);

function enableAttribs() {
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
  gl.enableVertexAttribArray(aPosition);
  gl.vertexAttribPointer(aPosition, 3, gl.FLOAT, false, stride, 0);
  gl.enableVertexAttribArray(aColor);
  gl.vertexAttribPointer(aColor, 3, gl.FLOAT, false, stride, 3 * BYTES_PER_FLOAT);
  gl.enableVertexAttribArray(aNormal);
  gl.vertexAttribPointer(aNormal, 3, gl.FLOAT, false, stride, 6 * BYTES_PER_FLOAT);
}
enableAttribs();

// alien vertex-color procedure, bottom vertices are deep purple soil and top vertices are bright magenta/cyan tips.
function colorForVertex(y, tint) {
  const t = y; // 0 at base, 1 at top of the unit cube
  const base = [0.18, 0.05, 0.32];
  const tip = [0.55 + tint * 0.35, 0.25 + tint * 0.2, 0.85 - tint * 0.25];
  return [
    base[0] + (tip[0] - base[0]) * t,
    base[1] + (tip[1] - base[1]) * t,
    base[2] + (tip[2] - base[2]) * t,
  ];
}

// rebuilding the cube buffer
function rebuildCubeBuffer(tint) {
  const data = [];
  for (const face of FACE_DEFS) {
    for (const v of face.verts) {
      const c = colorForVertex(v[1], tint);
      data.push(v[0], v[1], v[2], c[0], c[1], c[2], face.n[0], face.n[1], face.n[2]);
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
}

// flat gray violet for level 0 and 1a, its still per vertex so the pipeline is the same
function rebuildFlatCubeBuffer(rgb) {
  const data = [];
  for (const face of FACE_DEFS) {
    for (const v of face.verts) {
      data.push(v[0], v[1], v[2], rgb[0], rgb[1], rgb[2], face.n[0], face.n[1], face.n[2]);
    }
  }
  gl.bindBuffer(gl.ARRAY_BUFFER, cubeBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(data), gl.STATIC_DRAW);
}

// matrix helpers
function translation(x, y, z) {
  return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, x, y, z, 1];
}
function scaling(sx, sy, sz) {
  return [sx, 0, 0, 0, 0, sy, 0, 0, 0, 0, sz, 0, 0, 0, 0, 1];
}
// rotating around y axis for UFOs for aiming them along their flight direction
function rotationY(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    c, 0, -s, 0,
    0, 1, 0, 0,
    s, 0, c, 0,
    0, 0, 0, 1,
  ];
}
function rotationX(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    1, 0, 0, 0,
    0, c, s, 0,
    0, -s, c, 0,
    0, 0, 0, 1,
  ];
}
function rotationZ(angle) {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return [
    c, s, 0, 0,
    -s, c, 0, 0,
    0, 0, 1, 0,
    0, 0, 0, 1,
  ];
}
function multiply(a, b) {
  const out = new Array(16).fill(0);
  for (let col = 0; col < 4; col++) {
    for (let row = 0; row < 4; row++) {
      for (let k = 0; k < 4; k++) {
        out[col * 4 + row] += a[k * 4 + row] * b[col * 4 + k];
      }
    }
  }
  return out;
}

// level 3: cubic Bezier curve (degree 3)
// p0/p3 = endpoints, p1/p2 = control points that pull the curve
function cubicBezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const uu = u * u;
  const tt = t * t;
  const a = uu * u;        // (1-t)^3
  const b = 3 * uu * t;    // 3(1-t)^2 t
  const c = 3 * u * tt;    // 3(1-t) t^2
  const d = tt * t;        // t^3
  return [
    a * p0[0] + b * p1[0] + c * p2[0] + d * p3[0],
    a * p0[1] + b * p1[1] + c * p2[1] + d * p3[1],
    a * p0[2] + b * p1[2] + c * p2[2] + d * p3[2],
  ];
}

// derivative b'(t) that I used as a facing direction for the UFO
function cubicBezierTangent(p0, p1, p2, p3, t) {
  const u = 1 - t;
  const c0 = 3 * u * u;
  const c1 = 6 * u * t;
  const c2 = 3 * t * t;
  return [
    c0 * (p1[0] - p0[0]) + c1 * (p2[0] - p1[0]) + c2 * (p3[0] - p2[0]),
    c0 * (p1[1] - p0[1]) + c1 * (p2[1] - p1[1]) + c2 * (p3[1] - p2[1]),
    c0 * (p1[2] - p0[2]) + c1 * (p2[2] - p1[2]) + c2 * (p3[2] - p2[2]),
  ];
}
function perspective(fov, aspect, near, far) {
  const f = 1 / Math.tan(fov / 2);
  return [
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) / (near - far), -1,
    0, 0, (2 * far * near) / (near - far), 0,
  ];
}
function lookAt(eye, target, up) {
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0],
  ];
  const norm = (a) => {
    const len = Math.hypot(a[0], a[1], a[2]);
    return [a[0] / len, a[1] / len, a[2] / len];
  };
  const zAxis = norm(sub(eye, target));
  const xAxis = norm(cross(up, zAxis));
  const yAxis = cross(zAxis, xAxis);
  return[
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -dot(xAxis, eye), -dot(yAxis, eye), -dot(zAxis, eye), 1,
  ];
}

let level = '0';
let gridSize = 12;
let cubes = [];

// level 3 skyscape state
let skyIslands = []; // stationary cube clusters in the sky
let ufos = [];       // crafting that follow cubic Bezier paths
let volcanoCubes = []; // rotating cubes erupting from the center

// level 4 atmosphere / lighting state
let groundPlane = [];  // extended flat surface beyond the heightmapped square
let skyboxParts = [];  // large cubes forming a nebula skybox
let crystals = [];     // glowing cube formations that drive point lights
let pointLights = [];  // runtime light data fed to the shader
let alienSpirals = []; // cube-only mineral towers and distant rock formations
let orbitRings = []; // hovering arc fragments, also cube-only
let shootingStars = []; // moving luminous cube particles
let comets = []; // steep-falling cube comets with mini-cube fire trails

// making some fun ripples on the ground 
function groundRipple(x, z, t) {
  const r = Math.hypot(x, z);
  // two sine terms make clearer peaks/valleys
  const wave =
    Math.sin(r * 1.05 - t * 2.5) * 1.05 +
    Math.sin(r * 2.1 - t * 2.5) * 0.28;
  // carrying the ripples across the whole surface
  const envelope = (0.35 + 0.65 * Math.min(1, r / 3.5)) * Math.exp(-r * 0.0045);
  return wave * envelope;
}

// grid options for level 1 and 2
const GRID_OPTIONS_L1 = [
  { value: '8', label: '8x8' },
  { value: '12', label: '12x12' },
  { value: '16', label: '16x16' },
  { value: '20', label: '20x20' },
];
const GRID_OPTIONS_L2 = [
  { value: '16', label: '16x16 (low)' },
  { value: '24', label: '24x24' },
  { value: '32', label: '32x32' },
  { value: '40', label: '40x40 (target)' },
];

// image sampling state for level 2
// colorMap and heightMap are the images that are used to sample the landscape
let colorMap = null;
let heightMap = null;
let mapsReady = false;

const HEIGHT_MIN = 0.25;
const HEIGHT_MAX = 5.0;

function loadImageData(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const off = document.createElement('canvas');
      off.width = img.width;
      off.height = img.height;
      const ctx = off.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const imageData = ctx.getImageData(0, 0, img.width, img.height);
      resolve({ width: img.width, height: img.height, data: imageData.data });
    };
    img.onerror = () => reject(new Error('Failed to load ' + url));
    img.src = url;
  });
}

async function loadMaps() {
  try {
    const [color, height] = await Promise.all([
      loadImageData('images/alien-color.png'),
      loadImageData('images/alien-height.png'),
    ]);
    colorMap = color;
    heightMap = height;
    mapsReady = true;
    // if the user already opened level 2/3/4 while maps were loading, rebuild now
    if (level === '2' || level === '3' || level === '4') setLevel(level);
  } catch (err) {
    console.error(err);
    document.getElementById('status').textContent =
      'Level 2 maps failed to load (serve folder over http, not file://)';
  }
}
loadMaps();

// sampling one pixel from an RGBA buffer
// grid is N×N, image is W×H: mapping each cube to a pixel by stretching UV across the image
function samplePixel(map, col, row, n) {
  const u = n <= 1 ? 0 : col / (n - 1);
  const v = n <= 1 ? 0 : row / (n - 1);
  const px = Math.min(map.width - 1, Math.max(0, Math.floor(u * (map.width - 1))));
  const py = Math.min(map.height - 1, Math.max(0, Math.floor(v * (map.height - 1))));
  const i = (py * map.width + px) * 4;
  return {
    r: map.data[i],
    g: map.data[i + 1],
    b: map.data[i + 2],
  };
}

// gray 0–255, world height: black is short and white is tall
function grayToHeight(gray) {
  return HEIGHT_MIN + (gray / 255) * (HEIGHT_MAX - HEIGHT_MIN);
}

function setGridOptions(options, selected) {
  const sel = document.getElementById('gridSelect');
  sel.innerHTML = '';
  for (const opt of options) {
    const el = document.createElement('option');
    el.value = opt.value;
    el.textContent = opt.label;
    if (String(selected) === opt.value) el.selected = true;
    sel.appendChild(el);
  }
}

// deterministic ish height from the grid position, mainly for the alien ridges, not pure noise
function proceduralHeight(col, row, n) {
  const u = col / Math.max(n - 1, 1);
  const v = row / Math.max(n - 1, 1);
  const ridge = Math.sin(u * Math.PI * 2.2) * Math.cos(v * Math.PI * 1.7);
  const peak = Math.sin(u * Math.PI) * Math.sin(v * Math.PI); // taller near center
  const jitter = ((Math.sin(col * 12.9898 + row * 78.233) * 43758.5453) % 1 + 1) % 1;
  return 0.35 + Math.max(0, 1.6 * peak + 0.9 * ridge) + jitter * 0.55;
}
function alienTint(col, row, n) {
  const u = col / Math.max(n - 1, 1);
  const v = row / Math.max(n - 1, 1);
  return 0.15 + 0.7 * ((u + v) * 0.5);
}
function buildLandscape(withHeights) {
  cubes = [];
  const spacing = 1.15;
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const h = withHeights ? proceduralHeight(col, row, gridSize) : 1.0;
      cubes.push({
        x: (col - (gridSize - 1) / 2) * spacing,
        z: (row - (gridSize - 1) / 2) * spacing,
        height: h,
        baseHeight: h, // kept for Level 4 ripple animation
        tint: alienTint(col, row, gridSize),
        color: null,
      });
    }
  }
}

// level 2: building the landscape from image samples, combining the color and the height maps
function buildLandscapeFromImages() {
  cubes = [];
  if (!mapsReady) return;

  const spacing = 1.05;
  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const rgb = samplePixel(colorMap, col, row, gridSize);
      const grayPix = samplePixel(heightMap, col, row, gridSize);
      // height map is grayscale: using the red channel
      const gray = grayPix.r;
      const h = grayToHeight(gray);
      cubes.push({
        x: (col - (gridSize - 1) / 2) * spacing,
        z: (row - (gridSize - 1) / 2) * spacing,
        height: h,
        baseHeight: h,
        tint: 0.5,
        color: [rgb.r / 255, rgb.g / 255, rgb.b / 255],
      });
    }
  }
}

// level 3: a few floating sky islands UFOs looking thingies
function buildSkyIslands() {
  skyIslands = [
    // island A
    { x: -6, y: 5.5, z: -4, sx: 2.2, sy: 0.6, sz: 1.8, color: [0.45, 0.25, 0.75] },
    { x: -6, y: 6.1, z: -4, sx: 1.2, sy: 0.8, sz: 1.0, color: [0.7, 0.35, 0.95] },
    { x: -5.2, y: 5.8, z: -3.4, sx: 0.7, sy: 1.2, sz: 0.7, color: [0.55, 0.9, 0.95] },
    // island B
    { x: 7, y: 6.2, z: 3, sx: 2.5, sy: 0.5, sz: 2.0, color: [0.35, 0.2, 0.65] },
    { x: 7.4, y: 6.7, z: 3.2, sx: 1.0, sy: 0.7, sz: 1.0, color: [0.85, 0.4, 0.9] },
    { x: 6.4, y: 6.6, z: 2.4, sx: 0.6, sy: 1.0, sz: 0.6, color: [0.4, 0.85, 0.8] },
    // cloud ish floaters
    { x: 0, y: 7.0, z: -8, sx: 3.0, sy: 0.45, sz: 1.4, color: [0.55, 0.45, 0.8] },
    { x: 1.2, y: 7.3, z: -8, sx: 1.6, sy: 0.4, sz: 1.0, color: [0.65, 0.55, 0.9] },
    { x: -9, y: 5.8, z: 6, sx: 2.0, sy: 0.4, sz: 1.2, color: [0.5, 0.4, 0.75] },
  ];
}

// UFOs made of a few cubes, each with its own cubic Bezier control polygon!
function buildUfos() {
  ufos = [
    {
      // wide arc across the sky (lower y axis)
      p0: [-12, 4.2, -5],
      p1: [-3, 6.5, 3],
      p2: [5, 5.0, -1],
      p3: [12, 4.8, 6],
      t: 0,
      speed: 0.08,
      color: [0.75, 0.85, 0.95],
      accent: [0.3, 1.0, 0.7],
    },
    {
      // looping path that dips then rises a little
      p0: [11, 3.8, -8],
      p1: [2, 6.8, -3],
      p2: [-6, 4.0, 2],
      p3: [-12, 5.5, 7],
      t: 0.35,
      speed: 0.06,
      color: [0.95, 0.7, 0.4],
      accent: [1.0, 0.4, 0.85],
    },
  ];
}

// a mini volcano haha, rotating cubes erupting from below the center and rising upward
function buildVolcano() {
  volcanoCubes = [];
  const count = 14;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    volcanoCubes.push({
      // start near the crater and rise
      phase: i / count,
      riseSpeed: 2.2 + (i % 5) * 0.35,
      spinSpeed: 2.4 + (i % 4) * 0.8,
      outward: 0.9 + (i % 3) * 0.45,
      baseAngle: angle,
      size: 0.35 + (i % 3) * 0.12,
      color: i % 2 === 0 ? [1.0, 0.45, 0.2] : [0.95, 0.25, 0.75],
    });
  }
}

// level 4: translating this into a seamless ground grid for every cube matches the detail map's size
// (same spacing / footprint as the NxN heightmap cubes). extra pad rings
// continuing past the map edge so ripples never hit a size mismatch or water gap.
function buildSeamlessLevel4Terrain() {
  const spacing = 1.05; // identical footprint to the NxN detail cubes
  const pad = 28;       // same-size cubes beyond each edge
  const total = gridSize + pad * 2;
  const mapHalf = ((gridSize - 1) / 2) * spacing;

  cubes = [];
  for (let row = 0; row < total; row++) {
    for (let col = 0; col < total; col++) {
      const localCol = col - pad;
      const localRow = row - pad;
      const x = (col - (total - 1) / 2) * spacing;
      const z = (row - (total - 1) / 2) * spacing;
      // Circular blend (not a square cut) so the plain integrates with the crater
      const r = Math.hypot(x, z);
      const outside = Math.max(0, r - mapHalf);
      const flatten = Math.min(1, outside / (pad * spacing * 0.55));

      let h;
      let color;
      if (mapsReady) {
        // Same sampling as the detail map; clamp at the rim when outside
        const ic = Math.min(gridSize - 1, Math.max(0, localCol));
        const ir = Math.min(gridSize - 1, Math.max(0, localRow));
        const rgb = samplePixel(colorMap, ic, ir, gridSize);
        const gray = samplePixel(heightMap, ic, ir, gridSize).r;
        h = grayToHeight(gray);
        color = [rgb.r / 255, rgb.g / 255, rgb.b / 255];
        // Soft circular ease to a rippling plain (cube size stays identical everywhere)
        const n = ((Math.sin(x * 0.35 + z * 0.29) * 43758.5453) % 1 + 1) % 1;
        const plainH = 0.45 + n * 0.55;
        h = h * (1 - flatten) + plainH * flatten;
        color = color.map((c, i) => c * (1 - flatten * 0.22) + [0.22, 0.12, 0.38][i] * flatten * 0.22);
      } else {
        const pc = Math.min(gridSize - 1, Math.max(0, localCol));
        const pr = Math.min(gridSize - 1, Math.max(0, localRow));
        h = proceduralHeight(pc, pr, gridSize);
        const n = ((Math.sin(x * 0.35 + z * 0.29) * 43758.5453) % 1 + 1) % 1;
        h = h * (1 - flatten) + (0.45 + n * 0.55) * flatten;
        const t = alienTint(pc, pr, gridSize);
        color = [0.45 + t * 0.2, 0.2 + t * 0.15, 0.65 + t * 0.2];
      }

      cubes.push({
        x, z,
        height: h,
        baseHeight: h,
        tint: 0.5,
        color,
      });
    }
  }

  // Thin under-crust only — no oversized ground tiles
  groundPlane = [{
    x: 0, y: -0.6, z: 0,
    sx: total * spacing + 4, sy: 0.6, sz: total * spacing + 4,
    color: [0.13, 0.065, 0.24],
    base: true,
    baseSy: 0.6,
  }];
}

// Kept for any leftover callers; Level 4 uses buildSeamlessLevel4Terrain instead.
function buildExtendedGround() {
  buildSeamlessLevel4Terrain();
}

// Mini comets: brown rocky cube cores + fire trails of tiny cubes.
function buildComets() {
  comets = [];
  const browns = [
    [0.42, 0.26, 0.14],
    [0.55, 0.32, 0.16],
    [0.36, 0.22, 0.12],
    [0.48, 0.30, 0.18],
  ];
  for (let i = 0; i < 18; i++) {
    comets.push({
      phase: i / 18,
      speed: 0.08 + (i % 5) * 0.018,
      // start high and off to the side, fall diagonally inward
      x0: -55 + (i % 7) * 16,
      y0: 26 + (i % 4) * 5,
      z0: -48 + (i % 6) * 15,
      dx: 14 + (i % 4) * 7,
      dy: -30 - (i % 4) * 5,
      dz: 8 + (i % 3) * 7,
      headColor: browns[i % browns.length],
    });
  }
}

// The sky remains a SINGLE cube model. Its inner faces get a procedural
// starfield/nebula/aurora/planets from the fragment shader, not an image texture.
function buildSkybox() {
  skyboxParts = [{x:0,y:0,z:0,sx:700,sy:700,sz:700,sky:true}];
}

// Varied rock formations; all parts are stretched and transformed cubes.
function buildAlienFormations() {
  alienSpirals = [];
  const palette=[[0.48,0.19,0.72],[0.14,0.68,0.74],[0.76,0.30,0.62],[0.28,0.37,0.86]];
  for(let i=0;i<15;i++) {
    const a=i*2.399963;
    const r=22+(i%5)*8;
    const x=Math.cos(a)*r,z=Math.sin(a)*r;
    const n=3+(i%5);
    for(let j=0;j<n;j++) {
      alienSpirals.push({x:x+Math.sin(j*1.7)*0.45,z:z+Math.cos(j*1.7)*0.45,
        y:j*0.72,sx:1.0-j*0.09,sy:1.05,sz:1.0-j*0.09,
        yaw:a+j*0.42,color:palette[i%4],glow:j===n-1});
    }
  }
  // Ancient hovering fragmented ring in the distance.
  orbitRings=[];
  for(let i=0;i<52;i++) {
    const a=i/52*Math.PI*2;
    orbitRings.push({a, radius:10.0+Math.sin(i*3.2)*0.3,
      color:i%3===0?[0.23,0.95,0.86]:[0.74,0.27,0.89]});
  }
  shootingStars=[];
  for(let i=0;i<18;i++) shootingStars.push({
    phase:i/18, speed:0.055+(i%5)*0.014,
    x:-65+(i%7)*18, z:-45+(i%6)*17,
    height:22+(i%4)*6, color:i%2?[0.35,0.95,1.0]:[0.99,0.52,0.95]
  });
}

function drawAlienFormations(seconds) {
  for(const p of alienSpirals) {
    drawCubeTRS(p.x,p.y,p.z,p.yaw,p.sx,p.sy,p.sz,0,0,0,p.color,p.glow?1:0);
  }
  for(const p of orbitRings) {
    const a=p.a+seconds*0.06;
    const x=Math.cos(a)*p.radius,z=Math.sin(a)*p.radius;
    const y=11.5+Math.sin(a*3+seconds*0.4)*0.65;
    drawCubeTRS(x,y,z,-a,0.32,0.25,1.12,0,0,0,p.color,1);
  }
  for(const p of shootingStars) {
    const t=(p.phase+seconds*p.speed)%1;
    const x=p.x+t*85, z=p.z+t*18;
    const y=p.height-t*6;
    if(t>0.83)continue;
    drawCubeTRS(x,y,z,0.2,0.22,0.22,0.75,0,0,0,p.color,1);
    drawCubeTRS(x-0.8,y+0.2,z-0.18,0.2,0.12,0.12,1.5,0,0,0,
      p.color.map(v=>v*0.35),1);
  }
}

// Level 4: bioluminescent crystal formations (also the dynamic point-light sources)
function buildCrystals() {
  crystals = [];
  // Each crystal cluster = a few cubes + one point light at its tip.
  const sites = [
    { x: -5.5, z: -3.5, color: [1.0, 0.35, 0.9], light: [1.0, 0.4, 0.95], range: 11 },
    { x: 6.0, z: 2.5, color: [0.35, 1.0, 0.95], light: [0.35, 1.0, 0.95], range: 12 },
    { x: -2.0, z: 6.5, color: [1.0, 0.85, 0.35], light: [1.0, 0.75, 0.35], range: 10 },
    { x: 4.5, z: -6.0, color: [0.55, 0.45, 1.0], light: [0.55, 0.5, 1.0], range: 11 },
    { x: -11, z: 8, color: [0.3, 0.98, 0.75], light: [0.3, 0.98, 0.75], range: 9 },
    { x: 12, z: -7, color: [0.99, 0.35, 0.56], light: [0.99, 0.35, 0.56], range: 9 },
  ];

  for (const s of sites) {
    // Sample nearby terrain height so crystals sit on the ground instead of floating.
    let baseY = 1.5;
    if (cubes.length) {
      let best = Infinity;
      for (const c of cubes) {
        const d = Math.hypot(c.x - s.x, c.z - s.z);
        if (d < best) {
          best = d;
          baseY = c.height;
        }
      }
    }
    crystals.push({
      x: s.x,
      z: s.z,
      baseY,
      color: s.color,
      lightColor: s.light,
      range: s.range,
      phase: Math.random() * Math.PI * 2,
      parts: [
        { ox: 0, oy: 0, oz: 0, sx: 0.55, sy: 1.4, sz: 0.55 },
        { ox: 0.35, oy: 0.2, oz: 0.1, sx: 0.35, sy: 2.1, sz: 0.35 },
        { ox: -0.3, oy: 0.1, oz: -0.25, sx: 0.3, sy: 1.7, sz: 0.3 },
        { ox: 0.1, oy: 1.5, oz: 0.05, sx: 0.45, sy: 0.45, sz: 0.45 }, // glowing tip
      ],
    });
  }
}

function setLevel(next) {
  level = next;
  document.getElementById('btnLevel0').classList.toggle('active', level === '0');
  document.getElementById('btnLevel1a').classList.toggle('active', level === '1a');
  document.getElementById('btnLevel1bc').classList.toggle('active', level === '1bc');
  document.getElementById('btnLevel2').classList.toggle('active', level === '2');
  document.getElementById('btnLevel3').classList.toggle('active', level === '3');
  document.getElementById('btnLevel4').classList.toggle('active', level === '4');

  const gridSelect = document.getElementById('gridSelect');
  gridSelect.disabled = level === '0';

  // restting my arrays for each of the levels
  skyIslands = [];
  ufos = [];
  volcanoCubes = [];
  groundPlane = [];
  skyboxParts = [];
  crystals = [];
  pointLights = [];
  alienSpirals = [];
  orbitRings = [];
  shootingStars = [];
  comets = [];

  if (level === '2' || level === '3' || level === '4') {
    if (![16, 24, 32, 40].includes(gridSize)) gridSize = 16;
    setGridOptions(GRID_OPTIONS_L2, gridSize);
  } else if (level === '1a' || level === '1bc') {
    if (![8, 12, 16, 20].includes(gridSize)) gridSize = 12;
    setGridOptions(GRID_OPTIONS_L1, gridSize);
  }

  if (level === '0') {
    rebuildFlatCubeBuffer([0.55, 0.35, 0.85]);
    cubes = [{ x: 0, z: 0, height: 2, tint: 0.5, color: null }];
    document.getElementById('status').textContent = 'Level 0: single 2x2x2 cube';
  } else if (level === '1a') {
    rebuildFlatCubeBuffer([0.42, 0.28, 0.72]);
    buildLandscape(false);
    document.getElementById('status').textContent =
      `Level 1a: ${gridSize}x${gridSize} grid (translation only)`;
  } else if (level === '1bc') {
    // level 1b/c uses per-vertex colors; tint varies slightly per cube so we
    // rebuild the shared mesh once with a mid tint. Height still comes from scale.
    rebuildCubeBuffer(0.45);
    buildLandscape(true);
    document.getElementById('status').textContent =
      `Level 1b/c: ${gridSize}x${gridSize} heights + vertex colors + orbiting camera`;
  } else if (level === '2') {
    rebuildCubeBuffer(0.4);
    if (!mapsReady) {
      cubes = [];
      document.getElementById('status').textContent =
        'Level 2: loading color + height maps…';
    } else {
      buildLandscapeFromImages();
      document.getElementById('status').textContent =
        `Level 2: ${gridSize}x${gridSize} from ${colorMap.width}x${colorMap.height} maps + orbiting camera`;
    }
  } else if (level === '3') {
    rebuildCubeBuffer(0.4);
    buildSkyIslands();
    buildUfos();
    buildVolcano();
    if (!mapsReady) {
      cubes = [];
      document.getElementById('status').textContent =
        'Level 3: loading maps for ground…';
    } else {
      buildLandscapeFromImages();
      document.getElementById('status').textContent =
        `Level 3: Bezier UFOs + volcano cubes, ${gridSize}x${gridSize} landscape`;
    }
  } else if (level === '4') {
    // Brighter neutral vertex colors let the sampled PNG palette shine through.
    rebuildFlatCubeBuffer([0.91, 0.88, 0.98]);
    buildSkyIslands();
    buildUfos();
    buildVolcano();
    buildSkybox();
    // One uniform cube grid (detail map in the center + matching pad rings).
    buildSeamlessLevel4Terrain();
    buildCrystals();
    buildAlienFormations();
    buildComets();
    document.getElementById('status').textContent = mapsReady
      ? `Level 4: seamless ${gridSize}×${gridSize} cubes + ripples + comets`
      : 'Level 4: procedural preview (waiting for image maps)';
  }
}

document.getElementById('btnLevel0').addEventListener('click', () => setLevel('0'));
document.getElementById('btnLevel1a').addEventListener('click', () => setLevel('1a'));
document.getElementById('btnLevel1bc').addEventListener('click', () => setLevel('1bc'));
document.getElementById('btnLevel2').addEventListener('click', () => setLevel('2'));
document.getElementById('btnLevel3').addEventListener('click', () => setLevel('3'));
document.getElementById('btnLevel4').addEventListener('click', () => setLevel('4'));
document.getElementById('gridSelect').addEventListener('change', (e) => {
  gridSize = parseInt(e.target.value, 10);
  if (level !== '0') setLevel(level);
});

setLevel('0');
setBasicLighting();

// drawing loop
gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.05, 0.03, 0.1, 1.0); // deep alien night sky

const ORBIT_SPEED = 0.35; // radians / second
let lastSeconds = 0;

function drawCube(cube, sx, sy, sz, tintRgb, emissive) {
  // scaling first, then translation
  const model = multiply(translation(cube.x, 0, cube.z), scaling(sx, sy, sz));
  gl.uniformMatrix4fv(uModel, false, model);
  gl.uniform3fv(uTint, tintRgb);
  gl.uniform1f(uEmissive, emissive || 0);
  gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
}

// drawing a cube with translating, rotating, and scaling
function drawCubeTRS(x, y, z, yaw, sx, sy, sz, localOx, localOy, localOz, tintRgb, emissive) {
  let model = scaling(sx, sy, sz);
  model = multiply(translation(localOx, localOy, localOz), model);
  model = multiply(rotationY(yaw), model);
  model = multiply(translation(x, y, z), model);
  gl.uniformMatrix4fv(uModel, false, model);
  gl.uniform3fv(uTint, tintRgb);
  gl.uniform1f(uEmissive, emissive || 0);
  gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
}

// centered tumbling cube (for volcano ejecta), rotating around cube center
function drawTumblingCube(x, y, z, rx, ry, rz, size, tintRgb, emissive) {
  // unit cube is y=0..1, shifting by -0.5 in y so rotations orbit the center
  let model = translation(0, -0.5, 0);
  model = multiply(scaling(size, size, size), model);
  model = multiply(rotationX(rx), model);
  model = multiply(rotationY(ry), model);
  model = multiply(rotationZ(rz), model);
  model = multiply(translation(x, y, z), model);
  gl.uniformMatrix4fv(uModel, false, model);
  gl.uniform3fv(uTint, tintRgb);
  gl.uniform1f(uEmissive, emissive || 0);
  gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
}

function drawSkyIslands() {
  for (const p of skyIslands) {
    // centering the unit cube vertically around p.y by shifting local y by -0.5*sy after scaling
    // our unit cube goes y=0..1, so placing bottom at p.y - sy/2
    drawCubeTRS(p.x, p.y - p.sy * 0.5, p.z, 0, p.sx, p.sy, p.sz, 0, 0, 0, p.color);
  }
}

function drawUfo(ufo, pos, yaw) {
  // a saucer body essentially a flat disc, cabin dome, and two accent lights
  drawCubeTRS(pos[0], pos[1], pos[2], yaw, 1.8, 0.28, 1.8, 0, 0, 0, ufo.color);
  drawCubeTRS(pos[0], pos[1], pos[2], yaw, 0.7, 0.45, 0.7, 0, 0.28, 0, [0.9, 0.95, 1.0]);
  drawCubeTRS(pos[0], pos[1], pos[2], yaw, 0.25, 0.2, 0.25, 0.7, -0.05, 0, ufo.accent);
  drawCubeTRS(pos[0], pos[1], pos[2], yaw, 0.25, 0.2, 0.25, -0.7, -0.05, 0, ufo.accent);
}

function updateAndDrawUfos(dt) {
  for (const ufo of ufos) {
    ufo.t += ufo.speed * dt;

    // end of the path, or drifted far away, it will disappear and restart at P0
    const posProbe = cubicBezier(ufo.p0, ufo.p1, ufo.p2, ufo.p3, Math.min(ufo.t, 1));
    const dist = Math.hypot(posProbe[0], posProbe[1], posProbe[2]);
    if (ufo.t >= 1 || dist > 22) {
      ufo.t = 0;
    }

    const t = ufo.t;
    const pos = cubicBezier(ufo.p0, ufo.p1, ufo.p2, ufo.p3, t);
    const tan = cubicBezierTangent(ufo.p0, ufo.p1, ufo.p2, ufo.p3, t);
    const yaw = Math.atan2(tan[0], tan[2]); // facing along the horizontal tangent
    drawUfo(ufo, pos, yaw);
  }
}

// a mini air volcano: cubes start below the crater, rise, drift out, tumble a little bit and then reset
function updateAndDrawVolcano(seconds, asLights) {
  const craterY = 0.4;   // emerging from just under the crater center
  const maxHeight = 6.5;

  for (const rock of volcanoCubes) {
    // looping through the lifetime 0..1
    let life = (seconds * rock.riseSpeed * 0.18 + rock.phase) % 1;
    // easing out of the ground: starting below and then shooting up
    const y = craterY - 2.0 + life * (maxHeight + 2.0);
    const spread = life * life * rock.outward * 5.5;
    const x = Math.cos(rock.baseAngle + life * 0.8) * spread;
    const z = Math.sin(rock.baseAngle + life * 0.8) * spread;

    const spin = seconds * rock.spinSpeed;
    const rx = spin * 1.3;
    const ry = spin * 0.9 + rock.baseAngle;
    const rz = spin * 1.1;

    // fading ish by shrinking a little bit near the top of the arc
    const size = rock.size * (1 - life * 0.35);
    drawTumblingCube(x, y, z, rx, ry, rz, size, rock.color, asLights ? 1 : 0);
  }
}

function drawGroundPlane(seconds) {
  for (const g of groundPlane) {
    if (g.base) {
      // Huge under-crust stays flat so we never see holes through the world.
      drawCubeTRS(g.x, g.y, g.z, 0, g.sx, g.sy, g.sz, 0, 0, 0, g.color, 0);
      continue;
    }
    const baseSy = g.baseSy != null ? g.baseSy : g.sy;
    const sy = Math.max(0.12, baseSy + groundRipple(g.x, g.z, seconds));
    drawCubeTRS(g.x, g.y, g.z, 0, g.sx, sy, g.sz, 0, 0, 0, g.color, 0);
  }
}

function drawRipplingLandscape(seconds) {
  for (const cube of cubes) {
    const base = cube.baseHeight != null ? cube.baseHeight : cube.height;
    const h = Math.max(0.12, base + groundRipple(cube.x, cube.z, seconds));
    drawCube(cube, 1, h, 1, cube.color || [1, 1, 1], 0);
  }
}

// Steep-falling cube comets with a mini-cube fire trail (orange → red fade).
function updateAndDrawComets(seconds) {
  const fireColors = [
    [1.0, 0.95, 0.55],
    [1.0, 0.7, 0.2],
    [1.0, 0.4, 0.1],
    [0.85, 0.15, 0.05],
  ];
  for (const c of comets) {
    let t = (c.phase + seconds * c.speed) % 1;
    // Pause briefly after impact before respawning
    if (t > 0.88) continue;

    const x = c.x0 + c.dx * t;
    const y = c.y0 + c.dy * t;
    const z = c.z0 + c.dz * t;
    if (y < -1) continue;

    // Glowing icy/rocky head
    drawCubeTRS(x, y, z, t * 4.0, 0.55, 0.45, 0.55, 0, 0, 0, c.headColor, 1);

    // Fire trail: mini cubes stretched backward along the velocity
    const trailN = 8;
    for (let i = 1; i <= trailN; i++) {
      const u = i / trailN;
      const bx = x - c.dx * u * 0.045;
      const by = y - c.dy * u * 0.045;
      const bz = z - c.dz * u * 0.045;
      const size = 0.28 * (1 - u * 0.75);
      const col = fireColors[Math.min(fireColors.length - 1, Math.floor(u * fireColors.length))];
      // slight sideways jitter so the trail looks like sparks, not a line
      const jx = Math.sin(seconds * 18 + i * 2.1 + c.phase * 9) * 0.12 * u;
      const jz = Math.cos(seconds * 16 + i * 1.7) * 0.12 * u;
      drawCubeTRS(bx + jx, by, bz + jz, 0.4, size, size * 1.4, size, 0, 0, 0, col, 1);
    }
  }
}

function drawSkybox(eye) {
  // Render the inside of a large cube centered on the camera (so it never
  // looks like a small rectangular room). Ignore scene depth just for the sky.
  gl.disable(gl.DEPTH_TEST);
  gl.depthMask(false);
  gl.uniform1f(uSkyMode,1.0);
  drawCubeTRS(eye[0],eye[1]-350,eye[2],0,700,700,700,0,0,0,[1,1,1],0);
  gl.uniform1f(uSkyMode,0.0);
  gl.depthMask(true);
  gl.enable(gl.DEPTH_TEST);
}

function updateCrystalLights(seconds) {
  pointLights = [];
  for (const c of crystals) {
    const pulse = 0.72 + 0.28 * Math.sin(seconds * 2.2 + c.phase);
    c._pulse = pulse;
    const tip = c.parts[c.parts.length - 1];
    const lift = groundRipple(c.x, c.z, seconds);
    pointLights.push({
      pos: [c.x + tip.ox, c.baseY + lift + tip.oy + tip.sy * 0.5, c.z + tip.oz],
      color: [
        c.lightColor[0] * pulse * 2.2,
        c.lightColor[1] * pulse * 2.2,
        c.lightColor[2] * pulse * 2.2,
      ],
      range: c.range * 1.15,
    });
  }
  // Fourth local light travels with the lead UFO along its Bezier flight path.
  // The other three slots are occupied by the nearest three crystal sites.
  if (ufos.length) {
    const craft=ufos[0];
    const pos=cubicBezier(craft.p0,craft.p1,craft.p2,craft.p3,craft.t);
    pointLights[3]={pos:[pos[0],pos[1]-0.6,pos[2]],
      color:[0.18,0.92,0.90],range:9.0};
  }
}

function drawCrystals(seconds) {
  for (const c of crystals) {
    const pulse = c._pulse || 1;
    const lift = seconds != null ? groundRipple(c.x, c.z, seconds) : 0;
    for (let i = 0; i < c.parts.length; i++) {
      const p = c.parts[i];
      const isTip = i === c.parts.length - 1;
      const col = isTip
        ? [c.color[0] * pulse, c.color[1] * pulse, c.color[2] * pulse]
        : c.color;
      drawCubeTRS(
        c.x + p.ox, c.baseY + lift + p.oy, c.z + p.oz, 0,
        p.sx, p.sy, p.sz, 0, 0, 0, col, 1
      );
    }
  }
}

function uploadPointLights() {
  const lights = [
    { posLoc: uL0Pos, colLoc: uL0Color, rangeLoc: uL0Range },
    { posLoc: uL1Pos, colLoc: uL1Color, rangeLoc: uL1Range },
    { posLoc: uL2Pos, colLoc: uL2Color, rangeLoc: uL2Range },
    { posLoc: uL3Pos, colLoc: uL3Color, rangeLoc: uL3Range },
  ];
  for (let i = 0; i < 4; i++) {
    const L = pointLights[i];
    if (L) {
      gl.uniform3fv(lights[i].posLoc, L.pos);
      gl.uniform3fv(lights[i].colLoc, L.color);
      gl.uniform1f(lights[i].rangeLoc, L.range);
    } else {
      gl.uniform3fv(lights[i].posLoc, [0, -100, 0]);
      gl.uniform3fv(lights[i].colLoc, [0, 0, 0]);
      gl.uniform1f(lights[i].rangeLoc, 0.01);
    }
  }
}

function setLevel4Lighting(seconds) {
  // Colored global illumination changes smoothly, without a day/night toggle.
  const a=seconds*0.20;
  gl.uniform3fv(uAmbient, [0.20+0.035*Math.sin(a),
    0.14+0.035*Math.sin(a+2.1),0.28+0.05*Math.sin(a+4.1)]);
  gl.uniform3fv(uDirLightDir, [
    Math.sin(seconds * 0.15) * 0.35,
    0.85,
    Math.cos(seconds * 0.15) * 0.35,
  ]);
  gl.uniform3fv(uDirLightColor, [0.28+0.10*Math.sin(seconds*0.12),
    0.22+0.08*Math.sin(seconds*0.12+2.0),
    0.40+0.10*Math.sin(seconds*0.12+4.0)]);
  gl.uniform3fv(uFogColor, [0.28,0.075,0.31]);
  gl.uniform1f(uFogDensity, 0.008); // low haze: the horizon stays visible
  gl.uniform1f(uUsePointLights, 1.0);
  uploadPointLights();
}

function render(timeMs) {
  const seconds = timeMs * 0.001;
  const dt = Math.min(0.05, Math.max(0, seconds - lastSeconds));
  lastSeconds = seconds;

  // Cap backing resolution for smoother performance on high-density laptops.
  const pixelRatio=Math.min(window.devicePixelRatio||1,1.5);
  const targetW=Math.max(1,Math.round(canvas.clientWidth*pixelRatio));
  const targetH=Math.max(1,Math.round(canvas.clientHeight*pixelRatio));
  if(canvas.width!==targetW) canvas.width=targetW;
  if(canvas.height!==targetH) canvas.height=targetH;
  gl.viewport(0, 0, canvas.width, canvas.height);

  if (level === '4') {
    gl.clearColor(0.35, 0.08, 0.42, 1.0); // magenta haze clear
  } else {
    gl.clearColor(0.05, 0.03, 0.1, 1.0);
  }
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = canvas.width / canvas.height;
  gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, aspect, 0.1, level==='4'?1200:250));
  gl.uniform1f(uTime,seconds);
  gl.uniform1f(uSkyMode,0);

  // level 1d: orbiting around the look-at (0,0,0)
  let radius;
  let height;
  let lookY;
  if (level === '0') {
    radius = 7;
    height = 3.5;
    lookY = 1;
  } else {
    radius = Math.max(14, gridSize * 1.15);
    height = Math.max(8, gridSize * 0.6);
    if (level === '3' || level === '4') {
      height = Math.max(height, level === '4' ? 12 : 10);
      lookY = level === '4' ? 2.5 : 2.2;
      if (level === '4') radius = Math.max(radius, 22);
    } else {
      lookY = level === '2' ? 1.2 : 0;
    }
  }

  const angle = seconds * ORBIT_SPEED;
  const eye = [
    radius * Math.cos(angle),
    height,
    radius * Math.sin(angle),
  ];
  gl.uniformMatrix4fv(uView, false, lookAt(eye, [0, lookY, 0], [0, 1, 0]));
  gl.uniform3fv(uCameraPos,eye);

  enableAttribs();

  if (level !== '4') setBasicLighting();

  if (level === '0') {
    // unit cube scaled by 2
    const model = multiply(translation(0, -1, 0), scaling(2, 2, 2));
    gl.uniformMatrix4fv(uModel, false, model);
    gl.uniform3fv(uTint, [1, 1, 1]);
    gl.uniform1f(uEmissive, 0);
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
  } else if (level === '1a') {
    for (const cube of cubes) {
      drawCube(cube, 1, 1, 1, [1, 1, 1], 0);
    }
  } else if (level === '1bc') {
    // 1b: scaling in y. 1c: vertex colors in the buffer + per-cube tint.
    for (const cube of cubes) {
      const t = cube.tint;
      // procedural tint: purple to blue to magenta across the grid
      const tintRgb = [0.75 + t * 0.4, 0.55 + t * 0.2, 1.1 - t * 0.25];
      drawCube(cube, 1, cube.height, 1, tintRgb, 0);
    }
  } else if (level === '2') {
    for (const cube of cubes) {
      drawCube(cube, 1, cube.height, 1, cube.color || [1, 1, 1], 0);
    }
  } else if (level === '3') {
    for (const cube of cubes) {
      drawCube(cube, 1, cube.height, 1, cube.color || [1, 1, 1], 0);
    }
    drawSkyIslands();
    updateAndDrawUfos(dt);
    updateAndDrawVolcano(seconds, false);
  } else if (level === '4') {
    updateCrystalLights(seconds);
    setLevel4Lighting(seconds);
    drawSkybox(eye);
    drawGroundPlane(seconds);
    drawRipplingLandscape(seconds);
    drawCrystals(seconds);
    drawAlienFormations(seconds);
    drawSkyIslands();
    updateAndDrawUfos(dt);
    updateAndDrawVolcano(seconds, true);
    updateAndDrawComets(seconds);
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
