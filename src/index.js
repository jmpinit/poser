import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import ReferencePoints from './reference-points';
import { solvePnP } from './cv';
import { CreateTool } from './tools';
import ModelInteractionHandler from './model-interaction-handler';
import attachWebcamControl from './webcam-control';
import attachModelLoaders from './model-loading';

// ==================
// SETUP 3D RENDERING
// ==================

const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById('viewport'),
});

// Create camera
// Aspect will be updated in the resize handler
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);

const scene = new THREE.Scene();

function handleResize() {
  const w = renderer.domElement.offsetWidth;
  const h = renderer.domElement.offsetHeight;

  camera.aspect = w / h;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
}
{
  const resizeObserver = new ResizeObserver(() => handleResize());
  resizeObserver.observe(renderer.domElement);
  handleResize();
}

// ===============
// CONSTRUCT SCENE
// ===============

camera.position.z = 450;

const light = new THREE.AmbientLight(0xffffff);
scene.add(light);

const poseObject = new THREE.Object3D();
poseObject.name = 'pose-object';
scene.add(poseObject);

// Create some test geometry
{
  const geometry = new THREE.SphereGeometry(150, 32, 32);
  const material = new THREE.MeshBasicMaterial({ color: 0xaaaaaaaa });
  const testObj = new THREE.Mesh(geometry, material);
  poseObject.add(testObj);
}

const referencePoints = new ReferencePoints(128, 10);
poseObject.add(referencePoints.threeObject);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

// =================
// SCENE INTERACTION
// =================

const modelInteractionHandler = new ModelInteractionHandler(renderer, camera, scene);

// Test ModelInteractionHandler
// modelInteractionHandler.on('click', (pos) => console.log('Model click at', pos));
// modelInteractionHandler.on('mousedown', (pos) => console.log('Model mousedown at', pos));
// modelInteractionHandler.on('mouseup', () => console.log('Model mouseup'));
// modelInteractionHandler.on('dragstart', (pos) => console.log('Model dragstart at', pos));
// modelInteractionHandler.on('drag', (pos) => console.log('Model drag at', pos));
// modelInteractionHandler.on('dragend', () => console.log('Model dragend'));

function setStatusText(text) {
  const statusEl = document.getElementById('tool-status');
  statusEl.innerHTML = text;
}

let pointOfInterest; // A point that may be dragged
let pointHeld; // A point being dragged

let currentTool;
const pointPairs = [];
const tools = {
  create: new CreateTool(pointPairs, setStatusText),
};

function render3dPoints() {
  // TODO: clear current points and add new ones
  referencePoints.clearPoints();

  // TODO: render the points slightly above the surface
  pointPairs
    .filter(({ object }) => object !== undefined)
    .forEach(({ object }) => referencePoints.addPoint(object, object.scale || 10));
}

function animate() {
  requestAnimationFrame(animate);

  controls.update();

  renderer.render(scene, camera);
}

animate();

attachModelLoaders(scene);
attachWebcamControl();

// TOOLS

function getSelectedToolName() {
  return document.querySelector('input[name="sel-tool"]:checked').value;
}

function handleToolChanged() {
  if (currentTool !== undefined) {
    currentTool.cleanup();
  }

  const toolName = getSelectedToolName();
  currentTool = tools[toolName];
  console.log(`Current tool is ${toolName}`);
}

document.getElementsByName('sel-tool').forEach((el) => {
  el.addEventListener('click', () => handleToolChanged());
});

// Init the tool when we load
// handleToolChanged();

function renderCamPoints() {
  function drawPt(ctx, x, y) {
    ctx.fillStyle = '#f00';
    const radius = 5;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
    ctx.fill();
  }

  const videoOverlay = document.getElementById('video-overlay');
  const ctx = videoOverlay.getContext('2d');

  for (let i = 0; i < pointPairs.length; i += 1) {
    if (pointPairs[i].camera !== undefined) {
      const { x, y } = pointPairs[i].camera;
      drawPt(ctx, x, y);
    }
  }
}

// videoOverlay.addEventListener('click', (event) => {
//   // Convert the click into image coordinates
//   const elementWidth = event.target.offsetWidth;
//   const elementHeight = event.target.offsetHeight;
//   const pixelX = (cam.width * event.offsetX) / elementWidth;
//   const pixelY = (cam.height * event.offsetY) / elementHeight;
//
//   if (currentTool !== undefined) {
//     currentTool.handleCamClick(pixelX, pixelY);
//     renderCamPoints();
//   }
// });

// ===========
// OPENCV TEST
// ===========

function run() {
  const imageWidth = 1920;
  const imageHeight = 1080;
  const sensorWidth = 0.036;
  const sensorHeight = (sensorWidth * imageHeight) / imageWidth;
  const focalLength = 0.05;

  const points2d = [
    0, 0,
    imageWidth - 1, 0,
    imageWidth - 1, imageHeight - 1,
    0, imageHeight - 1,
  ];

  const points3d = [
    -0.539905, -0.303625, 0,
    0.539754, -0.303495, 0,
    0.539412, 0.303165, 0,
    -0.539342, 0.303176, 0,
  ];

  console.log(solvePnP(imageWidth, imageHeight, sensorWidth, sensorHeight, focalLength, points2d, points3d));
}

cv.onRuntimeInitialized = () => run();
