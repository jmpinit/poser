import * as THREE from 'three';
import pointVertShader from './shaders/point.vert';
import pointFragShader from './shaders/point.frag';

function createPointsObject(numPoints) {
  const vertices = new Float32Array(numPoints * 3);
  const scales = new Float32Array(numPoints);

  // Set default scale and a default position for debugging
  for (let i = 0; i < numPoints; i += 1) {
    vertices[i * 3] = i * 10;
    vertices[i * 3 + 1] = i * 10;
    vertices[i * 3 + 2] = i * 10;

    scales[i] = 1;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
  geometry.setAttribute('scale', new THREE.BufferAttribute(scales, 1));
  geometry.setDrawRange(0, 0);

  const material = new THREE.ShaderMaterial({
    uniforms: {
      color: { value: new THREE.Color(0xffffff) },
    },
    vertexShader: pointVertShader,
    fragmentShader: pointFragShader,
  });

  return new THREE.Points(geometry, material);
}

export default class DraggablePointGroup {
  constructor(maxPointsCount) {
    this.maxPointsCount = maxPointsCount;
    this.pointCount = 0;
    this.threeObject = createPointsObject(maxPointsCount);

    this.points = {};
  }

  getPointInfo(ptRef) {
    if (!(ptRef in this.points)) {
      throw new Error('Point with given reference does not exist');
    }

    return this.points[ptRef];
  }

  setPointPosition(ptRef, position) {
    const { index } = this.getPointInfo(ptRef);

    const positionsAttrib = this.threeObject.geometry.attributes.position;
    positionsAttrib.array[index * 3] = position.x;
    positionsAttrib.array[index * 3 + 1] = position.y;
    positionsAttrib.array[index * 3 + 2] = position.z;
    positionsAttrib.needsUpdate = true;
  }

  getPointPosition(ptRef) {
    const { index } = this.getPointInfo(ptRef);

    const positionsAttrib = this.threeObject.geometry.attributes.position;
    const x = positionsAttrib.array[index * 3];
    const y = positionsAttrib.array[index * 3 + 1];
    const z = positionsAttrib.array[index * 3 + 2];

    return new THREE.Vector3(x, y, z);
  }

  setPointScale(ptRef, newScale) {
    if (!(ptRef in this.points)) {
      throw new Error('Point with given reference does not exist');
    }

    const { index } = this.points[ptRef];

    const scalesAttrib = this.threeObject.geometry.attributes.scale;
    scalesAttrib.array[index] = newScale;
    scalesAttrib.needsUpdate = true;
  }

  addPoint(position, scale = 1) {
    if (this.pointCount >= this.maxPointsCount) {
      // FIXME: create a new geometry with 2x the limit and transfer points there
      throw new Error('Max points reached');
    }

    // Offset into the positions attribute array
    const pointIndex = this.pointCount;

    // Create a symbol for others to use to reference this point
    const pointRef = Symbol('point');

    // We store some book-keeping information about the point
    this.points[pointRef] = {
      index: pointIndex,
    };

    // Update the point count and the draw range
    this.pointCount += 1;
    this.threeObject.geometry.setDrawRange(0, this.pointCount);

    this.setPointPosition(pointRef, position);
    this.setPointScale(pointRef, scale);

    return pointRef;
  }

  getNearestPoint(position) {
    const pointRefs = Object.getOwnPropertySymbols(this.points);

    let nearestDistance;
    let nearestPt;

    for (let i = 0; i < pointRefs.length; i += 1) {
      const ptRef = pointRefs[i];
      const ptPos = this.getPointPosition(ptRef);

      const dist = position.distanceTo(ptPos);

      if (nearestDistance === undefined || dist < nearestDistance) {
        nearestDistance = dist;
        nearestPt = ptRef;
      }
    }

    return nearestPt;
  }
}
