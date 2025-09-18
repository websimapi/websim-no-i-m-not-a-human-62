const AUDIO_DURATION = 95, FADE = 15, FADE_OUT_START = 80;
export const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let audioUnlocked = false;
let backgroundAudioElement;
let knockBuffers = [], uiHoverBuffer = null, tvStaticLoopBuffer = null, primaryKnockBuffer = null, gateCreakBuffer = null, gateThudBuffer = null, gateStuckBuffer = null;
let knockTimeoutId = null, knockingActive = false;

async function loadSound(url){
  try { const r=await fetch(url); const b=await r.arrayBuffer(); return await audioCtx.decodeAudioData(b); } catch(e){ console.error('Failed sound', url, e); return null; }
}
export async function loadAllSounds(){
  const urls = ['knock.mp3','knock_2.mp3','knock_3.mp3','knock_4.mp3'];
  knockBuffers = (await Promise.all(urls.map(loadSound))).filter(Boolean);
  uiHoverBuffer = await loadSound('ui_hover.mp3');
  tvStaticLoopBuffer = await loadSound('tv_static_loop.mp3');
  primaryKnockBuffer = await loadSound('knock.mp3');
  gateCreakBuffer = await loadSound('gate_long_creak.mp3');
  gateThudBuffer = await loadSound('knock_4.mp3');
  gateStuckBuffer = await loadSound('gate_creak.mp3');
}
export async function unlockAudio(){
  if (audioUnlocked) return; if (audioCtx.state === 'suspended') await audioCtx.resume(); audioUnlocked = true;
}
export function setupBackgroundAudio(){
  if (backgroundAudioElement) return;
  const audio = new Audio('Fleshy Decay - Sonauto.ai.ogg'); backgroundAudioElement = audio; audio.loop=false; audio.preload='auto';
  const src = audioCtx.createMediaElementSource(audio); const gain = audioCtx.createGain(); gain.gain.value=0; src.connect(gain).connect(audioCtx.destination);
  const apply=()=>{ const t=audio.currentTime; let g=1; if(t<FADE) g=t/FADE; else if(t>=FADE_OUT_START) g=Math.max(0,(AUDIO_DURATION-t)/FADE); gain.gain.setTargetAtTime(g, audioCtx.currentTime, 0.05); };
  audio.addEventListener('timeupdate', apply); audio.addEventListener('seeked', apply); audio.addEventListener('ended', ()=>{ audio.currentTime=0; audio.play(); });
  audio.play().catch(e=>console.error('BG play failed', e));
}
export function playSound(buffer, volume=1.0, onEnded=null, loop=false, fadeInDuration=0, playbackRate=1){
  if (!audioUnlocked || !buffer) return null;
  try {
    const source = audioCtx.createBufferSource(); source.buffer = buffer; source.loop = loop;
    source.playbackRate.value = playbackRate;
    const gainNode = audioCtx.createGain(); if (fadeInDuration>0){ gainNode.gain.setValueAtTime(0, audioCtx.currentTime); gainNode.gain.linearRampToValueAtTime(volume, audioCtx.currentTime + fadeInDuration); } else { gainNode.gain.value = volume; }
    source.connect(gainNode); gainNode.connect(audioCtx.destination); source.start(0);
    if (onEnded && !loop) source.addEventListener('ended', onEnded, { once:true });
    return { source, gainNode };
  } catch(e){ console.error('Could not play sound', e); return null; }
}
export function scheduleNextKnock(){
  knockingActive = true; const randomInterval = Math.random()*(10000-3000)+3000;
  knockTimeoutId = setTimeout(()=>{ if(!knockingActive) return; if(knockBuffers.length){ playSound(knockBuffers[Math.floor(Math.random()*knockBuffers.length)]); } scheduleNextKnock(); }, randomInterval);
}
export function stopKnocks(){ knockingActive=false; if(knockTimeoutId){ clearTimeout(knockTimeoutId); knockTimeoutId=null; } }
export function playPrimaryKnock(){ if(primaryKnockBuffer) playSound(primaryKnockBuffer, 1.0); }
export function playGateCreak(volume=0.7){ if(gateCreakBuffer) playSound(gateCreakBuffer, volume); }
export function playGateThud(volume=0.9, rate=0.85){ if(gateThudBuffer) playSound(gateThudBuffer, volume, null, false, 0, rate); }
export function playGateStuck(volume=0.7, rate=Math.random()*0.15+0.9){ if(gateStuckBuffer) playSound(gateStuckBuffer, volume, null, false, 0, rate); }

/* add long creak controller */
let gateLongHandle = null;
export function startGateLongCreak(volume=0.6){
  if(!audioUnlocked || gateLongHandle || !gateCreakBuffer) return;
  gateLongHandle = playSound(gateCreakBuffer, volume, null, true, 1.2);
}
export function stopGateLongCreak(fadeOut=1.2){
  const h=gateLongHandle; if(!h) return; gateLongHandle=null;
  try{ h.gainNode.gain.cancelScheduledValues(audioCtx.currentTime);
    h.gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime+fadeOut);
    setTimeout(()=>{ try{ h.source.stop(); }catch{} }, fadeOut*1000);
  }catch{}
}

export function playGateFrameClank(intensity=1){
  if(!audioUnlocked) return;
  const t = audioCtx.currentTime;
  const metalHit = gateThudBuffer || knockBuffers[3] || knockBuffers[0];

  if (gateStuckBuffer) { // scrape/snag
    const s = audioCtx.createBufferSource(); s.buffer = gateStuckBuffer; s.playbackRate.value = 0.9 + Math.random()*0.2;
    const hp = audioCtx.createBiquadFilter(); hp.type='highpass'; hp.frequency.value = 700 + Math.random()*600;
    const g = audioCtx.createGain(); g.gain.value = 0.55 * intensity;
    s.connect(hp).connect(g).connect(audioCtx.destination); s.start(t);
  }
  if (metalHit) { // heavy clank
    const s = audioCtx.createBufferSource(); s.buffer = metalHit; s.playbackRate.value = 0.78 + Math.random()*0.12;
    const lp = audioCtx.createBiquadFilter(); lp.type='lowpass'; lp.frequency.value = 3200;
    const g = audioCtx.createGain(); g.gain.value = 0.9 * intensity;
    s.connect(lp).connect(g).connect(audioCtx.destination); s.start(t + 0.015);
  }
  if (gateCreakBuffer) { // brief squeal tail
    const s = audioCtx.createBufferSource(); s.buffer = gateCreakBuffer; s.playbackRate.value = 1.12 + Math.random()*0.12;
    const g = audioCtx.createGain(); g.gain.value = 0.32 * intensity;
    s.connect(g).connect(audioCtx.destination); s.start(t + 0.06);
  }
}

export function getUIBuffers(){ return { uiHoverBuffer, tvStaticLoopBuffer }; }
export function getBackgroundAudio(){ return backgroundAudioElement; }