
const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d');
const socket = io();

// Global State
let objetos = [];
let activeTool = 'select'; // Default tool
let selectedClass = null;
let relationshipStartClass = null;
let isDragging = false;
let tempLine = null; // For drawing relationship preview
let offsetX, offsetY;

const pizarraId = document.getElementById('pizarra_id').value;

// ==================================================
// SOCKET.IO EVENT HANDLING
// ==================================================

socket.emit('unirse', { pizarraId: pizarraId });

socket.on('dibujo', (data) => {
  const { pizarraId: id, objeto, objetos: objetosRecibidos, accion } = data;

  if (id === pizarraId) {
    switch (accion) {
      case 'agregar':
        const nuevoObjeto = deserializeObject(objeto);
        if (!objetos.find(o => o.id === nuevoObjeto.id)) {
          objetos.push(nuevoObjeto);
        }
        break;

      case 'mover':
        const objetoMovido = deserializeObject(objeto);
        const indexMover = objetos.findIndex(o => o.id === objetoMovido.id);
        if (indexMover !== -1) {
          objetos[indexMover] = objetoMovido;
        }
        break;

      case 'eliminar':
        objetos = objetos.filter(o => o.id !== objeto.id);
        break;

      case 'actualizar':
        const objetoActualizado = deserializeObject(objeto);
        const indexActualizar = objetos.findIndex(o => o.id === objetoActualizado.id);
        if (indexActualizar !== -1) {
          objetos[indexActualizar] = objetoActualizado;
        }
        break;

      case 'sincronizar':
        if (objetosRecibidos) {
          objetos = objetosRecibidos.map(obj => deserializeObject(obj));
        }
        break;

      default:
        console.log(`Unknown action: ${accion}`);
    }
    repaintCanvas();
  }
});

// ==================================================
// CANVAS & DRAWING FUNCTIONS
// ==================================================

function repaintCanvas() {
  context.clearRect(0, 0, canvas.width, canvas.height);

  const classes = objetos.filter(o => o.type === 'UMLClass');
  const relationships = objetos.filter(o => o.type === 'UMLRelationship');

  // Draw relationships first
  for (let rel of relationships) {
    rel.draw(context, classes);
  }

  // Draw classes on top
  for (let cls of classes) {
    cls.draw(context);
  }

  // Draw temporary line for relationship creation
  if (tempLine) {
    context.beginPath();
    context.moveTo(tempLine.from.x, tempLine.from.y);
    context.lineTo(tempLine.to.x, tempLine.to.y);
    context.stroke();
  }
}

function adjustCanvasSize() {
  canvas.width = window.innerWidth * 0.9;
  canvas.height = window.innerHeight * 0.8;
  repaintCanvas();
}

// ==================================================
// EVENT LISTENERS & WORKFLOW
// ==================================================

// Canvas Listeners
canvas.addEventListener('mousedown', (e) => {
  const { x, y } = getMousePos(e);
  const clickedClass = findClassAt(x, y);

  switch (activeTool) {
    case 'select':
      if (clickedClass) {
        selectedClass = clickedClass;
        isDragging = true;
        offsetX = x - selectedClass.x;
        offsetY = y - selectedClass.y;
        canvas.style.cursor = 'grabbing';
      }
      break;

    case 'class':
      const newClass = new UMLClass(generateUniqueId(), x - 75, y - 50, 'NewClass', ['attribute1']);
      objetos.push(newClass);
      selectedClass = newClass;
      emitSocketEvent('agregar', newClass);

      // Mostrar el modal de edición inmediatamente después de crear la clase
      document.getElementById('classModal').style.display = 'block';
      document.getElementById('className').value = selectedClass.name;
      document.getElementById('classAttributes').value = selectedClass.attributes.join('\n');

      repaintCanvas();
      break;

    case 'many_to_one':
    case 'one_to_one':
    case 'one_to_many':
    case 'many_to_many':
      if (clickedClass) {
        relationshipStartClass = clickedClass;
        tempLine = { from: { x, y }, to: { x, y } };
      }
      break;

    case 'delete':
      if (clickedClass) {
        // Remove class and any connected relationships
        objetos = objetos.filter(obj => obj.id !== clickedClass.id && obj.from !== clickedClass.id && obj.to !== clickedClass.id);
        emitSocketEvent('eliminar', { id: clickedClass.id, type: 'UMLClass' });
      } else {
        const clickedRel = findRelationshipAt(x, y);
        if (clickedRel) {
          objetos = objetos.filter(obj => obj.id !== clickedRel.id);
          emitSocketEvent('eliminar', clickedRel);
        }
      }
      repaintCanvas();
      break;
  }
});

