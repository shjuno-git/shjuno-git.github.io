"use strict";
// 鬼（敵）のデータ・描画・動き。角の先端が弱点（当たり判定は先端の円）。
const TAU = Math.PI * 2;
const OLS = 1;
const HORN_HR = 0.25;  // 角の当たり判定半径（×鬼の半径）。豆の半径は半分だけ足す（角先に触れたときだけクリティカル）
function ol(c, w){ c.lineWidth = w / OLS; c.strokeStyle = '#111'; c.lineJoin = 'round'; c.lineCap = 'round'; }
function rr(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x+r, y); c.arcTo(x+w, y, x+w, y+h, r); c.arcTo(x+w, y+h, x, y+h, r); c.arcTo(x, y+h, x, y, r); c.arcTo(x, y, x+w, y, r); c.closePath(); }
function hornTip(d, h){ return { x: h.x*d.r + Math.sin(h.ang)*h.len*d.r, y: h.y*d.r - Math.cos(h.ang)*h.len*d.r }; }
function pulseK(t, mode){ return mode === 'pulse' ? .5 + .5*Math.sin(t*9) : 0; }

function drawHorn(c,d,h,t,flash,pk){pk=pk||0;
  const r=d.r,bx=h.x*r,by=h.y*r,s=Math.sin(h.ang),co=Math.cos(h.ang);
  const dx=s,dy=-co,px=co,py=s,w=h.hw*r*1.6,L=h.len*r;
  const tx=bx+dx*L,ty=by+dy*L,bend=r*(h.curve===undefined?.1:h.curve);
  c.save();
  const g=c.createLinearGradient(bx,by,tx,ty);g.addColorStop(0,'#fff6d6');g.addColorStop(.5,'#fff6d6');g.addColorStop(.52,`rgb(255,${210+45*pk|0},${63+192*pk|0})`);g.addColorStop(1,`rgb(255,${154+80*pk|0},${31+120*pk|0})`);
  c.beginPath();c.moveTo(bx-px*w/2,by-py*w/2);
  if(h.zig){ // 雷型
    c.lineTo(bx+dx*L*.4-px*w*.55,by+dy*L*.4-py*w*.55);c.lineTo(bx+dx*L*.5+px*w*.1,by+dy*L*.5+py*w*.1);c.lineTo(tx,ty);
    c.lineTo(bx+dx*L*.6+px*w*.5,by+dy*L*.6+py*w*.5);c.lineTo(bx+dx*L*.4+px*w*.5,by+dy*L*.4+py*w*.5);c.lineTo(bx+px*w/2,by+py*w/2);
  }else{
    c.quadraticCurveTo(bx+dx*L*.5-px*(w*.3)+px*bend,by+dy*L*.5-py*(w*.3)+py*bend,tx,ty);
    c.quadraticCurveTo(bx+dx*L*.5+px*(w*.3)+px*bend,by+dy*L*.5+py*(w*.3)+py*bend,bx+px*w/2,by+py*w/2);
  }
  c.closePath();c.fillStyle=flash?'#fff':g;c.fill();ol(c,3);c.stroke();
  // 付け根のしわ
  c.lineWidth=(1/OLS)*1.8;[.18,.34].forEach(k=>{c.beginPath();c.moveTo(bx+dx*L*k-px*w*.3*(1-k),by+dy*L*k-py*w*.3*(1-k));c.lineTo(bx+dx*L*k+px*w*.3*(1-k),by+dy*L*k+py*w*.3*(1-k));c.stroke();});
  c.restore();
}
function sparkle(c,x,y,r,rot){c.beginPath();for(let i=0;i<8;i++){const a=rot+i*Math.PI/4,rr1=i%2?r*.35:r;i?c.lineTo(x+Math.cos(a)*rr1,y+Math.sin(a)*rr1):c.moveTo(x+Math.cos(a)*rr1,y+Math.sin(a)*rr1);}c.closePath();}

