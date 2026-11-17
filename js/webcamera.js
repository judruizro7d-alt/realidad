// ─────────────────────────────────────────────────────────────
//  Utilidades de cámara compartidas (detección de dispositivo,
//  errores legibles, lista de cámaras) + clase WebCamera para el
//  filtro facial.
// ─────────────────────────────────────────────────────────────

export function detectDevice() {
	const ua = navigator.userAgent || '';
	const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
	const coarse = window.matchMedia?.('(pointer: coarse)').matches && Math.min(screen.width, screen.height) < 900;
	const mobile = /Android|iPhone|iPad|iPod|Mobile/i.test(ua) || iPadOS || !!coarse;
	const touch = navigator.maxTouchPoints > 0 || 'ontouchstart' in window;
	const ios = /iPhone|iPad|iPod/i.test(ua) || iPadOS;
	return { mobile, touch, ios, kind: mobile ? 'mobile' : 'desktop' };
}

export function cameraSupport() {
	if (!window.isSecureContext) {
		return { ok: false, code: 'insecure', message: 'La cámara solo funciona con HTTPS (o en localhost). Abre la página desde el enlace seguro https://…' };
	}
	if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
		return { ok: false, code: 'unsupported', message: 'Este navegador no permite usar la cámara. Prueba con Chrome, Edge o Safari actualizados.' };
	}
	return { ok: true };
}

/** Convierte un error de getUserMedia en un mensaje claro para el usuario. */
export function explainCameraError(err) {
	const name = err?.name || '';
	switch (name) {
		case 'NotAllowedError':
		case 'SecurityError':
		case 'PermissionDeniedError':
			return {
				code: 'denied',
				title: 'Necesitamos tu cámara',
				message: 'Bloqueaste el permiso de cámara. Toca el candado (o el icono de cámara) junto a la dirección web, permite la cámara y pulsa “Reintentar”.',
			};
		case 'NotFoundError':
		case 'DevicesNotFoundError':
		case 'OverconstrainedError':
			return {
				code: 'notfound',
				title: 'No encontramos una cámara',
				message: 'No detectamos ninguna cámara disponible. Conecta una webcam o prueba desde tu celular.',
			};
		case 'NotReadableError':
		case 'TrackStartError':
		case 'AbortError':
			return {
				code: 'busy',
				title: 'La cámara está ocupada',
				message: 'Otra aplicación (Zoom, Meet, otra pestaña…) está usando la cámara. Ciérrala y pulsa “Reintentar”.',
			};
		default:
			return {
				code: 'unknown',
				title: 'No pudimos iniciar la cámara',
				message: 'Ocurrió un problema al abrir la cámara. Recarga la página e inténtalo de nuevo.',
			};
	}
}

export async function listCameras() {
	try {
		const devices = await navigator.mediaDevices.enumerateDevices();
		return devices.filter((d) => d.kind === 'videoinput');
	} catch { return []; }
}

/**
 * Cámara para el filtro facial. Por defecto cámara frontal ("user").
 * Se refleja en espejo solo si es cámara frontal / webcam.
 */
export class WebCamera {
	constructor() {
		this.video = document.createElement('video');
		this.video.setAttribute('playsinline', '');
		this.video.setAttribute('autoplay', '');
		this.video.muted = true;
		this.stream = null;
		this.deviceId = null;
		this.mirror = true;
	}

	async start({ deviceId = null, facingMode = 'user' } = {}) {
		this.stop();
		const base = { width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30, max: 30 } };
		const video = deviceId ? { ...base, deviceId: { exact: deviceId } } : { ...base, facingMode: { ideal: facingMode } };
		this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
		this.video.srcObject = this.stream;
		await this.video.play();
		const track = this.stream.getVideoTracks()[0];
		const s = track?.getSettings?.() || {};
		this.deviceId = s.deviceId || deviceId;
		// webcam (sin facingMode) o frontal → espejo; trasera → sin espejo
		this.mirror = s.facingMode ? s.facingMode === 'user' : true;
		return s;
	}

	get width() { return this.video.videoWidth; }
	get height() { return this.video.videoHeight; }

	stop() {
		if (this.stream) this.stream.getTracks().forEach((t) => t.stop());
		this.stream = null;
		this.video.srcObject = null;
	}
}
