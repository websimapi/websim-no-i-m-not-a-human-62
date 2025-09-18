import { applyPosterizeToImage } from './posterize.js';
import { audioCtx, getBackgroundAudio, playGateCreak, startGateLongCreak, stopGateLongCreak, playGateThud, playGateStuck, playGateFrameClank } from './audio.js';
import { animateBirds, stopBirds } from './birds.js';
import { parseGIF, decompressFrames } from 'https://esm.sh/gifuct-js@2.0.0';
import { initScene3D, stopScene3D } from './scene3d.js';

const scenes = [
  { // Scene 1: Landscape with birds
    image: 'cutscene_landscape.png',
    duration: 14000,
    fadeInClass: 'fade-in-long',
    onStart: (cs, canvas) => {
      if (posterizeInstance) posterizeInstance.setFogCoverage(0.45); // Set sky mask for cloud effect
      animateBirds(() => {
        // This onComplete might trigger a transition if the scene hasn't already.
        if (currentSceneIndex === 0) {
          transitionToScene(1);
        }
      });
    },
    onEnd: () => {
      stopBirds(false);
    }
  },
  { // Scene 2: Driving on the road
    image: 'cutscene_roadside.png',
    duration: 14000,
    animationClass: 'drive-zoom',
    onStart: (cs, canvas) => {
      const canvasWrapper = document.getElementById('cutscene-canvas-wrapper');
      let scale = 1.0;
      let lastTime = performance.now();
      const zoomSpeed = 0.1;
      const fogStartTime = performance.now();
      const fogDuration = 30000;

      function zoomLoop(currentTime) {
        if (currentSceneIndex !== 1) return; // Stop loop if scene changed
        const deltaTime = (currentTime - lastTime) / 1000;
        lastTime = currentTime;
        scale += zoomSpeed * deltaTime;
        if (canvasWrapper) canvasWrapper.style.transform = `scale(${scale})`;

        const fogElapsed = currentTime - fogStartTime;
        const fogProgress = Math.min(1.0, fogElapsed / fogDuration);
        const currentFogCoverage = 0.45 + (1.5 - 0.45) * fogProgress;
        if (posterizeInstance) posterizeInstance.setFogCoverage(currentFogCoverage);

        zoomRafId = requestAnimationFrame(zoomLoop);
      }
      zoomRafId = requestAnimationFrame(zoomLoop);
    },
    onEnd: () => {
      const canvasWrapper = document.getElementById('cutscene-canvas-wrapper');
      if (canvasWrapper) canvasWrapper.style.transform = `scale(1)`;
    }
  },
  { // Scene 3: The Green Gate (Animated GIF)
    image: 'cutscene_gate.png',
    gif: 'animated.gif',
    duration: 18000, // Longer, more pensive scene
    animationClass: 'gate-zoom',
    onStart: () => { if (posterizeInstance) posterizeInstance.setFogCoverage(0.5); startGateLongCreak(0.6); },
    onEnd: () => {
      stopGateLongCreak(1.2);
      // This is the last scene for now. It could fade to black or loop.
      if (csElement) {
        csElement.classList.add('fade-out-fast');
        setTimeout(() => {
          if (csElement) csElement.style.display = 'none';
          stopScene3D(); // cleanup previous if any
          initScene3D();
        }, 1000);
      }
    }
  }
];

let currentSceneIndex = -1;
let posterizeInstance = null;
let autoSkipTimeout = null;
let zoomRafId = null;
let isTransitioning = false;
let csElement = null;
let preloadedAssets = [];
let slideshowTimer = null;
let gateFrameClickHandler = null;

const skipCurrentScene = () => {
  if (currentSceneIndex < scenes.length - 1) {
    transitionToScene(currentSceneIndex + 1);
  }
};

