// ─────────────────────────────────────────────────────────────
//  EXPERIENCIA 2 · «ACTIVA TU MODO PICAFUEGO»
//  Filtro facial en tiempo real (MediaPipe Face Mesh, autoalojado):
//    · fuego animado que sale de la boca
//    · bigote mexicano justo encima del labio superior
//    · chile PICAFUEGO sobre la mejilla
// ─────────────────────────────────────────────────────────────

import { CONFIG } from './config.js';
import { WebCamera } from './webcamera.js';
import { drawFlame, drawGlow, Embers } from './fire.js';

// Landmarks de Face Mesh que usamos
const LM = {
	lipTop: 0, lipBottom: 17, innerTop: 13, innerBottom: 14,
	mouthL: 61, mouthR: 291,
	noseBase: 2, noseTip: 1, philtrum: 164,
	chin: 152, forehead: 10,
	faceR: 234, faceL: 454,     // bordes del rostro (derecha/izquierda del sujeto)
	eyeR: 33, eyeL: 263,        // comisuras externas de los ojos
	cheekR: 50, cheekL: 280,
};
const NEEDED = [...new Set(Object.values(LM))];

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const lerp = (a, b, t) => a + (b - a) * t;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a, b, t = 0.5) => ({ x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) });

function loadImage(src) {
	return new Promise((resolve, reject) => {
		const img = new Image();
		img.onload = () => resolve(img);
		img.onerror = () => reject(new Error('No se pudo cargar ' + src));
		img.src = src;
	});
}

function loadScript(src) {
	return new Promise((resolve, reject) => {
		if (window.FaceMesh) return resolve();
		const s = document.createElement('script');
		s.src = src;
		s.onload = () => resolve();
		s.onerror = () => reject(new Error('No se pudo cargar ' + src));
		document.head.appendChild(s);
	});
}

export class FaceFilter {
	/**
	 * @param {HTMLCanvasElement} canvas
	 * @param {{onStatus:(s:'loading'|'noface'|'ok')=>void}} hooks
	 */
	constructor(canvas, hooks = {}) {
		this.canvas = canvas;
		this.ctx = canvas.getContext('2d', { alpha: false });
		this.hooks = hooks;
		this.camera = new WebCamera();
		this.mesh = null;
		this.running = false;
		this.enabled = { all: true, fire: true, mustache: true, chile: true };
		this.status = 'loading';

		// landmarks suavizados (coordenadas de pantalla en píxeles de canvas)
		this.cur = {};
		this.target = {};
		this.alpha = 0;           // visibilidad global del filtro (fundido)
		this.lastSeen = 0;
		this.embers = new Embers(60);
		this._raf = 0;
		this._detectRaf = 0;
		this._lastT = -1;
		this._resize = () => this._fit();
	}

	async load(onProgress) {
		onProgress?.('Cargando recursos…');
		[this.mustacheImg, this.chileImg] = await Promise.all([
			loadImage(CONFIG.face.mustache),
			loadImage(CONFIG.face.cheekChile),
		]);
		if (!this.mesh) {
			onProgress?.('Cargando detector facial…');
			await loadScript(CONFIG.face.meshPath + 'face_mesh.js');
			const mesh = new window.FaceMesh({ locateFile: (f) => CONFIG.face.meshPath + f });
			mesh.setOptions({ maxNumFaces: 1, refineLandmarks: false, minDetectionConfidence: 0.5, minTrackingConfidence: 0.5 });
			mesh.onResults((r) => this._onResults(r));
			await mesh.initialize();
			this.mesh = mesh;
		}
	}

	async start({ deviceId = null, facingMode = 'user' } = {}) {
		this._setStatus('loading');
		await this.camera.start({ deviceId, facingMode });
		this.running = true;
		this._fit();
		window.addEventListener('resize', this._resize);
		window.addEventListener('orientationchange', this._resize);
		this.lastTick = performance.now();
		this._raf = requestAnimationFrame(() => this._draw());
		this._detectLoop();
		this._setStatus('noface');
	}

	stop() {
		this.running = false;
		cancelAnimationFrame(this._raf);
		cancelAnimationFrame(this._detectRaf);
		window.removeEventListener('resize', this._resize);
		window.removeEventListener('orientationchange', this._resize);
		this.camera.stop();
		this.cur = {}; this.target = {}; this.alpha = 0;
	}

	setEnabled(key, value) { this.enabled[key] = !!value; }

	snapshot() {
		return new Promise((resolve) => this.canvas.toBlob((b) => resolve(b), 'image/png'));
	}

