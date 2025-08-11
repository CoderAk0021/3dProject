import * as THREE from 'three';

export default class KeyboardControls {
  constructor({ camera, domElement }) {
    this.camera = camera;
    this.domElement = domElement;

    this.moveState = { forward: 0, backward: 0, left: 0, right: 0, up: 0, down: 0 };

    this._onKeyDown = (e) => this.handleKey(e, true);
    this._onKeyUp = (e) => this.handleKey(e, false);

    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
  }

  handleKey(e, isDown) {
    switch (e.code) {
      case 'KeyW':
      case 'ArrowUp':
        this.moveState.forward = isDown ? 1 : 0; break;
      case 'KeyS':
      case 'ArrowDown':
        this.moveState.backward = isDown ? 1 : 0; break;
      case 'KeyA':
      case 'ArrowLeft':
        this.moveState.left = isDown ? 1 : 0; break;
      case 'KeyD':
      case 'ArrowRight':
        this.moveState.right = isDown ? 1 : 0; break;
      case 'KeyQ':
        this.moveState.down = isDown ? 1 : 0; break;
      case 'KeyE':
        this.moveState.up = isDown ? 1 : 0; break;
      default: break;
    }
  }

  update(delta) {
    const speed = 18; // units per second
    const moveForward = (this.moveState.forward - this.moveState.backward) * speed * delta;
    const moveRight = (this.moveState.right - this.moveState.left) * speed * delta;
    const moveUp = (this.moveState.up - this.moveState.down) * speed * delta;

    // Move relative to camera orientation (yaw)
    const forward = this.getForwardVector();
    const right = this.getRightVector();

    this.camera.position.addScaledVector(forward, moveForward);
    this.camera.position.addScaledVector(right, moveRight);
    this.camera.position.y += moveUp;
  }

  getForwardVector() {
    const v = this.camera.getWorldDirection(new THREE.Vector3());
    v.y = 0;
    v.normalize();
    return v;
  }

  getRightVector() {
    const forward = this.getForwardVector();
    return new THREE.Vector3(forward.z, 0, -forward.x);
  }

  dispose() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
  }
}