async function transitionToScene(sceneIndex) {
  if (isTransitioning || sceneIndex === currentSceneIndex) return;
  isTransitioning = true;

  const canvas = document.getElementById('cutscene-canvas');
  const gifWrapper = document.getElementById('cutscene-gif-wrapper');
  csElement.removeEventListener('click', skipCurrentScene);
  if (autoSkipTimeout) clearTimeout(autoSkipTimeout);
  // remove previous scene-3 click advance handler if any
  if (gateFrameClickHandler) { csElement.removeEventListener('click', gateFrameClickHandler); gateFrameClickHandler = null; }
  
  const isExitingScene2 = currentSceneIndex === 1;

  // For scenes other than scene 2, stop animations before fading.
  if (!isExitingScene2) {
    if (zoomRafId) {
        cancelAnimationFrame(zoomRafId);
        zoomRafId = null;
    }
    if (currentSceneIndex >= 0 && scenes[currentSceneIndex].onEnd) {
        scenes[currentSceneIndex].onEnd();
    }
  }
  
  // Fade out current scene. For scene 2, zoom continues during this fade.
  canvas.className = ''; // Clear all classes to trigger fade-out
  if (gifWrapper) gifWrapper.className = '';
  if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer=null; }

  await new Promise(r => setTimeout(r, 2000));
  
  // Now that the screen is black, stop scene 2's zoom and run its cleanup.
  if (isExitingScene2) {
    if (zoomRafId) {
        cancelAnimationFrame(zoomRafId);
        zoomRafId = null;
    }
    if (currentSceneIndex >= 0 && scenes[currentSceneIndex].onEnd) {
        scenes[currentSceneIndex].onEnd();
    }
  }

  if (gifWrapper) gifWrapper.innerHTML = '';

  const flockContainer = document.getElementById('bird-flock');
  if (flockContainer && currentSceneIndex === 0) {
      flockContainer.innerHTML = '';
  }

  if (posterizeInstance) {
    try { posterizeInstance.cleanup(); } catch {}
    posterizeInstance = null;
  }
  
  currentSceneIndex = sceneIndex;
  const scene = scenes[currentSceneIndex];
  const sceneAssets = preloadedAssets[currentSceneIndex];

  if (!sceneAssets || !sceneAssets.img) {
      console.error(`Scene ${currentSceneIndex + 1} assets not preloaded.`);
      isTransitioning = false;
      return;
  }
  
  if (scene.gif && sceneAssets.frames) {
    canvas.style.display = 'block';
    posterizeInstance = applyPosterizeToImage(canvas, sceneAssets.frames[0], 5.0, 0.12);
    const wrapper = document.getElementById('cutscene-canvas-wrapper');
    if (scene.animationClass && wrapper) wrapper.classList.add(scene.animationClass);
    let idx = 0;
    const maxFrames = 3; // As per instruction, stop at the 3rd frame (index 2)

    const playFrame = () => {
      if (currentSceneIndex !== sceneIndex) return;
      idx++;
      if (idx < maxFrames && idx < sceneAssets.frames.length) {
        posterizeInstance.setImage(sceneAssets.frames[idx]);
        playGateFrameClank(1.0);
        const delay = sceneAssets.delays[idx] || 100;
        slideshowTimer = setTimeout(playFrame, delay);
      } else {
        // We've reached the last frame, stop audio.
        stopGateLongCreak(0.5); // Quicker fade out as the gate stops moving
        if (autoSkipTimeout) clearTimeout(autoSkipTimeout); // also cancel the scene skip timeout
        if (gateFrameClickHandler) { csElement.removeEventListener('click', gateFrameClickHandler); gateFrameClickHandler = null; }
        
        // This is the end of the final cutscene. Transition to 3D.
        if (currentSceneIndex === scenes.length - 1) {
            scenes[currentSceneIndex].onEnd();
        }
      }
    };

    // allow user click to advance to next frame immediately
    gateFrameClickHandler = () => { if (slideshowTimer) { clearTimeout(slideshowTimer); slideshowTimer = null; } playFrame(); };
    csElement.addEventListener('click', gateFrameClickHandler);
    
    requestAnimationFrame(()=>{ canvas.classList.add('reveal'); if(scene.onStart) scene.onStart(csElement, canvas);
      slideshowTimer = setTimeout(playFrame, sceneAssets.delays[0]||100);
      if (currentSceneIndex < scenes.length - 1) { autoSkipTimeout = setTimeout(skipCurrentScene, scene.duration); csElement.addEventListener('click', skipCurrentScene, { once:true }); }
      isTransitioning=false;
    });
  } else {
    // --- Canvas Scene Logic ---
    canvas.style.display = 'block';
    posterizeInstance = applyPosterizeToImage(canvas, sceneAssets.img, 5.0, 0.12);

    requestAnimationFrame(() => {
        canvas.classList.add('reveal');
        if (scene.fadeInClass) canvas.classList.add(scene.fadeInClass);
        if (scene.animationClass) canvas.classList.add(scene.animationClass);
        
        if (scene.onStart) scene.onStart(csElement, canvas);

        if (currentSceneIndex < scenes.length - 1) {
            autoSkipTimeout = setTimeout(skipCurrentScene, scene.duration);
            csElement.addEventListener('click', skipCurrentScene, { once: true });
        }
        isTransitioning = false;
    });
  }
}