canvas.addEventListener('mousemove', (e) => {
  const { x, y } = getMousePos(e);

  if (activeTool === 'select' && isDragging && selectedClass) {
    selectedClass.x = x - offsetX;
    selectedClass.y = y - offsetY;
    // Throttle socket events for performance if needed
    emitSocketEvent('mover', selectedClass);
    repaintCanvas();
  } else if (relationshipStartClass && tempLine) {
    tempLine.to = { x, y };
    repaintCanvas();
  }
});

canvas.addEventListener('mouseup', (e) => {
  const { x, y } = getMousePos(e);

  if (activeTool === 'select') {
    isDragging = false;
    selectedClass = null;
    canvas.style.cursor = 'grab';
  }

  if (relationshipStartClass) {
    const endClass = findClassAt(x, y);
    if (endClass && endClass.id !== relationshipStartClass.id) {
      const newRelationship = new UMLRelationship(
        generateUniqueId(),
        relationshipStartClass.id,
        endClass.id,
        activeTool // Use the tool name as the relationType
      );
      objetos.push(newRelationship);
      emitSocketEvent('agregar', newRelationship);
    }
    relationshipStartClass = null;
    tempLine = null;
    repaintCanvas();
  }
});

canvas.addEventListener('dblclick', (e) => {
  const { x, y } = getMousePos(e);
  const clickedClass = findClassAt(x, y);
  if (clickedClass) {
    selectedClass = clickedClass;
    document.getElementById('classModal').style.display = 'block';
    document.getElementById('className').value = selectedClass.name;
    document.getElementById('classAttributes').value = selectedClass.attributes.join('\n');
  }
});

// Toolbar & Modal Listeners
function setupToolbar() {
  const tools = document.querySelectorAll('.tool-button');
  tools.forEach(button => {
    button.addEventListener('click', () => {
      // Remover la clase active de todos los botones
      tools.forEach(b => b.classList.remove('active'));
      // Agregar la clase active al botón seleccionado
      button.classList.add('active');
      // Actualizar la herramienta activa
      activeTool = button.id.replace('tool-', '');
      updateCursor();
    });
  });

  // Configurar eventos para los botones de acción
  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    saveButton.addEventListener('click', saveCanvas);
  }

  const exportButton = document.getElementById('exportImageButton');
  if (exportButton) {
    exportButton.addEventListener('click', exportAsImage);
  }

  const downloadButton = document.getElementById('downloadJavaButton');
  if (downloadButton) {
    downloadButton.addEventListener('click', generateAndDownloadProject);
  }
}

document.getElementById('closeModal').addEventListener('click', () => {
  document.getElementById('classModal').style.display = 'none';
});

document.getElementById('saveClass').addEventListener('click', () => {
  if (selectedClass) {
    selectedClass.name = document.getElementById('className').value.trim() || 'ClassName';
    const attrs = document.getElementById('classAttributes').value.split('\n').map(attr => attr.trim()).filter(Boolean);
    selectedClass.attributes = attrs;

    emitSocketEvent('actualizar', selectedClass);
    repaintCanvas();
  }
  document.getElementById('classModal').style.display = 'none';
});

// ==================================================
// HELPER FUNCTIONS
// ==================================================

function getMousePos(e) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: e.clientX - rect.left,
    y: e.clientY - rect.top
  };
}

function findClassAt(x, y) {
  // Search in reverse to find the top-most class
  for (let i = objetos.length - 1; i >= 0; i--) {
    const obj = objetos[i];
    if (obj.type === 'UMLClass' && obj.isInside(x, y)) {
      return obj;
    }
  }
  return null;
}

function findRelationshipAt(x, y) {
  const threshold = 10; // Pixels around the line to consider a click

  // Helper function to calculate squared distance from point p to line segment v-w
  function distToSegmentSquared(p, v, w) {
    const l2 = (w.x - v.x) * (w.x - v.x) + (w.y - v.y) * (w.y - v.y);
    if (l2 === 0) return (p.x - v.x) * (p.x - v.x) + (p.y - v.y) * (p.y - v.y); // v == w, point
    let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
    t = Math.max(0, Math.min(1, t));
    const projection = { x: v.x + t * (w.x - v.x), y: v.y + t * (w.y - v.y) };
    return (p.x - projection.x) * (p.x - projection.x) + (p.y - projection.y) * (p.y - projection.y);
  }

  const classes = objetos.filter(o => o.type === 'UMLClass');

  for (let rel of objetos.filter(o => o.type === 'UMLRelationship')) {
    const fromClass = classes.find(c => c.id === rel.from);
    const toClass = classes.find(c => c.id === rel.to);

    if (fromClass && toClass) {
      // Get the actual connection points on the class boundaries
      const fromPoint = rel.getIntersectionPoint(fromClass, toClass);
      const toPoint = rel.getIntersectionPoint(toClass, fromClass);

      const distSq = distToSegmentSquared({ x, y }, fromPoint, toPoint);
      if (Math.sqrt(distSq) < threshold) {
        return rel;
      }
    }
  }
  return null;
}

