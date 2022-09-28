import * as THREE from 'three';
// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
// import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import EventEmitter from 'eventemitter3';
import ReferencePoints from './reference-points';
import MouseInteractionHandler from './mouse-interaction-handler';
import { solvePnP } from './cv';
import CameraManager from './camera';
import { CreateTool } from './tools';

const scene = new THREE.Scene();

const canvasEl = document.getElementById('viewport');
const renderer = new THREE.WebGLRenderer({ canvas: canvasEl });

// Create camera
// Aspect will be updated in the resize handler
const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 1000);

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

// CONSTRUCT SCENE

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

const loader = new FBXLoader();

const referencePoints = new ReferencePoints(128, 10);
poseObject.add(referencePoints.threeObject);

const controls = new OrbitControls(camera, renderer.domElement);
controls.update();

const rayCaster = new THREE.Raycaster();

const mouseInteractionHandler = new MouseInteractionHandler();
mouseInteractionHandler.connect(renderer.domElement);

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

function mousePositionOnObject(offsetX, offsetY) {
  const x = (offsetX / renderer.domElement.clientWidth) * 2 - 1;
  const y = -(offsetY / renderer.domElement.clientHeight) * 2 + 1;
  const pointer = new THREE.Vector2(x, y);

  rayCaster.setFromCamera(pointer, camera);

  const intersects = rayCaster.intersectObjects(scene.children);

  // TODO: filter to include only hits on a given object

  return intersects[0].point;
}

function render3dPoints() {
  // TODO: clear current points and add new ones
  referencePoints.clearPoints();

  // TODO: render the points slightly above the surface
  pointPairs
    .filter(({ object }) => object !== undefined)
    .forEach(({ object }) => referencePoints.addPoint(object, object.scale || 10));
}

mouseInteractionHandler.on('click', (event) => {
  const position = mousePositionOnObject(event.offsetX, event.offsetY);

  if (position === undefined) {
    // The user didn't click on the object's surface
    return;
  }

  currentTool.handleModelClick(position);
  render3dPoints();
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

  loader.load(url, (object) => {
    // const wireframe = new THREE.WireframeGeometry(geo);
    //
    // const line = new THREE.LineSegments(wireframe);
    // line.material.depthTest = false;
    // line.material.opacity = 0.25;
    // line.material.transparent = true;

    // poseObject.add(line);

    console.log(object)
    object.traverse((child) => {
      if (child.material) {
        console.log('Material to replace:', child.material);
        // eslint-disable-next-line no-param-reassign
        child.material = new THREE.MeshBasicMaterial({ map: inputTexture });
      }
    });

    poseObject.add(object);
    URL.revokeObjectURL(url);

    console.log('3D model loaded');
  }, undefined, (error) => {
    console.error(error);
    URL.revokeObjectURL(url);
  });
});

// Camera control

function getSelectedCameraId() {
  const camSelectEl = document.getElementById('sel-camera');
  return camSelectEl.value;
}

const videoInput = document.getElementById('video-input');
const videoOverlay = document.getElementById('video-overlay');

const cam = new CameraManager(videoInput);

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

// function run() {
//   cam.on('canplay', () => {
//     videoInput.width = videoInput.videoWidth;
//     videoInput.height = videoInput.videoHeight;
//
//     const video = document.getElementById('video-input');
//     const src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
//     const dst = new cv.Mat(video.height, video.width, cv.CV_8UC1);
//     const cap = new cv.VideoCapture(video);
//
//     const FPS = 30;
//     function processVideo() {
//       try {
//         if (!cam.isStreaming()) {
//           // Cleanup and stop
//           src.delete();
//           dst.delete();
//           return;
//         }
//
//         const begin = Date.now();
//
//         // start processing.
//         cap.read(src);
//         cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
//         cv.imshow('video-output', dst);
//
//         // Schedule the next update
//         const delay = 1000 / FPS - (Date.now() - begin);
//         setTimeout(processVideo, delay);
//       } catch (err) {
//         console.error(err);
//       }
//     }
//
//     // schedule the first one.
//     setTimeout(processVideo, 0);
//   });
// }

cv.onRuntimeInitialized = () => run();

let currentCameraId;

