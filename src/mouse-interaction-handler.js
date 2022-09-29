import EventEmitter from 'eventemitter3';

export default class MouseInteractionHandler extends EventEmitter {
  constructor(dragThreshold = 1) {
    super();

    this.dragThreshold = dragThreshold;

    this.touchDownX = undefined;
    this.touchDownY = undefined;

    this.dragging = false;

    this.handlers = {};
  }

  distanceFromTouchDown(x, y) {
    if (this.touchDownX === undefined || this.touchDownY === undefined) {
      return undefined;
    }

    return Math.sqrt((x - this.touchDownX) ** 2 + (y - this.touchDownY) ** 2);
  }

  handleMouseDown(event) {
    this.touchDownX = event.offsetX;
    this.touchDownY = event.offsetY;

    this.emit('mousedown', event);
  }

  handleMouseMove(event) {
    const x = event.offsetX;
    const y = event.offsetY;

    if (this.distanceFromTouchDown(x, y) >= this.dragThreshold) {
      if (!this.dragging) {
        this.emit('dragstart', event);
      }

      this.dragging = true;
    }

    if (this.dragging) {
      this.emit('drag', event);
    }
  }

  handleMouseUp(event) {
    if (!this.dragging) {
      this.emit('click', event);
    } else {
      this.emit('dragend');
    }

    this.emit('mouseup', event);

    this.dragging = false;
    this.touchDownX = undefined;
    this.touchDownY = undefined;
  }

  connect(el) {
    this.disconnect();

    this.handlers = {
      mousedown: (event) => this.handleMouseDown(event),
      mousemove: (event) => this.handleMouseMove(event),
      mouseup: (event) => this.handleMouseUp(event),
    };

    Object.entries(this.handlers)
      .forEach(([eventName, handlerFn]) => el.addEventListener(eventName, handlerFn));

    this.el = el;
  }

  disconnect() {
    if (this.el === undefined) {
      return;
    }

    Object.entries(this.handlers)
      .forEach(([eventName, handlerFn]) => this.el.removeEventListener(eventName, handlerFn));
  }
}
