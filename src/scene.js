import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { buildSolidGeometry } from './geometry.js';
import { createFruitMaterials, createWoodTexture } from './materials.js';

export class FruitScene {
  constructor(container) {
    this.container = container;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
    this.renderer.setClearColor(0x15191a);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.15;
    this.renderer.domElement.className = 'world-canvas';
    this.renderer.domElement.setAttribute('aria-label', '3D 과일 자르기. 마우스 왼쪽 버튼을 누르고 선을 그린 뒤 놓으세요.');
    container.prepend(this.renderer.domElement);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0x15191a, 22, 52);
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.1, 80);
    this.camera.position.set(0, 5.25, 12.9);
    this.camera.lookAt(0, 2.35, 0);
    this.baseCamera = this.camera.position.clone();
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const room = new RoomEnvironment();
    this.environment = pmrem.fromScene(room, 0.04).texture;
    this.scene.environment = this.environment;
    this.scene.environmentIntensity = 0.43;
    room.dispose(); pmrem.dispose();
    this.scene.add(new THREE.HemisphereLight(0xe1e9dc, 0x34332d, 1.6));
    const key = new THREE.DirectionalLight(0xfff1d7, 3.6);
    key.position.set(-3.5, 8, 5); key.castShadow = true;
    key.shadow.mapSize.set(2048,2048);
    Object.assign(key.shadow.camera, { left:-7,right:7,top:7,bottom:-5,near:0.5,far:23 });
    key.shadow.bias = -0.00012; key.shadow.normalBias = 0.018;
    key.shadow.radius = 4;
    this.scene.add(key); this.key = key;
    const rim = new THREE.DirectionalLight(0xd4e5c2, 2.1);
    rim.position.set(4,5,-4); this.scene.add(rim);
    const fill = new THREE.DirectionalLight(0xc3d5e4, 0.5);
    fill.position.set(3,3,6); this.scene.add(fill);
    this.makeBoard();
    this.materials = new Map();
    this.pieces = new Map();
    this.cleaning = [];
    this.droplets = [];
    this.splats = [];
    this.time = 0;
    this.shake = 0;
    this.splatGeometry = new THREE.CircleGeometry(1,12);
    this.splatMaterials = new Map();
    this.markMaterial = new THREE.MeshBasicMaterial({ color: 0xf5edbd, toneMapped:false });
    this.particleMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(1,7,5), new THREE.MeshPhysicalMaterial({ color:0xffffff,roughness:0.25,clearcoat:0.8 }), 650);
    this.particleMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleMesh.count = 0; this.particleMesh.frustumCulled = false;
    this.scene.add(this.particleMesh);
    this.dummy = new THREE.Object3D();
    this.color = new THREE.Color();
    this.raycaster = new THREE.Raycaster();
    this.resizeObserver = new ResizeObserver(() => this.resize());
    this.resizeObserver.observe(container);
    this.resize();
  }

  makeBoard() {
    const texture = createWoodTexture();
    const board = new THREE.Mesh(new RoundedBoxGeometry(10.1,0.32,5.5,4,0.12), new THREE.MeshStandardMaterial({ map:texture, roughness:0.69, bumpMap:texture, bumpScale:0.012 }));
    board.position.y = -0.16; board.receiveShadow = true; board.castShadow = true;
    this.scene.add(board);
    const bottom = new THREE.Mesh(new RoundedBoxGeometry(10.0,0.09,5.42,3,0.04), new THREE.MeshStandardMaterial({ color:0x513622,roughness:0.76 }));
    bottom.position.y = -0.34; this.scene.add(bottom);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(180,180), new THREE.MeshStandardMaterial({ color:0x171c1d,roughness:0.94 }));
    floor.rotation.x = -Math.PI/2; floor.position.y = -0.49; floor.receiveShadow = true; this.scene.add(floor);
    // A routed juice groove gives the timber a visible scale and boundary.
    const groove = new THREE.Shape();
    groove.moveTo(-4.68,-2.38); groove.lineTo(4.68,-2.38); groove.quadraticCurveTo(4.83,-2.38,4.83,-2.23);
    groove.lineTo(4.83,2.23); groove.quadraticCurveTo(4.83,2.38,4.68,2.38);
    groove.lineTo(-4.68,2.38); groove.quadraticCurveTo(-4.83,2.38,-4.83,2.23);
    groove.lineTo(-4.83,-2.23); groove.quadraticCurveTo(-4.83,-2.38,-4.68,-2.38);
    const path = groove.getPoints(90).map((p) => new THREE.Vector3(p.x,0.006,p.y));
    const curve = new THREE.CatmullRomCurve3(path,true);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve,160,0.014,5,true),new THREE.MeshStandardMaterial({color:0x71502f,roughness:0.85}));
    this.scene.add(mesh);
  }

  resize() {
    const rect = this.container.getBoundingClientRect();
    this.width = Math.max(1,rect.width); this.height = Math.max(1,rect.height);
    this.renderer.setSize(this.width,this.height,false);
    this.camera.aspect = this.width/this.height;
    this.camera.fov = this.camera.aspect < 0.8 ? 42 : 35;
    this.camera.updateProjectionMatrix();
  }

  setQuality(low) {
    this.renderer.setPixelRatio(low ? 1 : Math.min(devicePixelRatio,1.75));
    this.renderer.shadowMap.enabled = !low;
    this.resize();
  }

  getMaterials(fruit) {
    if (!this.materials.has(fruit.id)) this.materials.set(fruit.id,createFruitMaterials(fruit));
    return this.materials.get(fruit.id);
  }

  spawn(active) {
    this.removeActive();
    this.activeGroup = new THREE.Group();
    this.activeMesh = new THREE.Mesh(buildSolidGeometry(active.solid),this.getMaterials(active.fruit));
    this.activeMesh.castShadow = true; this.activeMesh.receiveShadow = true;
    this.activeGroup.add(this.activeMesh);
    this.marks = new THREE.Group(); this.activeGroup.add(this.marks);
    const stem = new THREE.Mesh(new THREE.CylinderGeometry(0.035,0.052,0.12,8),new THREE.MeshStandardMaterial({color:0x534129,roughness:1}));
    stem.position.y = active.fruit.radii[1]+0.025;
    this.activeGroup.add(stem); this.stem = stem;
    this.scene.add(this.activeGroup);
    this.activeGroup.position.copy(active.position); this.activeGroup.quaternion.copy(active.rotation);
  }

  removeActive() {
    if (!this.activeGroup) return;
    this.clearMarks();
    this.activeMesh.geometry.dispose();
    this.stem.geometry.dispose(); this.stem.material.dispose();
    this.scene.remove(this.activeGroup); this.activeGroup = null; this.activeMesh = null;
  }

  clearMarks() {
    if (!this.marks) return;
    for (const mark of this.marks.children) mark.geometry.dispose();
    this.marks.clear();
  }

  syncMarks(planes) {
    this.clearMarks();
    for (const { contour } of planes) {
      const points = contour.map((p) => p.clone().multiplyScalar(1.006));
      const curve = new THREE.CatmullRomCurve3(points,true,'centripetal');
      const line = new THREE.Mesh(new THREE.TubeGeometry(curve,Math.min(144,points.length*2),0.008,4,true),this.markMaterial);
      this.marks.add(line);
    }
  }

  cut(result, intensity=1) {
    this.removeActive();
    for (const piece of result.pieces) {
      const mesh = new THREE.Mesh(buildSolidGeometry(piece.solid,piece.center),this.getMaterials(piece.fruit));
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.position.copy(piece.body.translation()); mesh.quaternion.copy(piece.body.rotation());
      this.scene.add(mesh); this.pieces.set(piece.id,{mesh,piece});
    }
    this.shake = Math.min(0.055,0.014+result.count*0.004)*intensity;
    const center = result.active.position;
    const count = Math.min(150,25+result.count*11)*intensity;
    for (let i=0;i<count;i++) {
      const plane = result.planes[i%result.planes.length];
      const normal = plane.normal.clone().applyQuaternion(result.active.rotation);
      const position = center.clone().add(new THREE.Vector3((Math.random()-0.5)*1.5,(Math.random()-0.5)*1.7,(Math.random()-0.5)*1.1));
      const velocity = new THREE.Vector3((Math.random()-0.5)*3.8,Math.random()*3.1+0.5,(Math.random()-0.5)*2.8).addScaledVector(normal,(Math.random()-0.5)*2);
      this.droplets.push({position,velocity,life:1.2+Math.random()*0.5,size:0.012+Math.random()*0.024,color:result.active.fruit.juice,fruit:result.active.fruit});
    }
    if (this.droplets.length>650) this.droplets.splice(0,this.droplets.length-650);
  }

  splat(position,fruit) {
    if (this.splats.length>=180 || Math.abs(position.x)>4.9 || Math.abs(position.z)>2.55) return;
    if (!this.splatMaterials.has(fruit.id)) this.splatMaterials.set(fruit.id,new THREE.MeshBasicMaterial({color:fruit.juice,transparent:true,opacity:0.33,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}));
    const mesh = new THREE.Mesh(this.splatGeometry,this.splatMaterials.get(fruit.id));
    mesh.rotation.x = -Math.PI/2; mesh.rotation.z = Math.random()*Math.PI;
    mesh.position.set(position.x,0.008+this.splats.length*0.000008,position.z);
    const size = 0.025+Math.random()*0.055; mesh.scale.set(size,size*(0.6+Math.random()*0.7),1);
    this.scene.add(mesh); this.splats.push(mesh);
  }

  clean() {
    for (const item of this.pieces.values()) this.cleaning.push({mesh:item.mesh,start:item.mesh.position.clone(),rotation:item.mesh.quaternion.clone(),age:0});
    this.pieces.clear();
    for (const mesh of this.splats) this.scene.remove(mesh);
    this.splats = []; this.droplets = [];
  }

  project(point) {
    const p = point.clone().project(this.camera);
    return { x:(p.x+1)*this.width/2,y:(1-p.y)*this.height/2 };
  }

  localPlane(start,end,active) {
    const a = new THREE.Vector2(start.x/this.width*2-1,1-start.y/this.height*2);
    const b = new THREE.Vector2(end.x/this.width*2-1,1-end.y/this.height*2);
    const forward = new THREE.Vector3(); this.camera.getWorldDirection(forward);
    const screenPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(forward,active.position);
    this.raycaster.setFromCamera(a,this.camera);
    const wa = this.raycaster.ray.intersectPlane(screenPlane,new THREE.Vector3());
    this.raycaster.setFromCamera(b,this.camera);
    const wb = this.raycaster.ray.intersectPlane(screenPlane,new THREE.Vector3());
    if (!wa || !wb) return null;
    const normalWorld = new THREE.Vector3().crossVectors(wb.clone().sub(wa),forward).normalize();
    const inverse = active.rotation.clone().invert();
    const normal = normalWorld.clone().applyQuaternion(inverse);
    const localPoint = wa.clone().sub(active.position).applyQuaternion(inverse);
    return {normal,offset:normal.dot(localPoint)};
  }

  segmentTouches(contour,start,end,active) {
    const dx=end.x-start.x,dy=end.y-start.y,len2=dx*dx+dy*dy;
    if (len2<18*18) return false;
    const ts=contour.map((point)=>{
      const p=this.project(point.clone().applyQuaternion(active.rotation).add(active.position));
      return ((p.x-start.x)*dx+(p.y-start.y)*dy)/len2;
    });
    return Math.min(...ts)<0.98 && Math.max(...ts)>0.02 && Math.min(1,Math.max(...ts))-Math.max(0,Math.min(...ts))>0.06;
  }

  render(dt,simulation,intensity=1) {
    this.time+=dt;
    if (this.activeGroup && simulation.active) {
      this.activeGroup.position.copy(simulation.active.position);
      this.activeGroup.quaternion.copy(simulation.active.rotation);
    }
    for (const {mesh,piece} of this.pieces.values()) {
      if (!piece.body.isSleeping()) {mesh.position.copy(piece.body.translation());mesh.quaternion.copy(piece.body.rotation());}
    }
    this.cleaning=this.cleaning.filter((item)=>{
      item.age+=dt; const t=Math.min(item.age/0.48,1),ease=t*t;
      item.mesh.position.copy(item.start).add(new THREE.Vector3(ease*8,Math.sin(t*Math.PI)*0.6,-ease));
      item.mesh.scale.setScalar(1-t*0.7); item.mesh.rotateZ(dt*4);
      if(t>=1){this.scene.remove(item.mesh);item.mesh.geometry.dispose();return false;} return true;
    });
    this.droplets=this.droplets.filter((p)=>{
      p.life-=dt;p.velocity.y-=9.81*dt;p.position.addScaledVector(p.velocity,dt);
      if(p.position.y<0.02){this.splat(p.position,p.fruit);return false;}return p.life>0;
    });
    this.particleMesh.count=this.droplets.length;
    this.droplets.forEach((p,i)=>{
      this.dummy.position.copy(p.position);this.dummy.scale.set(p.size,p.size*(1+Math.min(p.velocity.length()*0.13,1.5)),p.size);
      this.dummy.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),p.velocity.clone().normalize());this.dummy.updateMatrix();
      this.particleMesh.setMatrixAt(i,this.dummy.matrix);this.particleMesh.setColorAt(i,this.color.set(p.color));
    });
    this.particleMesh.instanceMatrix.needsUpdate=true;
    if(this.particleMesh.instanceColor)this.particleMesh.instanceColor.needsUpdate=true;
    this.camera.position.copy(this.baseCamera);
    if(this.shake>0.0001){this.camera.position.x+=(Math.random()-0.5)*this.shake;this.camera.position.y+=(Math.random()-0.5)*this.shake;this.shake*=Math.exp(-dt*18);}
    this.renderer.render(this.scene,this.camera);
  }
}
