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

// Ruta para generar diagrama con Gemini
router.post('/generate-diagram', async (req, res) => {
	try {
		const { description } = req.body;

		console.log("Solicitud recibida para generar diagrama:", description);

		if (!description) {
			return res.status(400).json({
				error: 'Se requiere una descripción del diagrama'
			});
		}

		// Prompt para Gemini
		const prompt = `
Eres un experto en modelado UML. Genera un array de objetos JSON para un diagramador colaborativo.

DESCRIPCIÓN: "${description}"

FORMATO EXACTO REQUERIDO:

PARA CLASES (type: "UMLClass"):
{
  "id": "string_aleatorio_único (ej: _6fbn4scda)",
  "x": número entre 50 y 1200,
  "y": número entre 50 y 700,
  "name": "NombreClase",
  "attributes": ["nombre:Tipo", "nombre:Tipo"],
  "width": 150,
  "height": 60 + (20 * número_de_atributos),
  "type": "UMLClass"
}

PARA RELACIONES (type: "UMLRelationship"):
{
  "id": "string_aleatorio_único",
  "from": "id_clase_origen",
  "to": "id_clase_destino",
  "relationType": "one_to_one" // o "one_to_many", "many_to_one", "many_to_many"
  "type": "UMLRelationship"
}

IMPORTANTE: Responde SOLAMENTE con el array JSON válido, sin texto adicional, sin marcas de código, ni explicaciones.

Ejemplo de respuesta válida:
[
  {
    "id": "_6fbn4scda",
    "x": 647,
    "y": 475,
    "name": "Cliente",
    "attributes": ["id:Long", "nombre:String"],
    "width": 150,
    "height": 100,
    "type": "UMLClass"
  }
]
`;

		console.log("Enviando prompt a Gemini...");

		// Llamar a la API de Gemini
		const response = await ai.models.generateContent({
			model: 'gemini-2.5-flash',
			contents: prompt,
			config: {
				temperature: 0.1,
				maxOutputTokens: 2000,
			}
		});

		const generatedText = response.text;
		console.log("Respuesta cruda de Gemini:", generatedText);

		let diagramData;

		try {
			// Intentar extraer JSON de la respuesta
			let jsonString = generatedText;

			// Limpiar la respuesta - eliminar marcas de código si existen
			jsonString = jsonString.replace(/```json|```/g, '').trim();

			// Buscar el primer [ y el último ] para extraer el array JSON
			const firstBracket = jsonString.indexOf('[');
			const lastBracket = jsonString.lastIndexOf(']');

			if (firstBracket !== -1 && lastBracket !== -1) {
				jsonString = jsonString.substring(firstBracket, lastBracket + 1);
			}

			console.log("Texto procesado para parsing:", jsonString);

			diagramData = JSON.parse(jsonString);
			console.log("JSON parseado correctamente:", diagramData);

			// Validar y normalizar la estructura
			const validatedData = diagramData.map(item => {
				if (item.type === 'UMLClass') {
					return {
						id: item.id && item.id.startsWith('_') ? item.id : '_' + Math.random().toString(36).substr(2, 9),
						x: Math.max(50, Math.min(1200, Number(item.x) || 100 + Math.random() * 1000)),
						y: Math.max(50, Math.min(700, Number(item.y) || 100 + Math.random() * 500)),
						name: item.name || 'NewClass',
						attributes: Array.isArray(item.attributes) ?
							item.attributes.filter(attr => typeof attr === 'string') : ['attribute1'],
						width: 150,
						height: 60 + (Array.isArray(item.attributes) ? item.attributes.length * 20 : 20),
						type: 'UMLClass'
					};
				} else if (item.type === 'UMLRelationship') {
					const validRelations = ['one_to_one', 'one_to_many', 'many_to_one', 'many_to_many'];
					return {
						id: item.id && item.id.startsWith('_') ? item.id : '_' + Math.random().toString(36).substr(2, 9),
						from: item.from || '',
						to: item.to || '',
						relationType: validRelations.includes(item.relationType) ?
							item.relationType : 'one_to_one',
						type: 'UMLRelationship'
					};
				}
				return item;
			});

			console.log("Datos validados:", validatedData);

			res.json({
				success: true,
				objetos: validatedData,
				message: 'Elementos generados exitosamente'
			});

		} catch (parseError) {
			console.error('Error parsing Gemini response:', parseError);
			console.error('Respuesta completa de Gemini:', generatedText);
			res.status(500).json({
				error: 'Error al procesar la respuesta de la IA. Ver consola para detalles.'
			});
		}

	} catch (error) {
		console.error('Error generating diagram:', error);
		res.status(500).json({
			error: 'Error interno del servidor'
		});
	}
});

module.exports = router;