import * as THREE from 'three';

export default class Camera extends THREE.PerspectiveCamera {
  constructor({ renderer }) {
    super(60, 1, 0.1, 2000);

    this.renderer = renderer;

    // Initial position overlooking the road
    this.position.set(0, 6, 20);
    this.lookAt(new THREE.Vector3(0, 0, 0));

    // Mouse look state
    this.isLooking = false;
    this.yaw = 0;
    this.pitch = 0;

    this._onMouseDown = (e) => {
      if (e.button === 2) {
        this.isLooking = true;
        this.renderer.domElement.style.cursor = 'grabbing';
      }
    };
    this._onMouseUp = (e) => {
      if (e.button === 2) {
        this.isLooking = false;
        this.renderer.domElement.style.cursor = 'default';
      }
    };
    this._onContextMenu = (e) => e.preventDefault();

    this._onMouseMove = (e) => {
      if (!this.isLooking) return;
      const movementX = e.movementX || 0;
      const movementY = e.movementY || 0;

      const sensitivity = 0.0025;
      this.yaw -= movementX * sensitivity;
      this.pitch -= movementY * sensitivity;
      this.pitch = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, this.pitch));

      const dir = new THREE.Vector3(
        Math.sin(this.yaw) * Math.cos(this.pitch),
        Math.sin(this.pitch),
        Math.cos(this.yaw) * Math.cos(this.pitch)
      );
      const target = new THREE.Vector3().copy(this.position).add(dir);
      this.lookAt(target);
    };

    const el = this.renderer.domElement;
    el.addEventListener('mousedown', this._onMouseDown);
    el.addEventListener('mouseup', this._onMouseUp);
    el.addEventListener('mousemove', this._onMouseMove);
    el.addEventListener('contextmenu', this._onContextMenu);
  }

  handleResize(width, height) {
    this.aspect = width / height;
    this.updateProjectionMatrix();
  }

  dispose() {
    const el = this.renderer.domElement;
    el.removeEventListener('mousedown', this._onMouseDown);
    el.removeEventListener('mouseup', this._onMouseUp);
    el.removeEventListener('mousemove', this._onMouseMove);
    el.removeEventListener('contextmenu', this._onContextMenu);
  }
}