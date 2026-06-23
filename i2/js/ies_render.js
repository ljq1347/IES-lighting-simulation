
function loadMockIes(filename, angles, candelas) {
    var items = document.querySelectorAll('.file-item');
    for (var i = 0; i < items.length; i++) {
        var nameEl = items[i].querySelector('.file-name');
        if (nameEl && nameEl.innerText === filename) {
            for (var j = 0; j < items.length; j++) {
                items[j].classList.remove('active');
            }
            items[i].classList.add('active');
        }
    }
    
    var mockCandelasC90 = candelas.map(function(c) { return c * 0.4; });
    drawPolarPlot(angles, candelas, mockCandelasC90, false);
}

function parseAndRenderIES(text, canvasId) {
    try {
        var upperText = text.toUpperCase();
        var tiltIdx = upperText.indexOf("TILT=");
        if (tiltIdx === -1) {
            throw new Error("Standard TILT marker not found");
        }
        
        var dataSection = text.substring(tiltIdx);
        var tokens = dataSection.trim().split(/[\s\r\n]+/);
        
        var numArr = [];
        for (var i = 0; i < tokens.length; i++) {
            if (tokens[i] !== "" && !isNaN(tokens[i])) {
                numArr.push(Number(tokens[i]));
            }
        }

        if (numArr.length < 10) {
            throw new Error("无效的 IES 文件结构");
        }

        var multiplier = numArr[2] || 1;
        var numVerAngles = numArr[3]; 
        var numHorAngles = numArr[4];
        
        var ptr = 10; 
        
        var verticalAngles = [];
        for (var v = 0; v < numVerAngles; v++) {
            verticalAngles.push(numArr[ptr]);
            ptr++;
        }
        
        var horizontalAngles = [];
        for (var h = 0; h < numHorAngles; h++) {
            horizontalAngles.push(numArr[ptr]);
            ptr++;
        }

        var maxVerAngle = Math.max.apply(Math, verticalAngles);
        var isFullSphere = maxVerAngle > 95;

        var maxCandelas = new Array(numVerAngles).fill(0); // 截面 A：代表最大偏光形态的主截面
        var secondaryCandelas = [];                       // 截面 B：代表交互对照的侧截面
        var maxCollectedValue = -1;
        var bestHIdx = 0;

        for (var hIdx = 0; hIdx < numHorAngles; hIdx++) {
            var tempMax = -1;
            for (var vIdx = 0; vIdx < numVerAngles; vIdx++) {
                var val = (numArr[ptr + (hIdx * numVerAngles) + vIdx] || 0) * multiplier;
                if (val > tempMax) tempMax = val;
            }
            if (tempMax > maxCollectedValue) {
                maxCollectedValue = tempMax;
                bestHIdx = hIdx;
            }
        }

        for (var vIdx = 0; vIdx < numVerAngles; vIdx++) {
            maxCandelas[vIdx] = (numArr[ptr + (bestHIdx * numVerAngles) + vIdx] || 0) * multiplier;
        }

        var crossHIdx = (bestHIdx + Math.floor(numHorAngles / 4)) % numHorAngles;
        for (var vIdx = 0; vIdx < numVerAngles; vIdx++) {
            secondaryCandelas.push((numArr[ptr + (crossHIdx * numVerAngles) + vIdx] || 0) * multiplier);
        }

        drawPolarPlotEx(canvasId, verticalAngles, maxCandelas, secondaryCandelas, isFullSphere);

    } catch (err) {
        console.error("IES parsing failed, starting fallback simulation:", err);
        var angles = [0, 15, 30, 45, 60, 75, 90];
        var candelasA = [250, 380, 580, 460, 160, 20, 0];
        var candelasB = [250, 210, 150, 90, 40, 10, 0];
        drawPolarPlotEx(canvasId, angles, candelasA, candelasB, false);
    }
}

