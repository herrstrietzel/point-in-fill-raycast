

function isPointInPathData(d, pt, precision = 10) {

    let pathData, compoundPoly;

    //test polygon
    let hasCurves = (/[C|Q|T|S]/gi).test(d);
    let hasRelativeLinetos = (/[l]/g).test(d);
    let hasRelativeMovetos = (/[m]/g).test(d);
    let isPoly = !hasCurves && !hasRelativeLinetos && !hasRelativeMovetos


    if (!isPoly) {
        // parse pathdata if stringified
        pathData = Array.isArray(d) ? d : parsePathDataNormalized(d, { arcsToCubic: false });
        compoundPoly = pathDataToCompoundPoly(pathData, precision);
    }
    //path data contains only linetos
    else {
        let poly = d.replace(/[m|l|z]/gi, ' ').split(/,| /).filter(Boolean)
        compoundPoly = [{ vertices: [], bb: {} }]
        //let pol = {vertices:[], bb:{}}
        for (let i = 1; i < poly.length; i += 2) {
            compoundPoly[0].vertices.push({ x: +poly[i - 1], y: +poly[i] })
        }

        compoundPoly[0].bb = getPolyBBox(compoundPoly[0].vertices);
    }

    let pointsInPoly = 0;
    for (let i = 0; i < compoundPoly.length; i++) {
        let { vertices, bb } = compoundPoly[i];
        if (isPointInPolygon(pt, vertices, bb, false)) {
            pointsInPoly++;
        }
    }
    return pointsInPoly === 1;
}


function isPointInCompoundPolygon(compoundPoly, pt) {
    let pointsInPoly = 0;
    for (let i = 0; i < compoundPoly.length; i++) {
        let { vertices, bb } = compoundPoly[i];
        if (isPointInPolygon(pt, vertices, bb)) {
            pointsInPoly++;
        }
    }
    return pointsInPoly === 1;
}



/** Get relationship between a point and a polygon using ray-casting algorithm
* based on timepp's answer
* https://stackoverflow.com/questions/217578/how-can-i-determine-whether-a-2d-point-is-within-a-polygon#63436180
*/
function isPointInPolygon(pt, polygon, bb, skipBB = false) {
    const between = (p, a, b) => (p >= a && p <= b) || (p <= a && p >= b);
    let inside = false;

    // not in bbox - quit
    if (!skipBB) {
        if (bb.left > pt.x || bb.top > pt.y || bb.bottom < pt.y || bb.right < pt.x) {
            return false;
        }
    }

    for (let i = polygon.length - 1, j = 0; j < polygon.length; i = j, j++) {
        const A = polygon[i];
        const B = polygon[j];
        // corner cases
        if ((pt.x == A.x && pt.y == A.y) || (pt.x == B.x && pt.y == B.y))
            return true;
        if (A.y == B.y && pt.y == A.y && between(pt.x, A.x, B.x)) return true;
        if (between(pt.y, A.y, B.y)) {
            // if pt inside the vertical range
            // filter out "ray pass vertex" problem by treating the line a little lower
            if ((pt.y == A.y && B.y >= A.y) || (pt.y == B.y && A.y >= B.y)) continue;
            // calc cross product `ptA X ptB`, pt lays on left side of AB if c > 0
            const c = (A.x - pt.x) * (B.y - pt.y) - (B.x - pt.x) * (A.y - pt.y);
            if (c == 0) return true;
            if (A.y < B.y == c > 0) inside = !inside;
        }
    }
    return inside ? true : false;
}



function pathDataToCompoundPoly(d, precision = 10) {
    // parse pathdata if stringified
    let pathData = Array.isArray(d) ? d : parsePathDataNormalized(d, { arcsToCubic: true });

    //split subpaths
    let compoundPoly = [];

    // subpath polygon
    let subs = pathDataToPolygon(pathData, precision);

    for (let i = 0; i < subs.length; i++) {
        let vertices = subs[i];
        //getbounding box
        let bb = getPolyBBox(vertices);
        compoundPoly.push({ vertices: vertices, bb: bb });
    }

    return compoundPoly;
}



