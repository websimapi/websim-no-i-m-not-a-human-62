function measureStep(panel){
  const track = panel.querySelector('.panel-track'); const a=track?.children[0], b=track?.children[1]; if (!a || !b) return 0;
  const r1=a.getBoundingClientRect(), r2=b.getBoundingClientRect(); return Math.max(0, r2.top - r1.top);
}

export function initSideCarousels(){
  document.querySelectorAll('.side-panel').forEach(panel => {
    if (panel.querySelector('.panel-track')) return;
    const boxes = Array.from(panel.querySelectorAll('.feature-box')); const track = document.createElement('div'); track.className='panel-track';
    boxes.forEach(b => track.appendChild(b)); panel.appendChild(track); panel.dataset.direction = panel.classList.contains('left-panel') ? 'down' : 'up';
  });
}

export function cyclePanel(panel){
  const track = panel.querySelector('.panel-track'); if(!track || track.children.length<2) return;
  const dir = panel.dataset.direction; const step = measureStep(panel); if (!step) return;
  if (dir === 'up') {
    track.style.transition='transform 2.2s ease-in-out'; track.style.transform=`translateY(${-step}px)`;
    const onEnd=()=>{ track.removeEventListener('transitionend', onEnd); track.appendChild(track.firstElementChild); track.style.transition='none'; track.style.transform='translateY(0)'; void track.offsetHeight; track.style.transition='transform 2.2s ease-in-out'; };
    track.addEventListener('transitionend', onEnd, { once:true });
  } else {
    track.style.transition='none'; track.insertBefore(track.lastElementChild, track.firstElementChild); track.style.transform=`translateY(${-step}px)`;
    requestAnimationFrame(()=>{ requestAnimationFrame(()=>{ track.style.transition='transform 2.2s ease-in-out'; track.style.transform='translateY(0)'; }); });
  }
}

export function startCarousels(){
  const panels = Array.from(document.querySelectorAll('.side-panel')); if (!panels.length) return;
  setTimeout(()=>{ panels.forEach(p => cyclePanel(p)); }, 600);
  setInterval(()=>{ panels.forEach(p => cyclePanel(p)); }, 3000);
}