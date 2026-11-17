// ─────────────────────────────────────────────────────────────
//  PICAFUEGO · controlador principal
//  Inicio ⇄ Escaneo de imagen ⇄ Filtro facial
//  (los módulos de cámara/AR se cargan solo cuando se necesitan)
// ─────────────────────────────────────────────────────────────

import { CONFIG } from './config.js';
import { PicaAudio } from './audio.js';
import { detectDevice, cameraSupport, explainCameraError, listCameras } from './webcamera.js';
import { drawFlame, drawGlow, Embers } from './fire.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const device = detectDevice();
document.documentElement.dataset.device = device.kind;

const audio = new PicaAudio();
audio.scheduleWelcome();

// ── pantallas ────────────────────────────────────────────────
const screens = { home: $('#home'), ar: $('#ar-screen'), face: $('#face-screen') };
let current = 'home';
function show(name) {
	current = name;
	for (const [k, el] of Object.entries(screens)) el.classList.toggle('active', k === name);
	document.body.dataset.screen = name;
	homeFire.setActive(name === 'home');
}

// ── sonido (botones de silencio) ─────────────────────────────
const ICON_ON = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';
const ICON_OFF = '<svg viewBox="0 0 24 24"><path d="M4 9v6h4l5 4V5L8 9H4z"/><path d="M17 9l5 6M22 9l-5 6"/></svg>';
function refreshSoundButtons() {
	$$('.sound-btn').forEach((b) => {
		b.innerHTML = audio.muted ? ICON_OFF : ICON_ON;
		b.setAttribute('aria-pressed', String(!audio.muted));
		b.title = audio.muted ? 'Sonido desactivado' : 'Sonido activado';
	});
}
refreshSoundButtons();
audio.onChange(refreshSoundButtons);
$$('[data-action="sound"]').forEach((b) => b.addEventListener('click', async () => {
	await audio.unlock();
	audio.toggle();
}));

// ── utilidades de UI ─────────────────────────────────────────
const loadingEl = $('#loading'), loadingText = $('#loading-text');
const errorEl = $('#error'), errorTitle = $('#error-title'), errorText = $('#error-text');
let retryFn = null;
function showLoading(text) { loadingText.textContent = text; loadingEl.hidden = false; }
function hideLoading() { loadingEl.hidden = true; }
function showError(title, text, retry) {
	hideLoading();
	errorTitle.textContent = title;
	errorText.textContent = text;
	retryFn = retry || null;
	$('#error-retry').hidden = !retry;
	errorEl.hidden = false;
}
$('#error-retry').addEventListener('click', () => { errorEl.hidden = true; retryFn?.(); });
$('#error-back').addEventListener('click', () => { errorEl.hidden = true; goHome(); });

const toastEl = $('#toast');
let toastTimer = 0;
function toast(msg) {
	toastEl.textContent = msg;
	toastEl.hidden = false;
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => { toastEl.hidden = true; }, 2600);
}

// ── soporte de cámara en la portada ──────────────────────────
const support = cameraSupport();
if (!support.ok) {
	const n = $('#support-note');
	n.textContent = support.message;
	n.hidden = false;
}

// ── cámaras (cambio de cámara) ───────────────────────────────
async function nextCamera(list, currentId) {
	if (list.length < 2) return null;
	const i = list.findIndex((d) => d.deviceId === currentId);
	return list[(i + 1) % list.length].deviceId;
}

// ═════════════ EXPERIENCIA 1 · ESCANEO ═════════════
let ar = null;
let arDeviceId = null;
let arCams = [];
let lostTimer = 0;

const dock = $('#dock'), scanHint = $('#scan-hint'), lostHint = $('#lost-hint');
const panel = $('#panel'), panelImg = $('#panel-img'), panelCard = $('#panel-card'), panelClose = $('#panel-close');
let openSection = -1;

function buildDock() {
	dock.replaceChildren();
	CONFIG.sections.forEach((s, i) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = 'dock-btn';
		b.dataset.index = i;
		b.style.setProperty('--i', i);
		b.setAttribute('aria-label', s.label);
		b.innerHTML = `<img src="${s.icon}" alt="" draggable="false"><span>${s.label}</span>`;
		b.addEventListener('click', () => onSectionTap(i));
		dock.appendChild(b);
	});
}
buildDock();

function onSectionTap(i) {
	const s = CONFIG.sections[i];
	audio.unlock().then(() => audio.play(s.sound));
	if (openSection === i) { closePanel(); return; }
	openPanel(i);
}