function getPolyBBox(vertices) {
    let xArr = vertices.map((pt) => {
        return pt.x;
    });
    let yArr = vertices.map((pt) => {
        return pt.y;
    });
    let bb = {
        left: Math.min(...xArr),
        right: Math.max(...xArr),
        top: Math.min(...yArr),
        bottom: Math.max(...yArr)
    };
    return bb;
}



function pathDataToPolygon(pathData, precision = 10) {
    let M = { x: pathData[0].values[0], y: pathData[0].values[1] }
    let polys = [[]]

    pathData.forEach((com, i) => {

        let { type, values } = com;
        let comPrev = i > 0 ? pathData[i - 1] : pathData[0]
        let comPrevValues = comPrev.values;

        let p0 = { x: comPrevValues[comPrevValues.length - 2], y: comPrevValues[comPrevValues.length - 1] }
        let p = values.length ? { x: values[values.length - 2], y: values[values.length - 1] } : M;
        let cp1, cp2

        let vertices = polys[polys.length - 1];

        switch (type) {

            case 'M':
                // new sub polygon
                if (i > 0) {
                    //add new sub path
                    polys.push([p])
                }
                M = p
                break;

            case 'L':
                vertices.push(p)
                break;

            //quadratic
            case 'C':
            case 'Q':
                cp1 = { x: values[0], y: values[1] };
                cp2 = { x: values[2], y: values[3] };

                let pts = type === 'C' ? [p0, cp1, cp2, p] : [p0, cp1, p]

                for (let i = 1; i < precision; i++) {
                    let pt = pointAtT(pts, 1 / precision * i)
                    vertices.push(pt)
                }
                break;
        }
    })

    return polys

}



function pointAtT(pts, t = 0.5) {

    /**
    * Linear  interpolation (LERP) helper
    */
    const interpolate = (p1, p2, t) => {
        return {
            x: (p2.x - p1.x) * t + p1.x,
            y: (p2.y - p1.y) * t + p1.y
        };
    }

    /**
    * calculate single points on segments
    */
    const getPointAtCubicSegmentT = (p0, cp1, cp2, p, t) => {
        let t1 = 1 - t;
        return {
            x:
                t1 ** 3 * p0.x +
                3 * t1 ** 2 * t * cp1.x +
                3 * t1 * t ** 2 * cp2.x +
                t ** 3 * p.x,
            y:
                t1 ** 3 * p0.y +
                3 * t1 ** 2 * t * cp1.y +
                3 * t1 * t ** 2 * cp2.y +
                t ** 3 * p.y
        };
    }

    const getPointAtQuadraticSegmentT = (p0, cp1, p, t) => {
        let t1 = 1 - t;
        return {
            x: t1 * t1 * p0.x + 2 * t1 * t * cp1.x + t ** 2 * p.x,
            y: t1 * t1 * p0.y + 2 * t1 * t * cp1.y + t ** 2 * p.y
        };
    }

    let pt
    if (pts.length === 4) {
        pt = getPointAtCubicSegmentT(pts[0], pts[1], pts[2], pts[3], t)
    }
    else if (pts.length === 3) {
        pt = getPointAtQuadraticSegmentT(pts[0], pts[1], pts[2], t)
    }
    else {
        pt = interpolate(pts[0], pts[1], t)
    }
    return pt
}




/**
 * parse pathData from d attribute
 * the core function to parse the pathData array from a d string
 **/

