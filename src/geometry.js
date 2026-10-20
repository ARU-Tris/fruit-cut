import { BufferGeometry, Float32BufferAttribute, SphereGeometry, Vector3 } from 'three';

const EPS = 1e-7;
const MIN_VOLUME = 0.000025;

export function createFruitSolid(fruit, segments = 40, rings = 26) {
  const sphere = new SphereGeometry(1, segments, rings);
  const position = sphere.getAttribute('position');
  const index = sphere.getIndex();
  const faces = [];
  for (let i = 0; i < index.count; i += 3) {
    const vertices = [];
    for (let k = 0; k < 3; k++) {
      const p = new Vector3().fromBufferAttribute(position, index.getX(i + k));
      const pear = 1 - fruit.pear * p.y;
      p.set(p.x * fruit.radii[0] * pear, p.y * fruit.radii[1], p.z * fruit.radii[2] * pear);
      vertices.push(p);
    }
    if (polygonArea(vertices) > EPS) faces.push({ vertices, surface: 'skin' });
  }
  sphere.dispose();
  return { faces, fruit };
}

export function polygonNormal(vertices) {
  const normal = new Vector3();
  for (let i = 0; i < vertices.length; i++) normal.add(new Vector3().crossVectors(vertices[i], vertices[(i + 1) % vertices.length]));
  return normal.normalize();
}

function polygonArea(vertices) {
  if (vertices.length < 3) return 0;
  const normal = new Vector3();
  for (let i = 1; i < vertices.length - 1; i++) normal.add(new Vector3().crossVectors(vertices[i].clone().sub(vertices[0]), vertices[i + 1].clone().sub(vertices[0])));
  return normal.length() * 0.5;
}

export function solidProperties(solid) {
  let signedVolume = 0;
  const center = new Vector3();
  for (const face of solid.faces) {
    const a = face.vertices[0];
    for (let i = 1; i < face.vertices.length - 1; i++) {
      const b = face.vertices[i];
      const c = face.vertices[i + 1];
      const volume = a.dot(new Vector3().crossVectors(b, c)) / 6;
      signedVolume += volume;
      center.addScaledVector(a.clone().add(b).add(c), volume * 0.25);
    }
  }
  if (Math.abs(signedVolume) > EPS) center.divideScalar(signedVolume);
  return { volume: Math.abs(signedVolume), center };
}

