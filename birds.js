let rafId = null;

export function animateBirds(onComplete){
  const flockContainer = document.getElementById('bird-flock'); if (!flockContainer) return;
  const flockSize = 4, journeyDuration = 56000, startTime = performance.now();
  const birds=[]; for(let i=0;i<flockSize;i++){ const el=document.createElement('div'); el.className='bird'; el.style.transform='translate(-100px,-100px)'; flockContainer.appendChild(el); el.style.animationDelay = `${Math.random()*-0.5}s`;
    birds.push({ el, offsetX:(i%2===0?1:-1)*Math.ceil(i/2)*(window.innerWidth*0.025), offsetY:Math.ceil(i/2)*(window.innerHeight*-0.015), wobbleX:Math.random()*20-10, wobbleY:Math.random()*15-7.5, wobbleSpeed:Math.random()*0.5+0.5 });
  }
  let doneCalled=false; function loop(now){
    if(now<startTime){ rafId=requestAnimationFrame(loop); return; }
    const elapsed = now - startTime; let progress = elapsed / journeyDuration;
    if(progress>=0.96 && !doneCalled){ doneCalled=true; if(typeof onComplete==='function') setTimeout(()=>onComplete(), 300); }
    if(progress>1.2){ flockContainer.innerHTML=''; cancelAnimationFrame(rafId); rafId = null; return; }
    progress = Math.min(progress,1); const eased=1-Math.pow(1-progress,3);
    const p0={x:innerWidth*0.3, y:innerHeight*0.5}, p1={x:innerWidth*0.4, y:innerHeight*0.15}, p2={x:innerWidth*0.9, y:innerHeight*-0.1};
    const leaderX = Math.pow(1-eased,2)*p0.x + 2*(1-eased)*eased*p1.x + Math.pow(eased,2)*p2.x;
    const leaderY = Math.pow(1-eased,2)*p0.y + 2*(1-eased)*eased*p1.y + Math.pow(1-eased,2)*p2.y;
    const scale = 1.0 - (eased * 0.7);
    birds.forEach((b,i)=>{ if(progress>0.01 && b.el.style.opacity!=='1') b.el.style.opacity='1';
      const wt=elapsed/1000*b.wobbleSpeed; const dx=Math.sin(wt+i)*b.wobbleX; const dy=Math.cos(wt+i)*b.wobbleY;
      b.el.style.transform = `translate(${leaderX+b.offsetX+dx}px, ${leaderY+b.offsetY+dy}px) scale(${scale})`;
    });
    rafId=requestAnimationFrame(loop);
  }
  rafId=requestAnimationFrame(loop);
}

export function stopBirds(freeze = false) {
    if (rafId) {
        if (freeze) {
            cancelAnimationFrame(rafId);
            rafId = null;
        }
    }
    const flockContainer = document.getElementById('bird-flock');
    if (flockContainer) {
        const birds = flockContainer.querySelectorAll('.bird');
        birds.forEach(bird => {
            bird.style.opacity = '0';
        });
        
        if (!freeze) { // If not freezing, let animation finish and remove container later
             setTimeout(() => {
                if(rafId) cancelAnimationFrame(rafId);
                rafId = null;
                if (flockContainer) flockContainer.innerHTML = '';
            }, 5000); // Give enough time for birds to fly off-screen during fade
        } else { // if freezing, remove immediately after CSS fade
            setTimeout(() => {
                if (flockContainer) flockContainer.innerHTML = '';
            }, 1200);
        }
    }
}