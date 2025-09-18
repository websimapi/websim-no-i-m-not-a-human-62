export function adjustLayout() {
  const sidePanels = document.querySelectorAll('.side-panel'); if (!sidePanels.length) return;
  const app = document.getElementById('app'); if (!app) return;
  const contentHeight = app.clientHeight - (4 * parseFloat(getComputedStyle(app).paddingTop));
  const panelWidth = sidePanels[0].clientWidth;
  const gap = parseFloat(getComputedStyle(sidePanels[0]).gap) || 0;
  const boxHeight = (contentHeight - (4 * gap)) / 5;
  const requiredWidth = boxHeight * (16 / 9);
  sidePanels.forEach(panel => { requiredWidth > panelWidth ? panel.classList.add('vertical-aspect') : panel.classList.remove('vertical-aspect'); });
}

export function updateBackgroundDrip() {
  const bg = document.querySelector('.background-drip'); const fig = document.querySelector('.figure-container'); if (!bg || !fig) return;
  const r = fig.getBoundingClientRect(); const startY = Math.round(r.top + r.height * 0.85);
  bg.style.clipPath = `inset(${startY}px 0 0 0)`;
}