function parsePathDataNormalized(d, options = {}) {

    d = d
        // remove new lines, tabs an comma with whitespace
        .replace(/[\n\r\t|,]/g, " ")
        // pre trim left and right whitespace
        .trim()
        // add space before minus sign
        .replace(/(\d)-/g, '$1 -')
        // decompose multiple adjacent decimal delimiters like 0.5.5.5 => 0.5 0.5 0.5
        .replace(/(\.)(?=(\d+\.\d+)+)(\d+)/g, "$1$3 ")

    let pathData = [];
    let cmdRegEx = /([mlcqazvhst])([^mlcqazvhst]*)/gi;
    let commands = d.match(cmdRegEx);

    // valid command value lengths
    let comLengths = { m: 2, a: 7, c: 6, h: 1, l: 2, q: 4, s: 4, t: 2, v: 1, z: 0 };

    options = {
        ...{
            toAbsolute: true,
            toLonghands: true,
            arcToCubic: false,
            arcAccuracy: 4,
        },
        ...options
    }

    let { toAbsolute, toLonghands, arcToCubic, arcAccuracy } = options;
    let hasArcs = /[a]/gi.test(d);
    let hasShorthands = toLonghands ? /[vhst]/gi.test(d) : false;
    let hasRelative = toAbsolute ? /[lcqamts]/g.test(d.substring(1, d.length - 1)) : false;

    // offsets for absolute conversion
    let offX, offY, lastX, lastY;

    for (let c = 0; c < commands.length; c++) {
        let com = commands[c];
        let type = com.substring(0, 1);
        let typeRel = type.toLowerCase();
        let typeAbs = type.toUpperCase();
        let isRel = type === typeRel;
        let chunkSize = comLengths[typeRel];

        // split values to array
        let values = com.substring(1, com.length)
            .trim()
            .split(" ").filter(Boolean);

        /**
         * A - Arc commands
         * large arc and sweep flags
         * are boolean and can be concatenated like
         * 11 or 01
         * or be concatenated with the final on path points like
         * 1110 10 => 1 1 10 10
         */
        if (typeRel === "a" && values.length != comLengths.a) {

            let n = 0,
                arcValues = [];
            for (let i = 0; i < values.length; i++) {
                let value = values[i];

                // reset counter
                if (n >= chunkSize) {
                    n = 0;
                }
                // if 3. or 4. parameter longer than 1
                if ((n === 3 || n === 4) && value.length > 1) {
                    let largeArc = n === 3 ? value.substring(0, 1) : "";
                    let sweep = n === 3 ? value.substring(1, 2) : value.substring(0, 1);
                    let finalX = n === 3 ? value.substring(2) : value.substring(1);
                    let comN = [largeArc, sweep, finalX].filter(Boolean);
                    arcValues.push(comN);
                    n += comN.length;


                } else {
                    // regular
                    arcValues.push(value);
                    n++;
                }
            }
            values = arcValues.flat().filter(Boolean);
        }

        // string  to number
        values = values.map(Number)

        // if string contains repeated shorthand commands - split them
        let hasMultiple = values.length > chunkSize;
        let chunk = hasMultiple ? values.slice(0, chunkSize) : values;
        let comChunks = [{ type: type, values: chunk }];

        // has implicit or repeated commands – split into chunks
        if (hasMultiple) {
            let typeImplicit = typeRel === "m" ? (isRel ? "l" : "L") : type;
            for (let i = chunkSize; i < values.length; i += chunkSize) {
                let chunk = values.slice(i, i + chunkSize);
                comChunks.push({ type: typeImplicit, values: chunk });
            }
        }

        // no relative, shorthand or arc command - return current 
        if (!hasRelative && !hasShorthands && !hasArcs) {
            comChunks.forEach((com) => {
                pathData.push(com);
            });
        }

        /**
         * convert to absolute 
         * init offset from 1st M
         */
        else {
            if (c === 0) {
                offX = values[0];
                offY = values[1];
                lastX = offX;
                lastY = offY;
            }

            let typeFirst = comChunks[0].type;
            typeAbs = typeFirst.toUpperCase()

            // first M is always absolute
            isRel = typeFirst.toLowerCase() === typeFirst && pathData.length ? true : false;

            for (let i = 0; i < comChunks.length; i++) {
                let com = comChunks[i];
                let type = com.type;
                let values = com.values;
                let valuesL = values.length;
                let comPrev = comChunks[i - 1]
                    ? comChunks[i - 1]
                    : c > 0 && pathData[pathData.length - 1]
                        ? pathData[pathData.length - 1]
                        : comChunks[i];

                let valuesPrev = comPrev.values;
                let valuesPrevL = valuesPrev.length;
                isRel = comChunks.length > 1 ? type.toLowerCase() === type && pathData.length : isRel;

                if (isRel) {
                    com.type = comChunks.length > 1 ? type.toUpperCase() : typeAbs;

                    switch (typeRel) {
                        case "a":
                            com.values = [
                                values[0],
                                values[1],
                                values[2],
                                values[3],
                                values[4],
                                values[5] + offX,
                                values[6] + offY
                            ];
                            break;

                        case "h":
                        case "v":
                            com.values = type === "h" ? [values[0] + offX] : [values[0] + offY];
                            break;

                        case "m":
                        case "l":
                        case "t":
                            com.values = [values[0] + offX, values[1] + offY];
                            break;

                        case "c":
                            com.values = [
                                values[0] + offX,
                                values[1] + offY,
                                values[2] + offX,
                                values[3] + offY,
                                values[4] + offX,
                                values[5] + offY
                            ];
                            break;

                        case "q":
                        case "s":
                            com.values = [
                                values[0] + offX,
                                values[1] + offY,
                                values[2] + offX,
                                values[3] + offY
                            ];
                            break;
                    }
                }
                // is absolute
                else {
                    offX = 0;
                    offY = 0;
                }

                /**
                 * convert shorthands
                 */
                if (hasShorthands) {
                    let cp1X, cp1Y, cpN1X, cpN1Y, cp2X, cp2Y;
                    if (com.type === "H" || com.type === "V") {
                        com.values =
                            com.type === "H" ? [com.values[0], lastY] : [lastX, com.values[0]];
                        com.type = "L";
                    } else if (com.type === "T" || com.type === "S") {
                        [cp1X, cp1Y] = [valuesPrev[0], valuesPrev[1]];
                        [cp2X, cp2Y] =
                            valuesPrevL > 2
                                ? [valuesPrev[2], valuesPrev[3]]
                                : [valuesPrev[0], valuesPrev[1]];

                        // new control point
                        cpN1X = com.type === "T" ? lastX * 2 - cp1X : lastX * 2 - cp2X;
                        cpN1Y = com.type === "T" ? lastY * 2 - cp1Y : lastY * 2 - cp2Y;

                        com.values = [cpN1X, cpN1Y, com.values].flat();
                        com.type = com.type === "T" ? "Q" : "C";

                    }
                }

                /**
                 * convert arcs if elliptical
                 */
                let isElliptic = false;

                if (hasArcs && com.type === 'A') {

                    p0 = { x: lastX, y: lastY }
                    if (typeRel === 'a') {
                        isElliptic = com.values[0] === com.values[1] ? false : true;

                        if (isElliptic || arcToCubic) {
                            let comArc = arcToBezier(p0, com.values, arcAccuracy)
                            comArc.forEach(seg => {
                                pathData.push(seg);
                            })

                        } else {
                            pathData.push(com);
                        }
                    }
                }

                else {
                    // add to pathData array
                    pathData.push(com);
                }

                // update offsets
                lastX =
                    valuesL > 1
                        ? values[valuesL - 2] + offX
                        : typeRel === "h"
                            ? values[0] + offX
                            : lastX;
                lastY =
                    valuesL > 1
                        ? values[valuesL - 1] + offY
                        : typeRel === "v"
                            ? values[0] + offY
                            : lastY;
                offX = lastX;
                offY = lastY;
            }
        }
    }


    /**
     * first M is always absolute/uppercase -
     * unless it adds relative linetos
     * (facilitates d concatenating)
     */
    pathData[0].type = "M";
    return pathData;

    /** 
     * convert arctocommands to cubic bezier
     * based on puzrin's a2c.js
     * https://github.com/fontello/svgpath/blob/master/lib/a2c.js
     * returns pathData array
    */

    function arcToBezier(p0, values, splitSegments = 1) {
        const TAU = Math.PI * 2;
        let [rx, ry, rotation, largeArcFlag, sweepFlag, x, y] = values;

        if (rx === 0 || ry === 0) {
            return []
        }

        let phi = rotation ? rotation * TAU / 360 : 0;
        let sinphi = phi ? Math.sin(phi) : 0
        let cosphi = phi ? Math.cos(phi) : 1
        let pxp = cosphi * (p0.x - x) / 2 + sinphi * (p0.y - y) / 2
        let pyp = -sinphi * (p0.x - x) / 2 + cosphi * (p0.y - y) / 2

        if (pxp === 0 && pyp === 0) {
            return []
        }
        rx = abs(rx)
        ry = abs(ry)
        let lambda =
            pxp * pxp / (rx * rx) +
            pyp * pyp / (ry * ry)
        if (lambda > 1) {
            let lambdaRt = sqrt(lambda);
            rx *= lambdaRt
            ry *= lambdaRt
        }

        /** 
         * parametrize arc to 
         * get center point start and end angles
         */
        let rxsq = rx * rx,
            rysq = rx === ry ? rxsq : ry * ry

        let pxpsq = pxp * pxp,
            pypsq = pyp * pyp
        let radicant = (rxsq * rysq) - (rxsq * pypsq) - (rysq * pxpsq)

        if (radicant <= 0) {
            radicant = 0
        } else {
            radicant /= (rxsq * pypsq) + (rysq * pxpsq)
            radicant = sqrt(radicant) * (largeArcFlag === sweepFlag ? -1 : 1)
        }

        let centerxp = radicant ? radicant * rx / ry * pyp : 0
        let centeryp = radicant ? radicant * -ry / rx * pxp : 0
        let centerx = cosphi * centerxp - sinphi * centeryp + (p0.x + x) / 2
        let centery = sinphi * centerxp + cosphi * centeryp + (p0.y + y) / 2

        let vx1 = (pxp - centerxp) / rx
        let vy1 = (pyp - centeryp) / ry
        let vx2 = (-pxp - centerxp) / rx
        let vy2 = (-pyp - centeryp) / ry

        // get start and end angle
        const vectorAngle = (ux, uy, vx, vy) => {
            let dot = +(ux * vx + uy * vy).toFixed(9)
            if (dot === 1 || dot === -1) {
                return dot === 1 ? 0 : PI
            }
            dot = dot > 1 ? 1 : (dot < -1 ? -1 : dot)
            let sign = (ux * vy - uy * vx < 0) ? -1 : 1
            return sign * Math.acos(dot);
        }

        let ang1 = vectorAngle(1, 0, vx1, vy1),
            ang2 = vectorAngle(vx1, vy1, vx2, vy2)

        if (sweepFlag === 0 && ang2 > 0) {
            ang2 -= PI * 2
        }
        else if (sweepFlag === 1 && ang2 < 0) {
            ang2 += PI * 2
        }

        let ratio = +(abs(ang2) / (TAU / 4)).toFixed(0)

        // increase segments for more accureate length calculations
        let segments = ratio * splitSegments;
        ang2 /= segments
        let pathDataArc = [];


        // If 90 degree circular arc, use a constant
        // https://pomax.github.io/bezierinfo/#circles_cubic
        // k=0.551784777779014
        const angle90 = 1.5707963267948966;
        const k = 0.551785
        let a = ang2 === angle90 ? k :
            (
                ang2 === -angle90 ? -k : 4 / 3 * tan(ang2 / 4)
            );

        let cos2 = ang2 ? Math.cos(ang2) : 1;
        let sin2 = ang2 ? Math.sin(ang2) : 0;
        let type = 'C'

        const approxUnitArc = (ang1, ang2, a, cos2, sin2) => {
            let x1 = ang1 != ang2 ? Math.cos(ang1) : cos2;
            let y1 = ang1 != ang2 ? Math.sin(ang1) : sin2;
            let x2 = Math.cos(ang1 + ang2);
            let y2 = Math.sin(ang1 + ang2);

            return [
                { x: x1 - y1 * a, y: y1 + x1 * a },
                { x: x2 + y2 * a, y: y2 - x2 * a },
                { x: x2, y: y2 }
            ];
        }

        for (let i = 0; i < segments; i++) {
            let com = { type: type, values: [] }
            let curve = approxUnitArc(ang1, ang2, a, cos2, sin2);

            curve.forEach((pt) => {
                let x = pt.x * rx
                let y = pt.y * ry
                com.values.push(cosphi * x - sinphi * y + centerx, sinphi * x + cosphi * y + centery)
            })
            pathDataArc.push(com);
            ang1 += ang2
        }

        return pathDataArc;
    }

}
