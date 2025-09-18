import { typeText, typeTextAppend, sleep, wrapComma, pulseNotRandomly, waitForNot } from './utils.js';
import { unlockAudio, setupBackgroundAudio, scheduleNextKnock, getUIBuffers, playSound, audioCtx } from './audio.js';

export function initOverlayFlow(){
  const overlay=document.getElementById('ui-overlay'); const prompt=document.getElementById('overlay-prompt'); const yesBtn=document.getElementById('overlay-yes'); const overlayInner=overlay.querySelector('.overlay-inner'); const title=document.getElementById('main-title');
  const titleText = title.getAttribute('aria-label') || "NO, I'M NOT A HUMAN";
  typeText(prompt, "Are you a human?").then(()=>{ yesBtn.disabled=false; });
  yesBtn.addEventListener('click', async ()=> {
    overlay.style.pointerEvents='none'; if(overlayInner) overlayInner.style.pointerEvents='auto'; yesBtn.style.display='none'; prompt.classList.add('fade'); if(overlayInner) overlayInner.style.pointerEvents='none';
    await unlockAudio(); setupBackgroundAudio(); scheduleNextKnock();
    const fogCanvas=document.getElementById('fog-canvas'); if(fogCanvas){ fogCanvas.style.zIndex='1'; fogCanvas.style.background='transparent'; }
    const loadingOverlay=document.getElementById('loading-overlay'); if(loadingOverlay) loadingOverlay.classList.add('hidden');
    title.textContent=''; const prefix=document.createElement('span'); const rest=document.createElement('span'); title.append(prefix, rest);
    await typeText(prefix, "NO,", 180); const commaEl=wrapComma(prefix); await sleep(900); if(commaEl){ commaEl.classList.add('slow'); }
    const typing=typeTextAppend(rest, " I'M NOT A HUMAN", 90); await waitForNot(rest);
    rest.innerHTML = rest.textContent.replace('NOT','<span class="not-word">NOT</span>'); const notEl = rest.querySelector('.not-word'); requestAnimationFrame(()=>{ notEl.style.color='#ddd'; }); pulseNotRandomly(notEl); await typing;
  }, { once:true });
}

export function initButtonHovers(){
  const buttons=document.querySelectorAll('.menu button, .overlay-btn, .credits-btn'); let staticLoopSound=null; let initialSoundSource=null; let touchInProgress=false;
  const stopAll=()=>{ if(initialSoundSource){ try{ initialSoundSource.stop(); }catch{} initialSoundSource=null; }
    if(staticLoopSound){ const { source, gainNode } = staticLoopSound; const fadeOut=0.2; gainNode.gain.cancelScheduledValues(audioCtx.currentTime); gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime+fadeOut); setTimeout(()=>{ try{ source.stop(); }catch{} }, fadeOut*1000); staticLoopSound=null; } };
  const handleEnter=(btn)=>{ 
    if(btn.disabled) return; 
    const { uiHoverBuffer, tvStaticLoopBuffer } = getUIBuffers();
    stopAll(); btn.classList.add('static-bg-active');
    const h=playSound(uiHoverBuffer, 0.55); if(h) initialSoundSource=h.source;
    staticLoopSound=playSound(tvStaticLoopBuffer, 0.18, null, true, 0.5);
  };
  const handleLeave=(btn)=>{ stopAll(); btn.classList.remove('static-bg-active'); };
  buttons.forEach(button=>{
    button.addEventListener('mouseenter',(e)=>{ if(touchInProgress) return; handleEnter(e.currentTarget); });
    button.addEventListener('mouseleave',(e)=>{ if(touchInProgress) return; handleLeave(e.currentTarget); });
    button.addEventListener('touchstart',(e)=>{ touchInProgress=true; handleEnter(e.currentTarget); }, { passive:true });
    button.addEventListener('touchend',(e)=>{ handleLeave(e.currentTarget); setTimeout(()=>{ touchInProgress=false; },100); });
    button.addEventListener('touchcancel',(e)=>{ handleLeave(e.currentTarget); setTimeout(()=>{ touchInProgress=false; },100); });
  });
}