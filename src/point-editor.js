import * as THREE from 'three';
import Ajv from 'ajv';
import YAML from 'yaml';
import ReferencePoints from './reference-points';
import ModelInteractionHandler from './model-interaction-handler';
import CameraManager from './camera';
import { solvePnPRaw, distance } from './cv';

const ajv = new Ajv();

const SELECT_RADIUS = 10;

const validateCamInfo = ajv.compile({
  type: 'object',
  properties: {
    camera_matrix: {
      type: 'object',
      properties: {
        rows: { type: 'integer' },
        cols: { type: 'integer' },
        data: {
          type: 'array',
          minItems: 9,
          maxItems: 9,
        },
      },
      required: ['rows', 'cols', 'data'],
    },
    distortion_coefficients: {
      type: 'object',
      properties: {
        rows: { type: 'integer' },
        cols: { type: 'integer' },
        data: {
          type: 'array',
          minItems: 8,
          maxItems: 8,
        },
      },
      required: ['rows', 'cols', 'data'],
    },
    distortion_model: { type: 'string' },
    image_width: { type: 'integer' },
    image_height: { type: 'integer' },
  },
  required: ['camera_matrix', 'distortion_coefficients', 'distortion_model', 'image_width', 'image_height'],
});

function getSelectedToolName() {
  return document.querySelector('input[name="sel-tool"]:checked').value;
}

function setStatusText(text) {
  const statusEl = document.getElementById('tool-status');
  statusEl.innerHTML = text;
}

function drawPt(ctx, x, y) {
  ctx.strokeStyle = '#f0f';

  ctx.beginPath();
  ctx.moveTo(x - 5, y - 5);
  ctx.lineTo(x + 5, y + 5);
  ctx.moveTo(x + 5, y - 5);
  ctx.lineTo(x - 5, y + 5);
  ctx.stroke();
}

