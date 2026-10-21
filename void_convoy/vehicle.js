class Vehicle {
  constructor(x,y){
    this.pos=createVector(x,y);
    this.vel=createVector(random(-1,1),random(-1,1)).setMag(1.5);
    this.acc=createVector(0,0);
    this.r=8; this.maxSpeed=3; this.maxForce=0.6;
    this.rayonZoneDeFreinage=90;
    this.distanceCercle=70; this.wanderRadius=35; this.wanderTheta=random(TWO_PI); this.displaceRange=0.14;
    this.largeurZoneEvitementDevantVaisseau=this.r*1.2;
  }
  applyForce(f){ this.acc.add(f); }
  update(){ this.vel.add(this.acc); this.vel.limit(this.maxSpeed); this.pos.add(this.vel); this.acc.mult(0); if(this.vel.mag()>0.1) this.lastHeading=this.vel.heading(); }
  edges(){ if(this.pos.x>width+this.r)this.pos.x=-this.r; if(this.pos.x<-this.r)this.pos.x=width+this.r; if(this.pos.y>height+this.r)this.pos.y=-this.r; if(this.pos.y<-this.r)this.pos.y=height+this.r; }
  seek(target,arrival=false,d=0){
    let tp=(target&&target.pos)?target.pos:target; let v=this.maxSpeed;
    if(arrival){ let dista=p5.Vector.dist(this.pos,tp); if(dista<this.rayonZoneDeFreinage) v=map(dista,d,this.rayonZoneDeFreinage,0,this.maxSpeed); }
    let des=p5.Vector.sub(tp,this.pos); if(des.magSq()===0)return createVector(0,0); des.setMag(v); let f=p5.Vector.sub(des,this.vel); f.limit(this.maxForce); return f;
  }
  arrive(t,d=0){ return this.seek(t,true,d); }
  flee(t){ let tp=(t&&t.pos)?t.pos:t; let des=p5.Vector.sub(this.pos,tp); if(des.magSq()===0)return createVector(0,0); des.setMag(this.maxSpeed); let f=p5.Vector.sub(des,this.vel); f.limit(this.maxForce); return f; }
  pursue(v){ if(!v)return createVector(0,0); let t=v.pos.copy(); let pr=v.vel.copy().mult(9); t.add(pr); return this.seek(t); }
  evade(v){ let f=this.pursue(v); f.mult(-1); return f; }
  separate(list){
    let st=createVector(); let total=0; let per=this.r*4;
    for(let o of list){ if(o===this)continue; let d=dist(this.pos.x,this.pos.y,o.pos.x,o.pos.y); if(d>0&&d<per){ let diff=p5.Vector.sub(this.pos,o.pos); diff.div(d*d); st.add(diff); total++; } }
    if(total>0){ st.div(total); st.setMag(this.maxSpeed); st.sub(this.vel); st.limit(this.maxForce); } return st;
  }
  wander(){
    let c=this.vel.copy().setMag(this.distanceCercle).add(this.pos);
    let wa=this.vel.heading()+this.wanderTheta;
    let p=createVector(this.wanderRadius*cos(wa),this.wanderRadius*sin(wa)).add(c);
    let des=p5.Vector.sub(p,this.pos); let f=p5.Vector.sub(des,this.vel); f.limit(this.maxForce);
    this.wanderTheta+=random(-this.displaceRange,this.displaceRange); return f;
  }
  boundaries(bx,by,bw,bh,d){
    let vd=null; let x1=bx+d,x2=bx+bw-d,y1=by+d,y2=by+bh-d;
    if(this.pos.x<x1) vd=createVector(this.maxSpeed,this.vel.y);
    else if(this.pos.x>x2) vd=createVector(-this.maxSpeed,this.vel.y);
    if(this.pos.y<y1) vd=createVector(this.vel.x,this.maxSpeed);
    else if(this.pos.y>y2) vd=createVector(this.vel.x,-this.maxSpeed);
    if(vd){ vd.setMag(this.maxSpeed); let f=p5.Vector.sub(vd,this.vel); f.limit(this.maxForce); return f; }
    return createVector(0,0);
  }
  avoidObstacles(obs){
    if(!obs||!obs.length)return createVector(0,0);
    // direction de regard : vitesse courante, sinon dernier cap connu
    let speed=this.vel.mag();
    let dir;
    if(speed>0.05) dir=this.vel.copy().normalize();
    else if(this.lastHeading) dir=createVector(cos(this.lastHeading),sin(this.lastHeading));
    else dir=createVector(1,0);
    // portée du regard proportionnelle à la vitesse (bornée)
    let look=this.r+max(20,this.maxSpeed*12);
    let ahead=dir.copy().mult(look), ahead2=ahead.copy().mult(0.5);
    let p0=this.pos, p1=p5.Vector.add(this.pos,ahead), p2=p5.Vector.add(this.pos,ahead2);
    let best=null,bd=1e12,bestPoint=null;
    for(let o of obs){
      let d0=p0.dist(o.pos),d1=p1.dist(o.pos),d2=p2.dist(o.pos);
      let d=min(d0,min(d1,d2));
      if(d<bd){bd=d;best=o;bestPoint=(d===d0)?p0:((d===d1)?p1:p2);}
    }
    if(!best)return createVector(0,0);
    if(bd < best.r+this.r+this.largeurZoneEvitementDevantVaisseau){
      let force=p5.Vector.sub(bestPoint,best.pos);
      if(force.magSq()<1e-6){ force=p5.Vector.sub(this.pos,best.pos); }
      if(force.magSq()<1e-6){ force=createVector(1,0); } // superposé : poussée arbitraire non nulle
      force.setMag(this.maxSpeed); force.sub(this.vel); force.limit(this.maxForce*2); return force;
    }
    return createVector(0,0);
  }
  show(){
    push(); translate(this.pos.x,this.pos.y); rotate(this.vel.heading()+PI/2);
    fill(220,220,220); stroke(140,140,140);
    beginShape(); vertex(0,-this.r*1.8); vertex(-this.r,this.r*1.4); vertex(this.r,this.r*1.4); endShape(CLOSE); pop();
  }
}
