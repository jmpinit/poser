import ReferencePoints from './reference-points';
import ModelInteractionHandler from './model-interaction-handler';
import CameraManager from './camera';

function getSelectedToolName() {
  return document.querySelector('input[name="sel-tool"]:checked').value;
}

function setStatusText(text) {
  const statusEl = document.getElementById('tool-status');
  statusEl.innerHTML = text;
}

function drawPt(ctx, x, y) {
  ctx.fillStyle = '#f00';
  const radius = 50;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, 2 * Math.PI, false);
  ctx.fill();

  console.log(ctx, x, y)
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
    this.currentToolName = getSelectedToolName();
    this.modelPointsManager = new ReferencePoints();
  }

  createCamRow(device, points, error, pose) {
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

      const viewingThisCamera = this.currentCameraId !== undefined
        && device.deviceId === this.currentCameraId;

      if (!viewingThisCamera) {
        this.startCamera(device.deviceId)
          .then(() => {
            viewCaptureButtonEl.innerHTML = 'Capture';

            // Draw the point pairs for this image after the image overlay has
            // been resized for this camera
            this.render();
          });
      } else {
        // Capture
        const videoCanvas = document.getElementById('video-input');
        const captureCanvas = document.getElementById(device.deviceId);

        const ctx = captureCanvas.getContext('2d');
        ctx.drawImage(videoCanvas, 0, 0);

        // Reset the point pairs for the new image
        this.currentPointPairs().length = 0;
      }
    });
    viewCaptureButtonItemEl.appendChild(viewCaptureButtonEl);
    rowEl.appendChild(viewCaptureButtonItemEl);

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
        });
      });

    const poseObject = this.scene.getObjectByName('pose-object');
    poseObject.add(this.modelPointsManager.threeObject);

    // Tool selection

    document.getElementsByName('sel-tool').forEach((el) => {
      el.addEventListener('click', () => {
        this.currentTool = getSelectedToolName();
        console.log(`Current tool is now ${this.currentToolName}`);
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
        this.handleCamClick(pixelX, pixelY);
      }
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

    pointPairs
      .filter(({ image }) => image !== undefined)
      .forEach(({ image }) => {
        console.log('Point at', image)
        const { x, y } = image;
        drawPt(ctx, x, y);
      });
  }

  render() {
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

  // Interaction

  handleModelClick(position) {
    const pointPairs = this.currentPointPairs();

    console.log('Model click', position);
    pointPairs.push({ model: position });
    this.render();
  }

  handleCamClick(x, y) {
    const pointPairs = this.currentPointPairs();

    console.log('Cam click', x, y);
    pointPairs.push({ image: { x, y } });
    this.render();
  }
}