function uniquePoints(points) {
  const seen = new Set();
  return points.filter((p) => {
    const key = `${Math.round(p.x * 1e6)},${Math.round(p.y * 1e6)},${Math.round(p.z * 1e6)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function orderContour(points, normal) {
  const unique = uniquePoints(points);
  if (unique.length < 3) return [];
  const center = unique.reduce((sum, p) => sum.add(p), new Vector3()).divideScalar(unique.length);
  const u = new Vector3().crossVectors(Math.abs(normal.y) < 0.85 ? new Vector3(0, 1, 0) : new Vector3(1, 0, 0), normal).normalize();
  const v = new Vector3().crossVectors(normal, u);
  unique.sort((a, b) => {
    const da = a.clone().sub(center), db = b.clone().sub(center);
    return Math.atan2(da.dot(v), da.dot(u)) - Math.atan2(db.dot(v), db.dot(u));
  });
  // Collinear points along triangulated skin edges do not add to a cap.
  return unique.filter((p, i, list) => {
    const before = list[(i + list.length - 1) % list.length];
    const after = list[(i + 1) % list.length];
    return new Vector3().crossVectors(p.clone().sub(before), after.clone().sub(p)).lengthSq() > 1e-15;
  });
}

function clipPolygon(vertices, normal, offset, positive, intersections) {
  const out = [];
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i], b = vertices[(i + 1) % vertices.length];
    const da = normal.dot(a) - offset, db = normal.dot(b) - offset;
    const insideA = positive ? da >= -EPS : da <= EPS;
    const insideB = positive ? db >= -EPS : db <= EPS;
    if (insideA) out.push(a);
    if (insideA !== insideB && Math.abs(da - db) > EPS) {
      const p = a.clone().lerp(b, da / (da - db));
      out.push(p);
      intersections.push(p);
    }
    if (Math.abs(da) <= EPS) intersections.push(a);
  }
  const unique = uniquePoints(out);
  return unique.length >= 3 && polygonArea(unique) > 1e-10 ? unique : null;
}

export function sectionContour(solid, normal, offset) {
  const points = [];
  let min = Infinity, max = -Infinity;
  for (const face of solid.faces) {
    for (let i = 0; i < face.vertices.length; i++) {
      const a = face.vertices[i], b = face.vertices[(i + 1) % face.vertices.length];
      const da = normal.dot(a) - offset, db = normal.dot(b) - offset;
      min = Math.min(min, da); max = Math.max(max, da);
      if (Math.abs(da) <= EPS) points.push(a);
      if (da * db < 0) points.push(a.clone().lerp(b, da / (da - db)));
    }
  }
  if (min > -0.001 || max < 0.001) return [];
  return orderContour(points, normal);
}

export function splitSolid(solid, normal, offset) {
  const contour = sectionContour(solid, normal, offset);
  if (contour.length < 3) return [solid];
  const positiveFaces = [], negativeFaces = [];
  for (const face of solid.faces) {
    const positive = clipPolygon(face.vertices, normal, offset, true, []);
    const negative = clipPolygon(face.vertices, normal, offset, false, []);
    if (positive) positiveFaces.push({ vertices: positive, surface: face.surface });
    if (negative) negativeFaces.push({ vertices: negative, surface: face.surface });
  }
  positiveFaces.push({ vertices: [...contour].reverse(), surface: 'flesh' });
  negativeFaces.push({ vertices: contour, surface: 'flesh' });
  const positive = { faces: positiveFaces, fruit: solid.fruit };
  const negative = { faces: negativeFaces, fruit: solid.fruit };
  // A sub-millimetre graze keeps the whole piece, so no fruit volume is discarded.
  if (solidProperties(positive).volume < MIN_VOLUME || solidProperties(negative).volume < MIN_VOLUME) return [solid];
  return [positive, negative];
}

export function splitByPlanes(solid, planes) {
  let fragments = [solid];
  for (const { normal, offset } of planes) fragments = fragments.flatMap((piece) => splitSolid(piece, normal, offset));
  return fragments;
}

export function buildSolidGeometry(solid, center = new Vector3()) {
  const positions = [], normals = [], points = [], uvs = [];
  const radii = solid.fruit.radii;
  const geometry = new BufferGeometry();
  for (const [surfaceIndex, surface] of ['skin', 'flesh'].entries()) {
    const start = positions.length / 3;
    for (const face of solid.faces) {
      if (face.surface !== surface) continue;
      const flatNormal = surface === 'flesh' ? polygonNormal(face.vertices) : null;
      for (let i = 1; i < face.vertices.length - 1; i++) {
        const tri = [face.vertices[0], face.vertices[i], face.vertices[i + 1]];
        const us = tri.map((p) => 0.5 + Math.atan2(p.z, -p.x) / (Math.PI * 2));
        if (Math.max(...us) - Math.min(...us) > 0.5) us.forEach((u, k) => { if (u < 0.5) us[k] += 1; });
        for (let k = 0; k < 3; k++) {
          const p = tri[k], q = p.clone().sub(center);
          positions.push(q.x, q.y, q.z);
          const normal = flatNormal ?? new Vector3(p.x / radii[0] ** 2, p.y / radii[1] ** 2, p.z / radii[2] ** 2).normalize();
          normals.push(normal.x, normal.y, normal.z);
          points.push(p.x / radii[0], p.y / radii[1], p.z / radii[2]);
          uvs.push(us[k], 0.5 + Math.asin(Math.max(-1, Math.min(1, p.y / radii[1]))) / Math.PI);
        }
      }
    }
    geometry.addGroup(start, positions.length / 3 - start, surfaceIndex);
  }
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new Float32BufferAttribute(normals, 3));
  geometry.setAttribute('fruitPoint', new Float32BufferAttribute(points, 3));
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2));
  geometry.computeBoundingSphere();
  return geometry;
}

export function colliderVertices(solid, center) {
  const points = uniquePoints(solid.faces.flatMap((face) => face.vertices));
  return new Float32Array(points.flatMap((p) => [p.x - center.x, p.y - center.y, p.z - center.z]));
}
