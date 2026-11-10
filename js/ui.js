// Utilidades de interfaz compartidas: diálogo, toast, barra de progreso.
import { DIALOGS, DIALOG_ORDER } from './content.js';
import { SFX } from './sfx.js';

export const $ = (id) => document.getElementById(id);

let toastTimer = null;
export function toast(msg, ms = 2600) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('visible'), ms);
}

export function setProgress(pct, label) {
  const bar = $('progress');
  if (!bar) return;
  bar.classList.add('visible');
  bar.firstElementChild.style.width = `${Math.max(0, Math.min(100, pct))}%`;
  if (label && $('start-label')) $('start-label').textContent = label;
}

let lastFocus = null;
export function openDialog(key) {
  const d = DIALOGS[key];
  if (!d) return;
  SFX.play('open', { volume: 0.7 });
  $('dialog-kicker').textContent = d.kicker;
  $('dialog-title').innerHTML = d.title;
  $('dialog-body').innerHTML = d.html;
  $('dialog-count').textContent = `${String(DIALOG_ORDER.indexOf(key) + 1).padStart(2, '0')} / 03`;
  document.querySelectorAll('.info-btn').forEach((b) => b.classList.toggle('on', b.dataset.dialog === key));
  lastFocus = document.activeElement;
  $('dialog').hidden = false;
  $('dialog-close').focus({ preventScroll: true });
}
export function closeDialog() {
  if ($('dialog').hidden) return;
  $('dialog').hidden = true;
  document.querySelectorAll('.info-btn').forEach((b) => b.classList.remove('on'));
  SFX.play('click', { volume: 0.6 });
  lastFocus?.focus?.({ preventScroll: true });
}
export function bindDialog() {
  $('dialog-close').addEventListener('click', closeDialog);
  $('dialog').addEventListener('click', (e) => { if (e.target === $('dialog')) closeDialog(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDialog(); });
  document.querySelectorAll('.info-btn').forEach((b) => b.addEventListener('click', () => openDialog(b.dataset.dialog)));
}