function eyes(c,dx,dy,r1,look,angry){[-1,1].forEach(s=>{c.fillStyle='#fff';c.beginPath();c.ellipse(s*dx,dy,r1,r1*1.2,0,0,TAU);c.fill();ol(c,2.5);c.stroke();c.fillStyle='#111';c.beginPath();c.arc(s*dx+look,dy+1,r1*.5,0,TAU);c.fill();
  if(angry){ol(c,3.2);c.beginPath();c.moveTo(s*(dx+r1*1.2),dy-r1*1.9);c.lineTo(s*(dx-r1*.9),dy-r1*.7);c.stroke();}});}
function fangs(c,x,y,w,n,dir){c.fillStyle='#fff';for(let i=0;i<n;i++){const fx=x-w/2+(i+.5)*w/n;c.beginPath();c.moveTo(fx-w/n*.4,y);c.lineTo(fx+w/n*.4,y);c.lineTo(fx,y+dir*w/n*.9);c.closePath();c.fill();ol(c,1.8);c.stroke();}}

const ONI_DATA={
 chibi:{name:'チビ鬼',col:'#ff7a45',r:12,hp:4,role:'雑魚・超小型。大きな頭と虎柄パンツ',mv:'dart',spd:1.15,mvText:'ちょこまか素早く直進。壁で鋭く跳ね返る',horns:[{x:.12,y:-.95,ang:.32,len:.8,hw:.5}]},
 hito:{name:'一つ目小僧',col:'#b7e36a',r:13,hp:4,role:'雑魚・巨大な一つ目',mv:'float',spd:.3,mvText:'ふわふわ漂う。ゆっくり上下にゆれる',horns:[{x:0,y:-.98,ang:-.2,len:.85,hw:.5}]},
 tora:{name:'虎パン鬼',col:'#ff5a2a',r:17,hp:25,role:'中堅・ずんぐり体型（手足あり）',mv:'stomp',spd:.4,mvText:'ドスドス歩く。一歩ごとに体が弾む',atk:{every:9,speed:1.8},horns:[{x:-.6,y:-.72,ang:-.62,len:.62,hw:.5},{x:.6,y:-.72,ang:.62,len:.62,hw:.5}]},
 hyoro:{name:'ヒョロ鬼',col:'#3fc8c0',r:15,hp:21,role:'中堅・細長い体と超長い角',mv:'wiggle',spd:1.0,mvText:'素早くクネクネ蛇行しながら進む',atk:{every:8,speed:1.8},horns:[{x:0,y:-1.05,ang:.12,len:1.55,hw:.24,curve:.25}]},
 taiko:{name:'太鼓鬼（雷）',col:'#ffd23a',r:18,hp:32,role:'中堅・横に広い頭、頬から生えた角、背中に太鼓',mv:'step',spd:.95,mvText:'遅い。カクッ、カクッと直角に少しずつ動いて止まる',atk:{every:9,speed:1.8},horns:[{x:-1.0,y:.05,ang:-1.3,len:.75,hw:.42,zig:1},{x:1.0,y:.05,ang:1.3,len:.75,hw:.42,zig:1}]},
 hannya:{name:'般若',col:'#f4ede0',r:17,hp:32,role:'中堅・青白い顔と長い髪・反った長角',mv:'liss',spd:.5,mvText:'スーッと滑らかに8の字を描いて漂う',atk:{every:8,speed:1.8},horns:[{x:-.45,y:-.85,ang:-.5,len:1.35,hw:.3,curve:.45},{x:.45,y:-.85,ang:.5,len:1.35,hw:.3,curve:-.45}]},
 kan:{name:'角冠鬼',col:'#6a63e0',r:19,hp:63,role:'中堅(HP63)・王冠のように並ぶ4本角とマント',mv:'march',spd:.26,mvText:'堂々とゆっくり直進。ときどき立ち止まる',atk:{every:8,speed:1.8},horns:[{x:-.78,y:-.58,ang:-.75,len:.75,hw:.34},{x:-.28,y:-.92,ang:-.2,len:.82,hw:.34},{x:.28,y:-.92,ang:.2,len:.82,hw:.34},{x:.78,y:-.58,ang:.75,len:.75,hw:.34}]},
 boss:{name:'大鬼王（鎧と金棒）',col:'#c0202c',r:30,hp:126,role:'ボス(HP126)・たてがみ、肩当て、金棒、3本角',mv:'charge',spd:.3,mvText:'のっしのっし歩き、ときどき突進',atk:{every:6,speed:2.2},horns:[{x:-.62,y:-.8,ang:-.5,len:1.0,hw:.32},{x:.62,y:-.8,ang:.5,len:1.0,hw:.32},{x:0,y:-1,ang:0,len:.6,hw:.34}]}
};
function ell(c,x,y,rx,ry,fill,w){c.fillStyle=fill;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();ol(c,w||3);c.stroke();}
function tigerPants(c,x,y,rx,ry,r){c.save();c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.clip();c.fillStyle='#ffe45a';c.fillRect(x-rx,y-ry*.1,rx*2,ry*1.2);c.fillStyle='#111';for(let i=-3;i<=3;i++){c.beginPath();c.moveTo(x+i*rx*.3,y-ry*.1);c.lineTo(x+i*rx*.3+rx*.14,y-ry*.1);c.lineTo(x+i*rx*.3+rx*.04,y+ry*.45);c.closePath();c.fill();}c.restore();c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);ol(c,3);c.stroke();}
function mouthB(c,x,y,w,h,fn){ol(c,3);c.fillStyle='#4a0f0f';c.beginPath();c.moveTo(x-w/2,y);c.quadraticCurveTo(x,y+h*1.6,x+w/2,y);c.quadraticCurveTo(x,y+h*.3,x-w/2,y);c.fill();c.stroke();fangs(c,x,y,w*.9,fn||3,1);}
function drawOni(c,key,x,y,t,o){
  o=o||{};const d=ONI_DATA[key],r=d.r,md='pulse';
  c.save();c.translate(x,y+(o.still?0:Math.sin(t*6+x*.1)*1.6));if(o.shake)c.translate((Math.random()-.5)*o.shake,(Math.random()-.5)*o.shake);
  const hornsDraw=()=>{
    d.horns.forEach(h=>drawHorn(c,d,h,t,o.flashHorn===h,pulseK(t,md)));
    // 角ダメージ強化の段階に応じて、先端が赤く燃える
    if(o.critLv){ d.horns.forEach(h=>{ const tp=hornTip(d,h), lv=o.critLv, pu=1+Math.sin(t*10+h.x)*.15;
      c.save(); c.globalAlpha=.55; c.fillStyle='#ff3b2a'; c.beginPath(); c.arc(tp.x,tp.y,r*(.3+.07*lv)*pu,0,TAU); c.fill();
      c.globalAlpha=.9; c.fillStyle='#ffd23f'; c.beginPath(); c.arc(tp.x,tp.y,r*(.14+.03*lv)*pu,0,TAU); c.fill();
      c.restore(); }); }
  };
  const hi=(rx,ry)=>{c.fillStyle='rgba(255,255,255,.3)';c.beginPath();c.ellipse(-rx*.4,-ry*.45,rx*.26,ry*.15,-.6,0,TAU);c.fill();};
  if(key==='chibi'){
    ell(c,-r*.45,r*1.15,r*.28,r*.2,d.col,2.5);ell(c,r*.45,r*1.15,r*.28,r*.2,d.col,2.5);
    tigerPants(c,0,r*.95,r*.78,r*.52,r);hornsDraw();
    ell(c,0,0,r,r,d.col,3.5);hi(r,r);
    eyes(c,r*.4,-r*.05,r*.36,Math.sin(t*3),false);ol(c,2.5);c.fillStyle='#4a0f0f';c.beginPath();c.arc(0,r*.5,r*.16,0,TAU);c.fill();c.stroke();
  }else if(key==='hito'){
    ell(c,-r*.4,r*1.08,r*.26,r*.18,d.col,2.5);ell(c,r*.4,r*1.08,r*.26,r*.18,d.col,2.5);
    hornsDraw();ell(c,0,0,r,r,d.col,3.5);hi(r,r);
    c.fillStyle='#fff';c.beginPath();c.ellipse(0,-r*.05,r*.68,r*.58,0,0,TAU);c.fill();ol(c,3);c.stroke();
    const lx=Math.sin(t*2)*r*.15;c.fillStyle='#ff9a1f';c.beginPath();c.arc(lx,-r*.05,r*.34,0,TAU);c.fill();c.stroke();c.fillStyle='#111';c.beginPath();c.arc(lx,-r*.05,r*.17,0,TAU);c.fill();c.fillStyle='#fff';c.beginPath();c.arc(lx-r*.08,-r*.14,r*.07,0,TAU);c.fill();
    ol(c,2.5);c.fillStyle='#ff7aa0';c.beginPath();c.ellipse(r*.1,r*.62,r*.2,r*.24,0,0,TAU);c.fill();c.stroke();
  }else if(key==='tora'){
    // 手（こぶし）
    const fx=Math.sin(t*5)*1.5;ell(c,-r*1.25,r*.55+fx,r*.4,r*.4,d.col,3);ell(c,r*1.25,r*.55-fx,r*.4,r*.4,d.col,3);
    ell(c,0,r*1.0,r*1.1,r*.8,d.col,3.5);tigerPants(c,0,r*1.15,r*.95,r*.62,r);
    hornsDraw();ell(c,0,0,r,r,d.col,3.5);hi(r,r);
    c.fillStyle='#222';for(let i=0;i<5;i++){c.beginPath();c.arc((i-2)*r*.2,-r*.85+Math.abs(i-2)*r*.05,r*.13,0,TAU);c.fill();}
    eyes(c,r*.38,-r*.05,r*.24,1,true);mouthB(c,0,r*.34,r*.7,r*.28,3);
  }else if(key==='hyoro'){
    const sw=Math.sin(t*4)*2;
    // 細い胴と手足
    ol(c,3);c.strokeStyle='#111';c.lineWidth=(1/OLS)*9;c.beginPath();c.moveTo(0,r*.9);c.lineTo(0,r*2.0);c.stroke();c.strokeStyle=d.col;c.lineWidth=(1/OLS)*5.5;c.beginPath();c.moveTo(0,r*.9);c.lineTo(0,r*2.0);c.stroke();
    [[-1],[1]].forEach(([sg])=>{c.strokeStyle='#111';c.lineWidth=(1/OLS)*8;c.beginPath();c.moveTo(0,r*1.15);c.lineTo(sg*r*1.1,r*1.6+sw*sg);c.stroke();c.strokeStyle=d.col;c.lineWidth=(1/OLS)*4.5;c.beginPath();c.moveTo(0,r*1.15);c.lineTo(sg*r*1.1,r*1.6+sw*sg);c.stroke();});
    hornsDraw();ell(c,0,0,r*.78,r*1.08,d.col,3.5);hi(r*.78,r*1.08);
    ol(c,2.8);[-1,1].forEach(sg=>{c.beginPath();c.moveTo(sg*r*.5,-r*.2);c.lineTo(sg*r*.14,-r*.2);c.stroke();c.fillStyle='#111';c.beginPath();c.arc(sg*r*.32,-r*.2,r*.07,0,TAU);c.fill();});
    ol(c,2.5);c.beginPath();c.moveTo(-r*.35,r*.4);c.quadraticCurveTo(0,r*.3,r*.35,r*.4);c.stroke();c.beginPath();c.moveTo(-r*.3,r*.15);c.quadraticCurveTo(-r*.7,r*.15,-r*.75,r*.35);c.moveTo(r*.3,r*.15);c.quadraticCurveTo(r*.7,r*.15,r*.75,r*.35);c.stroke();
  }else if(key==='taiko'){
    // 太鼓の輪
    ol(c,3);c.beginPath();c.arc(0,-r*.1,r*1.35,Math.PI*1.17,Math.PI*1.83);c.stroke();
    for(let i=0;i<5;i++){const a=Math.PI*(1.2+i*.15),dx=Math.cos(a)*r*1.35,dy=-r*.1+Math.sin(a)*r*1.35;ell(c,dx,dy,r*.36,r*.36,'#ff3b3b',3);c.fillStyle='#fff';c.beginPath();c.arc(dx,dy,r*.15,0,TAU);c.fill();}
    ell(c,0,r*1.0,r*1.0,r*.7,d.col,3.5);ell(c,0,r*1.0,r*.5,r*.4,'#ff3b3b',3);c.fillStyle='#fff';c.beginPath();c.arc(0,r*1.0,r*.15,0,TAU);c.fill();
    hornsDraw();ell(c,0,0,r*1.15,r*.95,d.col,3.5);hi(r*1.15,r*.95);
    eyes(c,r*.5,-r*.1,r*.23,Math.sin(t*9)*1.5,false);mouthB(c,0,r*.3,r*.9,r*.3,4);ol(c,2);c.fillStyle='rgba(255,90,90,.6)';[-1,1].forEach(sg=>{c.beginPath();c.ellipse(sg*r*.7,r*.42,r*.16,r*.1,0,0,TAU);c.fill();});
  }else if(key==='hannya'){
    // 長い髪
    ol(c,3);c.fillStyle='#16101c';[-1,1].forEach(sg=>{c.beginPath();c.moveTo(sg*r*.5,-r*.9);c.quadraticCurveTo(sg*r*1.6,-r*.2,sg*r*1.3,r*1.8+Math.sin(t*3+sg)*2);c.quadraticCurveTo(sg*r*.95,r*.8,sg*r*.7,r*.4);c.closePath();c.fill();c.stroke();});
    hornsDraw();ell(c,0,0,r*.9,r*1.0,d.col,3.5);hi(r*.9,r);
    c.fillStyle='#16101c';c.beginPath();c.moveTo(-r*.9,-r*.35);c.quadraticCurveTo(0,-r*1.3,r*.9,-r*.35);c.quadraticCurveTo(0,-r*.7,-r*.9,-r*.35);c.fill();ol(c,2.5);c.stroke();
    [-1,1].forEach(sg=>{c.fillStyle='#ffd23f';c.beginPath();c.ellipse(sg*r*.38,-r*.12,r*.26,r*.15,sg*.4,0,TAU);c.fill();ol(c,2.5);c.stroke();c.fillStyle='#111';c.fillRect(sg*r*.38-1,-r*.2,2,r*.16);});
    ol(c,2);c.beginPath();c.moveTo(-r*.3,-r*.4);c.lineTo(r*.3,-r*.4);c.moveTo(-r*.2,-r*.5);c.lineTo(r*.2,-r*.5);c.stroke();
    ol(c,2.5);c.fillStyle='#d8143c';c.beginPath();c.moveTo(-r*.4,r*.45);c.quadraticCurveTo(0,r*.3,r*.4,r*.45);c.quadraticCurveTo(0,r*.85,-r*.4,r*.45);c.fill();c.stroke();fangs(c,0,r*.47,r*.5,2,1);
  }else if(key==='kan'){
    // マント
    ol(c,3);c.fillStyle='#b3202a';c.beginPath();c.moveTo(-r*.7,r*.5);c.lineTo(-r*1.5,r*1.9);c.quadraticCurveTo(0,r*2.2,r*1.5,r*1.9);c.lineTo(r*.7,r*.5);c.closePath();c.fill();c.stroke();
    ell(c,0,r*1.05,r*.8,r*.55,d.col,3.5);
    hornsDraw();ell(c,0,0,r,r,d.col,3.5);hi(r,r);
    // 王冠バンド
    c.save();c.beginPath();c.arc(0,0,r-1.5,0,TAU);c.clip();c.fillStyle='#ffd23f';c.fillRect(-r,-r*.58,r*2,r*.26);c.restore();ol(c,2.5);c.beginPath();c.moveTo(-r*.95,-r*.58);c.lineTo(r*.95,-r*.58);c.moveTo(-r*.97,-r*.32);c.lineTo(r*.97,-r*.32);c.stroke();c.fillStyle='#ff3b3b';c.beginPath();c.arc(0,-r*.45,r*.1,0,TAU);c.fill();
    eyes(c,r*.36,-r*.02,r*.22,1,true);ol(c,3);c.beginPath();c.moveTo(-r*.5,r*.32);c.quadraticCurveTo(-r*.25,r*.18,0,r*.3);c.quadraticCurveTo(r*.25,r*.18,r*.5,r*.32);c.stroke();mouthB(c,0,r*.42,r*.45,r*.18,2);
  }else{ // boss
    // たてがみ
    ol(c,3);c.fillStyle='#16101c';for(let i=0;i<13;i++){const a=Math.PI*1.0+i*Math.PI/12*1.0;const sa=a-Math.PI*.5+Math.PI*.5;c.beginPath();const bx=Math.cos(a)*r*.9,by=Math.sin(a)*r*.9;c.moveTo(bx-Math.sin(a)*5,by+Math.cos(a)*5);c.lineTo(Math.cos(a)*r*1.38,Math.sin(a)*r*1.38);c.lineTo(bx+Math.sin(a)*5,by-Math.cos(a)*5);c.closePath();c.fill();c.stroke();}
    // 金棒
    c.save();c.translate(-r*1.35,r*.3);c.rotate(-.3+Math.sin(t*2)*.04);ol(c,3);c.fillStyle='#4a3b2a';rr(c,-5,-r*1.0,10,r*2.0,3);c.fill();c.stroke();c.fillStyle='#6a6a78';rr(c,-11,-r*1.3,22,r*1.05,9);c.fill();c.stroke();c.fillStyle='#d6d6e2';for(let i=0;i<9;i++){c.beginPath();c.arc((Math.floor(i/3)-1)*8,-r*1.25+(i%3)*r*.28+7,3,0,TAU);c.fill();}c.restore();
    // 胴体＋肩当て
    ell(c,0,r*1.0,r*1.0,r*.7,'#3a3a4a',3.5);
    [-1,1].forEach(sg=>{ell(c,sg*r*1.0,r*.72,r*.42,r*.42,'#7a7a8c',3);c.fillStyle='#d6d6e2';for(let k=0;k<3;k++){const a=-Math.PI/2+sg*(k-1)*.7;c.beginPath();c.moveTo(sg*r*1.0+Math.cos(a-.2)*r*.36,r*.72+Math.sin(a-.2)*r*.36);c.lineTo(sg*r*1.0+Math.cos(a)*r*.66,r*.72+Math.sin(a)*r*.66);c.lineTo(sg*r*1.0+Math.cos(a+.2)*r*.36,r*.72+Math.sin(a+.2)*r*.36);c.closePath();c.fill();ol(c,2);c.stroke();}});
    hornsDraw();ell(c,0,0,r,r,d.col,4);hi(r,r);
    ell(c,0,r*.42,r*.72,r*.4,'#9a1822',3);
    eyes(c,r*.36,-r*.1,r*.19,Math.sin(t*2)*2,true);ol(c,2.5);c.beginPath();c.moveTo(-r*.55,-r*.3);c.lineTo(-r*.3,r*.05);c.stroke();
    mouthB(c,0,r*.34,r*.95,r*.3,4);c.fillStyle='#fff';[-1,1].forEach(sg=>{c.beginPath();c.moveTo(sg*r*.5,r*.62);c.lineTo(sg*r*.36,r*.28);c.lineTo(sg*r*.6,r*.34);c.closePath();c.fill();ol(c,2);c.stroke();});
  }
  
  c.restore();
}

