import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { FRUITS } from '../src/fruit.js';
import { buildSolidGeometry, createFruitSolid, polygonNormal, sectionContour, solidProperties, splitByPlanes, splitSolid } from '../src/geometry.js';

test('all fruit meshes are closed solids with plausible ellipsoid volumes',()=>{
  for(const fruit of FRUITS){
    const solid=createFruitSolid(fruit),{volume,center}=solidProperties(solid);
    const ellipsoid=4/3*Math.PI*fruit.radii.reduce((a,b)=>a*b,1);
    assert.ok(volume>ellipsoid*0.97&&volume<ellipsoid*1.03,`${fruit.id}: ${volume}`);
    assert.ok(Math.abs(center.x)<1e-6&&Math.abs(center.z)<1e-6);
  }
});

test('a centered straight cut yields two equal, closed halves with opposite cap normals',()=>{
  const solid=createFruitSolid(FRUITS[0]);
  const halves=splitSolid(solid,new Vector3(1,0,0),0);
  assert.equal(halves.length,2);
  const volumes=halves.map(s=>solidProperties(s).volume);
  assert.ok(Math.abs(volumes[0]-volumes[1])<1e-6);
  assert.ok(Math.abs(volumes[0]+volumes[1]-solidProperties(solid).volume)<1e-6);
  const n=halves.map(s=>polygonNormal(s.faces.find(f=>f.surface==='flesh').vertices));
  assert.ok(n[0].dot(n[1])<-.99999);
});

test('ten crossing cuts preserve every piece of fruit volume and cap every exposed surface',()=>{
  const solid=createFruitSolid(FRUITS[1]);
  const planes=Array.from({length:10},(_,i)=>({normal:new Vector3(Math.cos(i*2.3999),Math.sin(i*2.3999),0.18*Math.sin(i)).normalize(),offset:(i%3-1)*0.24}));
  const pieces=splitByPlanes(solid,planes);
  assert.ok(pieces.length>20,`${pieces.length} pieces`);
  assert.ok(Math.abs(pieces.reduce((sum,p)=>sum+solidProperties(p).volume,0)-solidProperties(solid).volume)<0.00002);
  for(const piece of pieces){
    const {volume,center}=solidProperties(piece);
    assert.ok(volume>0&&center.toArray().every(Number.isFinite));
    assert.ok(piece.faces.some(f=>f.surface==='flesh'));
    // Each cap must face away from the solid centroid.
    for(const face of piece.faces){
      assert.ok(polygonNormal(face.vertices).dot(face.vertices[0].clone().sub(center))> -0.00002);
    }
    const geometry=buildSolidGeometry(piece,center);
    assert.ok(Array.from(geometry.attributes.position.array).every(Number.isFinite));
    assert.equal(geometry.groups.length,2);geometry.dispose();
  }
});

test('misses, tangent lines, and duplicate planes cannot lose volume or create zero-volume bodies',()=>{
  const solid=createFruitSolid(FRUITS[2]),n=new Vector3(1,0,0);
  assert.equal(sectionContour(solid,n,5).length,0);
  assert.equal(splitSolid(solid,n,5)[0],solid);
  const planes=Array.from({length:10},()=>({normal:n,offset:0}));
  assert.equal(splitByPlanes(solid,planes).length,2);
  const tangent=splitSolid(solid,n,FRUITS[2].radii[0]-0.00001);
  assert.equal(tangent.length,1);
});

test('arbitrary oblique cuts preserve volume across all five fruits',()=>{
  for(const fruit of FRUITS){
    const solid=createFruitSolid(fruit),n=new Vector3(.4,.8,-.3).normalize();
    const parts=splitSolid(solid,n,.21);
    assert.equal(parts.length,2);
    assert.ok(Math.abs(parts.reduce((sum,p)=>sum+solidProperties(p).volume,0)-solidProperties(solid).volume)<1e-6);
  }
});
