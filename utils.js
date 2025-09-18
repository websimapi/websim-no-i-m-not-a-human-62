export function typeText(el, text, speed=40){
  el.textContent=''; let i=0; return new Promise(res=>{ const tick=()=>{ el.textContent += text[i++]||''; i<=text.length ? setTimeout(tick, speed) : res(); }; tick(); });
}
export function typeTextAppend(el, text, speed=40){
  let i=0; return new Promise(res=>{ const tick=()=>{ el.textContent += text[i++]||''; i<=text.length ? setTimeout(tick, speed) : res(); }; tick(); });
}
export const sleep = (ms)=>new Promise(r=>setTimeout(r,ms));
export function wrapComma(spanEl){
  const t=spanEl.textContent; const idx=t.lastIndexOf(','); if(idx===-1) return null;
  spanEl.textContent=''; spanEl.append(t.slice(0,idx)); const comma=document.createElement('span'); comma.className='bounce-comma'; comma.textContent=','; spanEl.appendChild(comma); spanEl.append(t.slice(idx+1)); return comma;
}
export function pulseNotRandomly(notEl){
  setInterval(()=>{ notEl.classList.add('pulse-red'); setTimeout(()=>notEl.classList.remove('pulse-red'),1300); }, 12000 + Math.random()*6000);
}
export function waitForNot(el){
  return new Promise(res=>{ const id=setInterval(()=>{ if(el.textContent.includes('NOT')){ clearInterval(id); res(); } },50); });
}