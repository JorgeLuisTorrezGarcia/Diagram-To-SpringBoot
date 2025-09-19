const expres = require("express");

const router = expres.Router();

const dotenv = require('dotenv');
dotenv.config({ path: './env/.env' });

// Importar la nueva versión del SDK de Google AI
const { GoogleGenAI } = require('@google/genai');

// Configuración de la API de Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
//  Invocamos a la conexion de la DB
const connection = require('../database/db');
/* importamos el Model */
const MProyecto = require('../model/MProyecto');
const mProyecto = new MProyecto();
//	Invocamos a bcrypt
const bcrypt = require('bcryptjs');

const ProyectoDTO = require('../interface/system');
// Multer para recibir archivos
const multer = require('multer');
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });


/**   RUTAS  **/

router.get('/login', (req, res) => {
	res.render('../views/login.ejs');
})

router.get('/register', (req, res) => {
	res.render('register');
})

router.get('/createproyecto', (req, res) => {
	res.render('create', {
		login: true,
		name: req.session.name,
		user_id: req.session.user_id,
	});
})

//10 - Método para REGISTRARSE
router.post('/register', async (req, res) => {
	const user = req.body.user;
	const name = req.body.name;
	const rol = req.body.rol;
	const pass = req.body.pass;
	let passwordHash = await bcrypt.hash(pass, 8);
	connection.query('INSERT INTO users SET ?', { user: user, name: name, rol: rol, pass: passwordHash }, async (error, results) => {
		if (error) {
			console.log(error);
		} else {
			res.render('register', {
				alert: true,
				alertTitle: "Regitro",
				alertMessage: "Te registraste correctamente!",
				alertIcon: 'success',
				showConfirmButton: false,
				timer: 1500,
				ruta: 'login'
			});
		}
	});
})

//10 - Método para la REGISTRACIÓN
router.post('/store', async (req, res) => {
	const name = req.body.name;
	const user_id = req.session.user_id;
	const link = `http://localhost:3000/pizarra/` + name;
	const nuevoProyectoDTO = new ProyectoDTO(name, link, user_id);
	mProyecto.crearProyecto(nuevoProyectoDTO)
		.then((insertId) => {

			res.render('create', {
				alert: true,
				name: name,
				alertTitle: "Registro Correcto",
				alertMessage: "¡Registro exitoso!",
				alertIcon: 'success',
				showConfirmButton: false,
				timer: 1500,
				ruta: ''
			});
		})
		.catch((error) => {
			console.error(error);
		});
});

router.post('/update', async (req, res) => {
	try {
		const { id, newData } = req.body;

		mProyecto.update(id, newData);
		res.status(200).json({ message: 'Datos actualizados con éxito' });
	} catch (error) {
		res.status(500).json({ error: 'Error al actualizar datos' });
	}
});