// ---------- 動き（dt は秒。速度は60fps基準のpx/フレームに dt*60 を掛ける） ----------
const ENEMY_BD = { x0: 55, x1: 305, y0: 55, y1: 274 };
function mvInit(e, d, bd){
  e.ph = Math.random()*6; e.tm = Math.random()*1.5; e.ox = 0; e.oy = 0;
  const a = Math.random()*TAU; e.vx = Math.cos(a)*d.spd; e.vy = Math.sin(a)*d.spd;
  e.st = 'go'; e.sx = 0; e.sy = 0;
  e.hx = Math.max(bd.x0+62, Math.min(bd.x1-62, e.x)); e.hy = Math.max(bd.y0+40, Math.min(bd.y1-40, e.y));
}
function mvStep(e, d, bd, dt){
  const f = dt*60;
  e.tm += dt; e.ph += dt;
  const bounce = () => {
    if(e.x < bd.x0){ e.x = bd.x0; e.vx = Math.abs(e.vx); }
    if(e.x > bd.x1){ e.x = bd.x1; e.vx = -Math.abs(e.vx); }
    if(e.y < bd.y0){ e.y = bd.y0; e.vy = Math.abs(e.vy); }
    if(e.y > bd.y1){ e.y = bd.y1; e.vy = -Math.abs(e.vy); }
  };
  switch(d.mv){
    case 'dart': e.x += e.vx*f; e.y += e.vy*f; bounce(); break;
    case 'float': e.x += e.vx*f; e.y += e.vy*f; bounce(); e.oy = Math.sin(e.ph*2.2)*9; e.ox = Math.sin(e.ph*1.3)*4; break;
    case 'stomp': e.x += e.vx*f; e.y += e.vy*f; bounce(); e.oy = -Math.abs(Math.sin(e.ph*4.5))*5; break;
    case 'wiggle': {
      const sp = Math.hypot(e.vx, e.vy) || 1, nx = -e.vy/sp, ny = e.vx/sp, w = Math.cos(e.ph*5)*2.4;
      e.x += (e.vx + nx*w)*f; e.y += (e.vy + ny*w)*f; bounce(); break;
    }
    case 'step':
      if(e.st === 'go'){
        e.x += e.sx*f; e.y += e.sy*f;
        if(e.x < bd.x0 || e.x > bd.x1){ e.x = Math.max(bd.x0, Math.min(bd.x1, e.x)); e.sx *= -1; }
        if(e.y < bd.y0 || e.y > bd.y1){ e.y = Math.max(bd.y0, Math.min(bd.y1, e.y)); e.sy *= -1; }
        if(e.tm > .3){ e.st = 'wait'; e.tm = 0; }
      } else if(e.tm > .6){
        const D = [[1,0],[-1,0],[0,1],[0,-1]][(Math.random()*4)|0];
        e.sx = D[0]*1.6; e.sy = D[1]*1.6; e.st = 'go'; e.tm = 0;
      }
      break;
    case 'liss': e.x = e.hx + Math.sin(e.ph*d.spd*1.3)*60; e.y = e.hy + Math.sin(e.ph*d.spd*2.6)*38; break;
    case 'march':
      if(e.st === 'go'){ e.x += e.vx*f; e.y += e.vy*f; bounce(); if(e.tm > 3.5){ e.st = 'wait'; e.tm = 0; } }
      else if(e.tm > 1.2){ e.st = 'go'; e.tm = 0; }
      break;
    case 'charge':
      e.x += e.vx*f; e.y += e.vy*f; bounce();
      if(e.st === 'dash'){
        if(e.tm > .5){ const sp = Math.hypot(e.vx, e.vy) || 1; e.vx = e.vx/sp*d.spd; e.vy = e.vy/sp*d.spd; e.st = 'go'; e.tm = 0; }
      } else if(e.tm > 3.2){
        const a = Math.random()*TAU; e.vx = Math.cos(a)*1.8; e.vy = Math.sin(a)*1.8; e.st = 'dash'; e.tm = 0;
      }
      break;
  }
  e.px = e.x + e.ox; e.py = e.y + e.oy;
}
