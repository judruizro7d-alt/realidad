// ─────────────────────────────────────────────────────────────
//  EXPERIENCIA 1 · Reconocimiento de imagen (MindAR + Three.js)
//  Al reconocer imagenescaneable.png aparece el chile bailando
//  entre llamas animadas, anclado a la imagen física.
// ─────────────────────────────────────────────────────────────

import * as THREE from 'three';
import { MindARThree } from './mindar/mindar-image-three.prod.js';
import { drawFlame, drawGlow, Embers } from './fire.js';
import { CONFIG } from './config.js';

const BPM = 116;           // ritmo del baile
const CHILE_H = 1.0;       // alto del chile (1 = ancho de la imagen objetivo)
const CHILE_X = 0.23;      // posición sobre la imagen (el chile impreso está a la derecha)
const CHILE_BASE_Y = -0.50;
const FIRE_SPAN = 2.0;     // tamaño del plano de llamas (en unidades de la imagen)

export class ARExperience {
	/**
	 * @param {HTMLElement} container
	 * @param {{onFound:Function,onLost:Function}} hooks
	 */
	constructor(container, hooks = {}) {
		this.container = container;
		this.hooks = hooks;
		this.mindar = null;
		this.running = false;
		this.found = false;
		this.foundAt = 0;
		this.lastError = null;
		this._onResize = () => this.mindar?.resize();
	}

	async start({ deviceId = null } = {}) {
		this.stop();
		this.container.replaceChildren();
		this.lastError = null;

		this.mindar = new MindARThree({
			container: this.container,
			imageTargetSrc: CONFIG.marker.mind,
			maxTrack: 1,
			uiLoading: 'no',
			uiScanning: 'no',
			uiError: 'no',
			filterMinCF: 0.001,
			filterBeta: 1000,
			warmupTolerance: 5,
			missTolerance: 5,
			environmentDeviceId: deviceId,
		});

		const { renderer, scene, camera } = this.mindar;
		renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
		renderer.setClearColor(0x000000, 0);

		this.anchor = this.mindar.addAnchor(CONFIG.marker.targetIndex);
		await this._buildContent();
		this.anchor.group.add(this.root);
		this.anchor.onTargetFound = () => this._handleFound();
		this.anchor.onTargetLost = () => this._handleLost();

		// MindAR descarta el error real de getUserMedia; lo capturamos para
		// poder mostrar un mensaje claro (permiso denegado, cámara ocupada…).
		const md = navigator.mediaDevices;
		const original = md.getUserMedia.bind(md);
		md.getUserMedia = (c) => original(c).catch((e) => { this.lastError = e; throw e; });
		try {
			await this.mindar.start();
		} catch (e) {
			const err = this.lastError || e || new Error('start-failed');
			this.stop();
			throw err;
		} finally {
			md.getUserMedia = original;
		}

		this.running = true;
		this._t0 = performance.now();
		this._tPrev = this._t0;
		this._fireClock = 0;
		renderer.setAnimationLoop(() => this._frame(scene, camera, renderer));
		window.addEventListener('resize', this._onResize);
		window.addEventListener('orientationchange', this._onResize);
		return this.mindar.video?.srcObject?.getVideoTracks?.()[0]?.getSettings?.() || {};
	}

	stop() {
		this.running = false;
		window.removeEventListener('resize', this._onResize);
		window.removeEventListener('orientationchange', this._onResize);
		if (this.mindar) {
			try { this.mindar.renderer.setAnimationLoop(null); } catch { /* ok */ }
			try { this.mindar.stop(); } catch { /* ok */ }
			try { this.mindar.renderer.dispose(); } catch { /* ok */ }
		}
		this.mindar = null;
		this.found = false;
		this._disposeContent();
		this.container.replaceChildren();
	}

