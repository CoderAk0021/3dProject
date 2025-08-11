import * as THREE from 'three';

export default class Scene extends THREE.Scene {
  constructor() {
    super();

    this.background = new THREE.Color(0x0b0d10);

    // Subtle fog to help depth perception
    this.fog = new THREE.Fog(0x0b0d10, 50, 400);

    // Ground reference grid (disabled by default)
    // const grid = new THREE.GridHelper(500, 100, 0x333333, 0x222222);
    // this.add(grid);
  }
}