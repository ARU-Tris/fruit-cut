import RAPIER from '@dimforge/rapier3d-compat';
import { Quaternion, Vector3 } from 'three';
import { getFruit } from './fruit.js';
import { colliderVertices, createFruitSolid, sectionContour, solidProperties, splitByPlanes } from './geometry.js';

let initialized;
export function initPhysics() {
  initialized ??= RAPIER.init();
  return initialized;
}

export class FruitSimulation {
  constructor({ random = Math.random, onCut = () => {}, onSpawn = () => {}, onImpact = () => {} } = {}) {
    this.random = random;
    this.onCut = onCut;
    this.onSpawn = onSpawn;
    this.onImpact = onImpact;
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.world.timestep = 1 / 120;
    this.world.numSolverIterations = 8;
    this.events = new RAPIER.EventQueue(true);
    this.pieces = [];
    this.colliderPieces = new Map();
    this.queued = [];
    this.totalCuts = 0;
    this.fruitsCut = 0;
    this.selected = 'avocado';
    this.spawnTimer = -1;
    this.accumulator = 0;
    this.serial = 0;
    this.elapsed = 0;
    this.lastBatch = 0;
    // The board and surrounding table both catch pieces. Nothing is culled.
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(5.05, 0.16, 2.75).setTranslation(0, -0.16, 0).setFriction(0.65).setRestitution(0.12));
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(12, 0.15, 8).setTranslation(0, -0.64, 0).setFriction(0.7));
    for (const x of [-12, 12]) this.world.createCollider(RAPIER.ColliderDesc.cuboid(0.12, 12, 8).setTranslation(x, 6, 0));
    for (const z of [-8, 8]) this.world.createCollider(RAPIER.ColliderDesc.cuboid(12, 12, 0.12).setTranslation(0, 6, z));
    this.spawn('avocado', false);
  }

  spawn(id = this.selected, animate = true) {
    this.selected = id;
    this.queued = [];
    this.spawnTimer = -1;
    this.active = {
      id: ++this.serial,
      fruit: getFruit(id),
      solid: createFruitSolid(getFruit(id)),
      position: new Vector3(animate ? 6.8 : 0, 3.25, 0),
      rotation: new Quaternion(),
      age: animate ? 0 : 1,
      ready: !animate,
    };
    this.updatePose();
    this.onSpawn(this.active);
    return this.active;
  }

  updatePose() {
    const a = this.active;
    if (!a) return;
    const t = Math.min(a.age / 0.57, 1);
    const ease = 1 - (1 - t) ** 4;
    a.position.set((1 - ease) * 6.8, 3.25 + Math.sin(a.age * 1.45) * 0.035, 0);
    // Local cut planes remain attached as the intact fruit gently floats.
    a.rotation.setFromAxisAngle(new Vector3(0, 1, 0), 0.2 + Math.sin(a.age * 0.38) * 0.055);
    a.ready = t >= 1;
  }

  validatePlane(normal, offset) {
    if (!this.active?.ready || !Number.isFinite(offset) || !normal.toArray().every(Number.isFinite) || normal.lengthSq() < 0.5) return [];
    return sectionContour(this.active.solid, normal, offset);
  }

  queueCut(normal, offset) {
    const contour = this.validatePlane(normal, offset);
    if (contour.length < 3) return false;
    const duplicate = this.queued.some((p) => (p.normal.dot(normal) > 0.99999 && Math.abs(p.offset - offset) < 0.004) || (p.normal.dot(normal) < -0.99999 && Math.abs(p.offset + offset) < 0.004));
    if (duplicate) return false;
    this.queued.push({ normal: normal.clone(), offset, contour });
    return true;
  }

  undoCut() { return this.queued.pop(); }
  cancelCuts() { this.queued = []; }

  cutNow(normal, offset) {
    if (this.validatePlane(normal, offset).length < 3) return null;
    return this.releaseCuts([{ normal: normal.clone(), offset }]);
  }

  releaseCuts(planes = this.queued) {
    if (!this.active || !planes.length) return null;
    const active = this.active;
    const fragments = splitByPlanes(active.solid, planes);
    if (fragments.length < 2) { this.queued = []; return null; }
    // Prepare every hull before changing state: a failed hull never drops fruit.
    const prepared = fragments.map((solid) => {
      const { center, volume } = solidProperties(solid);
      const collider = RAPIER.ColliderDesc.convexHull(colliderVertices(solid, center));
      if (!collider) throw new Error('절단 조각의 충돌 형상을 만들지 못했습니다.');
      return { solid, center, volume, collider };
    });
    const created = [];
    for (const item of prepared) {
      const { solid, center, volume, collider } = item;
      const rotatedCenter = center.clone().applyQuaternion(active.rotation);
      const direction = rotatedCenter.clone().normalize();
      const position = active.position.clone().add(rotatedCenter).addScaledVector(direction, 0.012);
      const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
        .setTranslation(position.x, position.y, position.z).setRotation(active.rotation)
        .setLinvel(direction.x * 0.78, direction.y * 0.38 + 0.12, direction.z * 0.62)
        .setAngvel({ x: (this.random() - 0.5) * 2.0, y: (this.random() - 0.5) * 1.0, z: (this.random() - 0.5) * 2.6 })
        .setLinearDamping(0.16).setAngularDamping(0.34).setCcdEnabled(true).setCanSleep(true));
      const shape = this.world.createCollider(collider.setDensity(active.fruit.density / 1000).setFriction(0.58).setRestitution(0.14).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
      const piece = { id: `${active.id}-${created.length}`, body, collider: shape, solid, center, volume, fruit: active.fruit, age: 0 };
      this.pieces.push(piece);
      created.push(piece);
      this.colliderPieces.set(shape.handle, piece);
    }
    this.totalCuts += planes.length;
    this.lastBatch = planes.length;
    this.fruitsCut++;
    this.queued = [];
    this.active = null;
    this.spawnTimer = 0.85;
    const result = { active, pieces: created, planes: [...planes], count: planes.length };
    this.onCut(result);
    return result;
  }

  step(dt) {
    dt = Math.min(Math.max(dt, 0), 0.08);
    this.elapsed += dt;
    if (this.active) { this.active.age += dt; this.updatePose(); }
    if (this.spawnTimer >= 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) this.spawn();
    }
    this.accumulator += dt;
    while (this.accumulator >= 1 / 120) {
      this.world.step(this.events);
      this.events.drainCollisionEvents((a, b, started) => {
        if (!started) return;
        const piece = this.colliderPieces.get(a) ?? this.colliderPieces.get(b);
        if (piece && piece.age > 0.1) this.onImpact(piece);
      });
      this.accumulator -= 1 / 120;
    }
    for (const piece of this.pieces) piece.age += dt;
  }

  clean() {
    const removed = this.pieces;
    for (const piece of removed) this.world.removeRigidBody(piece.body);
    this.pieces = [];
    this.colliderPieces.clear();
    return removed;
  }

  dispose() {
    this.world.free();
    this.events.free();
  }
}