	// ── contenido 3D ────────────────────────────────────────────
	async _buildContent() {
		const loader = new THREE.TextureLoader();
		const chileTex = await loader.loadAsync(CONFIG.chile);
		chileTex.colorSpace = THREE.SRGBColorSpace;
		chileTex.anisotropy = 4;

		const root = new THREE.Group();
		root.position.z = 0.02;
		this.root = root;
		this.disposables = [chileTex];

		// Llamas traseras (canvas animado)
		this.back = this._makeCanvasPlane(640, FIRE_SPAN, 1);
		this.back.mesh.position.set(CHILE_X, CHILE_BASE_Y + CHILE_H * 0.5, 0);
		root.add(this.back.mesh);

		// Chile (pivote en la base para que “baile” desde los pies)
		const aspect = chileTex.image.width / chileTex.image.height;
		const geo = new THREE.PlaneGeometry(CHILE_H * aspect, CHILE_H);
		geo.translate(0, CHILE_H / 2, 0);
		const mat = new THREE.MeshBasicMaterial({ map: chileTex, transparent: true, depthTest: false, depthWrite: false, side: THREE.DoubleSide });
		const chile = new THREE.Mesh(geo, mat);
		chile.renderOrder = 2;
		this.chile = chile;
		this.disposables.push(geo, mat);

		this.dancer = new THREE.Group();
		this.dancer.position.set(CHILE_X, CHILE_BASE_Y, 0);
		this.dancer.add(chile);
		root.add(this.dancer);

		// Llamas delanteras (pequeñas, junto a los pies) + chispas
		this.front = this._makeCanvasPlane(512, FIRE_SPAN, 3);
		this.front.mesh.position.set(CHILE_X, CHILE_BASE_Y + CHILE_H * 0.5, 0.01);
		root.add(this.front.mesh);

		this.embers = new Embers(46);
		root.visible = true;
		this.root.scale.setScalar(1);
	}