function drawPolarPlotEx(canvasId, angles, candelasA, candelasB, isFullSphere) {
    var canvas = document.getElementById(canvasId);
    if (!canvas) return;
    
    var ctx = canvas.getContext('2d');
    var width = canvas.width;
    var height = canvas.height;
    var cx = width / 2;
    var cy = height / 2;
    var maxRadius = Math.min(cx, cy) - 35;

    ctx.clearRect(0, 0, width, height);
    
    var maxCandela = 1;
    for (var i = 0; i < candelasA.length; i++) {
        if (candelasA[i] > maxCandela) maxCandela = candelasA[i];
    }
    for (var i = 0; i < candelasB.length; i++) {
        if (candelasB[i] > maxCandela) maxCandela = candelasB[i];
    }

    ctx.strokeStyle = '#e5e7eb';
    ctx.lineWidth = 1;
    
    for (var k = 1; k <= 4; k++) {
        var r = (maxRadius / 4) * k;
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, 2 * Math.PI);
        ctx.stroke();
        
        ctx.fillStyle = '#9ca3af';
        ctx.font = '10px sans-serif';
        ctx.fillText(Math.round((maxCandela / 4) * k) + ' cd', cx + 8, cy - r + 3);
    }

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = '#f0f0f0';
    var radialAngles = [30, 60, 120, 150];
    for (var rA = 0; rA < radialAngles.length; rA++) {
        var rad = (radialAngles[rA] * Math.PI) / 180;
        ctx.beginPath();
        ctx.moveTo(cx - maxRadius * Math.cos(rad), cy - maxRadius * Math.sin(rad));
        ctx.lineTo(cx + maxRadius * Math.cos(rad), cy + maxRadius * Math.sin(rad));
        ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = '#d1d5db';
    ctx.beginPath();
    ctx.moveTo(cx - maxRadius, cy); ctx.lineTo(cx + maxRadius, cy);
    ctx.moveTo(cx, cy - maxRadius); ctx.lineTo(cx, cy + maxRadius);
    ctx.stroke();

    ctx.fillStyle = '#9ca3af';
    ctx.fillText('0° (Downward)', cx - 22, cy + maxRadius + 16);
    ctx.fillText('180°', cx - 10, cy - maxRadius - 10);
    ctx.fillText('90°', cx + maxRadius + 8, cy + 4);

    function generatePoints(dataCandelas) {
        var pts = [];
        if (isFullSphere) {
            for (var i = 0; i < angles.length; i++) {
                var r = (dataCandelas[i] / maxCandela) * maxRadius;
                var theta = (angles[i] * Math.PI / 180) + (Math.PI / 2);
                pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
            }
            for (var j = angles.length - 1; j >= 0; j--) {
                if (angles[j] === 0 || angles[j] === 180) continue;
                var r = (dataCandelas[j] / maxCandela) * maxRadius;
                var theta = (-angles[j] * Math.PI / 180) + (Math.PI / 2);
                pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
            }
        } else {
            for (var a1 = 0; a1 < angles.length; a1++) {
                var r = (dataCandelas[a1] / maxCandela) * maxRadius;
                var theta = (angles[a1] * Math.PI / 180) + (Math.PI / 2);
                pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
            }
            for (var a2 = angles.length - 1; a2 >= 0; a2--) {
                if (angles[a2] === 0) continue;
                var r = (dataCandelas[a2] / maxCandela) * maxRadius;
                var theta = (-angles[a2] * Math.PI / 180) + (Math.PI / 2);
                pts.push({ x: cx + r * Math.cos(theta), y: cy + r * Math.sin(theta) });
            }
        }
        return pts;
    }

    var pointsA = generatePoints(candelasA); // 主配光面点集
    var pointsB = generatePoints(candelasB); // 正交配光面点集

    function drawSmoothShape(points, strokeColor, fillColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2.5;
        ctx.fillStyle = fillColor;
        ctx.beginPath();

        if (points.length > 0) {
            ctx.moveTo(points[0].x, points[0].y);
            for (var p = 0; p < points.length; p++) {
                var nextIdx = (p + 1) % points.length;
                var xc = (points[p].x + points[nextIdx].x) / 2;
                var yc = (points[p].y + points[nextIdx].y) / 2;
                ctx.quadraticCurveTo(points[p].x, points[p].y, xc, yc);
            }
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }

    drawSmoothShape(pointsB, '#3b82f6', 'rgba(59, 130, 246, 0.08)');

    drawSmoothShape(pointsA, '#ef4444', 'rgba(239, 68, 68, 0.06)');

    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, 2 * Math.PI);
    ctx.fillStyle = '#ea580c';
    ctx.fill();

    ctx.font = '11px sans-serif';
    ctx.fillStyle = '#ef4444';
    ctx.fillRect(15, 15, 12, 4);
    ctx.fillText('Main Plane (Max)', 32, 20);

    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(15, 32, 12, 4);
    ctx.fillText('Cross Plane', 32, 37);
}