// Ruta para generar diagrama con Gemini (acepta multipart/form-data con campo 'image')
router.post('/generate-diagram', upload.single('image'), async (req, res) => {
	try {
		// description puede venir en req.body (JSON) o como campo de form-data
		const description = req.body.description || req.body.description_text;

		console.log("Solicitud recibida para generar diagrama. Description present?", !!description, "file present?", !!req.file);

		if (!description && !req.file) {
			return res.status(400).json({ error: 'Se requiere al menos una descripción o una imagen.' });
		}

		// Preparar prompt base
		let prompt = `Eres un experto en modelado UML. Genera un array de objetos JSON para un diagramador colaborativo.\n\n`;

		if (description) {
			prompt += `DESCRIPCIÓN: "${description}"\n\n`;
		}

		// Si se recibió una imagen, convertir a base64 y anexar (nota: algunos modelos no procesan binarios; esto es un fallback)
		if (req.file) {
			try {
				const mime = req.file.mimetype || 'image/png';
				const base64 = req.file.buffer.toString('base64');
				prompt += `IMAGEN_EN_BASE64_MIME:${mime}_BEGIN:${base64}:END\n\n`;
			} catch (e) {
				console.error('Error procesando la imagen:', e);
			}
		}

		// Añadir instrucciones de formato exacto
		prompt += `FORMATO EXACTO REQUERIDO:\n\n`;
		prompt += `PARA CLASES (type: "UMLClass"):\n{ \"id\": \"string_aleatorio_único\", \"x\": número, \"y\": número, \"name\": \"NombreClase\", \"attributes\": [\"nombre:Tipo\"], \"width\": 150, \"height\": 60, \"type\": \"UMLClass\" }\n`;
		prompt += `PARA RELACIONES (type: \"UMLRelationship\"):\n{ \"id\": \"string\", \"from\": \"id_origen\", \"to\": \"id_destino\", \"relationType\": \"one_to_many\", \"type\": \"UMLRelationship\" }\n\n`;
		prompt += `IMPORTANTE: Responde solo con el array JSON válido, sin texto adicional, ni marcas de código.\n`;

		console.log("Prompt preparado (longitud):", prompt.length);

		// Llamar a la API de Gemini
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: prompt,
			config: { temperature: 0.1, maxOutputTokens: 2000 }
		});

		// El resto del procesamiento sigue igual (parseo, validación)
		let diagramData;

		// Helper: intenta extraer y reparar un array JSON desde un texto dado
		function extractAndRepairJsonArray(text) {
			if (!text) return null;
			// Eliminar fences de código
			let s = text.replace(/```(?:json)?/gi, '').trim();

			const first = s.indexOf('[');
			if (first === -1) return null;

			// Intentar localizar cierre correspondiente balanceando corchetes
			let depth = 0;
			let inString = false;
			let escape = false;
			let endIndex = -1;
			for (let i = first; i < s.length; i++) {
				const ch = s[i];
				if (escape) { escape = false; continue; }
				if (ch === '\\') { escape = true; continue; }
				if (ch === '"') { inString = !inString; continue; }
				if (inString) continue;
				if (ch === '[') depth++;
				else if (ch === ']') {
					depth--;
					if (depth === 0) { endIndex = i; break; }
				}
			}

			let candidate;
			if (endIndex !== -1) {
				candidate = s.substring(first, endIndex + 1);
			} else {
				// No se encontró cierre: tomar desde first hasta el final y tratar de reparar
				candidate = s.substring(first);
				// Balancear corchetes: contar y añadir cierres si faltan
				let openCount = 0;
				for (let ch of candidate) { if (ch === '[') openCount++; else if (ch === ']') openCount--; }
				while (openCount > 0) { candidate += ']'; openCount--; }
			}

			// Eliminar comas finales antes de cerrar objetos/arrays: "..., ]" -> "]"
			candidate = candidate.replace(/,\s*(?=[\]}])/g, '');

			return candidate;
		}

		// Intentos de parsing con varias heurísticas
		// Extraer de forma segura el texto generado por el SDK; los campos pueden variar según versión
		const generatedText = (response && (response.text || (response.outputs && response.outputs[0] && response.outputs[0].content && response.outputs[0].content[0] && response.outputs[0].content[0].text))) || '';
		const raw = generatedText || '';
		let jsonCandidate = extractAndRepairJsonArray(raw);
		let parsed = null;

		const tryParse = (str) => {
			try {
				return JSON.parse(str);
			} catch (e) {
				return null;
			}
		};

		if (jsonCandidate) {
			parsed = tryParse(jsonCandidate);
		}

		if (!parsed) {
			// Si no pudo parsear, intentar recortar hasta el último '}' y cerrar array
			if (jsonCandidate) {
				const lastObjEnd = jsonCandidate.lastIndexOf('}');
				if (lastObjEnd > 0) {
					let trimmed = jsonCandidate.substring(0, lastObjEnd + 1);
					// Asegurar que esté entre corchetes
					if (trimmed[0] !== '[') trimmed = '[' + trimmed + ']';
					// Eliminar comas finales
					trimmed = trimmed.replace(/,\s*(?=[\]}])/g, '');
					parsed = tryParse(trimmed);
					if (parsed) jsonCandidate = trimmed;
				}
			}
		}

		if (!parsed) {
			// Último recurso: extraer objetos JSON independientes con regex y envolverlos en array
			const objs = [];
			const re = /\{[^}]*\}/g;
			let m;
			while ((m = re.exec(raw)) !== null) {
				// intentar parsear cada objeto
				const objStr = m[0].replace(/,\s*(?=[\]}])/g, '');
				const o = tryParse(objStr);
				if (o) objs.push(o);
			}
			if (objs.length > 0) parsed = objs;
		}

		if (!parsed) {
			console.error('No se pudo parsear la respuesta de Gemini. Preview:', (raw || '').substring(0, 2000));
			throw new Error('Failed to parse AI response');
		}

		diagramData = parsed;

		// Normalizar estructura: primero normalizar clases y construir mapa de ids
		const idMap = Object.create(null);
		const normalizedClasses = [];

		diagramData.forEach(item => {
			if (item.type === 'UMLClass') {
				const origId = item.id || ('_' + Math.random().toString(36).substr(2, 9));
				const newId = origId.startsWith('_') ? origId : ('_' + Math.random().toString(36).substr(2, 9));
				idMap[origId] = newId;
				normalizedClasses.push({
					id: newId,
					x: Math.max(50, Math.min(1200, Number(item.x) || 100 + Math.random() * 1000)),
					y: Math.max(50, Math.min(700, Number(item.y) || 100 + Math.random() * 500)),
					name: item.name || 'NewClass',
					attributes: Array.isArray(item.attributes) ? item.attributes.filter(attr => typeof attr === 'string') : ['attribute1'],
					width: 150,
					height: 60 + (Array.isArray(item.attributes) ? item.attributes.length * 20 : 20),
					type: 'UMLClass'
				});
			}
		});

		// Normalizar relaciones usando idMap (si no existe mapping, intentar mantener id original o generar nuevo id)
		const normalizedRels = [];
		diagramData.forEach(item => {
			if (item.type === 'UMLRelationship') {
				const origFrom = item.from || '';
				const origTo = item.to || '';
				const mappedFrom = idMap[origFrom] || origFrom;
				const mappedTo = idMap[origTo] || origTo;
				const validRelations = ['one_to_one', 'one_to_many', 'many_to_one', 'many_to_many'];
				normalizedRels.push({
					id: item.id && item.id.startsWith('_') ? item.id : ('_' + Math.random().toString(36).substr(2, 9)),
					from: mappedFrom,
					to: mappedTo,
					relationType: validRelations.includes(item.relationType) ? item.relationType : 'one_to_one',
					type: 'UMLRelationship'
				});
			}
		});

		const validatedData = [...normalizedClasses, ...normalizedRels];

		console.log('Datos validados:', validatedData);
		res.json({ success: true, objetos: validatedData, message: 'Elementos generados exitosamente' });

	} catch (error) {
		console.error('Error generating diagram:', error);
		res.status(500).json({ error: 'Error interno del servidor' });
	}
});

module.exports = router;