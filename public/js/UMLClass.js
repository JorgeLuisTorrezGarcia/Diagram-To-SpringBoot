class UMLClass {
  constructor(id, x, y, name = 'ClassName', attributes = []) {
    this.id = id;
    this.x = x;
    this.y = y;
    this.name = name;
    this.attributes = attributes;
    this.width = Math.max(150, this.calculateWidth());
    this.height = this.calculateHeight();
    this.type = 'UMLClass';
    this.selected = false; // Para el manejo de selección
  }

  // Method to draw the UML class
  draw(context) {
    // Adjust height based on attribute count
    const attributeHeight = this.attributes.length * 15;
    this.height = 40 + attributeHeight; // Base height + attribute space

    context.strokeRect(this.x, this.y, this.width, this.height);
    context.textAlign = 'center';

    // Draw the class name
    context.fillText(this.name, this.x + this.width / 2, this.y + 15);

    // Draw the attributes
    context.textAlign = 'left';
    let attributesY = this.y + 35;
    for (let attribute of this.attributes) {
      context.fillText(attribute, this.x + 5, attributesY);
      attributesY += 15;
    }

    // Division line for the name
    context.beginPath();
    context.moveTo(this.x, this.y + 20);
    context.lineTo(this.x + this.width, this.y + 20);
    context.stroke();
  }

  generateXMI(xmlDoc) {
    // Create UML:Class element
    const classElement = xmlDoc.createElement('UML:Class');
    classElement.setAttribute('name', this.name);
    classElement.setAttribute('xmi.id', `EAID_${this.id}`);
    classElement.setAttribute('visibility', 'public');
    classElement.setAttribute('namespace', 'EAPK_PackageID'); // Replace with actual package ID
    classElement.setAttribute('isRoot', 'false');
    classElement.setAttribute('isLeaf', 'false');
    classElement.setAttribute('isAbstract', 'false');

    // ModelElement.taggedValue
    const taggedValues = xmlDoc.createElement('UML:ModelElement.taggedValue');
    classElement.appendChild(taggedValues);

    // Classifier.feature
    const classifierFeature = xmlDoc.createElement('UML:Classifier.feature');

    // Attributes
    this.attributes.forEach((attr, index) => {
      const attributeElement = xmlDoc.createElement('UML:Attribute');
      attributeElement.setAttribute('name', attr);
      attributeElement.setAttribute('visibility', 'private');
      attributeElement.setAttribute('changeable', 'none');
      attributeElement.setAttribute('ownerScope', 'instance');
      attributeElement.setAttribute('targetScope', 'instance');

      // Attribute.initialValue
      const initialValue = xmlDoc.createElement('UML:Attribute.initialValue');
      const expression = xmlDoc.createElement('UML:Expression');
      initialValue.appendChild(expression);
      attributeElement.appendChild(initialValue);

      // StructuralFeature.type
      const featureType = xmlDoc.createElement('UML:StructuralFeature.type');
      const classifier = xmlDoc.createElement('UML:Classifier');
      classifier.setAttribute('xmi.idref', 'eaxmiid0'); // Adjust based on actual data type
      featureType.appendChild(classifier);
      attributeElement.appendChild(featureType);

      // ModelElement.taggedValue for attribute
      const attrTaggedValues = xmlDoc.createElement('UML:ModelElement.taggedValue');
      attributeElement.appendChild(attrTaggedValues);

      classifierFeature.appendChild(attributeElement);
    });

    classElement.appendChild(classifierFeature);

    return classElement;
  }

  isInside(x, y) {
    return x >= this.x && x <= this.x + this.width && y >= this.y && y <= this.y + this.height;
  }

  calculateWidth() {
    const ctx = document.getElementById('canvas').getContext('2d');
    ctx.font = '12px Arial';

    // Medir el ancho del nombre de la clase
    const nameWidth = ctx.measureText(this.name).width;

    // Medir el ancho de cada atributo
    const attributeWidths = this.attributes.map(attr =>
      ctx.measureText(attr).width
    );

    // Encontrar el ancho máximo necesario
    const maxWidth = Math.max(
      nameWidth,
      ...attributeWidths
    );

    // Agregar padding
    return maxWidth + 40;
  }

  calculateHeight() {
    // Altura base para el nombre de la clase
    const baseHeight = 40;
    // Altura por cada atributo (15px por atributo)
    const attributesHeight = this.attributes.length * 20;
    // Padding adicional
    const padding = 20;

    return baseHeight + attributesHeight + padding;
  }

  draw(context) {
    this.width = Math.max(150, this.calculateWidth());
    this.height = this.calculateHeight();

    // Dibujar el rectángulo principal
    if (this.selected) {
      context.strokeStyle = '#0066cc';
      context.lineWidth = 2;
    } else {
      context.strokeStyle = '#000000';
      context.lineWidth = 1;
    }

    context.fillStyle = '#ffffff';
    context.fillRect(this.x, this.y, this.width, this.height);
    context.strokeRect(this.x, this.y, this.width, this.height);

    // Dibujar el nombre de la clase
    context.fillStyle = '#000000';
    context.font = 'bold 14px Arial';
    context.textAlign = 'center';
    context.fillText(this.name, this.x + this.width / 2, this.y + 25);

    // Línea divisoria
    context.beginPath();
    context.moveTo(this.x, this.y + 35);
    context.lineTo(this.x + this.width, this.y + 35);
    context.stroke();

    // Dibujar los atributos
    context.font = '12px Arial';
    context.textAlign = 'left';
    let y = this.y + 55;
    for (let attribute of this.attributes) {
      context.fillText(attribute, this.x + 10, y);
      y += 20;
    }

    // Restaurar estilos
    context.strokeStyle = '#000000';
    context.lineWidth = 1;
  }
}
