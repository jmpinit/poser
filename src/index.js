import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import ReferencePoints from './reference-points';
import MouseInteractionHandler from './mouse-interaction-handler';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);

const renderer = new THREE.WebGLRenderer();
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

const light = new THREE.AmbientLight(0xffffff);
scene.add(light);

const poseObject = new THREE.Object3D();
scene.add(poseObject);

// Create some test geometry
{
  const geometry = new THREE.SphereGeometry(150, 32, 32);
  const material = new THREE.MeshBasicMaterial({ color: 0xaaaaaaaa });
  const testObj = new THREE.Mesh(geometry, material);
  poseObject.add(testObj);
}

camera.position.z = 250;

const loader = new GLTFLoader();

const referencePoints = new ReferencePoints(128, 10);
poseObject.add(referencePoints.threeObject);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

const rayCaster = new THREE.Raycaster();

const mouseInteractionHandler = new MouseInteractionHandler();
mouseInteractionHandler.connect(renderer.domElement);

let pointOfInterest; // A point that may be dragged
let pointHeld; // A point being dragged

function mousePositionOnObject(offsetX, offsetY) {
  const x = (offsetX / renderer.domElement.clientWidth) * 2 - 1;
  const y = -(offsetY / renderer.domElement.clientHeight) * 2 + 1;
  const pointer = new THREE.Vector2(x, y);

  rayCaster.setFromCamera(pointer, camera);

  const intersects = rayCaster.intersectObjects(scene.children);

  // TODO: filter to include only hits on a given object

  return intersects[0].point;
}

mouseInteractionHandler.on('click', (event) => {
  const position = mousePositionOnObject(event.offsetX, event.offsetY);

  if (position === undefined) {
    return;
  }

  // TODO: create the point slightly above the surface
  referencePoints.addPoint(position, 1);
});

mouseInteractionHandler.on('mousedown', (event) => {
  const mousePosition3d = mousePositionOnObject(event.offsetX, event.offsetY);

  if (mousePosition3d === undefined) {
    return;
  }

  const nearestPt = referencePoints.getNearestPoint(mousePosition3d);

  if (nearestPt === undefined) {
    return;
  }

  const nearestPtPos = referencePoints.getPointPosition(nearestPt);

  if (mousePosition3d.distanceTo(nearestPtPos) < 5) {
    pointOfInterest = nearestPt;
    referencePoints.setPointScale(pointOfInterest, 10);
  }
});

mouseInteractionHandler.on('dragstart', () => {
  if (pointOfInterest !== undefined) {
    pointHeld = pointOfInterest;
    pointOfInterest = undefined;

    // Disable camera controls while we are dragging a point
    controls.enabled = false;
  }
});

mouseInteractionHandler.on('drag', (event) => {
  if (!pointHeld) {
    return;
  }

  const mousePosition3d = mousePositionOnObject(event.offsetX, event.offsetY);

  if (mousePosition3d === undefined) {
    return;
  }

  referencePoints.setPointPosition(pointHeld, mousePosition3d);
});

mouseInteractionHandler.on('dragend', () => {
  if (pointOfInterest !== undefined) {
    referencePoints.setPointScale(pointOfInterest, 1);
  }
  pointOfInterest = undefined;

  if (pointHeld !== undefined) {
    referencePoints.setPointScale(pointHeld, 1);
  }
  pointHeld = undefined;

  // Re-enable camera controls
  controls.enabled = true;
});

function animate() {
  requestAnimationFrame(animate);

  controls.update();

  renderer.render(scene, camera);
}

animate();

let inputTexture;
const inputTextureEl = document.getElementById('input-texture');
inputTextureEl.addEventListener('change', () => {
  const uploadedFile = inputTextureEl.files[0];
  const url = URL.createObjectURL(uploadedFile);

  const texLoader = new THREE.TextureLoader();
  inputTexture = texLoader.load(url);

  console.log('Texture loaded!', inputTexture);
});

const inputModelEl = document.getElementById('input-model');
inputModelEl.addEventListener('change', () => {
  const uploadedFile = inputModelEl.files[0];
  const url = URL.createObjectURL(uploadedFile);

  loader.load(url, function (gltf) {
    scene.add(gltf.scene);
    URL.revokeObjectURL(url);

    gltf.scene.traverse((child) => {
      if (child.material) {
        console.log('Material to replace:', child.material);
        child.material = new THREE.MeshBasicMaterial({ map: inputTexture });
      }
    });
  }, undefined, (error) => {
    console.error(error);
    URL.revokeObjectURL(url);
  });
});
