// ─────────────────────────────────────────────────────────────
//  Identidad sonora PICAFUEGO — todo sintetizado con Web Audio.
//  Sin archivos de audio, sin derechos de autor, sin descargas.
//
//  · welcome  → encendido suave + chispitas (≈1.2 s)
//  · crunch   → mordida de papita crujiente (≈0.8 s)
//  · sizzle   → chisporroteo de especias (≈1.0 s)
//  · flare    → llamarada breve (≈1.4 s)
//
//  Ningún efecto supera CONFIG.audio.maxSeconds (3 s): además de su
//  duración propia, cada reproducción pasa por una “voz” que se
//  apaga con fundido a los 2.8 s como tope duro.
// ─────────────────────────────────────────────────────────────

import { CONFIG } from './config.js';

const PREF_KEY = 'picafuego:muted';

// ── utilidades ────────────────────────────────────────────────
const noiseCache = new WeakMap();
function noise(ctx) {
	let buf = noiseCache.get(ctx);
	if (!buf) {
		buf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
		const d = buf.getChannelData(0);
		for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
		noiseCache.set(ctx, buf);
	}
	return buf;
}

function burst(ctx, out, t, { dur = 0.05, f = 3000, q = 1, gain = 0.5, type = 'bandpass', attack = 0.002 } = {}) {
	const src = ctx.createBufferSource();
	src.buffer = noise(ctx);
	const flt = ctx.createBiquadFilter();
	flt.type = type;
	flt.frequency.value = f;
	flt.Q.value = q;
	const g = ctx.createGain();
	g.gain.setValueAtTime(0.0001, t);
	g.gain.linearRampToValueAtTime(gain, t + attack);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	src.connect(flt).connect(g).connect(out);
	src.start(t, Math.random() * 1.5);
	src.stop(t + dur + 0.02);
}

function sweep(ctx, out, t, { dur = 1, f0 = 300, f1 = 2000, q = 1.2, gain = 0.5, attack = 0.08 } = {}) {
	const src = ctx.createBufferSource();
	src.buffer = noise(ctx);
	const flt = ctx.createBiquadFilter();
	flt.type = 'bandpass';
	flt.Q.value = q;
	flt.frequency.setValueAtTime(f0, t);
	flt.frequency.exponentialRampToValueAtTime(f1, t + dur * 0.8);
	const g = ctx.createGain();
	g.gain.setValueAtTime(0.0001, t);
	g.gain.linearRampToValueAtTime(gain, t + attack);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	src.connect(flt).connect(g).connect(out);
	src.start(t, Math.random() * 1.2);
	src.stop(t + dur + 0.02);
}

function tone(ctx, out, t, { f0 = 440, f1 = null, dur = 0.2, gain = 0.2, type = 'sine' } = {}) {
	const o = ctx.createOscillator();
	o.type = type;
	o.frequency.setValueAtTime(f0, t);
	if (f1) o.frequency.exponentialRampToValueAtTime(f1, t + dur);
	const g = ctx.createGain();
	g.gain.setValueAtTime(0.0001, t);
	g.gain.linearRampToValueAtTime(gain, t + 0.006);
	g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
	o.connect(g).connect(out);
	o.start(t);
	o.stop(t + dur + 0.02);
}

const rnd = (a, b) => a + Math.random() * (b - a);

// ── sonidos (cada uno devuelve su duración en segundos) ───────
export const SOUNDS = {

	welcome(ctx, out, t) {
		sweep(ctx, out, t, { dur: 0.55, f0: 180, f1: 900, q: 0.9, gain: 0.22, attack: 0.18 });
		tone(ctx, out, t + 0.05, { f0: 110, f1: 150, dur: 0.5, gain: 0.10 });
		for (let i = 0; i < 9; i++) {
			burst(ctx, out, t + 0.30 + i * rnd(0.07, 0.11), { dur: 0.018, f: rnd(2200, 5000), q: 2, gain: rnd(0.05, 0.14) });
		}
		tone(ctx, out, t + 0.45, { f0: 1568, dur: 0.55, gain: 0.05 });
		tone(ctx, out, t + 0.62, { f0: 2093, dur: 0.55, gain: 0.04 });
		return 1.2;
	},

	crunch(ctx, out, t) {
		const bite = (o, v = 1) => {
			burst(ctx, out, t + o, { dur: 0.09, f: 2800, q: 0.7, gain: 0.75 * v });
			burst(ctx, out, t + o + 0.012, { dur: 0.06, f: 5400, q: 0.8, gain: 0.5 * v, type: 'highpass' });
			tone(ctx, out, t + o, { f0: 150, f1: 70, dur: 0.09, gain: 0.35 * v });
		};
		bite(0, 1);
		bite(0.26, 0.85);
		bite(0.47, 0.55);
		for (let i = 0; i < 9; i++) {
			burst(ctx, out, t + rnd(0.04, 0.62), { dur: 0.02, f: rnd(4500, 8000), q: 1.5, gain: 0.14 });
		}
		return 0.8;
	},

	sizzle(ctx, out, t) {
		burst(ctx, out, t, { dur: 0.95, f: 4800, q: 0.5, gain: 0.2, type: 'highpass', attack: 0.06 });
		for (let i = 0; i < 16; i++) {
			const at = t + rnd(0.02, 0.9);
			const f = rnd(1800, 4200);
			tone(ctx, out, at, { f0: f, f1: f * 0.6, dur: 0.05, gain: 0.1 });
			burst(ctx, out, at, { dur: 0.02, f: rnd(2000, 3200), q: 3, gain: 0.25 });
		}
		tone(ctx, out, t + 0.02, { f0: 780, f1: 1400, dur: 0.3, gain: 0.05 });
		return 1.0;
	},

	flare(ctx, out, t) {
		sweep(ctx, out, t, { dur: 1.3, f0: 320, f1: 2600, q: 1.1, gain: 0.5, attack: 0.1 });
		tone(ctx, out, t, { f0: 70, f1: 150, dur: 1.1, gain: 0.30 });
		burst(ctx, out, t + 0.05, { dur: 0.12, f: 300, q: 0.7, gain: 0.5, type: 'lowpass' });
		for (let i = 0; i < 11; i++) {
			burst(ctx, out, t + 0.35 + i * rnd(0.05, 0.09), { dur: 0.02, f: rnd(1800, 4200), q: 2, gain: rnd(0.08, 0.2) });
		}
		return 1.4;
	},
};

