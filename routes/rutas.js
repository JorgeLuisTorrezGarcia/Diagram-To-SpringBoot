const express = require('express');
const router = express.Router();
const multer = require('multer');
const { GoogleGenAI } = require('@google/genai');
const dotenv = require('dotenv');
dotenv.config({ path: './env/.env' });

// Configuración de la API de Gemini
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

//  Invocamos a la conexion de la DB
const connection = require('../database/db');
/* importamos el Model */
const MProyecto = require('../model/MProyecto');

const mProyecto = new MProyecto();

//  Invocamos a bcrypt
const bcrypt = require('bcryptjs');

const ProyectoDTO = require('../interface/system');
// Multer para recibir archivos
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });


/**   RUTAS  **/

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
		const description = req.body.description || req.body.description_text;
		if (!description && !req.file) {
			return res.status(400).json({ error: 'Se requiere al menos una descripción o una imagen.' });
		}

		// Construir partes del prompt
		const parts = [];

		// 1. Añadir el texto del prompt con la descripción y las reglas
		let promptText = `Eres un experto en modelado UML. Genera un array de objetos JSON para un diagramador colaborativo. El JSON debe estar delimitado por marcas de código (fences) del tipo \`\`\`json.
FORMATO EXACTO REQUERIDO:

PARA CLASES (type: "UMLClass"):
{ "id": "string_aleatorio_único", "x": número, "y": número, "name": "NombreClase", "attributes": ["nombre:Tipo"], "width": 150, "height": 60, "type": "UMLClass" }

PARA RELACIONES (type: "UMLRelationship"):
{ "id": "string", "from": "id_origen_clase", "to": "id_destino_clase", "relationType": "one_to_many", "type": "UMLRelationship" }

IMPORTANTE: 
1. Responde ÚNICAMENTE con el array JSON dentro de las marcas de código, sin texto adicional.
2. Asegura que el valor de la propiedad "from" sea el "id" exacto de la clase de origen, y el valor de "to" sea el "id" exacto de la clase de destino.
3. El formato de los atributos en las clases debe ser "nombre:Tipo".
3.1 El TIPO deben ser los que se usan en Spring Boot y bases de datos (String, Integer, Long, Double, Float, Boolean, Date, LocalDate, LocalDateTime, BigDecimal).
4. Los tipos de relación soportados son: "one_to_one", "one_to_many", "many_to_one", y "many_to_many".
`;

		if (description) {
			promptText = `DESCRIPCIÓN: "${description}"\n\n` + promptText;
		}
		// Agregar la parte de texto
		parts.push({ text: promptText });

		// Si hay imagen adjunta
		if (req.file) {
			parts.push({
				inlineData: {
					data: req.file.buffer.toString('base64'),
					mimeType: req.file.mimetype || 'image/png'
				}
			});
		}

		const responseObj = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: [
				{
					parts: parts
				}
			],
			// opcional: configurar thinkingBudget, temperatura, etc.
			config: {
				thinkingConfig: {
					thinkingBudget: 0  // ejemplo: desactivar thinking si quieres rapidez
				}
			}
		});

		const generatedText = responseObj.text;  

		// Extraer JSON del texto generado
		const jsonMatch = generatedText.match(/```json\n([\s\S]*?)\n```/);
		if (!jsonMatch || jsonMatch.length < 2) {
			throw new Error('No se pudo extraer el JSON de la respuesta de Gemini.');
		}

		const jsonString = jsonMatch[1];
		let diagramData;
		try {
			diagramData = JSON.parse(jsonString);
		} catch (e) {
			throw new Error('Formato JSON inválido: ' + e.message);
		}

		// Normalizar classes y relaciones
		const idMap = {};
		const normalizedClasses = [];
		const normalizedRels = [];

		diagramData.forEach(item => {
			if (item.type === 'UMLClass') {
				const newId = '_' + Math.random().toString(36).substr(2, 9);
				idMap[item.id] = newId;
				normalizedClasses.push({
					id: newId,
					x: Number(item.x) || 100,
					y: Number(item.y) || 100,
					name: item.name || 'NewClass',
					attributes: Array.isArray(item.attributes) ? item.attributes.filter(a => typeof a === 'string') : [],
					width: 150,
					height: 60 + (Array.isArray(item.attributes) ? item.attributes.length * 20 : 20),
					type: 'UMLClass'
				});
			}
		});

		diagramData.forEach(item => {
			if (item.type === 'UMLRelationship') {
				normalizedRels.push({
					id: '_' + Math.random().toString(36).substr(2, 9),
					from: idMap[item.from] || item.from,
					to: idMap[item.to] || item.to,
					relationType: ['one_to_one', 'one_to_many', 'many_to_one', 'many_to_many'].includes(item.relationType)
						? item.relationType
						: 'one_to_one',
					type: 'UMLRelationship'
				});
			}
		});

		const validatedData = [...normalizedClasses, ...normalizedRels];

		res.json({ success: true, objetos: validatedData, message: 'Elementos generados exitosamente' });
	} catch (error) {
		console.error('Error generating diagram:', error);
		res.status(500).json({ error: 'Error interno del servidor', details: error.message });
	}
});

module.exports = router;
