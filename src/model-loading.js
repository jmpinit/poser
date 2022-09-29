// import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
// import { STLLoader } from 'three/examples/jsm/loaders/STLLoader';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader';
import * as THREE from 'three';

/**
 * Attaches loaders for the model texture and the model geometry to the webpage
 */
export default function attachModelLoaders(scene) {
  const loader = new FBXLoader();

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

      object.traverse((child) => {
        if (child.material) {
          console.log('Material to replace:', child.material);
          // eslint-disable-next-line no-param-reassign
          child.material = new THREE.MeshBasicMaterial({ map: inputTexture });
        }
      });

      const poseObject = scene.getObjectByName('pose-object');

      if (poseObject === undefined) {
        throw new Error('Failed to find pose object in scene');
      }

      poseObject.add(object);
      URL.revokeObjectURL(url);

      console.log('3D model loaded');
    }, undefined, (error) => {
      console.error(error);
      URL.revokeObjectURL(url);
    });
  });
}
