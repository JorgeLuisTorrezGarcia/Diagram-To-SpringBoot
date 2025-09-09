class UMLRelationship {
    constructor(id, from, to, relationType) {
        this.id = id;
        this.from = from; // ID de la clase de origen
        this.to = to; // ID de la clase de destino
        this.relationType = relationType;
        this.type = 'UMLRelationship';
    }
    // Función para dibujar la relación
    draw(context, classes) {
        const fromClass = classes.find(c => c.id === this.from);
        const toClass = classes.find(c => c.id === this.to);

        if (fromClass && toClass) {
            // Calcular los puntos de intersección en los bordes
            const fromPoint = this.getIntersectionPoint(fromClass, toClass);
            const toPoint = this.getIntersectionPoint(toClass, fromClass);

            // Dibujar la línea desde el borde de la clase de origen al borde de la clase de destino
            context.beginPath();
            context.moveTo(fromPoint.x, fromPoint.y);
            context.lineTo(toPoint.x, toPoint.y);

            // Ajustar estilo según el tipo de relación
            switch (this.relationType) {
                case 'inheritance':
                    context.setLineDash([]);
                    context.lineWidth = 2;
                    break;
                case 'aggregation':
                    context.setLineDash([5, 5]);
                    context.lineWidth = 1;
                    break;
                case 'composition':
                    context.setLineDash([]);
                    context.lineWidth = 2;
                    break;
                case 'association':
                default:
                    context.setLineDash([]);
                    context.lineWidth = 1;
            }

            context.stroke();
            // Restaurar el estilo predeterminado
            context.setLineDash([]);
            context.lineWidth = 1;
            this.drawRelationIndicator(context, fromPoint, toPoint);
        }
    }
    // Función para calcular el punto de intersección del borde
    getIntersectionPoint(fromClass, toClass) {
        const fromCenter = { x: fromClass.x + fromClass.width / 2, y: fromClass.y + fromClass.height / 2 };
        const toCenter = { x: toClass.x + toClass.width / 2, y: toClass.y + toClass.height / 2 };

        // Calcula el ángulo de la línea desde el centro de la clase de origen al centro de la clase de destino
        const angle = Math.atan2(toCenter.y - fromCenter.y, toCenter.x - fromCenter.x);

        // Calcular el punto de intersección en el borde de la clase de origen
        if (Math.abs(Math.cos(angle)) > Math.abs(Math.sin(angle))) {
            // Intersección en los lados izquierdo o derecho
            if (Math.cos(angle) > 0) {
                return { x: fromClass.x + fromClass.width, y: fromCenter.y + (fromClass.width / 2) * Math.tan(angle) };
            } else {
                return { x: fromClass.x, y: fromCenter.y - (fromClass.width / 2) * Math.tan(angle) };
            }
        } else {
            // Intersección en los lados superior o inferior
            if (Math.sin(angle) > 0) {
                return { x: fromCenter.x + (fromClass.height / 2) / Math.tan(angle), y: fromClass.y + fromClass.height };
            } else {
                return { x: fromCenter.x - (fromClass.height / 2) / Math.tan(angle), y: fromClass.y };
            }
        }
    }
    drawRelationIndicator(context, fromPoint, toPoint) {
        const angle = Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x);
        const headlen = 10; // length of head in pixels

        switch (this.relationType) {
            case 'many_to_one':
                // Simple arrowhead at the 'to' end
                context.beginPath();
                context.moveTo(toPoint.x, toPoint.y);
                context.lineTo(toPoint.x - headlen * Math.cos(angle - Math.PI / 6), toPoint.y - headlen * Math.sin(angle - Math.PI / 6));
                context.moveTo(toPoint.x, toPoint.y);
                context.lineTo(toPoint.x - headlen * Math.cos(angle + Math.PI / 6), toPoint.y - headlen * Math.sin(angle + Math.PI / 6));
                context.stroke();
                break;
            case 'many_to_many':
                // Simple arrowhead at the 'to' end
                context.beginPath();
                context.moveTo(toPoint.x, toPoint.y);
                context.lineTo(toPoint.x - headlen * Math.cos(angle - Math.PI / 6), toPoint.y - headlen * Math.sin(angle - Math.PI / 6));
                context.moveTo(toPoint.x, toPoint.y);
                context.lineTo(toPoint.x - headlen * Math.cos(angle + Math.PI / 6), toPoint.y - headlen * Math.sin(angle + Math.PI / 6));
                context.stroke();
                break;
            case 'one_to_one':
                // Simple arrowhead at the 'to' end
                context.beginPath();
                context.moveTo(toPoint.x, toPoint.y);
                context.lineTo(toPoint.x - headlen * Math.cos(angle - Math.PI / 6), toPoint.y - headlen * Math.sin(angle - Math.PI / 6));
                context.moveTo(toPoint.x, toPoint.y);
                context.lineTo(toPoint.x - headlen * Math.cos(angle + Math.PI / 6), toPoint.y - headlen * Math.sin(angle + Math.PI / 6));
                context.stroke();
                break;
            case 'one_to_many':
                // Simple arrowhead at the 'to' end
                context.beginPath();
                context.moveTo(toPoint.x, toPoint.y);
                context.lineTo(toPoint.x - headlen * Math.cos(angle - Math.PI / 6), toPoint.y - headlen * Math.sin(angle - Math.PI / 6));
                context.moveTo(toPoint.x, toPoint.y);
                context.lineTo(toPoint.x - headlen * Math.cos(angle + Math.PI / 6), toPoint.y - headlen * Math.sin(angle + Math.PI / 6));
                context.stroke();
                break;
            case 'inheritance':
                // Hollow triangle at the 'to' end
                context.beginPath();
                context.save();
                context.translate(toPoint.x, toPoint.y);
                context.rotate(angle);
                context.moveTo(0, 0);
                context.lineTo(-headlen * 1.5, -headlen / 2);
                context.lineTo(-headlen * 1.5, headlen / 2);
                context.closePath();
                context.stroke();
                context.restore();
                break;
            case 'aggregation':
                // Hollow diamond at the 'from' end
                context.beginPath();
                context.save();
                context.translate(fromPoint.x, fromPoint.y);
                context.rotate(angle + Math.PI); // Rotate to point towards the 'from' class
                context.moveTo(0, 0);
                context.lineTo(headlen, -headlen / 2);
                context.lineTo(headlen * 2, 0);
                context.lineTo(headlen, headlen / 2);
                context.closePath();
                context.stroke();
                context.restore();
                break;
            case 'composition':
                // Filled diamond at the 'from' end
                context.beginPath();
                context.save();
                context.translate(fromPoint.x, fromPoint.y);
                context.rotate(angle + Math.PI); // Rotate to point towards the 'from' class
                context.moveTo(0, 0);
                context.lineTo(headlen, -headlen / 2);
                context.lineTo(headlen * 2, 0);
                context.lineTo(headlen, headlen / 2);
                context.closePath();
                context.fill(); // Fill the diamond
                context.stroke();
                context.restore();
                break;
        }
    }

    generateXMI(xmlDoc) {
        if (this.relationType === 'inheritance') {
            // Create UML:Generalization element
            const generalizationElement = xmlDoc.createElement('UML:Generalization');
            generalizationElement.setAttribute('xmi.id', `EAID_${this.id}`);
            generalizationElement.setAttribute('subtype', `EAID_${this.from}`);
            generalizationElement.setAttribute('supertype', `EAID_${this.to}`);
            generalizationElement.setAttribute('visibility', 'public');

            // ModelElement.taggedValue
            const taggedValues = xmlDoc.createElement('UML:ModelElement.taggedValue');
            generalizationElement.appendChild(taggedValues);

            return generalizationElement;
        }

        // Handle other relationship types if needed

        return null;
    }
}
