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
// {
//   const geometry = new THREE.SphereGeometry(150, 32, 32);
//   const material = new THREE.MeshBasicMaterial({ color: 0xaaaaaaaa });
//   const testObj = new THREE.Mesh(geometry, material);
//   poseObject.add(testObj);
// }

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

cv.onRuntimeInitialized = () => {
  // HACK: maybe make this nicer later by queuing ops until runtime is ready?
  pointEditor.cvReady = true;
};