function openPanel(i) {
	const s = CONFIG.sections[i];
	const wasOpen = openSection !== -1;
	openSection = i;
	panelImg.src = s.card;
	panelImg.alt = s.label;
	panelClose.style.setProperty('--cx', s.close.x * 100 + '%');
	panelClose.style.setProperty('--cy', s.close.y * 100 + '%');
	panelClose.style.setProperty('--cr', s.close.r * 100 + '%');
	panel.hidden = false;
	panel.classList.remove('closing');
	panelCard.classList.remove('swap');
	void panelCard.offsetWidth;
	panelCard.classList.add(wasOpen ? 'swap' : 'enter');
	$$('.dock-btn').forEach((b) => b.classList.toggle('active', Number(b.dataset.index) === i));
	panelClose.focus({ preventScroll: true });
}

function closePanel() {
	if (openSection === -1) return;
	openSection = -1;
	$$('.dock-btn').forEach((b) => b.classList.remove('active'));
	panel.classList.add('closing');
	setTimeout(() => {
		if (openSection === -1) { panel.hidden = true; panel.classList.remove('closing'); panelCard.classList.remove('enter', 'swap'); }
	}, 200);
}
panelClose.addEventListener('click', closePanel);
panel.addEventListener('click', (e) => { if (e.target === panel) closePanel(); });
window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && openSection !== -1) closePanel(); });

function onFound() {
	clearTimeout(lostTimer);
	scanHint.classList.add('gone');
	lostHint.hidden = true;
	if (dock.hidden) {
		dock.hidden = false;
		dock.classList.remove('pop');
		void dock.offsetWidth;
		dock.classList.add('pop');
	}
}

function onLost() {
	clearTimeout(lostTimer);
	// pequeño margen para parpadeos del seguimiento
	lostTimer = setTimeout(() => {
		if (current !== 'ar') return;
		lostHint.hidden = openSection !== -1;
		if (openSection === -1) { dock.hidden = true; }
	}, 1400);
}

async function startAR(deviceId = arDeviceId) {
	const sup = cameraSupport();
	if (!sup.ok) { showError('No se puede abrir la cámara', sup.message, null); return; }
	show('ar');
	resetARUI();
	showLoading('Iniciando cámara y cargando la escena…');
	await audio.unlock();
	try {
		if (!ar) {
			const { ARExperience } = await import('./ar-experience.js');
			ar = new ARExperience($('#ar-container'), { onFound, onLost });
		}
		const settings = await ar.start({ deviceId });
		arDeviceId = settings.deviceId || deviceId;
		arCams = await listCameras();
		$('#ar-switch-cam').hidden = arCams.length < 2;
		hideLoading();
	} catch (e) {
		console.error('AR:', e);
		const info = explainCameraError(e);
		showError(info.title, info.message, () => startAR(deviceId));
	}
}

function resetARUI() {
	clearTimeout(lostTimer);
	closePanel();
	panel.hidden = true;
	dock.hidden = true;
	lostHint.hidden = true;
	scanHint.classList.remove('gone');
}

$('#ar-switch-cam').addEventListener('click', async () => {
	const id = await nextCamera(arCams, arDeviceId);
	if (id) { toast('Cambiando de cámara…'); startAR(id); }
});

// ═════════════ EXPERIENCIA 2 · FILTRO FACIAL ═════════════
let face = null;
let faceDeviceId = null;
let faceCams = [];
const faceHint = $('#face-hint'), faceControls = $('#face-controls');

async function startFace({ deviceId = faceDeviceId, facingMode = 'user' } = {}) {
	const sup = cameraSupport();
	if (!sup.ok) { showError('No se puede abrir la cámara', sup.message, null); return; }
	show('face');
	faceControls.hidden = true;
	faceHint.hidden = true;
	showLoading('Preparando tu filtro PICAFUEGO…');
	await audio.unlock();
	try {
		if (!face) {
			const { FaceFilter } = await import('./face-filter.js');
			face = new FaceFilter($('#face-canvas'), {
				onStatus: (s) => { faceHint.hidden = s !== 'noface'; },
			});
		}
		await face.load((msg) => { loadingText.textContent = msg; });
		loadingText.textContent = 'Iniciando cámara…';
		await face.start({ deviceId, facingMode });
		faceDeviceId = face.camera.deviceId;
		faceCams = await listCameras();
		$('#face-switch-cam').hidden = faceCams.length < 2;
		faceControls.hidden = false;
		hideLoading();
		audio.play('flare');
	} catch (e) {
		console.error('Filtro:', e);
		face?.stop();
		const isCam = ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError', 'SecurityError', 'AbortError'].includes(e?.name);
		if (isCam) {
			const info = explainCameraError(e);
			showError(info.title, info.message, () => startFace({ deviceId, facingMode }));
		} else {
			showError('No pudimos cargar el filtro', 'Revisa tu conexión y vuelve a intentarlo. Si el problema continúa, prueba con Chrome, Edge o Safari actualizados.', () => startFace({ deviceId, facingMode }));
		}
	}
}

