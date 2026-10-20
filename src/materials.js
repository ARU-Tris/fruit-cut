import * as THREE from 'three';

const hash = (n) => { const s = Math.sin(n * 127.1 + 311.7) * 43758.5453123; return s - Math.floor(s); };

const noiseGrid = new Float32Array(512*256);
for(let i=0;i<noiseGrid.length;i++)noiseGrid[i]=hash(i);
function noise2(x,y){
  const ix=Math.floor(x),iy=Math.floor(y);let fx=x-ix,fy=y-iy;fx=fx*fx*(3-2*fx);fy=fy*fy*(3-2*fy);
  const at=(a,b)=>noiseGrid[((b+256)%256)*512+(a+512)%512];
  const a=at(ix,iy)*(1-fx)+at(ix+1,iy)*fx,b=at(ix,iy+1)*(1-fx)+at(ix+1,iy+1)*fx;
  return a*(1-fy)+b*fy;
}

function skinTexture(fruit) {
  const width = 1024, height = 512;
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  const image = ctx.createImageData(width, height);
  const bump = ctx.createImageData(width, height);
  const base = new THREE.Color(fruit.skin).convertLinearToSRGB();
  // Equirectangular microstructure; fixed seed makes textures reproducible.
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const n = hash(x + y * width + fruit.index * 2903);
      const cell = noise2(x/5,y/5);
      let shade = 0.73 + n * 0.28 + cell * 0.16;
      if (fruit.id === 'avocado') shade = 0.61 + Math.pow(cell,0.75) * 0.23 + n * 0.15 + noise2(x/53,y/53)*0.12;
      if (fruit.id === 'watermelon') {
        const stripe = Math.sin(x / width * Math.PI * 22 + Math.sin(y * 0.038) * 0.28 + Math.sin(y * 0.016 + x * 0.035) * 0.24);
        shade = (stripe > 0.08 + (n - 0.5) * 0.28 ? 0.65 : 1.14) + n * 0.18;
      }
      if (fruit.id === 'kiwi') shade = 0.55 + n * 0.36 + cell * 0.2;
      image.data[i] = Math.min(255, base.r * 255 * shade);
      image.data[i + 1] = Math.min(255, base.g * 255 * shade);
      image.data[i + 2] = Math.min(255, base.b * 255 * shade);
      image.data[i + 3] = 255;
      const micro = fruit.id === 'avocado' ? (n * 0.16 + cell * 0.84) : n;
      bump.data[i] = bump.data[i + 1] = bump.data[i + 2] = Math.floor(micro * 255);
      bump.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);
  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width; bumpCanvas.height = height;
  bumpCanvas.getContext('2d').putImageData(bump, 0, 0);
  if (fruit.id === 'kiwi') {
    ctx.strokeStyle = '#c4a77755'; ctx.lineWidth = 0.7;
    for (let i = 0; i < 9000; i++) {
      const x = hash(i + 3) * width, y = hash(i + 500) * height;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + hash(i + 77) * 2 - 1, y - 3); ctx.stroke();
    }
  }
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  map.wrapS = THREE.RepeatWrapping;
  map.anisotropy = 8;
  const bumpMap = new THREE.CanvasTexture(bumpCanvas);
  bumpMap.wrapS = THREE.RepeatWrapping;
  return { map, bumpMap };
}

