const connection = require('../database/db');

class MProyecto {
    constructor() {
        this.table = 'proyecto'; // Nombre de la tabla de proyectos en la base de datos
    }

    async listarProyectos() {
        try {
            const sql = 'SELECT * FROM ' + this.table;
            const [rows] = await connection.promise().query(sql);
            console.log("CONTENIDO:"+[rows]);
            return rows;
        } catch (error) {
            throw error;
        }
    }

    async update(id, newData) {
        try {
            console.log("UPDATE"+newData);     
            
            const sql = 'UPDATE ' + this.table + ' SET objetos = ? WHERE id = ?';
            await connection.promise().query(sql, [JSON.stringify(newData), id]);
        } catch (error) {
            throw error;
        }
    }    
    

    async crearProyecto(Proyecto) {
        try {
            const sql = 'INSERT INTO ' + this.table + ' SET ?';
            const nuevoProyecto = {
                name: Proyecto.name,
                link: Proyecto.link,
                user_id: Proyecto.user_id,
                
            };
            const [result] = await connection.promise().query(sql, nuevoProyecto);
            return result.insertId;
        } catch (error) {
            throw error;
        }
    }

    async find(id) {
        try {
            const sql = 'SELECT * FROM ' + this.table + ' WHERE id = ?';
            const [rows] = await connection.promise().query(sql, id);
    
            if (rows.length === 1) {
                return rows[0]; 
            } else {
                throw new Error('Proyecto no encontrado'); // Si no se encontró ninguna tupla con ese ID
            }
        } catch (error) {
            throw error;
        }
    }
    
    
}

module.exports = MProyecto;
