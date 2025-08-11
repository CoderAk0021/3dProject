import * as THREE from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export default class Environment {
  constructor({ scene, renderer }) {
    this.scene = scene;
    this.renderer = renderer;

    this.pmrem = new THREE.PMREMGenerator(this.renderer);
    this.pmrem.compileEquirectangularShader();

    // Try to load an HDRI from assets; fallback to RoomEnvironment if not found
    const hdriPath = '/assets/envmaps/studio.hdr';

    new RGBELoader()
      .load(
        hdriPath,
        (texture) => {
          texture.mapping = THREE.EquirectangularReflectionMapping;
          const envMap = this.pmrem.fromEquirectangular(texture).texture;
          texture.dispose();
          this.applyEnvironment(envMap, true);
        },
        undefined,
        () => {
          const env = new RoomEnvironment();
          const envMap = this.pmrem.fromScene(env, 0.04).texture;
          this.applyEnvironment(envMap, false);
          env.dispose();
        }
      );

    // Add a large ground plane to catch the road
    const ground = new THREE.Mesh(
      new THREE.CircleGeometry(500, 64),
      new THREE.MeshStandardMaterial({ color: 0x0f1116, metalness: 0.0, roughness: 1.0 })
    );
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.01;
    ground.receiveShadow = false;
    this.ground = ground;
    this.scene.add(ground);

    // Ambient light to fill shadows
    const ambient = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambient);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight.position.set(10, 20, 10);
    dirLight.castShadow = false;
    this.scene.add(dirLight);
  }

  applyEnvironment(envMap, setBackground) {
    this.scene.environment = envMap;
    if (setBackground) {
      this.scene.background = envMap;
    }
  }

  dispose() {
    if (this.ground) {
      this.scene.remove(this.ground);
      this.ground.geometry?.dispose();
      this.ground.material?.dispose();
    }
    if (this.scene.environment && this.scene.environment.dispose) {
      this.scene.environment.dispose();
    }
    this.pmrem?.dispose();
  }
}