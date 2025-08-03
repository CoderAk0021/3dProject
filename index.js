import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import { add } from "three/tsl";

// Scene, Camera, Renderer
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  1000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
document.body.appendChild(renderer.domElement);

// Loaders

const roadTexture = new THREE.TextureLoader().load("src/assets/road.jpg");
roadTexture.wrapS = roadTexture.wrapT = THREE.RepeatWrapping;
roadTexture.anisotropy = 16; // Improve quality
roadTexture.magFilter = THREE.LinearFilter;
roadTexture.minFilter = THREE.LinearMipMapLinearFilter;
roadTexture.encoding = THREE.sRGBEncoding; // Ensuree
//rotate the texture
roadTexture.rotation = Math.PI / 2; // Rotate to align with road
roadTexture.center.set(0.5, 0.5); // Set rotation center to middle
roadTexture.repeat.set(1, 10); // Repeat along length

const roadMaterial = new THREE.MeshStandardMaterial({ map: roadTexture });
const road = new THREE.Mesh(new THREE.PlaneGeometry(2000, 10), roadMaterial);
road.rotation.x = -Math.PI / 2;
road.position.y = 0.01; // Slightly above ground
scene.add(road);

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader().setPath("src/assets/").load("env.hdr", (hdrTexture) => {
  const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
  scene.environment = envMap;
  scene.background = envMap;

  hdrTexture.dispose();
  pmremGenerator.dispose();
});

// Lights
scene.add(new THREE.AmbientLight(0x404040));
const light = new THREE.DirectionalLight(0xffffff, 1);
light.position.set(10, 10, 10);
scene.add(light);

// Physics world
const world = new CANNON.World();
world.gravity.set(0, -9.82, 0);


// ground body
const groundBody = new CANNON.Body({ mass: 0 });
groundBody.addShape(new CANNON.Plane());
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
world.addBody(groundBody);

// Ground mesh
const groundGeo = new THREE.PlaneGeometry(2000, 2000);
const groundMat = new THREE.MeshStandardMaterial({
  color: 0x00ce23,
  bumpScale: 0.5,
  metalness: 0.3,
  roughness: 0.9,
  envMap: scene.environment,
});
const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
scene.add(ground);

const gltfLoader = new GLTFLoader();

// Car chassis body
const chassisBody = new CANNON.Body({ mass: 150 });
const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
chassisBody.addShape(chassisShape);
chassisBody.position.set(0, 0, 0);
world.addBody(chassisBody);
// add contact material to the world
const contactMaterial = new CANNON.ContactMaterial(
  chassisShape,
  groundBody.shapes[0],
    {
    friction: 0.5,
    restitution: 0.1,
  }
);
world.addContactMaterial(contactMaterial);

//add wheelGroundContactMaterial
const wheelGroundContactMaterial = new CANNON.ContactMaterial(
  chassisShape,
  groundBody.shapes[0],
    {
    friction: 0.9,
    restitution: 0.1,
  }
);
world.addContactMaterial(wheelGroundContactMaterial);

let chassisMesh = null;
let vehicleGroup = null;

gltfLoader.load(
  "src/assets//cybertruck.glb",
  (gltf) => {
    chassisMesh = gltf.scene;
    chassisMesh.traverse((child) => {
      if (child.name.toLowerCase().includes("wheel")) {
        child.visible = false;
      }
      if (child.isMesh) {
        child.position.set(0.095, 0, 0.4); // Adjust position to match physics body
      }
    });

    vehicleGroup = new THREE.Group();
    chassisMesh.scale.set(1, 1, 1);
    scene.add(chassisMesh);
  },
  (e) => {},
  (err) => console.error(err)
);

// Vehicle setup
const vehicle = new CANNON.RaycastVehicle({
  chassisBody,
  indexRightAxis: 0,
  indexUpAxis: 1,
  indexForwardAxis: 2,
});
const wheelOptions = {
  radius: 0.4,
  directionLocal: new CANNON.Vec3(0, -1, 0),
  suspensionStiffness: 30,
  suspensionRestLength: 0.3,
  frictionSlip: 5,
  dampingRelaxation: 2.3,
  dampingCompression: 4.4,
  maxSuspensionForce: 100000,
  rollInfluence: 0.01,
  axleLocal: new CANNON.Vec3(-1, 0, 0),
  chassisConnectionPointLocal: new CANNON.Vec3(),
  maxSuspensionTravel: 0.3,
};
const wheelPositions = [
  new CANNON.Vec3(-1, 0, -1.6),
  new CANNON.Vec3(1, 0, -1.6),
  new CANNON.Vec3(-1, 0, 1.6),
  new CANNON.Vec3(1, 0, 1.6),
];
wheelPositions.forEach((pos) => {
  wheelOptions.chassisConnectionPointLocal.copy(pos);
  vehicle.addWheel(wheelOptions);
});
vehicle.addToWorld(world);

