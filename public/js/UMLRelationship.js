class UMLRelationship {
    constructor(id, from, to, relationType) {
        this.id = id;
        this.from = from; // ID de la clase de origen
        this.to = to; // ID de la clase de destino
        this.relationType = relationType;
        this.type = 'UMLRelationship';
    }

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
            context.strokeStyle = '#111212ff'; // Color de línea claro
            context.lineWidth = 2.5; // Grosor de línea
            context.stroke();

            // Dibujar los indicadores de cardinalidad
            this.drawCardinality(context, fromPoint, toPoint, this.relationType);
        }
    }

    getIntersectionPoint(fromClass, toClass) {
        const fromCenter = { x: fromClass.x + fromClass.width / 2, y: fromClass.y + fromClass.height / 2 };
        const toCenter = { x: toClass.x + toClass.width / 2, y: toClass.y + toClass.height / 2 };
        const dx = toCenter.x - fromCenter.x;
        const dy = toCenter.y - fromCenter.y;
        const angle = Math.atan2(dy, dx);
        const halfWidth = fromClass.width / 2;
        const halfHeight = fromClass.height / 2;
        const slope = dy / dx;

        let intersectionX, intersectionY;

        if (Math.abs(dx) >= Math.abs(dy)) {
            intersectionX = (dx > 0) ? fromClass.x + fromClass.width : fromClass.x;
            intersectionY = fromCenter.y + slope * (intersectionX - fromCenter.x);
        } else {
            intersectionY = (dy > 0) ? fromClass.y + fromClass.height : fromClass.y;
            intersectionX = fromCenter.x + (intersectionY - fromCenter.y) / slope;
        }

        return { x: intersectionX, y: intersectionY };
    }

    drawCardinality(context, fromPoint, toPoint, type) {
        const angle = Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x);

        switch (type) {
            case 'one_to_one':
                this.drawText(context, "1", fromPoint, toPoint, angle - Math.PI);
                this.drawText(context, "1", toPoint, fromPoint, angle);
                break;
            case 'one_to_many':
                this.drawText(context, "1", fromPoint, toPoint, angle - Math.PI);
                this.drawText(context, "*", toPoint, fromPoint, angle);
                break;
            case 'many_to_one':
                this.drawText(context, "*", fromPoint, toPoint, angle - Math.PI);
                this.drawText(context, "1", toPoint, fromPoint, angle);
                break;
            case 'many_to_many':
                this.drawText(context, "*", fromPoint, toPoint, angle - Math.PI);
                this.drawText(context, "*", toPoint, fromPoint, angle);
                break;
        }
    }

    drawText(context, text, point, otherPoint, angle) {
        context.save();
        context.fillStyle = '#090909ff';
        context.font = '14px Inter';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const longitudinalOffset = -20; 
        const perpendicularOffset = -20; 

        const baseX = point.x + longitudinalOffset * Math.cos(angle);
        const baseY = point.y + longitudinalOffset * Math.sin(angle);

        const perpendicularAngle = angle + Math.PI / 2;

        const textX = baseX + perpendicularOffset * Math.cos(perpendicularAngle);
        const textY = baseY + perpendicularOffset * Math.sin(perpendicularAngle);

        context.fillText(text, textX, textY);
        context.restore();
    }
}
