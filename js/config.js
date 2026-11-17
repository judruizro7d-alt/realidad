// ─────────────────────────────────────────────────────────────
//  PICAFUEGO · configuración central
//  Aquí se enlazan iconos ↔ tarjetas ↔ sonidos y las rutas de
//  los recursos. Para cambiar un recurso, reemplaza el archivo
//  (mismo nombre) o edita la ruta en este archivo.
// ─────────────────────────────────────────────────────────────

export const CONFIG = {

	// Imagen objetivo (la que se imprime / se muestra en otra pantalla).
	// targets.mind se generó a partir de imagenescaneable.png.
	marker: {
		mind: 'assets/marker/targets.mind',
		image: 'assets/marker/imagenescaneable.png',
		targetIndex: 0,
	},

	// Personaje
	chile: 'assets/img/chile.png',
	logo: 'assets/img/logo.png',

	// Los 3 botones. El número del icono coincide con el número de la tarjeta
	// (icono-1 ↔ tarjeta-1, etc.). Si quieres otro orden, intercambia aquí.
	sections: [
		{
			id: 'artesanal',
			label: 'Hecho artesanal',
			icon: 'assets/img/icono-1.png',
			card: 'assets/img/tarjeta-1.png',
			sound: 'crunch',
			// Zona táctil sobre la “X” que ya trae la imagen (fracción del ancho/alto de la tarjeta)
			close: { x: 0.891, y: 0.180, r: 0.07 },
		},
		{
			id: 'ingredientes',
			label: 'Ingredientes',
			icon: 'assets/img/icono-2.png',
			card: 'assets/img/tarjeta-2.png',
			sound: 'sizzle',
			close: { x: 0.857, y: 0.170, r: 0.07 },
		},
		{
			id: 'picante',
			label: 'Nivel de picante',
			icon: 'assets/img/icono-3.png',
			card: 'assets/img/tarjeta-3.png',
			sound: 'flare',
			close: { x: 0.872, y: 0.170, r: 0.07 },
		},
	],

	// Filtro facial. Para usar tu propio bigote: coloca bigote.png (fondo transparente)
	// en assets/face/ y cambia la ruta de abajo.
	face: {
		mustache: 'assets/face/bigote.svg',
		cheekChile: 'assets/img/chile.png',
		// MediaPipe Face Mesh (local, sin CDN)
		meshPath: 'js/facemesh/',
	},

	audio: {
		masterVolume: 0.5,
		maxSeconds: 3, // tope duro por efecto
	},
};
