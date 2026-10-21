class Obstacle{
  constructor(x,y,r=24){ this.pos=createVector(x,y); this.r=r; }
  show(){ push(); fill(150,120,80); stroke(110,90,60); strokeWeight(2); circle(this.pos.x,this.pos.y,this.r*2); pop(); }
}
