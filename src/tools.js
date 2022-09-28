class Tool {
  constructor(pointPairs, setStatus) {
    if (this.constructor === Tool) {
      throw new Error("Abstract classes can't be instantiated.");
    }

    this.pointPairs = pointPairs;
    this.setStatus = setStatus;
  }

  // Camera overlay event handlers

  handleCamClick(x, y) {
    throw new Error('Unimplemented');
  }

  handleCamDrag(x, y) {
    throw new Error('Unimplemented');
  }

  handleCamMouseDown(x, y) {
    throw new Error('Unimplemented');
  }

  handleCamMouseUp(x, y) {
    throw new Error('Unimplemented');
  }

  // 3D model event handlers

  handleModelClick(position) {
    throw new Error('Unimplemented');
  }

  handleModelDrag(position) {
    throw new Error('Unimplemented');
  }

  handleModelMouseDown(position) {
    throw new Error('Unimplemented');
  }

  handleModelMouseUp(position) {
    throw new Error('Unimplemented');
  }

  // Utility

  lastPair() {
    if (this.pointPairs.length === 0) {
      return undefined;
    }

    return this.pointPairs[this.pointPairs.length - 1];
  }

  lastPairComplete() {
    const last = this.lastPair();

    if (last === undefined) {
      return false;
    }

    return last.camera !== undefined && last.object !== undefined;
  }

  /**
   * Called before switching tools
   */
  cleanup() {
    throw new Error('Unimplemented');
  }
}

export class SelectTool extends Tool {

}

export class CreateTool extends Tool {
  handleCamClick(x, y) {
    const last = this.lastPair();

    if (last !== undefined && last.object === undefined && last.camera !== undefined) {
      // Need to wait for the 3D point to be defined
      return;
    }

    if (last === undefined || this.lastPairComplete()) {
      // Create a new point pair
      this.pointPairs.push({});

      this.setStatus('Waiting for model point');
    }

    // Set the camera point position
    this.lastPair().camera = { x, y };
  }

  handleModelClick(position) {
    const last = this.lastPair();

    if (last !== undefined && last.object !== undefined && last.camera === undefined) {
      // Need to wait for the camera point to be defined
      return;
    }

    let pair = last;

    if (last === undefined || this.lastPairComplete()) {
      // Create a new point pair
      pair = {};
      this.pointPairs.push(pair);

      this.setStatus('Waiting for image point');
    }

    // Set the camera point position
    pair.object = position;
  }

  cleanup() {
    if (!this.lastPairComplete()) {
      // Remove the last, incomplete point pair
      this.pointPairs.splice(this.pointPairs.length - 1, 1);
    }
  }
}

export class MoveTool extends Tool {

}

export class DeleteTool extends Tool {

}
