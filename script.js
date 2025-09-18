import { FogFX } from './fog.js';
import { adjustLayout, updateBackgroundDrip } from './layout.js';
import { initSideCarousels, startCarousels } from './carousel.js';
import { initOverlayFlow, initButtonHovers } from './ui.js';
import { loadAllSounds, stopKnocks, playPrimaryKnock } from './audio.js';
import { startCutscene, warmPreload } from './cutscene.js';

document.addEventListener('DOMContentLoaded', async () => {
  const fogInstance = new FogFX('#fog-canvas'); fogInstance.start();
  initOverlayFlow();
  adjustLayout(); updateBackgroundDrip(); initSideCarousels(); startCarousels(); initButtonHovers();
  window.addEventListener('resize', () => { adjustLayout(); updateBackgroundDrip(); }, { passive:true });
  await loadAllSounds();
  // Preprocess cutscene assets (including decoding GIF frames) at initial load
  warmPreload().catch((e)=>console.error('warmPreload failed', e));
  const loadingOverlay = document.getElementById('loading-overlay'); const spinner = loadingOverlay && loadingOverlay.querySelector('.loader'); if (spinner) spinner.style.display = 'none';
  const newGameBtn = Array.from(document.querySelectorAll('.menu button')).find(b=>b.textContent.trim()==='New Game');
  if(newGameBtn){ newGameBtn.addEventListener('click', async ()=>{ newGameBtn.disabled=true; stopKnocks(); playPrimaryKnock(); await startCutscene(); }); }
});