const capShader = /* glsl */`
varying vec3 vFruitPoint;
uniform float uFruitKind;
uniform float uPear;
float fhash(vec3 p) { return fract(sin(dot(p, vec3(127.1,311.7,74.7))) * 43758.5453); }
float fnoise(vec3 p) {
  vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(fhash(i), fhash(i+vec3(1,0,0)), f.x), mix(fhash(i+vec3(0,1,0)), fhash(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(fhash(i+vec3(0,0,1)), fhash(i+vec3(1,0,1)),f.x),mix(fhash(i+vec3(0,1,1)),fhash(i+vec3(1,1,1)),f.x),f.y),f.z);
}
vec3 fruitFlesh(vec3 p) {
  vec3 roundP = vec3(p.x/(1.0-uPear*p.y), p.y, p.z/(1.0-uPear*p.y));
  float r = length(roundP);
  float grain = fnoise(p * 120.0);
  float large = fnoise(p * 16.0);
  vec3 col;
  if (uFruitKind < 0.5) {
    float edge = smoothstep(0.62, 0.98, r);
    col = mix(vec3(0.89,0.9,0.44),vec3(0.27,0.49,0.095),edge);
    col += (grain-0.5)*0.045 + (large-0.5)*0.03;
    float pit = length((p-vec3(0.0,-0.14,0.0))/vec3(0.43,0.47,0.43));
    vec3 pitColor = mix(vec3(0.18,0.065,0.025),vec3(0.48,0.23,0.095),large*0.8+grain*0.2);
    pitColor += sin(p.y*120.0 + large*6.0)*0.025;
    col = mix(pitColor,col,smoothstep(0.98,1.015,pit));
    col = mix(col,vec3(0.075,0.15,0.018),smoothstep(0.972,0.992,r));
  } else if (uFruitKind < 1.5) {
    col = mix(vec3(0.69,0.055,0.095),vec3(0.98,0.19,0.25),large);
    col += (grain-0.5)*0.07;
    col = mix(col,vec3(0.85,0.88,0.57),smoothstep(0.82,0.91,r));
    col = mix(col,vec3(0.095,0.28,0.035),smoothstep(0.935,0.985,r));
    for (int i=0; i<28; i++) {
      float fi = float(i);
      float a = fi*2.39996;
      vec3 seed = vec3(sin(a)*0.57, (fract(fi*0.618)*2.0-1.0)*0.7, cos(a)*0.57);
      float d = length((p-seed)/vec3(0.033,0.065,0.025));
      col = mix(vec3(0.032,0.014,0.009),col,smoothstep(0.75,1.05,d));
    }
  } else if (uFruitKind < 2.5 || uFruitKind > 3.5) {
    bool lemon = uFruitKind > 3.5;
    col = lemon ? vec3(0.93,0.72,0.22) : vec3(0.99,0.35,0.015);
    col += grain*0.09 + large*0.055;
    float angle = atan(p.z, p.x);
    float membrane = pow(abs(cos(angle*5.0 + 0.12)), 85.0);
    float core = 1.0-smoothstep(0.045,0.12,length(p.xz));
    float vesicle = pow(abs(sin(p.y*110.0 + angle*15.0 + large*3.0)),16.0)*0.12;
    col = mix(col,vec3(1.0,0.88,0.6),max(membrane*0.72,core));
    col += vesicle;
    col = mix(col,vec3(0.97,0.91,0.72),smoothstep(0.86,0.9,r));
    col = mix(col,lemon ? vec3(0.8,0.64,0.022) : vec3(0.88,0.25,0.005),smoothstep(0.965,0.995,r));
  } else {
    float radial = length(p.xz);
    float angle = atan(p.z,p.x);
    float ray = pow(abs(sin(angle*38.0 + p.y*2.0)),9.0);
    col = mix(vec3(0.39,0.65,0.075),vec3(0.7,0.86,0.23),large);
    col += ray*0.09 + (grain-0.5)*0.06;
    col = mix(vec3(0.91,0.93,0.63),col,smoothstep(0.13,0.27,radial));
    float seeds = pow(abs(sin(angle*15.0 + p.y*7.0)),22.0) * (1.0-smoothstep(0.025,0.055,abs(radial-0.4)));
    col = mix(col,vec3(0.02,0.022,0.009),seeds);
    col = mix(col,vec3(0.27,0.14,0.045),smoothstep(0.955,0.99,r));
  }
  return clamp(col,0.0,1.0);
}
`;

export function createFruitMaterials(fruit) {
  const textures = skinTexture(fruit);
  const skin = new THREE.MeshPhysicalMaterial({
    ...textures, roughness: fruit.id === 'kiwi' ? 0.94 : 0.47,
    bumpScale: fruit.id === 'avocado' ? 0.055 : 0.023,
    metalness: 0, clearcoat: fruit.id === 'kiwi' ? 0 : 0.26, clearcoatRoughness: 0.45,
  });
  const flesh = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.39, metalness: 0, clearcoat: 0.22, clearcoatRoughness: 0.4 });
  flesh.onBeforeCompile = (shader) => {
    shader.uniforms.uFruitKind = { value: fruit.index };
    shader.uniforms.uPear = { value: fruit.pear };
    shader.vertexShader = 'attribute vec3 fruitPoint; varying vec3 vFruitPoint;\n' + shader.vertexShader;
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\nvFruitPoint = fruitPoint;');
    shader.fragmentShader = capShader + shader.fragmentShader;
    shader.fragmentShader = shader.fragmentShader.replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= fruitFlesh(vFruitPoint);');
  };
  flesh.customProgramCacheKey = () => `fruit-flesh-${fruit.id}`;
  return [skin, flesh];
}

export function createWoodTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024; canvas.height = 512;
  const ctx = canvas.getContext('2d');
  const data = ctx.createImageData(canvas.width, canvas.height);
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const i = (y * canvas.width + x) * 4;
      const band = Math.floor(y / 86);
      const coarse = Math.sin(y*0.45 + Math.sin(x*0.004)*2.6 + Math.sin(x*0.017 + y*0.02)*0.3 + noise2(x/46,y/15)*2.8);
      const fine = Math.sin(y*2.0 + Math.sin(x*0.013)*1.7);
      const n = hash(x + y*1024);
      const value = 0.85 + coarse*0.035 + fine*0.012 + n*0.025 + hash(band+9)*0.06 + noise2(x/160,y/30)*0.045;
      data.data[i] = 179 * value; data.data[i+1] = 126 * value; data.data[i+2] = 77 * value; data.data[i+3] = 255;
    }
  }
  ctx.putImageData(data,0,0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 8;
  return texture;
}