	// ── detección ───────────────────────────────────────────────
	_detectLoop() {
		if (!this.running) return;
		const v = this.camera.video;
		const go = async () => {
			if (!this.running) return;
			if (v.readyState >= 2 && v.currentTime !== this._lastT) {
				this._lastT = v.currentTime;
				try { await this.mesh.send({ image: v }); } catch (e) { console.warn('FaceMesh:', e); }
			}
			this._detectRaf = requestAnimationFrame(go);
		};
		go();
	}

	_onResults(res) {
		const face = res.multiFaceLandmarks && res.multiFaceLandmarks[0];
		if (!face) return;
		this.lastSeen = performance.now();
		const g = this._geom;
		if (!g) return;
		for (const i of NEEDED) {
			const p = face[i];
			const x = g.ox + (this.camera.mirror ? 1 - p.x : p.x) * g.dw;
			const y = g.oy + p.y * g.dh;
			this.target[i] = { x, y };
			if (!this.cur[i]) this.cur[i] = { x, y };
		}
		if (this.status !== 'ok') this._setStatus('ok');
	}

	_setStatus(s) {
		if (this.status === s) return;
		this.status = s;
		this.hooks.onStatus?.(s);
	}

	// ── tamaño / encuadre “cover” ───────────────────────────────
	_fit() {
		const c = this.canvas;
		const dpr = Math.min(window.devicePixelRatio || 1, 2);
		const w = c.clientWidth, h = c.clientHeight;
		c.width = Math.round(w * dpr);
		c.height = Math.round(h * dpr);
		this._dpr = dpr;
		this._updateGeom();
	}

	_updateGeom() {
		const v = this.camera.video;
		const cw = this.canvas.width, ch = this.canvas.height;
		const vw = v.videoWidth || 640, vh = v.videoHeight || 480;
		const s = Math.max(cw / vw, ch / vh);
		const dw = vw * s, dh = vh * s;
		this._geom = { cw, ch, dw, dh, ox: (cw - dw) / 2, oy: (ch - dh) / 2 };
	}

	// ── dibujo ──────────────────────────────────────────────────
	_draw() {
		if (!this.running) return;
		this._raf = requestAnimationFrame(() => this._draw());
		const now = performance.now();
		const dt = Math.min((now - this.lastTick) / 1000, 0.1);
		this.lastTick = now;
		const t = now / 1000;

		const v = this.camera.video;
		if (!this._geom || this._vw !== v.videoWidth || this._vh !== v.videoHeight) {
			this._vw = v.videoWidth; this._vh = v.videoHeight;
			this._updateGeom();
		}
		const g = this._geom;
		const ctx = this.ctx;

		// 1) video (espejo si es cámara frontal)
		ctx.setTransform(1, 0, 0, 1, 0, 0);
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, g.cw, g.ch);
		if (this.camera.video.readyState >= 2) {
			ctx.save();
			if (this.camera.mirror) { ctx.translate(g.cw, 0); ctx.scale(-1, 1); }
			ctx.drawImage(this.camera.video, g.ox, g.oy, g.dw, g.dh);
			ctx.restore();
		}

		// 2) suavizado de landmarks + fundido
		const sinceSeen = now - this.lastSeen;
		const visible = this.enabled.all && this.cur[LM.noseTip] && sinceSeen < 400;
		this.alpha = lerp(this.alpha, visible ? 1 : 0, 1 - Math.exp(-dt / 0.08));
		if (sinceSeen > 400 && this.status === 'ok') this._setStatus('noface');
		const k = 1 - Math.exp(-dt / 0.045);
		for (const i of NEEDED) {
			const a = this.cur[i], b = this.target[i];
			if (a && b) { a.x = lerp(a.x, b.x, k); a.y = lerp(a.y, b.y, k); }
		}
		if (this.alpha < 0.02 || !this.cur[LM.noseTip]) return;

		const L = this.cur;
		const faceW = dist(L[LM.faceR], L[LM.faceL]);
		const faceH = dist(L[LM.forehead], L[LM.chin]);
		const mouthW = dist(L[LM.mouthL], L[LM.mouthR]);
		const roll = Math.atan2(L[LM.eyeR].y - L[LM.eyeL].y, L[LM.eyeR].x - L[LM.eyeL].x);
		// guiñada (giro lateral) → acortamiento horizontal
		const dR = dist(L[LM.noseTip], L[LM.faceR]);
		const dL = dist(L[LM.noseTip], L[LM.faceL]);
		const yaw = (dR - dL) / (dR + dL + 1e-6);   // -1…1
		const fore = 1 - 0.5 * Math.min(1, Math.abs(yaw));

		ctx.save();
		ctx.globalAlpha = this.alpha;

