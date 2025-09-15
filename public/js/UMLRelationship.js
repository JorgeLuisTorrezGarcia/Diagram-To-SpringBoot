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
            context.strokeStyle = '#E0F2FE'; // Color de línea claro
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
        const headLength = 10;
        const angle = Math.atan2(toPoint.y - fromPoint.y, toPoint.x - fromPoint.x);

        switch (type) {
            case 'one_to_one':
                this.drawText(context, "1", fromPoint, toPoint, angle - Math.PI);
                this.drawText(context, "1", toPoint, fromPoint, angle);
                break;
            case 'one_to_many':
                this.drawText(context, "1", fromPoint, toPoint, angle - Math.PI);
                this.drawFork(context, toPoint, fromPoint, angle);
                break;
            case 'many_to_one':
                this.drawFork(context, fromPoint, toPoint, angle - Math.PI);
                this.drawText(context, "1", toPoint, fromPoint, angle);
                break;
            case 'many_to_many':
                // Dibuja el símbolo de tenedor en ambos extremos
                this.drawFork(context, fromPoint, toPoint, angle - Math.PI);
                this.drawFork(context, toPoint, fromPoint, angle);
                break;
        }
    }

    drawFork(context, point, otherPoint, angle) {
        const headLength = 10;
        const forkSpread = Math.PI / 6;

        const x1 = point.x - headLength * Math.cos(angle - forkSpread);
        const y1 = point.y - headLength * Math.sin(angle - forkSpread);

        const x2 = point.x - headLength * Math.cos(angle);
        const y2 = point.y - headLength * Math.sin(angle);

        const x3 = point.x - headLength * Math.cos(angle + forkSpread);
        const y3 = point.y - headLength * Math.sin(angle + forkSpread);

        context.save();
        context.beginPath();
        context.moveTo(x1, y1);
        context.lineTo(point.x, point.y);
        context.lineTo(x3, y3);
        context.moveTo(point.x, point.y);
        context.lineTo(x2, y2);
        context.strokeStyle = '#E0F2FE';
        context.lineWidth = 2.5;
        context.stroke();
        context.restore();
    }

    drawText(context, text, point, otherPoint, angle) {
        context.save();
        context.fillStyle = '#E0F2FE';
        context.font = '14px Inter';
        context.textAlign = 'center';
        context.textBaseline = 'middle';

        const offset = 20;
        const textX = point.x + offset * Math.cos(angle);
        const textY = point.y + offset * Math.sin(angle);

        context.fillText(text, textX, textY);
        context.restore();
    }
}
