import EventEmitter from 'eventemitter3';

export default class CameraManager extends EventEmitter {
  constructor(videoEl) {
    super();

    this.videoEl = videoEl;
    this.streaming = false;

    // Current video feed width and height
    this.width = undefined;
    this.height = undefined;
  }

  start(deviceId, width, height) {
    const deviceConstraints = {
      audio: false,
      video: {
        deviceId,
        width: { ideal: width },
        height: { ideal: height },
      },
    };

    return navigator.mediaDevices.getUserMedia(deviceConstraints)
      .then((stream) => {
        const videoSettings = stream.getVideoTracks()[0].getSettings();

        this.width = videoSettings.width;
        this.height = videoSettings.height;

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