$('#face-switch-cam').addEventListener('click', async () => {
	const id = await nextCamera(faceCams, faceDeviceId);
	if (id) { toast('Cambiando de cámara…'); startFace({ deviceId: id }); }
});

$$('.chip[data-fx]').forEach((chip) => chip.addEventListener('click', () => {
	const on = !chip.classList.contains('on');
	chip.classList.toggle('on', on);
	chip.setAttribute('aria-pressed', String(on));
	face?.setEnabled(chip.dataset.fx, on);
}));

const master = $('#fx-master');
master.addEventListener('click', () => {
	const on = master.getAttribute('aria-pressed') !== 'true';
	master.setAttribute('aria-pressed', String(on));
	master.classList.toggle('off', !on);
	face?.setEnabled('all', on);
	toast(on ? 'Filtro activado' : 'Filtro desactivado');
});

$('#fx-photo').addEventListener('click', async () => {
	if (!face) return;
	const blob = await face.snapshot();
	if (!blob) return;
	const url = URL.createObjectURL(blob);
	const a = document.createElement('a');
	a.href = url; a.download = 'picafuego-filtro.png';
	document.body.appendChild(a); a.click(); a.remove();
	setTimeout(() => URL.revokeObjectURL(url), 4000);
	toast('Foto guardada');
});

$('#fx-close').addEventListener('click', () => goHome());

// ── navegación ───────────────────────────────────────────────
function goHome() {
	ar?.stop();
	face?.stop();
	hideLoading();
	resetARUI();
	faceControls.hidden = true;
	faceHint.hidden = true;
	show('home');
}

$$('[data-action="back"]').forEach((b) => b.addEventListener('click', goHome));
$('#btn-scan').addEventListener('click', () => { audio.unlock(); audio.play('sizzle'); startAR(); });
$('#btn-face').addEventListener('click', () => { audio.unlock(); audio.play('flare'); startFace(); });

// la cámara se libera si la pestaña se cierra / se oculta mucho tiempo
window.addEventListener('pagehide', () => { ar?.stop(); face?.stop(); });

// ═════════════ Fuego de la portada ═════════════
const homeFire = (() => {
	const canvas = $('#home-fire');
	const ctx = canvas.getContext('2d');
	const embers = new Embers(50);
	let raf = 0, last = 0, active = true;
	const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	function frame(now) {
		raf = requestAnimationFrame(frame);
		if (now - last < 33) return; // ~30 fps
		const dt = Math.min((now - last) / 1000, 0.1); last = now;
		const t = now / 1000, S = canvas.width;
		ctx.clearRect(0, 0, S, S);
		drawGlow(ctx, S * 0.5, S * 0.52, S * 0.38, 0.42 + 0.06 * Math.sin(t * 4));
		// [dx, baseY, ancho, alto, semilla] — todo dentro del lienzo para que no se corte
		const fl = [
			[-0.24, 0.26, 0.13, 0.28, 1], [0.24, 0.26, 0.13, 0.28, 2], [-0.31, 0.08, 0.11, 0.22, 3], [0.31, 0.08, 0.11, 0.22, 4],
			[-0.12, 0.33, 0.14, 0.32, 5], [0.12, 0.33, 0.14, 0.32, 6], [-0.26, -0.12, 0.09, 0.17, 7], [0.26, -0.12, 0.09, 0.17, 8],
			[-0.12, -0.26, 0.075, 0.14, 9], [0.12, -0.26, 0.075, 0.14, 10],
		];
		for (const [dx, by, w, h, seed] of fl) {
			drawFlame(ctx, S * (0.5 + dx), S * (0.5 + by), w * S, h * S * (1 + 0.08 * Math.sin(t * 7 + seed)), t, seed, dx * 0.8);
		}
		embers.update(dt);
		if (Math.random() < 0.5) {
			const e = fl[(Math.random() * fl.length) | 0];
			embers.emit(S * (0.5 + e[0]), S * (0.5 + e[1]) - e[3] * S * 0.7, { spreadX: S * 0.06, size: S * 0.007, life: 0.9 + Math.random() * 0.7, dirX: e[0] * 2.5, dirY: -1 });
		}
		embers.draw(ctx);
	}

	return {
		setActive(v) {
			active = v;
			cancelAnimationFrame(raf);
			if (v && !reduce) raf = requestAnimationFrame(frame);
		},
		init() { if (!reduce) raf = requestAnimationFrame(frame); },
	};
})();
homeFire.init();

document.body.dataset.screen = 'home';
