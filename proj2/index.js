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

  void main() {
    vColor = aColor;
    vNormal = normalize(mat3(uModel) * aNormal);
    gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
  }
`;

// fragment shader
const fragmentShaderSource = `
  precision mediump float;

  uniform vec3 uTint;   // per-cube alien color shift (Level 1b/c)

  varying vec3 vColor;
  varying vec3 vNormal;

  void main() {
    // vColor is already interpolated across the triangle by the GPU.
    vec3 lightDir = normalize(vec3(0.4, 1.0, 0.25));
    float brightness = max(dot(normalize(vNormal), lightDir), 0.0);
    float light = 0.35 + 0.65 * brightness;
    gl_FragColor = vec4(vColor * uTint * light, 1.0);
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
    // if the user has already opened level 2/3 while maps were loading, rebuilding the landscape now
    if (level === '2' || level === '3') setLevel(level);
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
      cubes.push({
        x: (col - (gridSize - 1) / 2) * spacing,
        z: (row - (gridSize - 1) / 2) * spacing,
        height: withHeights ? proceduralHeight(col, row, gridSize) : 1.0,
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
      cubes.push({
        x: (col - (gridSize - 1) / 2) * spacing,
        z: (row - (gridSize - 1) / 2) * spacing,
        height: grayToHeight(gray),
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

function setLevel(next) {
  level = next;
  document.getElementById('btnLevel0').classList.toggle('active', level === '0');
  document.getElementById('btnLevel1a').classList.toggle('active', level === '1a');
  document.getElementById('btnLevel1bc').classList.toggle('active', level === '1bc');
  document.getElementById('btnLevel2').classList.toggle('active', level === '2');
  document.getElementById('btnLevel3').classList.toggle('active', level === '3');

  const gridSelect = document.getElementById('gridSelect');
  gridSelect.disabled = level === '0';

  // restting my arrays for each of the levels
  skyIslands = [];
  ufos = [];
  volcanoCubes = [];

  if (level === '2' || level === '3') {
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
  }
}

document.getElementById('btnLevel0').addEventListener('click', () => setLevel('0'));
document.getElementById('btnLevel1a').addEventListener('click', () => setLevel('1a'));
document.getElementById('btnLevel1bc').addEventListener('click', () => setLevel('1bc'));
document.getElementById('btnLevel2').addEventListener('click', () => setLevel('2'));
document.getElementById('btnLevel3').addEventListener('click', () => setLevel('3'));
document.getElementById('gridSelect').addEventListener('change', (e) => {
  gridSize = parseInt(e.target.value, 10);
  if (level !== '0') setLevel(level);
});

setLevel('0');

// drawing loop
gl.enable(gl.DEPTH_TEST);
gl.clearColor(0.05, 0.03, 0.1, 1.0); // deep alien night sky

const ORBIT_SPEED = 0.35; // radians / second
let lastSeconds = 0;

function drawCube(cube, sx, sy, sz, tintRgb) {
  // scaling first, then translation
  const model = multiply(translation(cube.x, 0, cube.z), scaling(sx, sy, sz));
  gl.uniformMatrix4fv(uModel, false, model);
  gl.uniform3fv(uTint, tintRgb);
  gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
}

// drawing a cube with translating, rotating, and scaling
function drawCubeTRS(x, y, z, yaw, sx, sy, sz, localOx, localOy, localOz, tintRgb) {
  let model = scaling(sx, sy, sz);
  model = multiply(translation(localOx, localOy, localOz), model);
  model = multiply(rotationY(yaw), model);
  model = multiply(translation(x, y, z), model);
  gl.uniformMatrix4fv(uModel, false, model);
  gl.uniform3fv(uTint, tintRgb);
  gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
}

// centered tumbling cube (for volcano ejecta), rotating around cube center
function drawTumblingCube(x, y, z, rx, ry, rz, size, tintRgb) {
  // unit cube is y=0..1, shifting by -0.5 in y so rotations orbit the center
  let model = translation(0, -0.5, 0);
  model = multiply(scaling(size, size, size), model);
  model = multiply(rotationX(rx), model);
  model = multiply(rotationY(ry), model);
  model = multiply(rotationZ(rz), model);
  model = multiply(translation(x, y, z), model);
  gl.uniformMatrix4fv(uModel, false, model);
  gl.uniform3fv(uTint, tintRgb);
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
function updateAndDrawVolcano(seconds) {
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
    drawTumblingCube(x, y, z, rx, ry, rz, size, rock.color);
  }
}

function render(timeMs) {
  const seconds = timeMs * 0.001;
  const dt = Math.min(0.05, Math.max(0, seconds - lastSeconds));
  lastSeconds = seconds;

  canvas.width = canvas.clientWidth;
  canvas.height = canvas.clientHeight;
  gl.viewport(0, 0, canvas.width, canvas.height);
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

  const aspect = canvas.width / canvas.height;
  gl.uniformMatrix4fv(uProjection, false, perspective(Math.PI / 4, aspect, 0.1, 200));

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
    if (level === '3') {
      height = Math.max(height, 10);
      lookY = 2.2;
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

  enableAttribs();

  if (level === '0') {
    // unit cube scaled by 2
    const model = multiply(translation(0, -1, 0), scaling(2, 2, 2));
    gl.uniformMatrix4fv(uModel, false, model);
    gl.uniform3fv(uTint, [1, 1, 1]);
    gl.drawArrays(gl.TRIANGLES, 0, VERTEX_COUNT);
  } else if (level === '1a') {
    for (const cube of cubes) {
      drawCube(cube, 1, 1, 1, [1, 1, 1]);
    }
  } else if (level === '1bc') {
    // 1b: scaling in y. 1c: vertex colors in the buffer + per-cube tint.
    for (const cube of cubes) {
      const t = cube.tint;
      // procedural tint: purple to blue to magenta across the grid
      const tintRgb = [0.75 + t * 0.4, 0.55 + t * 0.2, 1.1 - t * 0.25];
      drawCube(cube, 1, cube.height, 1, tintRgb);
    }
  } else if (level === '2') {
    for (const cube of cubes) {
      drawCube(cube, 1, cube.height, 1, cube.color || [1, 1, 1]);
    }
  } else if (level === '3') {
    for (const cube of cubes) {
      drawCube(cube, 1, cube.height, 1, cube.color || [1, 1, 1]);
    }
    drawSkyIslands();
    updateAndDrawUfos(dt);
    updateAndDrawVolcano(seconds);
  }

  requestAnimationFrame(render);
}
requestAnimationFrame(render);