function updateCursor() {
  switch (activeTool) {
    case 'class':
    case 'delete':
      canvas.style.cursor = 'crosshair';
      break;
    case 'many_to_one':
    case 'one_to_one':
    case 'one_to_many':
    case 'many_to_many':
      canvas.style.cursor = 'crosshair';
      break;
    case 'select':
      canvas.style.cursor = 'grab';
      break;
    default:
      canvas.style.cursor = 'default';
  }
}

function generateUniqueId() {
  return '_' + Math.random().toString(36).substr(2, 9);
}

function saveCanvas() {
  const diagramData = {
    pizarraId: pizarraId,
    objetos: objetos.map(obj => serializeObject(obj))
  };

  // Enviar los datos al servidor
  fetch('/guardarDiagrama', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(diagramData)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Error al guardar');
      }
      return response.text();
    })
    .then(result => {
      console.log('Diagrama guardado:', result);
      // Mostrar un mensaje de éxito
      alert('Diagrama guardado con éxito');
    })
    .catch(error => {
      console.error('Error:', error);
      alert('Error al guardar el diagrama');
    });
}

function exportAsImage() {
  const dataURL = canvas.toDataURL('image/png');
  const downloadLink = document.createElement('a');
  downloadLink.href = dataURL;
  downloadLink.download = `${document.getElementById('proyecto_name').value || 'diagrama'}.png`;
  downloadLink.click();
}

function generatePayload() {
  // Separar clases y relaciones
  const classes = objetos.filter(obj => obj.type === 'UMLClass');
  const relationships = objetos.filter(obj => obj.type === 'UMLRelationship');

  // Transformar al formato requerido
  return {
    classes: classes.map(cls => ({
      id: cls.id,
      name: cls.name,
      attributes: cls.attributes.map(attrStr => {
        // Intentar separar nombre y tipo si existe el formato "nombre:tipo"
        const parts = attrStr.split(':').map(s => s.trim());
        return parts.length > 1
          ? { name: parts[0], type: parts[1] }
          : { name: parts[0], type: 'String' }; // tipo por defecto si no se especifica
      })
    })),
    relationships: relationships.map(rel => ({
      id: rel.id,
      sourceId: rel.from,
      targetId: rel.to,
      type: rel.relationType
    }))
  };
}

function generateAndDownloadProject() {
  showMessage('Generando tu proyecto... por favor espera.', 50000);

  const payload = generatePayload();

  fetch('http://localhost:8080/api/v1/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.blob();
    })
    .then(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'spring-project.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      showMessage('¡Proyecto generado con éxito! El archivo se está descargando.', 5000);
    })
    .catch(error => {
      console.error('Error al generar el proyecto:', error);
      showMessage('Error al generar el proyecto. Revisa la consola para más detalles.', 5000);
    });
}

function showMessage(message, duration) {
  // Crear o obtener el elemento de mensaje
  let messageDiv = document.getElementById('messageDiv');
  if (!messageDiv) {
    messageDiv = document.createElement('div');
    messageDiv.id = 'messageDiv';
    messageDiv.style.position = 'fixed';
    messageDiv.style.top = '20px';
    messageDiv.style.left = '50%';
    messageDiv.style.transform = 'translateX(-50%)';
    messageDiv.style.padding = '10px 20px';
    messageDiv.style.backgroundColor = '#333';
    messageDiv.style.color = 'white';
    messageDiv.style.borderRadius = '5px';
    messageDiv.style.zIndex = '1000';
    document.body.appendChild(messageDiv);
  }

  messageDiv.textContent = message;
  messageDiv.style.display = 'block';

  if (duration) {
    setTimeout(() => {
      messageDiv.style.display = 'none';
    }, duration);
  }
}


function emitSocketEvent(action, object) {
  socket.emit('dibujo', {
    pizarraId: pizarraId,
    objeto: serializeObject(object),
    accion: action
  });
}

function serializeObject(obj) {
  if (obj.type === 'UMLClass') {
    return {
      id: obj.id,
      x: obj.x,
      y: obj.y,
      name: obj.name,
      attributes: obj.attributes,
      width: obj.width,
      height: obj.height,
      type: obj.type
    };
  } else if (obj.type === 'UMLRelationship') {
    return {
      id: obj.id,
      from: obj.from,
      to: obj.to,
      relationType: obj.relationType,
      type: obj.type
    };
  } else {
    return obj;
  }
}