		// orden de capas: fuego → chile → bigote (el bigote queda por encima)
		if (this.enabled.fire) this._drawFire(ctx, L, { faceH, mouthW, t, dt });
		if (this.enabled.chile) this._drawChile(ctx, L, { faceW, roll, yaw, fore, t });
		if (this.enabled.mustache) this._drawMustache(ctx, L, { mouthW, faceW, roll, fore });

		ctx.restore();
	}

	_drawFire(ctx, L, { faceH, mouthW, t, dt }) {
		const c = mid(L[LM.innerTop], L[LM.innerBottom]);
		const open = clamp(dist(L[LM.innerTop], L[LM.innerBottom]) / (mouthW + 1e-6), 0, 1);
		const n = clamp(open / 0.45, 0, 1);               // 0 boca cerrada · 1 boca abierta
		const down = { x: L[LM.chin].x - L[LM.forehead].x, y: L[LM.chin].y - L[LM.forehead].y };
		const len = Math.hypot(down.x, down.y) || 1;
		down.x /= len; down.y /= len;
		const rot = Math.atan2(down.y, down.x) + Math.PI / 2; // la punta de la llama sigue “hacia el mentón”

		const base = { x: c.x + down.x * faceH * 0.012, y: c.y + down.y * faceH * 0.012 };
		const hF = faceH * (0.20 + 0.36 * n);
		const wF = mouthW * (0.36 + 0.26 * n);

		drawGlow(ctx, base.x + down.x * hF * 0.4, base.y + down.y * hF * 0.4, hF * (1.1 + 0.2 * n), 0.30 + 0.25 * n);

		// abanico de llamas: laterales más bajas, centrales más altas
		const spread = [-0.78, 0.78, -0.40, 0.40, 0];
		const hh = [0.55, 0.55, 0.8, 0.8, 1];
		const ww = [0.7, 0.7, 0.8, 0.8, 0.85];
		for (let i = 0; i < spread.length; i++) {
			const pulse = 1 + 0.12 * Math.sin(t * 9 + i * 1.7);
			drawFlame(ctx, base.x, base.y, wF * ww[i], hF * hh[i] * pulse, t, i * 2.3, rot + spread[i]);
		}

		// chispas lanzadas desde la boca
		this.embers.update(dt);
		if (Math.random() < 0.25 + 0.6 * n) {
			this.embers.emit(base.x + down.x * hF * 0.5, base.y + down.y * hF * 0.5, {
				spreadX: wF * 0.6, size: faceH * 0.012, life: 0.7 + Math.random() * 0.6,
				dirX: down.x + (Math.random() - 0.5) * 0.7, dirY: down.y + (Math.random() - 0.5) * 0.3,
			});
		}
		this.embers.draw(ctx);
	}

	_drawChile(ctx, L, { faceW, roll, yaw, fore, t }) {
		// mejilla derecha del sujeto (a la derecha de la pantalla en modo espejo)
		const cheek = this.camera.mirror ? LM.cheekR : LM.cheekL;
		const p = mid(L[cheek], L[LM.noseTip], 0.12);
		const img = this.chileImg;
		const h = faceW * 0.44;
		const w = h * (img.width / img.height);
		// si la mejilla se gira de espaldas a la cámara, se esconde poco a poco
		const side = this.camera.mirror ? -yaw : yaw;         // >0 → mejilla visible
		const vis = clamp(1 - Math.max(0, -side - 0.25) * 2.2, 0, 1);
		if (vis <= 0.02) return;
		const bob = Math.sin(t * 3.2) * 0.04;
		ctx.save();
		ctx.globalAlpha *= vis;
		ctx.translate(p.x, p.y);
		ctx.rotate(roll + (this.camera.mirror ? 0.30 : -0.30) + bob);
		ctx.scale(fore, 1);
		// sombra suave para integrarlo a la piel
		ctx.shadowColor = 'rgba(0,0,0,0.35)';
		ctx.shadowBlur = h * 0.06;
		ctx.shadowOffsetY = h * 0.02;
		ctx.drawImage(img, -w / 2, -h / 2, w, h);
		ctx.restore();
	}

	_drawMustache(ctx, L, { mouthW, faceW, roll, fore }) {
		// Entre la base de la nariz y el labio superior
		const c = mid(L[LM.noseBase], L[LM.lipTop], 0.62);
		const img = this.mustacheImg;
		const w = clamp(mouthW * 1.75, faceW * 0.45, faceW * 0.95);
		const h = w * (img.height / img.width);
		ctx.save();
		ctx.translate(c.x, c.y);
		ctx.rotate(roll);
		ctx.scale(fore, 1);
		// el centro visual del bigote (zona gruesa) queda sobre el labio
		ctx.drawImage(img, -w / 2, -h * 0.40, w, h);
		ctx.restore();
	}
}
