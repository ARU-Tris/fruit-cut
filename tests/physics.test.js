import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from 'three';
import { FruitSimulation, initPhysics } from '../src/simulation.js';
await initPhysics();

const advance=(sim,seconds)=>{for(let i=0;i<seconds*120;i++)sim.step(1/120);};

test('Shift marks remain intact and motionless until released; all cuts release in one transaction',()=>{
  const sim=new FruitSimulation({random:()=>.5});
  try{
    const id=sim.active.id;
    for(let i=0;i<5;i++)assert.ok(sim.queueCut(new Vector3(Math.cos(i*.6),Math.sin(i*.6),0),.1));
    advance(sim,1);
    assert.equal(sim.active.id,id);assert.equal(sim.pieces.length,0);assert.equal(sim.queued.length,5);assert.equal(sim.totalCuts,0);
    const result=sim.releaseCuts();
    assert.ok(result.pieces.length>=10);assert.equal(sim.active,null);assert.equal(sim.queued.length,0);assert.equal(sim.totalCuts,5);assert.equal(sim.fruitsCut,1);
    assert.ok(result.pieces.every(p=>p.body.mass()>0));
  }finally{sim.dispose();}
});

test('gravity drops real hulls, pieces settle on the board and never disappear as new fruit arrives',()=>{
  const sim=new FruitSimulation({random:()=>.5});
  try{
    sim.cutNow(new Vector3(1,0,0),0);
    const initialY=sim.pieces.map(p=>p.body.translation().y);
    advance(sim,.35);
    sim.pieces.forEach((p,i)=>assert.ok(p.body.translation().y<initialY[i]-.25));
    advance(sim,20);
    assert.equal(sim.pieces.length,2);assert.ok(sim.active?.ready);assert.equal(sim.active.id,2);
    assert.ok(sim.pieces.every(p=>p.body.translation().y>-.2&&p.body.translation().y<1.4));
    assert.ok(sim.pieces.every(p=>p.body.isSleeping()));
    sim.cutNow(new Vector3(0,1,0),0);advance(sim,9);
    assert.equal(sim.pieces.length,4);
    assert.ok(sim.pieces.every(p=>Object.values(p.body.translation()).every(Number.isFinite)));
  }finally{sim.dispose();}
});

test('cleaning removes only dropped pieces and preserves the suspended fruit and pending lines',()=>{
  const sim=new FruitSimulation();
  try{
    sim.cutNow(new Vector3(1,0,0),0);advance(sim,1.7);
    sim.queueCut(new Vector3(0,1,0),0);const active=sim.active;
    assert.equal(sim.clean().length,2);assert.equal(sim.pieces.length,0);
    assert.equal(sim.active,active);assert.equal(sim.queued.length,1);assert.equal(sim.totalCuts,1);
    assert.equal(sim.world.bodies.len(),0);
  }finally{sim.dispose();}
});

test('duplicate marks, undo, cancel, and misses leave physical state intact',()=>{
  const sim=new FruitSimulation();
  try{
    const n=new Vector3(1,0,0);
    assert.ok(sim.queueCut(n,0));assert.equal(sim.queueCut(n,0),false);assert.equal(sim.queueCut(n.clone().negate(),0),false);
    sim.undoCut();assert.equal(sim.queued.length,0);
    sim.queueCut(n,.2);sim.cancelCuts();assert.equal(sim.releaseCuts(),null);
    assert.equal(sim.cutNow(n,3),null);assert.ok(sim.active);assert.equal(sim.pieces.length,0);
  }finally{sim.dispose();}
});

test('a busy pile stays finite and retains every generated hull until explicit cleaning',()=>{
  const sim=new FruitSimulation({random:()=>.53});
  try{
    let count=0;
    for(let fruit=0;fruit<8;fruit++){
      sim.spawn(['avocado','watermelon','orange','kiwi','lemon'][fruit%5],false);
      for(let i=0;i<4;i++)sim.queueCut(new Vector3(Math.cos(i*.8),Math.sin(i*.8),.1).normalize(),(i-1.5)*.16);
      count+=sim.releaseCuts().pieces.length;
      advance(sim,1.2);
    }
    advance(sim,8);
    assert.ok(count>=70,`${count} pieces`);assert.equal(sim.pieces.length,count);assert.equal(sim.world.bodies.len(),count);
    for(const p of sim.pieces){const pos=p.body.translation();assert.ok(Object.values(pos).every(Number.isFinite));assert.ok(pos.y>-.7&&pos.y<7);}
    sim.clean();assert.equal(sim.world.bodies.len(),0);assert.equal(sim.pieces.length,0);
  }finally{sim.dispose();}
});
