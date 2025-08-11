import Renderer from './Renderer.js';
import Scene from './Scene.js';
import Camera from './Camera.js';
import Environment from '../world/Environment.js';
import Road from '../world/Road.js';
import KeyboardControls from '../controls/KeyboardControls.js';

export default class App {
  constructor(container) {
    this.container = container;

    this.renderer = new Renderer({ container: this.container });
    this.scene = new Scene();
    this.camera = new Camera({ renderer: this.renderer });

    // World
    this.environment = new Environment({ scene: this.scene, renderer: this.renderer });
    this.road = new Road();
    this.scene.add(this.road.mesh);

    // Controls
    this.controls = new KeyboardControls({ camera: this.camera, domElement: this.renderer.domElement });

    // Resize handling
    window.addEventListener('resize', this.handleResize);
    this.handleResize();

    // Start render loop
    this.lastTime = performance.now();
    this.isRunning = true;
    this.renderer.setAnimationLoop(this.animate);
  }

  handleResize = () => {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.camera.handleResize(width, height);
    this.renderer.setSize(width, height);
  };

  animate = (time) => {
    const delta = Math.min(0.05, (time - this.lastTime) / 1000);
    this.lastTime = time;

    this.controls.update(delta);

    this.renderer.render(this.scene, this.camera);
  };

  dispose = () => {
    this.isRunning = false;
    this.renderer.setAnimationLoop(null);
    window.removeEventListener('resize', this.handleResize);

    this.controls.dispose();
    this.environment.dispose();
    this.road.dispose();
    this.camera.dispose();
    this.renderer.dispose();
  };
}