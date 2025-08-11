import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';

class Loader {
  constructor() {
    this.textureLoader = new THREE.TextureLoader();
    this.hdriLoader = new RGBELoader();
  }

  loadTexture(url, onLoad, onProgress, onError) {
    return this.textureLoader.load(url, onLoad, onProgress, onError);
  }

  loadHDRI(url, onLoad, onProgress, onError) {
    return this.hdriLoader.load(url, onLoad, onProgress, onError);
  }
}

export default new Loader();