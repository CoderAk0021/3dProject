import * as THREE from 'three';

export default class Renderer extends THREE.WebGLRenderer {
  constructor({ container }) {
    const canvas = document.createElement('canvas');
    super({ antialias: true, canvas, alpha: false, stencil: false, powerPreference: 'high-performance' });

    this.outputColorSpace = THREE.SRGBColorSpace;
    this.toneMapping = THREE.ACESFilmicToneMapping;
    this.toneMappingExposure = 1.1;
    this.shadowMap.enabled = false;
    this.physicallyCorrectLights = true;

    container.appendChild(this.domElement);
  }
}