function startCamera(deviceId) {
  currentCameraId = deviceId;

  videoInput.play();

  cam.start(deviceId, 99999, 99999)
    .then(() => {
      // Hide all canvases
      Array.from(document.querySelectorAll('#capture-canvases canvas'))
        // eslint-disable-next-line no-param-reassign
        .forEach((canvas) => { canvas.style.display = 'none'; });

      const captureCanvas = document.getElementById(deviceId);
      captureCanvas.style.display = null;

      if (captureCanvas.getAttribute('width') === null) {
        // Set the size of the video overlay to match the resolution of the camera feed
        captureCanvas.setAttribute('width', cam.width);
        captureCanvas.setAttribute('height', cam.height);
      }
    });
}

// Populate the list of cameras

function createCamRow(device, points, error, pose) {
  const rowEl = document.createElement('tr');

  const nameEl = document.createElement('td');
  nameEl.innerHTML = device.label;
  rowEl.appendChild(nameEl);

  const viewCaptureButtonItemEl = document.createElement('td');
  const viewCaptureButtonEl = document.createElement('button');
  viewCaptureButtonEl.innerHTML = 'View';
  viewCaptureButtonEl.addEventListener('click', () => {
    // Reset all other view buttons
    Array.from(document.querySelectorAll('#cam-table button'))
      .filter((btn) => btn !== viewCaptureButtonEl)
      // eslint-disable-next-line no-param-reassign
      .forEach((btn) => { btn.innerHTML = 'View'; });

    const viewingThisCamera = currentCameraId !== undefined && device.deviceId === currentCameraId;

    if (!viewingThisCamera) {
      startCamera(device.deviceId);
      viewCaptureButtonEl.innerHTML = 'Capture';
    } else {
      // Capture
      const videoCanvas = document.getElementById('video-input');
      const captureCanvas = document.getElementById(device.deviceId);

      const ctx = captureCanvas.getContext('2d');
      ctx.drawImage(videoCanvas, 0, 0);
    }
  });
  viewCaptureButtonItemEl.appendChild(viewCaptureButtonEl);
  rowEl.appendChild(viewCaptureButtonItemEl);

  // const captureButtonItemEl = document.createElement('td');
  // const captureButtonEl = document.createElement('button');
  // captureButtonEl.innerHTML = 'Capture';
  // captureButtonEl.addEventListener('click', () => {
  //   const videoCanvas = document.getElementById('video-input');
  //   const captureCanvas = document.getElementById(device.deviceId);
  //
  //   const ctx = captureCanvas.getContext('2d');
  //   ctx.drawImage(videoCanvas, 0, 0);
  // });
  // captureButtonItemEl.appendChild(captureButtonEl);
  // rowEl.appendChild(captureButtonItemEl);

  const pointsEl = document.createElement('td');
  pointsEl.innerHTML = points;
  rowEl.appendChild(pointsEl);

  const errorEl = document.createElement('td');
  errorEl.innerHTML = error;
  rowEl.appendChild(errorEl);

  const poseEl = document.createElement('td');
  poseEl.innerHTML = pose;
  rowEl.appendChild(poseEl);

  return rowEl;
}

const camTableEl = document.getElementById('cam-table');
navigator.mediaDevices.enumerateDevices()
  .then((devices) => devices.filter((d) => d.kind === 'videoinput'))
  .then((devices) => {
    devices.forEach((device) => {
      // Create a canvas for the camera captures
      const capCanvasDivEl = document.getElementById('capture-canvases');

      // The dimensions will be updated when the camera is activated
      const capCanvasEl = document.createElement('canvas');
      capCanvasEl.setAttribute('id', device.deviceId);
      capCanvasDivEl.appendChild(capCanvasEl);

      // Add a row for the camera UI/info
      const camRowEl = createCamRow(device, 0, NaN, 'No solution');
      camTableEl.appendChild(camRowEl);
    });
  });

// Switch cameras when selection changes
// cameraSelectEl.addEventListener('change', () => {
//   if (cam.isStreaming()) {
//     cam.stop();
//   }
//
//   startSelectedCamera();
//
//   // Enable pause button
//   startPauseButtonEl.removeAttribute('disabled');
// });
//
// startPauseButtonEl.addEventListener('click', () => {
//   if (cam.isStreaming()) {
//     cam.stop();
//     videoInput.pause();
//
//     startPauseButtonEl.innerHTML = 'Start';
//   } else {
//     startSelectedCamera();
//   }
// });

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
