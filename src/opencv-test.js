// Adapted from https://docs.opencv.org/3.4/dd/d00/tutorial_js_video_display.html

import EventEmitter from 'eventemitter3';

class CameraManager extends EventEmitter {
  constructor(videoEl) {
    super();
    this.videoEl = videoEl;
    this.streaming = false;
  }

  start(width, height) {
    const videoConstraint = {
      width: { exact: width },
      height: { exact: height },
    };

    navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false })
      .then((stream) => {
        this.videoEl.srcObject = stream;
        this.videoEl.play();
        this.canPlayHandler = () => this.emit('canplay', this.stream, this.videoEl);
        this.videoEl.addEventListener('canplay', this.canPlayHandler, false);
        this.streaming = true;
      })
      .catch((err) => console.error(`Camera error: ${err.name} ${err.message}`));
  }

  stop() {
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video.removeEventListener('canplay', this.canPlayHandler);
    }

    if (this.stream) {
      this.stream.getVideoTracks()[0].stop();
    }

    this.streaming = false;
  }

  isStreaming() {
    return this.streaming;
  }
}

const videoInput = document.getElementById('videoInput');
const startAndStop = document.getElementById('startAndStop');

const cam = new CameraManager(videoInput);

function run() {
  function onVideoStopped() {
    const canvasOutput = document.getElementById('canvasOutput');
    const canvasContext = canvasOutput.getContext('2d');
    canvasContext.clearRect(0, 0, canvasOutput.width, canvasOutput.height);
    startAndStop.innerText = 'Start';
  }

  startAndStop.addEventListener('click', () => {
    if (!cam.isStreaming()) {
      cam.start(640, 480);
    } else {
      cam.stop();
      onVideoStopped();
    }
  });

  cam.on('canplay', () => {
    startAndStop.innerText = 'Stop';
    videoInput.width = videoInput.videoWidth;
    videoInput.height = videoInput.videoHeight;

    const video = document.getElementById('videoInput');
    const src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
    const dst = new cv.Mat(video.height, video.width, cv.CV_8UC1);
    const cap = new cv.VideoCapture(video);

    const FPS = 30;
    function processVideo() {
      try {
        if (!cam.isStreaming()) {
          // Cleanup and stop
          src.delete();
          dst.delete();
          return;
        }

        const begin = Date.now();

        // start processing.
        cap.read(src);
        cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
        cv.imshow('canvasOutput', dst);

        // Schedule the next update
        const delay = 1000 / FPS - (Date.now() - begin);
        setTimeout(processVideo, delay);
      } catch (err) {
        console.error(err);
      }
    }

    // schedule the first one.
    setTimeout(processVideo, 0);
  });
}

cv.onRuntimeInitialized = () => run();
