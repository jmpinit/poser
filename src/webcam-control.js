import CameraManager from './camera';

export default function attachCamControl() {
  const videoInput = document.getElementById('video-input');

  const cam = new CameraManager(videoInput);

  let currentCameraId;

  function startCamera(deviceId) {
    currentCameraId = deviceId;

    videoInput.play();

    cam.start(deviceId, 99999, 99999)
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
          captureCanvas.setAttribute('width', cam.width);
          captureCanvas.setAttribute('height', cam.height);
        }

        // Set the overlay resolution to match the current camera image
        const imageOverlayCanvas = document.getElementById('image-overlay');
        imageOverlayCanvas.setAttribute('width', captureCanvas.width);
        imageOverlayCanvas.setAttribute('height', captureCanvas.height);
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

      const viewingThisCamera = currentCameraId !== undefined
        && device.deviceId === currentCameraId;

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
}
