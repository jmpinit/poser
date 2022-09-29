import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import { solvePnP } from './cv';
import attachModelLoaders from './model-loading';
import PointEditor from './point-editor';

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

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

// =================
// SCENE INTERACTION
// =================

function animate() {
  requestAnimationFrame(animate);

  controls.update();

  renderer.render(scene, camera);
}

animate();

attachModelLoaders(scene);

// =======
// EDITING
// =======

const pointEditor = new PointEditor(renderer, camera, scene);
pointEditor.setup();

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
