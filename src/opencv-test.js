// Adapted from https://docs.opencv.org/3.4/dd/d00/tutorial_js_video_display.html

function Utils(errorOutputId) { // eslint-disable-line no-unused-vars
  let self = this;
  this.errorOutput = document.getElementById(errorOutputId);

  this.createFileFromUrl = function(path, url, callback) {
    let request = new XMLHttpRequest();
    request.open('GET', url, true);
    request.responseType = 'arraybuffer';
    request.onload = function(ev) {
      if (request.readyState === 4) {
        if (request.status === 200) {
          let data = new Uint8Array(request.response);
          cv.FS_createDataFile('/', path, data, true, false, false);
          callback();
        } else {
          self.printError('Failed to load ' + url + ' status: ' + request.status);
        }
      }
    };
    request.send();
  };

  this.loadImageToCanvas = function(url, cavansId) {
    let canvas = document.getElementById(cavansId);
    let ctx = canvas.getContext('2d');
    let img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = function() {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0, img.width, img.height);
    };
    img.src = url;
  };

  this.printError = function(err) {
    console.log('OpenCV error:', err);
  };

  this.addFileInputHandler = function(fileInputId, canvasId) {
    let inputElement = document.getElementById(fileInputId);
    inputElement.addEventListener('change', (e) => {
      let files = e.target.files;
      if (files.length > 0) {
        let imgUrl = URL.createObjectURL(files[0]);
        self.loadImageToCanvas(imgUrl, canvasId);
      }
    }, false);
  };

  function onVideoCanPlay() {
    if (self.onCameraStartedCallback) {
      self.onCameraStartedCallback(self.stream, self.video);
    }
  }

  this.startCamera = function(resolution, callback, videoId) {
    const constraints = {
      'qvga': {width: {exact: 320}, height: {exact: 240}},
      'vga': {width: {exact: 640}, height: {exact: 480}}};
    let video = document.getElementById(videoId);
    if (!video) {
      video = document.createElement('video');
    }

    let videoConstraint = constraints[resolution];
    if (!videoConstraint) {
      videoConstraint = true;
    }

    navigator.mediaDevices.getUserMedia({video: videoConstraint, audio: false})
      .then(function(stream) {
        video.srcObject = stream;
        video.play();
        self.video = video;
        self.stream = stream;
        self.onCameraStartedCallback = callback;
        video.addEventListener('canplay', onVideoCanPlay, false);
      })
      .catch(function(err) {
        self.printError('Camera Error: ' + err.name + ' ' + err.message);
      });
  };

  this.stopCamera = function() {
    if (this.video) {
      this.video.pause();
      this.video.srcObject = null;
      this.video.removeEventListener('canplay', onVideoCanPlay);
    }
    if (this.stream) {
      this.stream.getVideoTracks()[0].stop();
    }
  };
}

let utils = new Utils('errorMessage');

let streaming = false;
let videoInput = document.getElementById('videoInput');
let startAndStop = document.getElementById('startAndStop');
let canvasOutput = document.getElementById('canvasOutput');
let canvasContext = canvasOutput.getContext('2d');

function codeEditorCode() {
  let video = document.getElementById('videoInput');
  let src = new cv.Mat(video.height, video.width, cv.CV_8UC4);
  let dst = new cv.Mat(video.height, video.width, cv.CV_8UC1);
  let cap = new cv.VideoCapture(video);

  const FPS = 30;
  function processVideo() {
    try {
      if (!streaming) {
        // clean and stop.
        src.delete();
        dst.delete();
        return;
      }

      let begin = Date.now();

      // start processing.
      cap.read(src);
      cv.cvtColor(src, dst, cv.COLOR_RGBA2GRAY);
      cv.imshow('canvasOutput', dst);

      // schedule the next one.
      let delay = 1000/FPS - (Date.now() - begin);
      setTimeout(processVideo, delay);
    } catch (err) {
      utils.printError(err);
    }
  }

  // schedule the first one.
  setTimeout(processVideo, 0);
}

function run() {
  startAndStop.addEventListener('click', () => {
    if (!streaming) {
      utils.startCamera('qvga', onVideoStarted, 'videoInput');
    } else {
      utils.stopCamera();
      onVideoStopped();
    }
  });

  function onVideoStarted() {
    streaming = true;
    startAndStop.innerText = 'Stop';
    videoInput.width = videoInput.videoWidth;
    videoInput.height = videoInput.videoHeight;

    codeEditorCode();
  }

  function onVideoStopped() {
    streaming = false;
    canvasContext.clearRect(0, 0, canvasOutput.width, canvasOutput.height);
    startAndStop.innerText = 'Start';
  }
}

cv['onRuntimeInitialized'] = () => run();
