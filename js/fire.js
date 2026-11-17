// ─────────────────────────────────────────────────────────────
//  Fuego procedural con el estilo gráfico de PICAFUEGO
//  (rojo → naranja → ámbar → crema). Se usa en:
//   · la escena de realidad aumentada (llamas alrededor del chile)
//   · el filtro facial (fuego en la boca)
//   · la pantalla de inicio
// ─────────────────────────────────────────────────────────────

const LAYERS = [
	{ k: 1.00, a: '#d9271f', b: '#ff7a1c', dt: 0.0 },
	{ k: 0.74, a: '#ff7f1e', b: '#ffbd33', dt: 0.35 },
	{ k: 0.46, a: '#ffc93c', b: '#fff1b0', dt: 0.7 },
];

function flamePath(ctx, w, h, t, seed) {
	const s1 = Math.sin(t * 6.1 + seed * 1.7);
	const s2 = Math.sin(t * 9.3 + seed * 3.1);
	const s3 = Math.sin(t * 4.3 + seed);
	const tipX = (s1 * 0.22 + s3 * 0.10) * w;
	const lick = s2 * 0.10 * w;
	const tipY = -h * (1 + 0.04 * s2);
	ctx.beginPath();
	ctx.moveTo(0, 0);
	ctx.bezierCurveTo(-0.70 * w, -0.04 * h, -0.62 * w + lick, -0.46 * h, -0.16 * w + tipX * 0.5, -0.74 * h);
	ctx.bezierCurveTo(-0.02 * w + tipX * 0.8, -0.86 * h, tipX * 0.7 - 0.05 * w, -0.93 * h, tipX, tipY);
	ctx.bezierCurveTo(0.14 * w + tipX * 0.6, -0.72 * h, 0.72 * w - lick, -0.58 * h, 0.58 * w, -0.26 * h);
	ctx.bezierCurveTo(0.52 * w, -0.05 * h, 0.26 * w, 0, 0, 0);
	ctx.closePath();
}

/**
 * Dibuja una llama con la base en (x, y) y la punta apuntando "hacia arriba"
 * (se puede rotar con `rot`, en radianes).
 */
export function drawFlame(ctx, x, y, w, h, t, seed = 0, rot = 0, alpha = 1) {
	ctx.save();
	ctx.translate(x, y);
	ctx.rotate(rot);
	ctx.globalAlpha *= alpha;
	for (const L of LAYERS) {
		ctx.save();
		ctx.scale(L.k, L.k);
		const g = ctx.createLinearGradient(0, 0, 0, -h);
		g.addColorStop(0, L.a);
		g.addColorStop(1, L.b);
		ctx.fillStyle = g;
		flamePath(ctx, w, h, t + L.dt, seed + L.dt * 3);
		ctx.fill();
		ctx.restore();
	}
	ctx.restore();
}

/** Resplandor suave (aditivo) */
export function drawGlow(ctx, x, y, r, alpha = 0.35) {
	const g = ctx.createRadialGradient(x, y, 0, x, y, r);
	g.addColorStop(0, `rgba(255,170,40,${alpha})`);
	g.addColorStop(0.5, `rgba(255,90,20,${alpha * 0.45})`);
	g.addColorStop(1, 'rgba(255,60,10,0)');
	ctx.save();
	ctx.globalCompositeOperation = 'lighter';
	ctx.fillStyle = g;
	ctx.beginPath();
	ctx.arc(x, y, r, 0, Math.PI * 2);
	ctx.fill();
	ctx.restore();
}

const EMBER_COLORS = ['#ffe08a', '#ffb02e', '#ff7a1c', '#ff4d2a'];

/** Chispas que suben y se apagan */
export class Embers {
	constructor(max = 40) {
		this.max = max;
		this.list = [];
	}
	emit(x, y, { spreadX = 10, vx = 0, vy = -60, size = 3, life = 1.1, dirX = 0, dirY = -1 } = {}) {
		if (this.list.length >= this.max) this.list.shift();
		const speed = 40 + Math.random() * 70;
		this.list.push({
			x: x + (Math.random() - 0.5) * spreadX,
			y,
			vx: vx + dirX * speed + (Math.random() - 0.5) * 40,
			vy: vy * 0 + dirY * speed + (Math.random() - 0.5) * 20,
			size: size * (0.5 + Math.random()),
			life,
			age: 0,
			col: EMBER_COLORS[(Math.random() * EMBER_COLORS.length) | 0],
		});
	}
	update(dt) {
		for (let i = this.list.length - 1; i >= 0; i--) {
			const p = this.list[i];
			p.age += dt;
			if (p.age >= p.life) { this.list.splice(i, 1); continue; }
			p.x += p.vx * dt;
			p.y += p.vy * dt;
			p.vx *= 0.99;
		}
	}
	draw(ctx) {
		ctx.save();
		ctx.globalCompositeOperation = 'lighter';
		for (const p of this.list) {
			const k = 1 - p.age / p.life;
			ctx.globalAlpha = Math.max(0, k);
			ctx.fillStyle = p.col;
			ctx.beginPath();
			ctx.arc(p.x, p.y, Math.max(0.4, p.size * k), 0, Math.PI * 2);
			ctx.fill();
		}
		ctx.restore();
	}
}
