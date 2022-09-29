import EventEmitter from 'eventemitter3';
import * as THREE from 'three';
import MouseInteractionHandler from './mouse-interaction-handler';

function mousePositionOnObject(renderer, camera, scene, offsetX, offsetY) {
  const x = (offsetX / renderer.domElement.clientWidth) * 2 - 1;
  const y = -(offsetY / renderer.domElement.clientHeight) * 2 + 1;
  const pointer = new THREE.Vector2(x, y);

  const rayCaster = new THREE.Raycaster();
  rayCaster.setFromCamera(pointer, camera);

  const intersects = rayCaster.intersectObjects(scene.children);

  // TODO: filter to include only hits on a given object

  if (intersects.length === 0) {
    return undefined;
  }

  return intersects[0].point;
}

export default class ModelInteractionHandler extends EventEmitter {
  constructor(renderer, camera, scene) {
    super();

    this.renderer = renderer;
    this.camera = camera;
    this.scene = scene;

    this.mouseInteractionHandler = new MouseInteractionHandler();
    this.mouseInteractionHandler.connect(renderer.domElement);

    const create3dClickHandler = (eventName) => (event) => {
      const position = mousePositionOnObject(
        this.renderer,
        this.camera,
        this.scene,
        event.offsetX,
        event.offsetY,
      );

      if (position === undefined) {
        // The user didn't click on the object's surface
        return;
      }

      this.emit(eventName, position);
    };

    // Emit events from this object when mouse interactions happen with this object
    this.mouseInteractionHandler.on('click', create3dClickHandler('click'));
    this.mouseInteractionHandler.on('mousedown', create3dClickHandler('mousedown'));
    this.mouseInteractionHandler.on('dragstart', create3dClickHandler('dragstart'));
    this.mouseInteractionHandler.on('drag', create3dClickHandler('drag'));

    this.mouseInteractionHandler.on('mouseup', () => this.emit('mouseup'));
    this.mouseInteractionHandler.on('dragend', () => this.emit('dragend'));
  }
}