/** Renderiza un sonido sin conexión (para pruebas de duración). */
export async function renderSound(name, sampleRate = 22050) {
	const ctx = new OfflineAudioContext(1, sampleRate * 4, sampleRate);
	const out = ctx.createGain();
	out.connect(ctx.destination);
	const dur = SOUNDS[name](ctx, out, 0);
	const buf = await ctx.startRendering();
	const d = buf.getChannelData(0);
	let last = 0;
	for (let i = d.length - 1; i >= 0; i--) { if (Math.abs(d[i]) > 0.002) { last = i; break; } }
	return { declared: dur, audible: last / sampleRate };
}

// ── motor de reproducción ─────────────────────────────────────
function readMuted() { try { return localStorage.getItem(PREF_KEY) === '1'; } catch { return false; } }
function writeMuted(v) { try { localStorage.setItem(PREF_KEY, v ? '1' : '0'); } catch { /* modo privado */ } }

export class PicaAudio {
	constructor() {
		this.muted = readMuted();
		this.ctx = null;
		this.master = null;
		this.voice = null;
		this.welcomePlayed = false;
		this.listeners = new Set();
		document.addEventListener('visibilitychange', () => {
			if (!this.ctx) return;
			if (document.hidden) this.ctx.suspend().catch(() => {});
			else if (!this.muted) this.ctx.resume().catch(() => {});
		});
	}

	onChange(fn) { this.listeners.add(fn); }

	_ensure() {
		if (this.ctx) return this.ctx;
		const AC = window.AudioContext || window.webkitAudioContext;
		if (!AC) return null;
		try {
			this.ctx = new AC({ latencyHint: 'interactive' });
		} catch { return null; }
		this.master = this.ctx.createGain();
		this.master.gain.value = this.muted ? 0 : CONFIG.audio.masterVolume;
		this.master.connect(this.ctx.destination);
		return this.ctx;
	}

	/** Debe llamarse dentro de un gesto del usuario (clic / toque). */
	async unlock() {
		const ctx = this._ensure();
		if (!ctx) return false;
		if (ctx.state !== 'running') { try { await ctx.resume(); } catch { /* bloqueado */ } }
		return ctx.state === 'running';
	}

	/**
	 * Sonido de bienvenida respetando la política de autoplay: se intenta al
	 * cargar; si el navegador lo bloquea, suena en la primera interacción.
	 */
	scheduleWelcome() {
		const tryPlay = async () => {
			if (this.welcomePlayed) return true;
			const ok = await this.unlock();
			if (ok && !this.muted) { this.play('welcome'); this.welcomePlayed = true; return true; }
			if (ok && this.muted) { this.welcomePlayed = true; return true; }
			return false;
		};
		tryPlay().then((ok) => {
			if (ok) return;
			const events = ['pointerdown', 'keydown', 'touchstart'];
			const once = async () => {
				if (await tryPlay()) events.forEach((e) => window.removeEventListener(e, once, true));
			};
			events.forEach((e) => window.addEventListener(e, once, { capture: true, passive: true }));
		});
	}

	play(name) {
		if (this.muted || !SOUNDS[name]) return;
		const ctx = this._ensure();
		if (!ctx) return;
		if (ctx.state !== 'running') { ctx.resume().catch(() => {}); }
		const t = ctx.currentTime + 0.005;

		// Una sola voz a la vez: la anterior se apaga con un fundido corto.
		if (this.voice) {
			try {
				this.voice.gain.cancelScheduledValues(t);
				this.voice.gain.setValueAtTime(this.voice.gain.value, t);
				this.voice.gain.linearRampToValueAtTime(0.0001, t + 0.06);
			} catch { /* ya terminó */ }
		}
		const voice = ctx.createGain();
		voice.gain.setValueAtTime(1, t);
		// Tope duro: fundido final antes de los 3 s
		const cap = Math.min(CONFIG.audio.maxSeconds, 3) - 0.2;
		voice.gain.setValueAtTime(1, t + cap - 0.15);
		voice.gain.linearRampToValueAtTime(0.0001, t + cap);
		voice.connect(this.master);
		this.voice = voice;
		SOUNDS[name](ctx, voice, t);
		setTimeout(() => { try { voice.disconnect(); } catch { /* ok */ } if (this.voice === voice) this.voice = null; }, CONFIG.audio.maxSeconds * 1000);
	}

	setMuted(v) {
		this.muted = !!v;
		writeMuted(this.muted);
		if (this.master && this.ctx) {
			this.master.gain.cancelScheduledValues(this.ctx.currentTime);
			this.master.gain.setTargetAtTime(this.muted ? 0 : CONFIG.audio.masterVolume, this.ctx.currentTime, 0.02);
		}
		this.listeners.forEach((fn) => fn(this.muted));
	}

	toggle() { this.setMuted(!this.muted); return this.muted; }
}