	_makeCanvasPlane(px, size, order) {
		const canvas = document.createElement('canvas');
		canvas.width = canvas.height = px;
		const ctx = canvas.getContext('2d');
		const tex = new THREE.CanvasTexture(canvas);
		tex.colorSpace = THREE.SRGBColorSpace;
		tex.minFilter = THREE.LinearFilter;
		tex.generateMipmaps = false;
		const geo = new THREE.PlaneGeometry(size, size);
		const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false });
		const mesh = new THREE.Mesh(geo, mat);
		mesh.renderOrder = order;
		this.disposables.push(tex, geo, mat);
		return { canvas, ctx, tex, mesh, px };
	}

	_disposeContent() {
		(this.disposables || []).forEach((d) => d.dispose?.());
		this.disposables = [];
		this.root = this.dancer = this.chile = this.back = this.front = null;
	}

	// ── eventos del reconocimiento ──────────────────────────────
	_handleFound() {
		this.found = true;
		this.foundAt = performance.now();
		this.hooks.onFound?.();
	}
	_handleLost() {
		this.found = false;
		this.hooks.onLost?.();
	}

	// ── bucle ───────────────────────────────────────────────────
	_frame(scene, camera, renderer) {
		if (!this.running) return;
		const now = performance.now();
		const dt = Math.min((now - this._tPrev) / 1000, 0.1);
		this._tPrev = now;
		const t = (now - this._t0) / 1000;

		if (this.anchor.group.visible) {
			this._dance(t);
			this._fireClock += dt;
			// Las llamas se repintan a ~30 fps para ahorrar batería
			if (this._fireClock >= 1 / 30) {
				this._drawFire(t, this._fireClock);
				this._fireClock = 0;
			}
		}
		renderer.render(scene, camera);
	}

	_dance(t) {
		const beat = t * BPM / 60;
		const bar = Math.floor(beat) % 8;
		const hop = Math.abs(Math.sin(Math.PI * beat));       // 0 en el suelo · 1 en el aire
		const big = (bar === 3 || bar === 7) ? 1.6 : 1;        // salto grande cada 4 tiempos
		const lift = hop * 0.06 * big;
		const squash = 1 - hop;                                 // 1 = agachado
		let sx = 1 + squash * 0.06 - hop * 0.03;
		const sy = 1 - squash * 0.07 + hop * 0.045;

		// balanceo de lado a lado desde los pies + inclinación suave
		const sway = Math.sin(beat * Math.PI) * 0.15 + Math.sin(beat * Math.PI * 0.5) * 0.05;

		// giro “de papel” (el chile se voltea) una vez cada 8 tiempos
		let spin = 1;
		if (bar === 7) {
			const k = beat % 1;
			spin = Math.cos(k * Math.PI * 2);
		}
		sx *= spin === 1 ? 1 : (Math.abs(spin) < 0.06 ? (spin < 0 ? -0.06 : 0.06) : spin);

		// entrada con rebote elástico (primer segundo tras reconocer)
		const age = Math.min((performance.now() - this.foundAt) / 700, 1);
		const intro = age >= 1 ? 1 : 1 - Math.pow(1 - age, 3) * Math.cos(age * 9);

		this.dancer.position.y = CHILE_BASE_Y + lift;
		this.dancer.rotation.z = sway;
		this.dancer.scale.set(sx * intro, sy * intro, 1);
		const s = Math.max(0.001, intro);
		this.back.mesh.scale.setScalar(s);
		this.front.mesh.scale.setScalar(s);
		this.back.mesh.material.opacity = Math.min(1, intro);
		this.front.mesh.material.opacity = Math.min(1, intro);
	}

	_drawFire(t, dt) {
		const B = this.back, F = this.front;
		const S = B.px;
		// centro del plano = centro del chile → (S/2, S/2)
		const cx = S / 2;
		const ctx = B.ctx;
		ctx.clearRect(0, 0, S, S);

		// resplandor detrás del personaje
		drawGlow(ctx, cx, S * 0.5, S * 0.30, 0.40 + 0.06 * Math.sin(t * 5));

		// Llamas: [dx, baseY, ancho, alto, semilla] en fracción de S (el chile ocupa el centro)
		const flames = [
			[-0.135, 0.27, 0.105, 0.23, 1.0],
			[ 0.135, 0.27, 0.105, 0.23, 2.0],
			[-0.055, 0.29, 0.085, 0.19, 3.0],
			[ 0.055, 0.29, 0.085, 0.19, 4.0],
			[-0.165, 0.11, 0.085, 0.18, 5.0],
			[ 0.165, 0.11, 0.085, 0.18, 6.0],
			[-0.145, -0.05, 0.07, 0.135, 7.0],
			[ 0.145, -0.05, 0.07, 0.135, 8.0],
			[-0.09, -0.19, 0.055, 0.10, 9.0],
			[ 0.09, -0.19, 0.055, 0.10, 10.0],
		];
		for (const [dx, by, w, h, seed] of flames) {
			const pulse = 1 + 0.08 * Math.sin(t * 7 + seed);
			drawFlame(ctx, cx + dx * S, S * 0.5 + by * S, w * S, h * S * pulse, t, seed, dx * 1.6);
		}

		// chispas
		this.embers.update(dt);
		if (Math.random() < 0.6) {
			const e = flames[(Math.random() * flames.length) | 0];
			this.embers.emit(cx + e[0] * S, S * 0.5 + e[1] * S - e[3] * S * 0.7, { spreadX: S * 0.04, size: S * 0.006, life: 0.9 + Math.random() * 0.7, dirX: e[0] * 2.5, dirY: -1 });
		}
		this.embers.draw(ctx);
		B.tex.needsUpdate = true;

		// frente: llamitas cruzadas junto a los pies
		const FS = F.px, fx = F.ctx;
		fx.clearRect(0, 0, FS, FS);
		const fy = FS * 0.5 + FS * 0.25 * 0.96;
		const fl = [[-0.075, 0.07, 0.13, 0], [0.07, 0.065, 0.11, 3], [0.0, 0.055, 0.085, 6]];
		for (const [dx, w, h, seed] of fl) {
			drawFlame(fx, FS / 2 + dx * FS, fy, w * FS, h * FS * (1 + 0.1 * Math.sin(t * 8 + seed)), t, seed + 20, dx * 1.2);
		}
		F.tex.needsUpdate = true;
	}
}
