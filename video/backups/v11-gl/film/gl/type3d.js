/*
 * 3D type in the brand face (Open Sauce One): every letter is its own bevelled extrusion, laid out with the
 * font's kerning and a tight track, so words can bounce, stretch, echo and fly letter by letter.
 *
 *   const w = type3d('in time.', { weight: 800, size: 1.2, depth: 0.28, material, align: 'center' });
 *   scene.add(w.group); w.letters[i].mesh …  (each mesh's origin is its letter's centre)
 */
import * as THREE from 'three';

const FONTS = window.HC_FONT3D;
const cache = new Map();

function glyphShapes(font, ch) {
  const g = font.glyphs[ch] || font.glyphs['?'];
  if (!g || !g.o) return [];
  const path = new THREE.ShapePath();
  const o = g.o.split(' ');
  for (let i = 0; i < o.length;) {
    const c = o[i++];
    if (c === 'm') path.moveTo(+o[i++], +o[i++]);
    else if (c === 'l') path.lineTo(+o[i++], +o[i++]);
    else if (c === 'q') { const x = +o[i++], y = +o[i++], cx = +o[i++], cy = +o[i++]; path.quadraticCurveTo(cx, cy, x, y); }
    else if (c === 'b') { const x = +o[i++], y = +o[i++], c1x = +o[i++], c1y = +o[i++], c2x = +o[i++], c2y = +o[i++]; path.bezierCurveTo(c1x, c1y, c2x, c2y, x, y); }
  }
  // TrueType draws outer contours clockwise, CFF counter-clockwise: read it off the largest contour
  let big = null, bigA = 0;
  for (const sp of path.subPaths) {
    const pts = sp.getPoints();
    const a = Math.abs(THREE.ShapeUtils.area(pts));
    if (a > bigA) { bigA = a; big = pts; }
  }
  return path.toShapes(big ? !THREE.ShapeUtils.isClockWise(big) : false);
}

// one glyph's geometry, in font units scaled to `size` = cap height in world units, centred on its bounding box
function glyphGeometry(weight, ch, size, depth, bevel, curve) {
  const key = [weight, ch, size, depth, bevel, curve].join('|');
  if (cache.has(key)) return cache.get(key);
  const font = FONTS[weight];
  const k = size / font.capHeight;
  const shapes = glyphShapes(font, ch);
  let geo = null, center = new THREE.Vector3();
  if (shapes.length) {
    geo = new THREE.ExtrudeGeometry(shapes, {
      depth: depth / k,
      curveSegments: curve,
      bevelEnabled: bevel > 0,
      bevelThickness: bevel / k,
      bevelSize: (bevel * 0.8) / k,
      bevelOffset: -(bevel * 0.35) / k,
      bevelSegments: 4,
    });
    geo.scale(k, k, k);
    geo.computeBoundingBox();
    geo.boundingBox.getCenter(center);
    geo.translate(-center.x, -center.y, -center.z);
    geo.computeVertexNormals();
  }
  const out = { geo, center, advance: (font.glyphs[ch] ? font.glyphs[ch].ha : font.unitsPerEm * 0.3) * k };
  cache.set(key, out);
  return out;
}

export function type3d(text, { weight = 800, size = 1, depth = 0.25, bevel = 0.03, tracking = -0.02, material, align = 'left', curve = 6, castShadow = true } = {}) {
  const font = FONTS[weight];
  const k = size / font.capHeight;
  const group = new THREE.Group();
  const letters = [];
  let x = 0;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const g = glyphGeometry(weight, ch, size, depth, bevel, curve);
    if (g.geo) {
      const mesh = new THREE.Mesh(g.geo, material);
      mesh.castShadow = castShadow;
      mesh.receiveShadow = true;
      mesh.position.set(x + g.center.x, g.center.y, g.center.z);
      group.add(mesh);
      letters.push({ ch, mesh, home: mesh.position.clone(), index: letters.length });
    }
    x += g.advance + tracking * size * (font.unitsPerEm / font.capHeight);
    const kern = font.kern[ch + (text[i + 1] || '')];
    if (kern) x += kern * k;
  }
  const width = x - tracking * size * (font.unitsPerEm / font.capHeight);
  const shift = align === 'center' ? -width / 2 : align === 'right' ? -width : 0;
  letters.forEach((l) => { l.mesh.position.x += shift; l.home.x += shift; });
  return { group, letters, width, height: size, text };
}