function downloadObjectAsJson(exportObj, exportName) {
  // Adapted from https://stackoverflow.com/a/30800715
  const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(exportObj))}`;
  const downloadAnchorNode = document.createElement('a');
  downloadAnchorNode.setAttribute('href', dataStr);
  downloadAnchorNode.setAttribute('download', `${exportName}.json`);
  document.body.appendChild(downloadAnchorNode); // required for Firefox
  downloadAnchorNode.click();
  downloadAnchorNode.remove();
}

function assertValidCameraInfo(camInfo) {
  const valid = validateCamInfo(camInfo);

  if (!valid) {
    throw new Error(ajv.errorsText(validateCamInfo.errors));
  }
}

/**
 * Main controller for editing points across 3D model and image
 */
export default class PointEditor {
  constructor(renderer, camera, scene) {
    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;

    this.pointPairs = {};
    this.solutions = {};
    this.cameraInfo = {};
    this.currentToolName = getSelectedToolName();
    this.modelPointsManager = new ReferencePoints();
    this.cvReady = false;
  }

  createCamRow(device, points, error, pose) {
    const rowEl = document.createElement('tr');
    rowEl.setAttribute('id', `row-${device.deviceId}`);

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

      const viewingThisCamera = this.currentCameraId !== undefined
        && device.deviceId === this.currentCameraId;

      const videoCanvas = document.getElementById('video-input');
      const captureCanvas = document.getElementById(device.deviceId);

      if (!viewingThisCamera) {
        // Cancel finishing the current point pair if it's incomplete
        this.cancelIncompletePair();

        this.startCamera(device.deviceId)
          .then(() => {
            viewCaptureButtonEl.innerHTML = 'Capture';

            // Draw the point pairs for this image after the image overlay has
            // been resized for this camera
            this.render();
          });
      } else {
        // Capture

        const ctx = captureCanvas.getContext('2d');
        ctx.drawImage(videoCanvas, 0, 0, captureCanvas.width, captureCanvas.height);

        // Reset the point pairs for the new image
        this.currentPointPairs().length = 0;
        this.render();
      }
    });
    viewCaptureButtonItemEl.appendChild(viewCaptureButtonEl);
    rowEl.appendChild(viewCaptureButtonItemEl);

    const uploadCamInfoButtonItemEl = document.createElement('td');
    const uploadCamInfo = document.createElement('input');
    uploadCamInfo.setAttribute('type', 'file');
    uploadCamInfo.setAttribute('accept', '.json,.yml');
    uploadCamInfo.addEventListener('change', () => {
      const uploadedFile = uploadCamInfo.files[0];
      const fileReader = new FileReader();
      fileReader.onload = (event) => {
        console.log(uploadedFile.name);

        try {
          let cameraInfo;

          if (uploadedFile.name.endsWith('.yml')) {
            cameraInfo = YAML.parse(event.target.result);
          } else if (uploadedFile.name.endsWith('.json')) {
            cameraInfo = JSON.parse(event.target.result);
          } else {
            alert('Unrecognized file type');
          }

          assertValidCameraInfo(cameraInfo);

          this.cameraInfo[device.deviceId] = {
            ...this.cameraInfo[device.deviceId],
            ...cameraInfo,
          };

          console.log(this.cameraInfo);
        } catch (e) {
          console.error('Failed to read uploaded file as JSON:', e);
        }
      };
      fileReader.readAsText(uploadedFile);
    });
    uploadCamInfoButtonItemEl.appendChild(uploadCamInfo);
    rowEl.appendChild(uploadCamInfoButtonItemEl);

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

  setup() {
    // Webcam control

    const videoInput = document.getElementById('video-input');
    this.cam = new CameraManager(videoInput);

    // Populate the list of cameras

    const camTableEl = document.getElementById('cam-table');
    navigator.mediaDevices.enumerateDevices()
      .then((devices) => devices.filter((d) => d.kind === 'videoinput'))
      .then((devices) => {
        devices.forEach((device) => {
          this.cameraInfo[device.deviceId] = {
            label: device.label,
          };

          // Each camera will have an associated list of point pairs
          this.pointPairs[device.deviceId] = [];

          // Create a canvas for the camera captures
          const capCanvasDivEl = document.getElementById('capture-canvases');

          // The dimensions will be updated when the camera is activated
          const capCanvasEl = document.createElement('canvas');
          capCanvasEl.setAttribute('id', device.deviceId);
          capCanvasDivEl.appendChild(capCanvasEl);

          // Add a row for the camera UI/info
          const camRowEl = this.createCamRow(device, 0, NaN, 'No solution');
          camTableEl.appendChild(camRowEl);

          // Add a 3D object to the scene to represent the pose solution for the camera
          const axesHelper = new THREE.AxesHelper(50);
          axesHelper.name = device.deviceId;
          this.scene.add(axesHelper);
        });
      });

    const poseObject = this.scene.getObjectByName('pose-object');
    poseObject.add(this.modelPointsManager.threeObject);

    // Tool selection

    document.getElementsByName('sel-tool').forEach((el) => {
      el.addEventListener('click', () => {
        const toolSelected = getSelectedToolName();

        if (toolSelected !== this.currentToolName) {
          // Handle tool change

          // If we were in the middle of creating a new point pair, cancel it
          this.cancelIncompletePair();

          this.currentToolName = toolSelected;
          console.log(`Current tool is now ${this.currentToolName}`);
        }
      });
    });

    // Wire up interaction events

    const modelInteractionHandler = new ModelInteractionHandler(
      this.renderer,
      this.camera,
      this.scene,
    );
    modelInteractionHandler.on('click', (position) => this.handleModelClick(position));

    const imageOverlayCanvas = document.getElementById('image-overlay');
    imageOverlayCanvas.addEventListener('click', (event) => {
      // Convert the click into image coordinates
      const elementWidth = event.target.offsetWidth;
      const elementHeight = event.target.offsetHeight;
      const pixelX = (imageOverlayCanvas.width * event.offsetX) / elementWidth;
      const pixelY = (imageOverlayCanvas.height * event.offsetY) / elementHeight;

      if (this.currentToolName !== undefined) {
        this.handleImageClick(pixelX, pixelY);
      }
    });

    // Export button
    document.getElementById('btn-export-solution').addEventListener('click', () => {
      console.log(JSON.stringify(this.solutions));
      downloadObjectAsJson(this.solutions, 'camera-solutions');
    });
  }

  // Rendering

  currentPointPairs() {
    return this.pointPairs[this.currentCameraId];
  }

  updateModelPoints() {
    const pointPairs = this.currentPointPairs();
    console.log('Rendering model points', pointPairs);

    this.modelPointsManager.clearPoints();

    // TODO: render the points slightly above the surface
    pointPairs
      .filter(({ model }) => model !== undefined)
      .forEach(({ model }) => this.modelPointsManager.addPoint(model, model.scale || 10));
  }

  renderImagePoints() {
    const pointPairs = this.currentPointPairs();
    console.log('Rendering image points', pointPairs);

    const imageOverlay = document.getElementById('image-overlay');
    const ctx = imageOverlay.getContext('2d');

    ctx.clearRect(0, 0, imageOverlay.width, imageOverlay.height);

    pointPairs
      .filter(({ image }) => image !== undefined)
      .forEach(({ image }) => {
        const { x, y } = image;
        drawPt(ctx, x, y);
      });
  }

  render() {
    if (this.lastPairComplete()) {
      this.updateSolution();
    }

    this.updateModelPoints();
    this.renderImagePoints();
  }

  // Webcam control

  startCamera(deviceId) {
    this.currentCameraId = deviceId;

    const videoInput = document.getElementById('video-input');
    videoInput.play();

    return this.cam.start(deviceId, 99999, 99999)
      .then(() => {
        const captureCanvas = document.getElementById(deviceId);

        // Show the capture canvas for this camera
        captureCanvas.style.display = null;

        // Hide all other capture canvases
        Array.from(document.querySelectorAll('#capture-canvases canvas'))
          .filter((canvas) => canvas !== captureCanvas)
          // eslint-disable-next-line no-param-reassign
          .forEach((canvas) => { canvas.style.display = 'none'; });

        if (captureCanvas.getAttribute('width') === null) {
          // Set the size of the capture canvas to match the resolution of the camera feed
          captureCanvas.setAttribute('width', this.cam.width);
          captureCanvas.setAttribute('height', this.cam.height);
        }

        // Set the overlay resolution to match the current camera image
        const imageOverlayCanvas = document.getElementById('image-overlay');
        imageOverlayCanvas.setAttribute('width', captureCanvas.width);
        imageOverlayCanvas.setAttribute('height', captureCanvas.height);
      });
  }

  // Computer vision

  updateSolution() {
    if (this.cameraInfo[this.currentCameraId] === undefined) {
      return;
    }

    const pairs = this.completePairs();

    if (pairs.length < 4) {
      // Not enough points for a solution yet
      return;
    }

    const pointsEl = document.querySelector(`#row-${this.currentCameraId} :nth-child(4)`);
    pointsEl.innerHTML = pairs.length;

    if (!this.cvReady) {
      // Abort if OpenCV is not ready yet
      // Flag is set by cv.onRuntimeInitialized externally
      return;
    }

    const captureCanvas = document.getElementById(this.currentCameraId);

    const imageWidth = captureCanvas.width;
    const imageHeight = captureCanvas.height;
    const sensorWidth = 0.036;
    const sensorHeight = (sensorWidth * imageHeight) / imageWidth;
    const focalLength = 0.05;

    // const points2d = [
    //   0, 0,
    //   imageWidth - 1, 0,
    //   imageWidth - 1, imageHeight - 1,
    //   0, imageHeight - 1,
    // ];
    //
    // const points3d = [
    //   -0.539905, -0.303625, 0,
    //   0.539754, -0.303495, 0,
    //   0.539412, 0.303165, 0,
    //   -0.539342, 0.303176, 0,
    // ];

    const {
      camera_matrix: camMatrix,
      distortion_coefficients: distortionCoeffs,
    } = this.cameraInfo[this.currentCameraId];
    console.log(this.cameraInfo[this.currentCameraId]);

    const points2d = pairs.map(({ image }) => [image.x, image.y]).flat();
    const points3d = pairs.map(({ model }) => [model.x, model.y, model.z]).flat();

    try {
      const solution = solvePnPRaw(
        points3d,
        points2d,
        camMatrix.data,
        distortionCoeffs.data,
      );

      this.solutions[this.currentCameraId] = {
        label: this.cameraInfo[this.currentCameraId].label,
        pose: solution,
      };

      // TODO: calculate and update re-projection error
      const errorEl = document.querySelector(`#row-${this.currentCameraId} :nth-child(5)`);
      errorEl.innerHTML = `${Math.round(solution.error * 1000) / 1000}`;

      const poseEl = document.querySelector(`#row-${this.currentCameraId} :nth-child(6)`);
      poseEl.innerHTML = JSON.stringify(solution);

      // Update the camera object in the 3D scene
      const camAxes = this.scene.getObjectByName(this.currentCameraId);
      camAxes.position.set(solution.position.x, solution.position.y, solution.position.z);
      const camRot = new THREE.Euler(solution.rotation.x, solution.rotation.y, solution.rotation.z, 'XYZ');
      camAxes.setRotationFromEuler(camRot);
    } catch (e) {
      console.error(e);
    }
  }

  // Interaction

  lastPair() {
    const pointPairs = this.currentPointPairs();

    if (pointPairs === undefined || pointPairs.length === 0) {
      return undefined;
    }

    return pointPairs[pointPairs.length - 1];
  }

  lastPairComplete() {
    const last = this.lastPair();

    if (last === undefined) {
      return false;
    }

    return last.image !== undefined && last.model !== undefined;
  }

  completePairs() {
    return this.currentPointPairs()
      .filter((pp) => pp.image !== undefined && pp.model !== undefined);
  }

  readyForNewPair() {
    return this.lastPair() === undefined || this.lastPairComplete();
  }

  cancelIncompletePair() {
    if (this.currentPointPairs() !== undefined && !this.lastPairComplete()) {
      const pointPairs = this.currentPointPairs();
      pointPairs.splice(pointPairs.length - 1, 1);
    }

    setStatusText('');
  }

  waitingForModelPoint() {
    if (this.readyForNewPair()) {
      return false;
    }

    return this.lastPair().model === undefined;
  }

  waitingForImagePoint() {
    if (this.readyForNewPair()) {
      return false;
    }

    return this.lastPair().image === undefined;
  }

  nearestImagePoint(x, y) {
    let nearest;
    let nearestDist;

    const imagePoints = this.currentPointPairs().map(({ image }) => image);

    for (let i = 0; i < imagePoints.length; i += 1) {
      const pt = imagePoints[i];
      const dist = distance(pt.x, pt.y, x, y);

      if (nearest === undefined || dist < nearestDist) {
        nearest = pt;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  nearestModelPoint(position) {
    let nearest;
    let nearestDist;

    const modelPoints = this.currentPointPairs().map(({ model }) => model);

    for (let i = 0; i < modelPoints.length; i += 1) {
      const pt = modelPoints[i];
      const dist = position.distanceTo(pt);

      if (nearest === undefined || dist < nearestDist) {
        nearest = pt;
        nearestDist = dist;
      }
    }

    return nearest;
  }

  handleModelClick(position) {
    console.log('Model click', position, this.currentPointPairs());

    if (this.currentToolName === 'create') {
      if (this.waitingForImagePoint()) {
        // Need to wait for the camera point to be defined
        // before we define any more model points
        return;
      }

      if (this.readyForNewPair()) {
        // Add a new empty point pair
        this.currentPointPairs().push({});

        setStatusText('Waiting for image point');
      } else {
        // This model point finishes the pair so we can clear the status text
        setStatusText('');
      }

      // Set the camera point position
      this.lastPair().model = position;
    } else if (this.currentToolName === 'move') {

    } else if (this.currentToolName === 'delete') {
      const nearest = this.nearestModelPoint(position);

      if (nearest !== undefined && position.distanceTo(nearest) <= SELECT_RADIUS) {
        // Remove the selected point
        this.pointPairs[this.currentCameraId] = this.currentPointPairs()
          .filter(({ model }) => model !== nearest);

        console.log('Deleted', nearest);
      }
    }

    this.render();
  }

  handleImageClick(x, y) {
    if (this.currentToolName === 'create') {
      if (this.waitingForModelPoint()) {
        // Need to wait for the model point to be defined
        // before we define any more model points
        return;
      }

      if (this.readyForNewPair()) {
        // Add a new empty point pair
        this.currentPointPairs().push({});

        setStatusText('Waiting for model point');
      } else {
        // This image point finishes the pair so we can clear the status text
        setStatusText('');
      }

      // Set the camera point position
      this.lastPair().image = { x, y };
    } else if (this.currentToolName === 'move') {

    } else if (this.currentToolName === 'delete') {
      const nearest = this.nearestImagePoint(x, y);

      if (nearest !== undefined && distance(x, y, nearest.x, nearest.y) <= SELECT_RADIUS) {
        // Remove the selected point
        this.pointPairs[this.currentCameraId] = this.currentPointPairs()
          .filter(({ image }) => image !== nearest);

        console.log('Deleted', nearest);
      }
    }

    this.render();
  }
}