async function preloadCutsceneAssets() {
  const promises = scenes.map(scene => {
    const imagePromise = new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = (err) => reject(`Failed to load ${scene.image}: ${err}`);
      img.src = scene.image;
    });

    if (scene.gif) {
      return imagePromise.then(async (baseImg) => {
        const res = await fetch(scene.gif); const buf = await res.arrayBuffer();
        const gif = parseGIF(buf); const frames = decompressFrames(gif, true);
        const oc = document.createElement('canvas'), ox = oc.getContext('2d');
        oc.width = gif.lsd.width; oc.height = gif.lsd.height;
        const outFrames = [], delays = [];
        frames.forEach(f => { ox.clearRect(0,0,oc.width,oc.height); ox.drawImage(baseImg,0,0,oc.width,oc.height);
          const imgData = new ImageData(f.patch, f.dims.width, f.dims.height);
          ox.putImageData(imgData, f.dims.left, f.dims.top);
          const c = document.createElement('canvas'); c.width=oc.width; c.height=oc.height; c.getContext('2d').drawImage(oc,0,0);
          outFrames.push(c); delays.push((f.delay||10)*10);
        });
        return ({ img: baseImg, frames: outFrames, delays });
      });
    }

    return imagePromise.then(img => ({ img }));
  });
  return Promise.all(promises);
}

export async function warmPreload(){ try{ preloadedAssets = await preloadCutsceneAssets(); }catch(e){ console.error('Warm preload failed', e); } }

export async function startCutscene(){
  csElement = document.getElementById('cutscene');
  const loading = csElement.querySelector('.cutscene-loading');
  csElement.style.display = 'flex';
  loading.style.display = 'grid';
  
  try {
    preloadedAssets = await preloadCutsceneAssets();
  } catch (error) {
    console.error("Failed to preload cutscene assets:", error);
    loading.style.display = 'none'; // Hide loader on error too
    // Maybe show an error message to the user
    return;
  }
  loading.style.display = 'none';
  
  const bg = getBackgroundAudio();
  if (bg) { try { bg.pause(); } catch(e){} }
  
  const cutsceneAudio = new Audio('Distant Transmission - Sonauto.ai.ogg');
  const src = audioCtx.createMediaElementSource(cutsceneAudio);
  const g = audioCtx.createGain();
  g.gain.value = 0;
  src.connect(g).connect(audioCtx.destination);
  await audioCtx.resume();
  await cutsceneAudio.play().catch(()=>{});
  g.gain.linearRampToValueAtTime(1, audioCtx.currentTime + 7);
  setTimeout(() => {
    g.gain.cancelScheduledValues(audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 7);
  }, (115 - 7) * 1000);

  currentSceneIndex = -1;
  isTransitioning = false;
  transitionToScene(0);
}