function deserializeObject(obj) {
  if (obj.type === 'UMLClass') {
    const newClass = new UMLClass(obj.id, obj.x, obj.y, obj.name, obj.attributes);
    // Manually set dimensions if they are part of the serialized object
    newClass.width = obj.width;
    newClass.height = obj.height;
    return newClass;
  } else if (obj.type === 'UMLRelationship') {
    return new UMLRelationship(obj.id, obj.from, obj.to, obj.relationType);
  } else {
    return obj;
  }
}

// ==================================================
// ON LOAD
// ==================================================

document.addEventListener("DOMContentLoaded", () => {
  // Cargar objetos existentes
  const objetosJson = document.getElementById('objetos').value;
  if (objetosJson && objetosJson !== 'null' && objetosJson !== 'undefined') {
    try {
      const parsedObjetos = JSON.parse(objetosJson);
      if (Array.isArray(parsedObjetos)) {
        objetos = parsedObjetos.map(obj => deserializeObject(obj));
      }
    } catch (error) {
      console.error('Error al cargar los objetos:', error);
      objetos = [];
    }
  }

  // Configurar la interfaz
  setupToolbar();
  adjustCanvasSize();
  updateCursor();

  // Realizar el primer dibujado
  repaintCanvas();

  // Agregar manejador de eventos para guardar
  window.addEventListener('beforeunload', () => {
    saveCanvas();
  });
}); window.addEventListener('resize', adjustCanvasSize);

// ==================================================
// AI Assistant Logic & Listeners
// ==================================================
function setupAIAssistant() {
  const aiModal = document.getElementById('aiModal');
  const openButton = document.getElementById('openAIAssistantButton');
  const closeButton = document.getElementById('closeAIModal');
  const generateButton = document.getElementById('generateModelButton');
  const aiPromptInput = document.getElementById('aiPromptInput');

  // Abre el modal de la IA
  openButton.addEventListener('click', () => {
    aiModal.style.display = 'block';
  });

  // Cierra el modal de la IA
  closeButton.addEventListener('click', () => {
    aiModal.style.display = 'none';
  });

  // Genera el diagrama con la IA
  generateButton.addEventListener('click', async () => {
    const prompt = aiPromptInput.value.trim();
    if (!prompt) {
      showMessage('Por favor, describe el modelo que deseas generar.', 3000);
      return;
    }

    showMessage('Generando diagrama con IA... Por favor, espera.', 60000);
    aiModal.style.display = 'none';

    try {
      const response = await fetch('/api/ai/generate-model', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ prompt: prompt })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Error del servidor. Revisa el backend.');
      }

      const modelData = await response.json();

      // Usa la función que ya tenías para procesar y dibujar los datos
      processAndDrawModel(modelData);

      showMessage('¡Diagrama generado con éxito!', 3000);
      aiPromptInput.value = '';
    } catch (error) {
      console.error('Error al generar el modelo con IA:', error);
      showMessage(error.message || 'Error desconocido al generar el diagrama.', 5000);
    }
  });

  // Cierra el modal si el usuario hace clic fuera de él
  window.addEventListener('click', (event) => {
    if (event.target === aiModal) {
      aiModal.style.display = 'none';
    }
  });
}

// ==================================================
// Helper Function para procesar el JSON de la IA
// ==================================================
function processAndDrawModel(modelData) {
  if (!modelData || !modelData.classes) {
    console.error('El formato de datos de la IA es incorrecto.', modelData);
    showMessage('El formato de respuesta de la IA es incorrecto.', 5000);
    return;
  }

  const newClasses = [];
  const newRelationships = [];

  // Posiciona las nuevas clases en el canvas de manera ordenada
  let startX = 50;
  const startY = 50;
  const paddingX = 200;

  // 1. Crear las clases y agregarlas al estado global
  modelData.classes.forEach((cls, index) => {
    const newClass = new UMLClass(
      cls.id,
      startX + (index * paddingX),
      startY,
      cls.name,
      cls.attributes.map(attr => `${attr.name}:${attr.type}`)
    );
    objetos.push(newClass);
    newClasses.push(newClass);
  });

  // 2. Crear las relaciones
  modelData.relationships.forEach(rel => {
    const newRelationship = new UMLRelationship(
      rel.id,
      rel.sourceId,
      rel.targetId,
      rel.type
    );
    objetos.push(newRelationship);
    newRelationships.push(newRelationship);
  });

  // 3. Sincronizar con Socket.io
  newClasses.forEach(cls => emitSocketEvent('agregar', cls));
  newRelationships.forEach(rel => emitSocketEvent('agregar', rel));

  // 4. Repintar el canvas para mostrar los nuevos elementos
  repaintCanvas();
}