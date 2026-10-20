import './style.css';
import { FRUITS } from './fruit.js';
import { FruitAudio } from './audio.js';
import { BladeEffects } from './effects.js';
import { FruitScene } from './scene.js';
import { FruitSimulation, initPhysics } from './simulation.js';

const svg=(body)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${body}</svg>`;
const icons={
  sound:svg('<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M15 8a6 6 0 010 8m3-11a10 10 0 010 14"/>'),
  muted:svg('<path d="M11 5L6 9H3v6h3l5 4V5z"/><path d="M16 9l5 6m0-6l-5 6"/>'),
  expand:svg('<path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5"/>'),
  help:svg('<circle cx="12" cy="12" r="9"/><path d="M9.7 8.7a2.5 2.5 0 014.8.8c0 2-2.5 2-2.5 4m0 3h.01"/>'),
  broom:svg('<path d="M15 3L9 14m1-5l6 3m-7 1c-3-1-5 2-6 6 3 2 7 3 10 1 0-3-1-5-4-7zM7 16l-2 4m5-3l-1 4"/>'),
  slow:svg('<circle cx="12" cy="13" r="8"/><path d="M12 9v4l3 2m-6-13h6m-3 0v3m7 1l1.5-1.5"/>'),
  arrow:svg('<path d="M5 12h14m-5-5l5 5-5 5"/>'),
  cut:svg('<path d="M4 20L20 4M7 5l1 1m8 12l1 1M3 12h3m12 0h3M12 3v3m0 12v3"/>'),
};

document.querySelector('#app').innerHTML=`
  <div class="shell">
    <header class="header">
      <span class="brand" aria-label="Fruit Cut">FRUIT <span>/</span> CUT<i></i></span>
      <span class="header-note">A LITTLE CUT. A LITTLE CALM.</span>
      <nav class="top-actions" aria-label="게임 설정">
        <button id="slow" class="text-button" aria-pressed="false" title="슬로 모션 (Space)">${icons.slow}<span>슬로 모션</span></button>
        <span class="action-divider"></span>
        <button id="sound" class="icon-button" aria-label="소리 끄기" title="소리 끄기"></button>
        <button id="fullscreen" class="icon-button" aria-label="전체 화면" title="전체 화면">${icons.expand}</button>
        <button id="help" class="icon-button" aria-label="조작 방법" title="조작 방법">${icons.help}</button>
      </nav>
    </header>
    <main class="game" id="game" aria-label="과일 자르기 게임" data-ready="false">
      <canvas id="blade" class="blade-canvas" aria-hidden="true"></canvas>
      <div class="vignette" aria-hidden="true"></div>
      <section class="specimen" aria-label="선택한 과일"><span class="eyebrow">TODAY'S LITTLE PLEASURE</span><h1 id="fruit-name">아보카도</h1><span id="fruit-english">01 / AVOCADO</span></section>
      <div class="cut-counter" aria-live="polite" aria-atomic="true"><span class="counter-label" id="counter-label">MAKE THE FIRST CUT</span><div><span id="cut-count">0</span><span class="cut-unit">CUTS</span></div><span id="counter-caption" class="counter-caption">기분 좋은 한 조각의 시작</span></div>
      <section class="stats" aria-label="플레이 기록"><div><span>자른 과일</span><strong id="fruit-count">00</strong></div><div><span>쌓인 조각</span><strong id="piece-count">00</strong></div></section>
      <div id="batch-status" class="batch-status" hidden><span class="batch-light"></span><span id="batch-copy">절단선을 모으고 있어요</span><button id="release" title="모은 선대로 자르기">지금 자르기 ${icons.arrow}</button></div>
      <div class="stage-hint" id="stage-hint"><span class="mouse-icon"></span><span>누르고, 긋고, 놓기.</span><span class="hint-separator"></span><span>나머지는 중력에게.</span></div>
      <div class="board-caption" aria-hidden="true"><span>THE CUTTING ROOM</span><span>TAKE YOUR TIME, MAKE A MESS.</span></div>
      <div id="loader" class="loader"><div class="loader-ring"></div><span>과일을 준비하고 있어요</span></div>
      <div id="toast" class="toast" role="status" aria-live="polite"></div>
    </main>
    <footer class="dock">
      <div class="fruit-picker" role="group" aria-label="과일 선택">${FRUITS.map((f,i)=>`<button class="fruit-button${i===0?' selected':''}" data-fruit="${f.id}" aria-pressed="${i===0}" title="${f.name} 선택"><span class="fruit-icon">${f.icon}</span><span>${f.name}</span><i></i></button>`).join('')}</div>
      <div class="dock-tools"><button id="batch" class="batch-button" aria-pressed="false" title="누른 채로 여러 선을 그리거나, 클릭해서 모아 베기를 켜세요."><kbd>SHIFT</kbd><span>모아 베기</span></button><span class="dock-divider"></span><button id="clean" class="clean-button" title="떨어진 조각과 과즙 청소 (C)">${icons.broom}<span>청소하기</span><kbd>C</kbd></button></div>
    </footer>
  </div>
  <dialog id="help-dialog">
    <form method="dialog"><button class="dialog-close" aria-label="닫기">×</button></form><span class="eyebrow">WELCOME TO THE CUTTING ROOM</span><h2>생각은 잠깐,<br>칼질은 마음껏.</h2>
    <div class="help-row"><span class="help-symbol">↗</span><div><strong>한 번에 한 칼</strong><p>마우스 왼쪽 버튼을 누르고 직선을 그으세요.<br>버튼을 놓으면 그 선대로 잘립니다.</p></div></div>
    <div class="help-row"><kbd>SHIFT</kbd><div><strong>여러 선을 모아서 싹</strong><p>Shift를 누른 채 여러 번 그으면 선이 과일에 새겨집니다. Shift를 놓으면 모두 한꺼번에 잘려요.<br>아래 ‘모아 베기’ 버튼으로도 켤 수 있습니다.</p></div></div>
    <div class="help-shortcuts"><span><kbd>ESC</kbd> 모은 선 취소</span><span><kbd>Ctrl Z</kbd> 마지막 선 지우기</span><span><kbd>C</kbd> 청소</span><span><kbd>SPACE</kbd> 슬로 모션</span></div>
    <div class="quality-row"><label for="quality">그래픽</label><select id="quality"><option value="high">부드러운 그림자</option><option value="low">가볍게 실행</option></select><label for="intensity">효과</label><select id="intensity"><option value="1">풍성하게</option><option value="0.4">차분하게</option></select></div>
    <form method="dialog"><button class="dialog-start">좋아, 잘라볼게요 ${icons.arrow}</button></form>
  </dialog>`;

const $=(id)=>document.getElementById(id);
const audio=new FruitAudio();
const game=$('game');
const effects=new BladeEffects($('blade'));
let scene,simulation,draft=null,shiftDown=false,latched=false,slow=false,intensity=window.matchMedia('(prefers-reduced-motion: reduce)').matches?0.4:1;
let freeze=0,autoSlow=0,toastTimer,uiKey='',lastTime=performance.now(),lastUI=0;

function toast(message){$('toast').textContent=message;$('toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('visible'),2300);}
function syncSound(){const b=$('sound');b.innerHTML=audio.muted?icons.muted:icons.sound;b.setAttribute('aria-label',audio.muted?'소리 켜기':'소리 끄기');b.title=audio.muted?'소리 켜기':'소리 끄기';b.classList.toggle('is-muted',audio.muted);}
syncSound();
$('intensity').value=String(intensity);

function syncUI(force=false){
  if(!simulation)return;
  const queued=simulation.queued.length,batch=shiftDown||latched;
  const key=[queued,batch,slow,simulation.pieces.length,simulation.totalCuts,simulation.selected,simulation.fruitsCut].join('/');
  if(!force&&key===uiKey)return;uiKey=key;
  const fruit=FRUITS.find(f=>f.id===simulation.selected);
  $('fruit-name').textContent=fruit.name;$('fruit-english').textContent=`${String(fruit.index+1).padStart(2,'0')} / ${fruit.english}`;
  $('cut-count').textContent=queued||simulation.totalCuts;
  $('counter-label').textContent=queued?'READY WHEN YOU ARE':simulation.totalCuts?'THAT FELT GOOD.':'MAKE THE FIRST CUT';
  $('counter-caption').textContent=queued?`${queued}개의 선, 한 번의 쾌감`:simulation.totalCuts?'계속해서 마음껏 잘라보세요':'기분 좋은 한 조각의 시작';
  $('cut-count').classList.toggle('queued',queued>0);
  $('fruit-count').textContent=String(simulation.fruitsCut).padStart(2,'0');$('piece-count').textContent=String(simulation.pieces.length).padStart(2,'0');
  $('batch-status').hidden=!batch&&!queued;
  $('batch-copy').textContent=queued?(latched?`${queued}개의 절단선이 준비됐어요`:'Shift를 놓으면 한꺼번에 잘려요'):'절단선을 여러 개 그어보세요';
  $('release').hidden=queued===0;
  $('batch').classList.toggle('active',batch);$('batch').setAttribute('aria-pressed',String(latched));
  $('slow').setAttribute('aria-pressed',String(slow));
  $('stage-hint').hidden=batch||simulation.totalCuts>1;
  game.classList.toggle('batch-mode',batch);game.dataset.queued=queued;game.dataset.pieces=simulation.pieces.length;game.dataset.totalCuts=simulation.totalCuts;
  document.querySelectorAll('[data-fruit]').forEach(b=>{const selected=b.dataset.fruit===fruit.id;b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));});
}

function position(event){const rect=game.getBoundingClientRect();return{x:event.clientX-rect.left,y:event.clientY-rect.top};}
function releasePointer(id){if(id!=null&&scene.renderer.domElement.hasPointerCapture(id))scene.renderer.domElement.releasePointerCapture(id);}
function cancelDraft(){if(!draft)return;const id=draft.pointerId;draft=null;releasePointer(id);}

function finishStroke(forceMark=false){
  if(!draft||!simulation.active){cancelDraft();return;}
  const stroke=draft;draft=null;releasePointer(stroke.pointerId);
  const active=simulation.active,plane=scene.localPlane(stroke.start,stroke.end,active);
  if(!plane)return;
  const contour=simulation.validatePlane(plane.normal,plane.offset);
  if(!contour.length||!scene.segmentTouches(contour,stroke.start,stroke.end,active))return;
  const mark=forceMark||shiftDown||latched;
  try{
    if(mark){
      if(simulation.queueCut(plane.normal,plane.offset)){scene.syncMarks(simulation.queued);audio.slice(1,true);effects.slash(stroke.start,stroke.end,true,intensity);}
    }else if(simulation.cutNow(plane.normal,plane.offset))effects.slash(stroke.start,stroke.end,false,intensity);
  }catch(error){console.error(error);toast('이 선은 자르지 못했어요. 다른 각도로 다시 그어주세요.');}
  syncUI();
}

function releaseQueued(){
  if(!simulation?.queued.length)return;
  try{simulation.releaseCuts();scene.syncMarks(simulation.queued);}catch(error){console.error(error);toast('절단을 완료하지 못했어요. Esc로 선을 지운 뒤 다시 시도해주세요.');}
  syncUI();
}

function clean(){
  if(!simulation||(!simulation.pieces.length&&!scene.splats.length))return;
  simulation.clean();scene.clean();effects.clean();audio.unlock();audio.sweep();toast('말끔해졌어요. 다시 마음껏.');syncUI();
}

function cancelCuts(){cancelDraft();simulation.cancelCuts();scene.syncMarks([]);syncUI();}
function setSlow(){slow=!slow;syncUI();}

$('sound').addEventListener('click',()=>{audio.toggle();syncSound();});
$('slow').addEventListener('click',setSlow);
$('help').addEventListener('click',()=>{cancelDraft();$('help-dialog').showModal();});
$('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{toast('이 브라우저에서는 전체 화면을 켤 수 없어요.');}});
$('quality').addEventListener('change',e=>scene?.setQuality(e.target.value==='low'));
$('intensity').addEventListener('change',e=>{intensity=Number(e.target.value);});
$('clean').addEventListener('click',clean);
$('batch').addEventListener('click',()=>{if(!simulation)return;audio.unlock();latched=!latched;if(!latched&&!shiftDown)releaseQueued();syncUI();});
$('release').addEventListener('click',()=>{audio.unlock();releaseQueued();});
document.querySelectorAll('[data-fruit]').forEach(button=>button.addEventListener('click',()=>{if(!simulation)return;cancelDraft();audio.unlock();simulation.spawn(button.dataset.fruit);syncUI();}));

window.addEventListener('keydown',event=>{
  if(!simulation||$('help-dialog').open||['INPUT','SELECT','TEXTAREA'].includes(document.activeElement?.tagName))return;
  if(event.key==='Shift'){shiftDown=true;syncUI();}
  if(event.repeat)return;
  if(event.key==='Escape')cancelCuts();
  if((event.ctrlKey||event.metaKey)&&event.key.toLowerCase()==='z'){event.preventDefault();simulation.undoCut();scene.syncMarks(simulation.queued);syncUI();}
  if(event.code==='Space'){event.preventDefault();setSlow();}
  if(event.code==='KeyC'&&!event.ctrlKey&&!event.metaKey)clean();
});
window.addEventListener('keyup',event=>{
  if(event.key==='Shift'){shiftDown=false;if(draft)finishStroke(true);if(!latched)releaseQueued();syncUI();}
});
window.addEventListener('blur',()=>{cancelDraft();shiftDown=false;effects.cursor=null;syncUI();});
document.addEventListener('visibilitychange',()=>{lastTime=performance.now();if(document.hidden){cancelDraft();shiftDown=false;syncUI();}});

async function start(){
  try{
    scene=new FruitScene(game);
    const resizeEffects=()=>effects.resize(scene.width,scene.height);
    new ResizeObserver(resizeEffects).observe(game);resizeEffects();
    await initPhysics();
    simulation=new FruitSimulation({
      onSpawn:active=>scene.spawn(active),
      onImpact:piece=>audio.impact(piece),
      onCut:result=>{
        scene.cut(result,intensity);audio.slice(result.count);freeze=0.035*intensity;autoSlow=result.count>1?0.27*intensity:0;
        const center=scene.project(result.active.position);effects.burst(center.x,center.y,intensity);
        $('cut-count').animate([{transform:'scale(1.12)',opacity:0.4},{transform:'scale(1)',opacity:1}],{duration:280,easing:'ease-out'});
      },
    });
    const canvas=scene.renderer.domElement;
    canvas.addEventListener('pointerdown',event=>{
      if(event.button!==0||draft)return;event.preventDefault();audio.unlock();
      if(!simulation.active?.ready)return;
      shiftDown=event.shiftKey;const p=position(event);draft={start:p,end:{...p},pointerId:event.pointerId};canvas.setPointerCapture(event.pointerId);syncUI();
    });
    canvas.addEventListener('pointermove',event=>{const p=position(event);effects.cursor=p;if(draft&&event.pointerId===draft.pointerId)draft.end=p;});
    canvas.addEventListener('pointerup',event=>{if(event.button===0&&draft&&event.pointerId===draft.pointerId){draft.end=position(event);finishStroke();}});
    canvas.addEventListener('pointercancel',cancelDraft);
    canvas.addEventListener('lostpointercapture',()=>{if(draft)draft=null;});
    canvas.addEventListener('pointerleave',()=>{if(!draft)effects.cursor=null;});
    canvas.addEventListener('contextmenu',event=>event.preventDefault());
    canvas.addEventListener('webglcontextlost',event=>{event.preventDefault();cancelDraft();toast('그래픽 연결이 끊겼어요. 페이지를 새로고침해주세요.');});
    $('loader').remove();game.dataset.ready='true';syncUI(true);
    if(import.meta.env.DEV||new URLSearchParams(location.search).has('qa')){
      // Inspection only. Browser checks still use real pointer and keyboard events.
      window.__FRUIT_CUT__={
        snapshot:()=>({ready:true,queued:simulation.queued.length,pieces:simulation.pieces.length,totalCuts:simulation.totalCuts,fruitsCut:simulation.fruitsCut,activeType:simulation.selected,activeId:simulation.active?.id,activeReady:simulation.active?.ready??false,marks:scene.marks?.children.length??0,slow,latched,shiftDown,sleeping:simulation.pieces.filter(p=>p.body.isSleeping()).length,positions:simulation.pieces.map(p=>({...p.body.translation()})),meshes:scene.pieces.size,drawCalls:scene.renderer.info.render.calls,triangles:scene.renderer.info.render.triangles,geometries:scene.renderer.info.memory.geometries}),
        fruitBounds:()=>{
          if(!simulation.active)return null;const active=simulation.active;
          const ps=active.solid.faces.flatMap(f=>f.vertices).map(p=>scene.project(p.clone().applyQuaternion(active.rotation).add(active.position)));
          const rect=game.getBoundingClientRect();
          return{left:Math.min(...ps.map(p=>p.x))+rect.left,right:Math.max(...ps.map(p=>p.x))+rect.left,top:Math.min(...ps.map(p=>p.y))+rect.top,bottom:Math.max(...ps.map(p=>p.y))+rect.top,center:scene.project(active.position),stage:{x:rect.left,y:rect.top,width:rect.width,height:rect.height}};
        },
      };
    }
    lastTime=performance.now();requestAnimationFrame(frame);
  }catch(error){console.error(error);$('loader').innerHTML='<span class="error-mark">!</span><strong>게임을 시작하지 못했어요</strong><span>최신 Chrome 또는 Edge에서 실행하고, 브라우저의 그래픽 가속을 켜주세요.</span><button onclick="location.reload()">다시 시도</button>';}
}

function frame(now){
  requestAnimationFrame(frame);
  const dt=Math.min((now-lastTime)/1000,0.05);lastTime=now;
  if(document.hidden)return;
  freeze=Math.max(0,freeze-dt);autoSlow=Math.max(0,autoSlow-dt);
  const worldDt=freeze>0?0:dt*(slow?0.25:autoSlow>0?0.3:1);
  // A live drag freezes only the suspended fruit's pose for an exact preview.
  const age=simulation.active?.age;
  simulation.step(worldDt);
  if(draft&&simulation.active&&age!=null){simulation.active.age=age;simulation.updatePose();}
  scene.render(worldDt,simulation,intensity);effects.render(dt,draft,shiftDown||latched,intensity);
  if(now-lastUI>120){syncUI();lastUI=now;}
}

start();
