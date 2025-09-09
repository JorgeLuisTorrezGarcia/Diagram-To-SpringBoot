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




const systemInstruction = "You are a specialized UML diagram generator. Your only task is to convert natural language descriptions into a structured JSON format. NEVER include any explanatory text, conversational phrases, or additional code. Your response MUST be ONLY the JSON object. The JSON should follow this exact structure: { 'classes': [ { 'id': string, 'name': string, 'attributes': [ { 'name': string, 'type': string } ] } ], 'relationships': [ { 'id': string, 'sourceId': string, 'targetId': string, 'type': string } ] }. Ensure IDs are unique and short (max 9 chars). Relationship 'type' must be one of: 'one_to_one', 'one_to_many', 'many_to_many', 'many_to_one'. The attributes should have a 'name' and a 'type'. For example, if a user asks for 'a class called User with a name attribute and an id', you should generate: { 'classes': [ { 'id': 'uniqueid1', 'name': 'User', 'attributes': [ { 'name': 'name', 'type': 'String' }, { 'name': 'id', 'type': 'Long' } ] } ], 'relationships': [] }. If a relationship is mentioned like 'a User can have many Products', you should create a 'one_to_many' relationship between them. If no relationships are described, the 'relationships' array should be empty. Return the JSON object directly and nothing else.";

// Endpoint para la generación de diagramas con IA
router.post('/api/ai/generate-model', async (req, res) => {
	try {
		const userPrompt = req.body.prompt;
		if (!userPrompt) {
			return res.status(400).json({ error: 'Prompt is missing in the request body.' });
		}

		// Combinar las instrucciones del sistema con el prompt del usuario
		const fullPrompt = `${systemInstruction}\n\nUser Request: ${userPrompt}`;

		const response = await ai.models.generateContent({
			model: "gemini-2.0-flash",
			contents: [{
				parts: [{ text: fullPrompt }]
			}]
		});

		if (!response || !response.response) {
			throw new Error('No response from AI model');
		}

		let jsonResponseText = response.response.text().trim();

		if (jsonResponseText.startsWith('```json')) {
			jsonResponseText = jsonResponseText.substring(7, jsonResponseText.lastIndexOf('```'));
		}

		const diagramData = JSON.parse(jsonResponseText);

		res.json(diagramData);

	} catch (error) {
		console.error('Error al comunicarse con la API de Gemini:', error);
		res.status(500).json({ error: 'Failed to generate model from AI.' });
	}
});


module.exports = router;