// Wheel visuals
const loader = new THREE.TextureLoader();
const colorMap = loader.load("src/wheel/wheel_color.jpg");
colorMap.rotation = Math.PI / 2;
colorMap.center.set(0.5, 0.5);

const normalMap = loader.load("src/wheel/wheel_normal.jpg");
normalMap.rotation = Math.PI / 2;
normalMap.center.set(0.5, 0.5);

const roughnessMap = loader.load("src/wheel/wheel_roughness.jpg");
roughnessMap.rotation = Math.PI / 2;
roughnessMap.center.set(0.5, 0.5);

const wheelMeshes = vehicle.wheelInfos.map(() => {
  const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
  geo.rotateZ(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    map: colorMap,
    normalMap: normalMap,
    roughnessMap: roughnessMap,
    metalness: 0,
    roughness: 1,
    envMap: scene.environment,
  });
  const mesh = new THREE.Mesh(geo, mat);
  scene.add(mesh);
  return mesh;
});

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.minDistance = 5;
controls.maxDistance = 20;
controls.minPolarAngle = Math.PI / 4;
controls.maxPolarAngle = Math.PI / 2.1;

// Input map
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

camera.position.set(0, 3, -8);
controls.target.copy(chassisBody.position);

// ====== AUDIO SETUP ======
const listener = new THREE.AudioListener();
camera.add(listener); // Attach to camera

const engineSound = new THREE.Audio(listener);
const brakeSound = new THREE.Audio(listener);

const audioLoader = new THREE.AudioLoader();
audioLoader.load("src/sounds/engine.mp3", (buffer) => {
  engineSound.setBuffer(buffer);
  engineSound.setLoop(true);
  engineSound.setVolume(0.5);
});

audioLoader.load("src/sounds/brake.mp3", (buffer) => {
  brakeSound.setBuffer(buffer);
  brakeSound.setLoop(false);
  brakeSound.setVolume(0.8);
});

let isBraking = false;

function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60);

  const maxSteer = 0.5;
  const maxForce = 1000;
  const brakeForce = 100;

  // Reset steering
  vehicle.setSteeringValue(0, 2);
  vehicle.setSteeringValue(0, 3);

  const forward = keys["ArrowUp"];
  const reverse = keys["ArrowDown"];
  const left = keys["ArrowLeft"];
  const right = keys["ArrowRight"];

  if (forward) {
    vehicle.applyEngineForce(-maxForce, 2);
    vehicle.applyEngineForce(-maxForce, 3);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);

    if (!engineSound.isPlaying) engineSound.play();
  } else if (reverse) {
    vehicle.applyEngineForce(maxForce, 2);
    vehicle.applyEngineForce(maxForce, 3);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);

    // Brake sound logic (play only once)
    if (!isBraking) {
      isBraking = true;
      if (!brakeSound.isPlaying) brakeSound.play();
    }
  } else {
    vehicle.applyEngineForce(0, 2);
    vehicle.applyEngineForce(0, 3);
    vehicle.setBrake(brakeForce*0.2, 2);
    vehicle.setBrake(brakeForce*0.2, 3);

    if (engineSound.isPlaying) engineSound.pause();
    if (brakeSound.isPlaying) brakeSound.stop();
    isBraking = false;
  }

  if (left) {
    vehicle.setSteeringValue(maxSteer, 2);
    vehicle.setSteeringValue(maxSteer, 3);
  } else if (right) {
    vehicle.setSteeringValue(-maxSteer, 2);
    vehicle.setSteeringValue(-maxSteer, 3);
  }

  // Dynamic engine pitch
  const speed = chassisBody.velocity.length();
  engineSound.setPlaybackRate(THREE.MathUtils.clamp(0.5 + speed * 0.1, 0.5, 2));

  // Sync visuals
  if (chassisMesh) {
    chassisMesh.position.copy(chassisBody.position);
    chassisMesh.quaternion.copy(chassisBody.quaternion);
  }
  vehicle.wheelInfos.forEach((w, i) => {
    vehicle.updateWheelTransform(i);
    const t = w.worldTransform;
    wheelMeshes[i].position.copy(t.position);
    wheelMeshes[i].quaternion.copy(t.quaternion);
  });

  // Camera follow
  const offset = new THREE.Vector3(2, 3, -8)
    .applyQuaternion(chassisBody.quaternion)
    .add(chassisBody.position);
  camera.position.lerp(offset, 0.1);
  controls.target.copy(chassisBody.position);
  controls.update();

  renderer.render(scene, camera);
}


animate();
