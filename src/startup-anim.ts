/*
 * Copyright (c) 2026 Yunyun(云云) By 虚舟实验室(CaelLab) / CaelLabGameTS
 * Licensed under the CaelLab BY-SA Code License, Version 2.0
 * or any later version. https://www.caellab.com/license/bysa-code-v2.txt
 * Source: https://github.com/CaelLab-org/GoodPlanCraftLauncher
 */


// __IMPORTS_BEGIN__
import { BrowserWindow, app, ipcMain, shell } from 'electron';
import fs from 'fs';
import path from 'path';

import { writeLog } from './config';
// __IMPORTS_END__

export let activeAnimWindow: any = null;


export function cleanupAnimTempDir(dir: string): void {
  try {
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  } catch (e: any) {}
}


ipcMain.handle('play-startup-animation', async () => {
  if (activeAnimWindow && !activeAnimWindow.isDestroyed()) {
    try { activeAnimWindow.close(); } catch (e: any) {}
    activeAnimWindow = null;
  }

  writeLog('[启动动画] 开始播放启动动画');

  const iconDir: string = path.join(__dirname, 'static', 'icon');
  const tempAnimDir: string = path.join(app.getPath('temp'), 'gpcl-anim-' + Date.now());
  try { fs.mkdirSync(tempAnimDir, { recursive: true }); } catch (e: any) {}

  var imageNames: string[] = ['caellab.png', 'gamets.png', 'gamets.ico', 'GPCL.png'];
  for (var _i: number = 0; _i < imageNames.length; _i++) {
    var src: string = path.join(iconDir, imageNames[_i]);
    if (fs.existsSync(src)) {
      try { fs.copyFileSync(src, path.join(tempAnimDir, imageNames[_i])); } catch (e: any) {}
    }
  }

  var hasCaelab: boolean = fs.existsSync(path.join(tempAnimDir, 'caellab.png'));
  var hasGamets: boolean = fs.existsSync(path.join(tempAnimDir, 'gamets.png')) || fs.existsSync(path.join(tempAnimDir, 'gamets.ico'));
  var hasGpcl: boolean = fs.existsSync(path.join(tempAnimDir, 'GPCL.png'));
  var gametsFile: string = fs.existsSync(path.join(tempAnimDir, 'gamets.png')) ? 'gamets.png' : 'gamets.ico';

  writeLog('[启动动画] 资源: caellab=' + hasCaelab + ' gamets=' + hasGamets + ' gpcl=' + hasGpcl);

  var ANIM_DURATION: number = 30;

  var htmlContent: string = '<!DOCTYPE html>\n<html><head><meta charset="utf-8"><style>\n' +
'*{margin:0;padding:0;box-sizing:border-box}\n' +
'html,body{width:100%;height:100%;overflow:hidden;background:#0a0a0a}\n' +
'canvas{position:fixed;top:0;left:0;width:100%;height:100%;z-index:1}\n' +
'.scene{position:fixed;top:0;left:0;width:100%;height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;pointer-events:none;z-index:10;opacity:0}\n' +
'#welcome-txt{text-align:center;font-family:"Microsoft YaHei","Segoe UI",sans-serif}\n' +
'#welcome-txt h1{font-size:56px;font-weight:700;color:#fff;letter-spacing:3px;text-shadow:0 0 25px rgba(91,135,49,0.6),0 0 50px rgba(91,135,49,0.2);margin-bottom:16px}\n' +
'#welcome-txt p{font-size:20px;color:rgba(180,180,180,0.7);letter-spacing:5px}\n' +
'.logo-row{display:flex;flex-direction:row;align-items:center;justify-content:center}\n' +
'#logo-caellab img{max-height:130px;max-width:300px;object-fit:contain;filter:drop-shadow(0 0 18px rgba(91,135,49,0.35))}\n' +
'#logo-both .logo-row{gap:50px}\n' +
'#logo-both img{max-height:110px;max-width:240px;object-fit:contain}\n' +
'#logo-both .caellab-img{filter:drop-shadow(0 0 18px rgba(91,135,49,0.35))}\n' +
'#logo-both .gamets-img{filter:drop-shadow(0 0 14px rgba(255,255,255,0.25))}\n' +
'#logo-gpcl img{max-height:170px;max-width:340px;object-fit:contain;filter:drop-shadow(0 0 25px rgba(91,135,49,0.4))}\n' +
'.logo-text{text-align:center;font-family:"Microsoft YaHei","Segoe UI",sans-serif;margin-top:18px}\n' +
'.logo-text-bottom{position:absolute;bottom:40px;left:0;width:100%;margin-top:0}\n' +
'.logo-title{font-size:20px;color:rgba(200,200,200,0.85);letter-spacing:4px;margin-bottom:6px}\n' +
'.footer-link{font-size:14px;color:rgba(91,135,49,0.7);text-decoration:underline;pointer-events:auto;cursor:pointer}\n' +
'.copyright{font-size:13px;color:rgba(160,160,160,0.6);letter-spacing:1px;margin-bottom:6px}\n' +
'.license-text{font-size:12px;color:rgba(140,140,140,0.5);margin:0}\n' +
'.license-text .footer-link{font-size:12px}\n' +
'.disclaimer{font-size:12px;color:rgba(120,120,120,0.45);max-width:600px;line-height:1.6;margin:40px auto 0;text-align:center}\n' +
'#sweep-line{position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:25;opacity:0}\n' +
'#sweep-line .band{position:absolute;top:0;height:100%;width:100px;background:linear-gradient(90deg,transparent,rgba(91,135,49,0.1),rgba(127,255,0,0.12),rgba(91,135,49,0.1),transparent)}\n' +
'#fade{position:fixed;top:0;left:0;width:100%;height:100%;background:#0a0a0a;opacity:0;pointer-events:none;z-index:30;transition:opacity 1.5s ease-in}\n' +
'#fade.show{opacity:1}\n' +
'#flash{position:fixed;top:0;left:0;width:100%;height:100%;background:#fff;opacity:0;pointer-events:none;z-index:28}\n' +
'</style></head><body>\n' +
'<canvas id="c"></canvas>\n' +
'<div class="scene" id="welcome"><div id="welcome-txt"><h1>Minecraft\u6B22\u8FCE\u4F60\uFF01</h1><p>By GPCL And AllMinecraftPlayer</p></div></div>\n' +
'<div class="scene" id="logo-caellab"><div class="logo-row"><img src="caellab.png" alt="CaelLab"></div><div class="logo-text"><div class="logo-title">\u865A\u821F\u5B9E\u9A8C\u5BA4</div><a href="https://www.caellab.com" target="_blank" class="footer-link">caellab.com</a></div></div>\n' +
'<div class="scene" id="logo-both"><div class="logo-row"><img class="caellab-img" src="caellab.png" alt="CaelLab"><img class="gamets-img" src="' + gametsFile + '" alt="GameTS"></div><div class="logo-text logo-text-bottom"><div class="copyright">Copyright \u00A9 2026 Yunyun(\u4E91\u4E91) By \u865A\u821F\u5B9E\u9A8C\u5BA4(CaelLab) / CaelLabGameTS</div><p class="license-text">Licensed under <a href="https://www.caellab.com/license/bysa-code-v2.txt" target="_blank" class="footer-link">CaelLab BY-SA Code License v2.0</a>. Open Source on <a href="https://github.com/CaelLab-org/GoodPlanCraftLauncher" target="_blank" class="footer-link">GitHub</a>.</p></div></div>\n' +
'<div class="scene" id="logo-gpcl"><img src="GPCL.png" alt="GPCL"><div class="logo-text logo-text-bottom"><div class="disclaimer">GoodPlanCraftLauncher \u4E0E Mojang Studios \u53CA Microsoft\u3001Xbox \u65E0\u5B98\u65B9\u5173\u8054\u3002Minecraft \u4E3A Mojang Studios \u5546\u6807\u3002</div></div></div>\n' +
'<div id="sweep-line"><div class="band" id="sweep-band"></div></div>\n' +
'<div id="flash"></div><div id="fade"></div>\n' +
'<script>\n' +
'(function(){\n' +
'var canvas=document.getElementById("c"),ctx=canvas.getContext("2d");\n' +
'var W,H,dpr=window.devicePixelRatio||1;\n' +
'function resize(){W=window.innerWidth;H=window.innerHeight;canvas.width=W*dpr;canvas.height=H*dpr;ctx.setTransform(dpr,0,0,dpr,0,0)}\n' +
'resize();window.addEventListener("resize",resize);\n' +
'var startTime=performance.now();\n' +
'var DUR=' + ANIM_DURATION + ';\n' +
'function rand(a,b){return a+Math.random()*(b-a)}\n' +
'function easeOut(t){return 1-Math.pow(1-t,3)}\n' +
'function easeInOut(t){return t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2}\n' +
'function clamp(v,a,b){return v<a?a:v>b?b:v}\n' +
'function lerp(a,b,t){return a+(b-a)*t}\n' +
'var BS=24;\n' +
'var MC_COLORS=["#8B6B3D","#6B6B6B","#5B8731","#3E6B1F","#6B4226","#5A5A5A","#7B5B2D","#4A4A4A"];\n' +
'var terrCols=Math.ceil(W/BS)+1;\n' +
'var terrH=[];\n' +
'for(var i=0;i<terrCols;i++){terrH.push(2+~~rand(0,4))}\n' +
'var parts=[];\n' +
'for(var i=0;i<160;i++){\n' +
'  var a=rand(0,6.283),sp=rand(0.12,0.6);\n' +
'  parts.push({x:rand(0,W),y:rand(0,H),vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,\n' +
'    sz:rand(8,18),c:MC_COLORS[~~rand(0,MC_COLORS.length)],a:0,ta:rand(.08,.25),\n' +
'    rot:rand(0,6.28),rs:rand(-.012,.012)});\n' +
'}\n' +
'var star={active:false,x:0,y:0,sx:0,sy:0,tx:0,ty:0,t:0,dur:1.6,trail:[]};\n' +
'var sparkles=[];\n' +
'function addSparkle(x,y){for(var i=0;i<6;i++){var a=rand(0,6.28),sp=rand(0.5,2);\n' +
'  sparkles.push({x:x,y:y,vx:Math.cos(a)*sp,vy:Math.sin(a)*sp,a:1,sz:rand(3,6)})}}\n' +
'var shockwaves=[];\n' +
'function addShock(x,y,c,mr,d){shockwaves.push({x:x,y:y,r:0,mr:mr,c:c,a:.35,d:d,t:0})}\n' +
'var phaseShown={};\n' +
'function showScene(id,o,d){document.title="show:"+id+":"+o+":"+d}\n' +
'function hideScene(id,d){document.title="hide:"+id+":"+d}\n' +
'var waitingForDismiss=false;\n' +
'window.dismissAnimation=function(){\n' +
'  var f=document.getElementById("fade");f.style.transition="opacity 1.2s ease-in";f.classList.add("show");\n' +
'  setTimeout(function(){document.title="ended"},1300);\n' +
'};\n' +
'function drawBlock(x,y,sz,color,alpha){\n' +
'  ctx.save();ctx.globalAlpha=alpha;\n' +
'  ctx.fillStyle=color;ctx.fillRect(x,y,sz,sz);\n' +
'  ctx.fillStyle="rgba(255,255,255,0.09)";ctx.fillRect(x,y,sz,1);ctx.fillRect(x,y,1,sz);\n' +
'  ctx.fillStyle="rgba(0,0,0,0.18)";ctx.fillRect(x,y+sz-1,sz,1);ctx.fillRect(x+sz-1,y,1,sz);\n' +
'  ctx.restore();\n' +
'}\n' +
'function drawTerrain(t){\n' +
'  var a=clamp(t*.3,0,.2);\n' +
'  for(var c=0;c<terrCols;c++){\n' +
'    for(var r=0;r<terrH[c];r++){\n' +
'      var y=H-(r+1)*BS;var x=c*BS;\n' +
'      var col=r===0?"#3E6B1F":r===1?"#5B4B2D":"#3D3D3D";\n' +
'      drawBlock(x,y,BS,col,a);\n' +
'    }\n' +
'  }\n' +
'}\n' +
'function drawGrid(t){\n' +
'  var a=clamp(t*.3,0,.018);\n' +
'  ctx.save();ctx.strokeStyle="rgba(255,255,255,"+a+")";ctx.lineWidth=0.5;\n' +
'  for(var x=0;x<W;x+=BS){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,H);ctx.stroke()}\n' +
'  for(var y=0;y<H;y+=BS){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(W,y);ctx.stroke()}\n' +
'  ctx.restore();\n' +
'}\n' +
'function frame(now){\n' +
'  var t=(now-startTime)/1000;\n' +
'  ctx.clearRect(0,0,W,H);\n' +
'  ctx.fillStyle="rgba(10,10,10,"+clamp(t*.5,0,1)+")";ctx.fillRect(0,0,W,H);\n' +
'  drawGrid(t);\n' +
'  drawTerrain(t);\n' +
'  if(t>1&&t<8){\n' +
'    var gp=clamp((t-1)*.6,0,.3);var r=100+gp*120;\n' +
'    var g=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,r);\n' +
'    g.addColorStop(0,"rgba(91,135,49,"+(.06*gp)+")");g.addColorStop(1,"rgba(62,107,31,0)");\n' +
'    ctx.fillStyle=g;ctx.fillRect(0,0,W,H);\n' +
'  }\n' +
'  if(t>22&&t<28){\n' +
'    var gp2=clamp((t-22)*.5,0,.25);var r2=120+gp2*130;\n' +
'    var g2=ctx.createRadialGradient(W/2,H/2,0,W/2,H/2,r2);\n' +
'    g2.addColorStop(0,"rgba(91,135,49,"+(.06*gp2)+")");g2.addColorStop(1,"rgba(62,107,31,0)");\n' +
'    ctx.fillStyle=g2;ctx.fillRect(0,0,W,H);\n' +
'  }\n' +
'  for(var i=0;i<parts.length;i++){var p=parts[i];\n' +
'    p.a=clamp(p.a+.003,0,p.ta);p.x+=p.vx;p.y+=p.vy;p.rot+=p.rs;\n' +
'    p.vx*=.9995;p.vy*=.9995;\n' +
'    if(p.x<-30)p.x=W+30;if(p.x>W+30)p.x=-30;\n' +
'    if(p.y<-30)p.y=H+30;if(p.y>H+30)p.y=-30;\n' +
'    ctx.save();ctx.translate(p.x,p.y);ctx.rotate(p.rot);\n' +
'    drawBlock(-p.sz/2,-p.sz/2,p.sz,p.c,p.a);ctx.restore();\n' +
'  }\n' +
'  if(star.active){\n' +
'    var st=clamp((t-star.t)/star.dur,0,1);var e=easeInOut(st);\n' +
'    star.x=lerp(star.sx,star.tx,e);star.y=lerp(star.sy,star.ty,e);\n' +
'    star.trail.push({x:star.x,y:star.y,a:1});if(star.trail.length>35)star.trail.shift();\n' +
'    for(var j=0;j<star.trail.length;j++){var tr=star.trail[j];tr.a*=.93;\n' +
'      ctx.save();ctx.globalAlpha=tr.a*.5;ctx.fillStyle="#7FFF00";\n' +
'      ctx.fillRect(tr.x-2,tr.y-2,4,4);ctx.restore();}\n' +
'    ctx.save();ctx.fillStyle="#7FFF00";ctx.shadowColor="#7FFF00";ctx.shadowBlur=15;\n' +
'    ctx.fillRect(star.x-5,star.y-5,10,10);\n' +
'    ctx.shadowBlur=30;ctx.fillStyle="rgba(127,255,0,0.12)";\n' +
'    ctx.fillRect(star.x-14,star.y-14,28,28);ctx.restore();\n' +
'    if(Math.random()>.6)addSparkle(star.x+rand(-8,8),star.y+rand(-8,8));\n' +
'    if(st>=1)star.active=false;\n' +
'  }\n' +
'  for(var s=sparkles.length-1;s>=0;s--){var sp=sparkles[s];\n' +
'    sp.x+=sp.vx;sp.y+=sp.vy;sp.a*=.95;sp.vx*=.97;sp.vy*=.97;\n' +
'    if(sp.a<.01){sparkles.splice(s,1);continue}\n' +
'    ctx.save();ctx.globalAlpha=sp.a;ctx.fillStyle="#7FFF00";\n' +
'    ctx.fillRect(sp.x-sp.sz/2,sp.y-sp.sz/2,sp.sz,sp.sz);ctx.restore();\n' +
'  }\n' +
'  for(var s=shockwaves.length-1;s>=0;s--){var sw=shockwaves[s];\n' +
'    sw.t+=1/60;var pct=sw.t/sw.d;if(pct>=1){shockwaves.splice(s,1);continue}\n' +
'    sw.r=sw.mr*easeOut(pct);sw.a=.35*(1-pct);\n' +
'    ctx.save();ctx.strokeStyle=sw.c;ctx.globalAlpha=sw.a;ctx.lineWidth=2+2*(1-pct);\n' +
'    ctx.beginPath();ctx.arc(sw.x,sw.y,sw.r,0,6.28);ctx.stroke();ctx.restore();\n' +
'  }\n' +
'  if(t>1.5&&!phaseShown.w){phaseShown.w=true;showScene("welcome",1,1)}\n' +
'  if(t>7&&!phaseShown.hidew){phaseShown.hidew=true;hideScene("welcome",1)}\n' +
'  if(t>8.5&&!phaseShown.star){\n' +
'    phaseShown.star=true;\n' +
'    star.active=true;star.sx=-50;star.sy=H*.55;star.tx=W/2;star.ty=H/2;star.t=t;star.trail=[];\n' +
'  }\n' +
'  if(t>10.5&&!phaseShown.ca){phaseShown.ca=true;addShock(W/2,H/2,"rgba(91,135,49,0.3)",400,1.2);showScene("logo-caellab",1,1.2)}\n' +
'  if(t>14.5&&!phaseShown.hideca){phaseShown.hideca=true;hideScene("logo-caellab",.8)}\n' +
'  if(t>15.5&&!phaseShown.both){phaseShown.both=true;showScene("logo-both",1,1.2)}\n' +
'  if(t>20.5&&!phaseShown.hideboth){phaseShown.hideboth=true;hideScene("logo-both",1)}\n' +
'  if(t>22&&!phaseShown.gpcl){phaseShown.gpcl=true;addShock(W/2,H/2,"rgba(127,255,0,0.12)",350,1);showScene("logo-gpcl",1,1.5)}\n' +
'  if(t>26&&!phaseShown.sweep){\n' +
'    phaseShown.sweep=true;\n' +
'    var sl=document.getElementById("sweep-line");sl.style.opacity="1";\n' +
'    var band=document.getElementById("sweep-band");var swStart=performance.now();\n' +
'    function sweepFrame(swNow){var swT=(swNow-swStart)/1500;\n' +
'      if(swT>1){sl.style.opacity="0";return}\n' +
'      band.style.left=(-200+(W+400)*easeInOut(swT))+"px";\n' +
'      requestAnimationFrame(sweepFrame)}\n' +
'    requestAnimationFrame(sweepFrame);\n' +
'  }\n' +
'  if(t>27.5&&!phaseShown.launch){phaseShown.launch=true;document.title="launch"}\n' +
'  if(t>28&&!phaseShown.hgpcl){phaseShown.hgpcl=true;hideScene("logo-gpcl",1)}\n' +
'  if(t>29.5&&!phaseShown.fadeblk){phaseShown.fadeblk=true;document.getElementById("fade").classList.add("show")}\n' +
'  if(t>DUR&&!waitingForDismiss){waitingForDismiss=true;document.title="waiting"}\n' +
'  requestAnimationFrame(frame);\n' +
'}\n' +
'document.title="meta:"+DUR;\n' +
'requestAnimationFrame(frame);\n' +
'})();\n' +
'<\/script></body></html>';

  var tempHtmlPath: string = path.join(tempAnimDir, 'index.html');
  try { fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8'); } catch (e: any) {
    writeLog('[启动动画] 写入临时文件失败: ' + e.message);
    cleanupAnimTempDir(tempAnimDir);
    return { success: false, error: '写入临时文件失败', duration: 0 };
  }

  return new Promise<any>(function(resolve) {
    var animWindow = new BrowserWindow({
      fullscreen: true,
      frame: false,
      skipTaskbar: true,
      backgroundColor: '#000000',
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true
      }
    });

    activeAnimWindow = animWindow;

    animWindow.setAlwaysOnTop(true, 'screen-saver');
    animWindow.webContents.setWindowOpenHandler(function(details: any) {
      shell.openExternal(details.url);
      return { action: 'deny' } as any;
    });
    animWindow.loadFile(tempHtmlPath);

    var resolved: boolean = false;

    animWindow.on('page-title-updated', function(e: any, title: string) {
      e.preventDefault();

      if (title.startsWith('show:')) {
        var parts: string[] = title.split(':');
        var sceneId: string = parts[1];
        var opacity: string = parts[2];
        var dur: string = parts[3];
        animWindow.webContents.executeJavaScript(
          '(function(){var el=document.getElementById("' + sceneId + '");' +
          'if(el){el.style.transition="opacity ' + dur + 's ease-out";' +
          'el.style.opacity="' + opacity + '"}})()'
        );
        return;
      }

      if (title.startsWith('hide:')) {
        var parts: string[] = title.split(':');
        var sceneId: string = parts[1];
        var dur: string = parts[2];
        animWindow.webContents.executeJavaScript(
          '(function(){var el=document.getElementById("' + sceneId + '");' +
          'if(el){el.style.transition="opacity ' + dur + 's ease-in";' +
          'el.style.opacity="0"}})()'
        );
        return;
      }

      if (title === 'launch' && !resolved) {
        resolved = true;
        writeLog('[启动动画] 动画即将结束，提前启动MC');
        resolve({ success: true, duration: ANIM_DURATION });
        return;
      }

      if (title === 'waiting') {
        writeLog('[启动动画] 进入黑屏等待阶段');
        return;
      }

      if (title === 'ended') {
        writeLog('[启动动画] 动画退场完毕');
        try { animWindow.close(); } catch (e: any) {}
        return;
      }
    });

    animWindow.on('closed', function() {
      if (activeAnimWindow === animWindow) activeAnimWindow = null;
      cleanupAnimTempDir(tempAnimDir);
      if (!resolved) {
        resolved = true;
        resolve({ success: false, error: '动画窗口已关闭', duration: 0 });
      }
    });

    setTimeout(function() {
      if (!resolved) {
        resolved = true;
        writeLog('[启动动画] 动画加载超时');
        resolve({ success: false, error: '动画加载超时', duration: 0 });
        try { if (!animWindow.isDestroyed()) animWindow.close(); } catch (e: any) {}
      }
    }, 35000);
  });
});


ipcMain.handle('dismiss-startup-animation', function() {
  if (activeAnimWindow && !activeAnimWindow.isDestroyed()) {
    writeLog('[启动动画] MC窗口就绪，执行退场');
    try {
      activeAnimWindow.webContents.executeJavaScript(
        'if(typeof dismissAnimation==="function")dismissAnimation()'
      );
    } catch (e: any) {}
  }
});

