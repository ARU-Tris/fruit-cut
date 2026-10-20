export class BladeEffects {
  constructor(canvas) {
    this.canvas=canvas;this.ctx=canvas.getContext('2d');this.flashes=[];this.sparks=[];this.cursor=null;this.time=0;
  }
  resize(width,height) {this.width=width;this.height=height;const dpr=Math.min(devicePixelRatio,2);this.canvas.width=width*dpr;this.canvas.height=height*dpr;this.ctx.setTransform(dpr,0,0,dpr,0,0);}
  slash(start,end,marked=false,intensity=1) {
    this.flashes.push({start:{...start},end:{...end},life:1,marked});
    for(let i=0;i<22*intensity;i++){
      const t=Math.random();this.sparks.push({x:start.x+(end.x-start.x)*t,y:start.y+(end.y-start.y)*t,vx:(Math.random()-0.5)*240,vy:(Math.random()-0.5)*240,life:0.5+Math.random()*0.35,max:0.85});
    }
  }
  burst(x,y,intensity=1){for(let i=0;i<50*intensity;i++){const a=Math.random()*Math.PI*2,s=70+Math.random()*280;this.sparks.push({x,y,vx:Math.cos(a)*s,vy:Math.sin(a)*s,life:0.7+Math.random()*0.3,max:1});}}
  line(start,end,alpha,width,color,glow=0){const c=this.ctx;c.globalAlpha=alpha;c.lineWidth=width;c.strokeStyle=color;c.shadowColor=color;c.shadowBlur=glow;c.beginPath();c.moveTo(start.x,start.y);c.lineTo(end.x,end.y);c.stroke();c.shadowBlur=0;}
  render(dt,draft,batch,intensity=1){
    this.time+=dt;const c=this.ctx;c.clearRect(0,0,this.width,this.height);c.lineCap='round';c.globalCompositeOperation='lighter';
    this.flashes=this.flashes.filter(f=>{
      f.life-=dt*3.5;if(f.life<=0)return false;
      this.line(f.start,f.end,f.life*0.17,24*f.life, f.marked?'#dae5a0':'#c6efd1',18*intensity);
      this.line(f.start,f.end,f.life*0.65,3*f.life,'#faffeb',8*intensity);return true;
    });
    if(draft){
      const color=batch?'#e7e9a4':'#d9fbcf';
      this.line(draft.start,draft.end,0.16,17,color,20*intensity);this.line(draft.start,draft.end,0.95,1.6,'#faffed',7*intensity);
      for(const point of [draft.start,draft.end]){c.globalAlpha=0.9;c.fillStyle='#eefad7';c.beginPath();c.arc(point.x,point.y,2.5,0,Math.PI*2);c.fill();}
      const dx=draft.end.x-draft.start.x,dy=draft.end.y-draft.start.y,angle=Math.atan2(dy,dx);
      if(dx*dx+dy*dy>400){
        c.save();c.translate(draft.end.x,draft.end.y);c.rotate(angle);c.globalAlpha=0.9;
        const grad=c.createLinearGradient(-56,0,0,0);grad.addColorStop(0,'#d1e1d000');grad.addColorStop(1,'#fff');c.fillStyle=grad;
        c.beginPath();c.moveTo(-58,-8);c.lineTo(4,0);c.lineTo(-58,3);c.fill();c.restore();
      }
    }
    this.sparks=this.sparks.filter(p=>{p.life-=dt;if(p.life<=0)return false;p.x+=p.vx*dt;p.y+=p.vy*dt;p.vy+=130*dt;c.globalAlpha=p.life/p.max;c.strokeStyle='#e7efb3';c.lineWidth=1;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x-p.vx*0.016,p.y-p.vy*0.016);c.stroke();return true;});
    if(this.cursor&&!draft){c.globalAlpha=0.6;c.strokeStyle=batch?'#ddeb9c':'#e7efd5';c.lineWidth=1;const{x,y}=this.cursor;c.beginPath();c.moveTo(x-7,y);c.lineTo(x-3,y);c.moveTo(x+3,y);c.lineTo(x+7,y);c.moveTo(x,y-7);c.lineTo(x,y-3);c.moveTo(x,y+3);c.lineTo(x,y+7);c.stroke();}
    c.globalAlpha=1;c.globalCompositeOperation='source-over';
  }
  clean(){this.sparks=[];this.flashes=[];}
}
