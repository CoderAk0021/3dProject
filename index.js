// full-scene.js
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import {
  CSS2DRenderer,
  CSS2DObject,
} from "three/addons/renderers/CSS2DRenderer.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { gsap } from "gsap";
/*
  HOW TO USE
  - Put your billboard images in //images/billboards (or adjust paths below).
  - Edit BILLBOARD_DATA: each item has { img, href, desc }.
  - Hover a billboard to see its description; click to open its link in a new tab.
*/



const BILLBOARD_FOCUS_DISTANCE = 12; // how close the car should be to trigger billboard focus
const BILLBOARD_FOCUS_LERP = 0.08; // smoothness of camera movement
let currentFocusBillboard = null;
let cameraTargetOffset = new THREE.Vector3(2, 3, -8); // default car follow offset


// ----------------- Basic setup -----------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  60,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// If you're on newer three, prefer: renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);

const labelRenderer = new CSS2DRenderer();
labelRenderer.setSize(window.innerWidth, window.innerHeight);
labelRenderer.domElement.style.position = "absolute";
labelRenderer.domElement.style.top = "0";
labelRenderer.domElement.style.pointerEvents = "none";
labelRenderer.domElement.style.fontFamily =
  "system-ui, -apple-system, Segoe UI, Roboto, sans-serif";
document.body.appendChild(labelRenderer.domElement);

// --------------- Environment & lights ----------------
const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();
new RGBELoader().setPath("/textures/").load("env.hdr", (hdr) => {
  const envMap = pmremGenerator.fromEquirectangular(hdr).texture;
  scene.environment = envMap;
  scene.background = envMap;
  hdr.dispose();
  pmremGenerator.dispose();
});

scene.add(new THREE.AmbientLight(0x404040, 1.1));
const dirLight = new THREE.DirectionalLight(0xffffff, 1.0);
dirLight.position.set(20, 30, 10);
dirLight.castShadow = true;
dirLight.shadow.mapSize.width = 2048;
dirLight.shadow.mapSize.height = 2048;
dirLight.shadow.camera.near = 0.5;
dirLight.shadow.camera.far = 400;
dirLight.shadow.camera.left = -200;
dirLight.shadow.camera.right = 200;
dirLight.shadow.camera.top = 200;
dirLight.shadow.camera.bottom = -200;
dirLight.shadow.bias = -0.0004;
dirLight.shadow.normalBias = 0.02;

scene.add(dirLight);

// ---------------- Physics ----------------
const world = new CANNON.World({ allowSleep: true });
const defaultMat = new CANNON.Material("default");
world.defaultContactMaterial = new CANNON.ContactMaterial(
  defaultMat,
  defaultMat,
  {
    friction: 1,
    restitution: 0.0,
  }
);
world.addContactMaterial(world.defaultContactMaterial);

world.gravity.set(0, -9.82, 0);

// ground physics plane
const groundBody = new CANNON.Body({ mass: 0 });
groundBody.addShape(new CANNON.Plane());
groundBody.quaternion.setFromEuler(-Math.PI / 2, 0, 0);
groundBody.material = defaultMat;

world.addBody(groundBody);

// Load font

// function create3DText(scene, textString, position = { x: 0, y: 0, z: 0 }) {
//     const loader = new FontLoader();
//     loader.load("/font.json", function (font) {
//         const textGeometry = new TextGeometry(textString, {
//             font: font,
//             size: 2,       // Text size
//             height: 0.5,   // Extrusion depth
//             curveSegments: 12,
//             bevelEnabled: true,
//             bevelThickness: 0.03,
//             bevelSize: 0.02,
//             bevelOffset: 0,
//             bevelSegments: 5
//         });

//         textGeometry.computeBoundingBox();
//         textGeometry.center(); // Centers the text

//         const textMaterial = new THREE.MeshStandardMaterial({
//             color: 0xff6600,   // Orange like Bruno Simon's
//             metalness: 0.5,
//             roughness: 0.2
//         });

//          const textMesh = new THREE.Mesh(textGeometry, textMaterial);
//         textMesh.position.set(position.x, position.y, position.z);
//         textMesh.scale.set(1,1,0.005)
//         scene.add(textMesh);
//     });
// }

// create3DText(scene, "WELCOME BATCH OF 2K25", { x: 0, y: 1, z: -10 });

// ground visual
// Load snow texture
const textureLoader = new THREE.TextureLoader();
const snowTexture = textureLoader.load("/textures/snow2.jpg"); // Path to your snow texture
snowTexture.wrapS = THREE.RepeatWrapping;
snowTexture.wrapT = THREE.RepeatWrapping;
snowTexture.repeat.set(50, 50); // Adjust tiling for large ground

// Ground geometry & material
const groundGeo = new THREE.PlaneGeometry(2000, 2000);
const groundMat = new THREE.MeshStandardMaterial({
  map: snowTexture,
  roughness: 1,
  metalness: 0,
});

const ground = new THREE.Mesh(groundGeo, groundMat);
ground.rotation.x = -Math.PI / 2;
ground.receiveShadow = true;
scene.add(ground);

// ---------------- Textures ----------------
const texLoader = new THREE.TextureLoader();

// free seamless asphalt (swap to local if you prefer)
const ASPHALT_URL =
  "https://cdn.jsdelivr.net/gh/ansimuz/3d-textures@master/asphalt/asphalt_diff_1k.jpg";
const asphalt = texLoader.load(ASPHALT_URL, () => {
  // If you're on newer three, prefer: asphalt.colorSpace = THREE.SRGBColorSpace;
  asphalt.colorSpace = THREE.SRGBColorSpace;
});
asphalt.wrapS = asphalt.wrapT = THREE.RepeatWrapping;
asphalt.repeat.set(6, 32);
asphalt.anisotropy = 16;

// wheel textures (your existing)
const wheelColor = texLoader.load("/textures/wheel_color.jpg");
wheelColor.rotation = Math.PI / 2;
wheelColor.center.set(0.5, 0.5);
const wheelNormal = texLoader.load("/textures/wheel_normal.jpg");
wheelNormal.rotation = Math.PI / 2;
wheelNormal.center.set(0.5, 0.5);
const wheelRough = texLoader.load("/textures/wheel_roughness.jpg");
wheelRough.rotation = Math.PI / 2;
wheelRough.center.set(0.5, 0.5);

// ---------------- Road (wider oval) ----------------
function createOvalCenterline(rx = 50, rz = 110, segments = 512) {
  const pts = [];
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    const x = Math.cos(a) * rx;
    const z = Math.sin(a) * rz;
    pts.push(new THREE.Vector3(x, 0, -z));
  }
  return new THREE.CatmullRomCurve3(pts, true, "catmullrom", 0.5);
}

function buildRoadStrip(centerCurve, width = 12, samples = 900) {
  const halfW = width / 2;
  const pos = [],
    norm = [],
    uv = [],
    idx = [];
  const pts = [],
    tans = [],
    lengths = [];
  let accum = 0;
  let prev = centerCurve.getPointAt(0);
  pts.push(prev.clone());
  tans.push(centerCurve.getTangentAt(0).clone());
  lengths.push(0);

  for (let i = 1; i <= samples; i++) {
    const t = i / samples;
    const p = centerCurve.getPointAt(t);
    pts.push(p.clone());
    const tan = centerCurve.getTangentAt(t).clone().normalize();
    tans.push(tan);
    accum += p.distanceTo(prev);
    lengths.push(accum);
    prev = p;
  }

  const length = accum || 1;

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i],
      tan = tans[i];
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, tan).normalize();

    const leftP = p.clone().addScaledVector(right, -halfW);
    const rightP = p.clone().addScaledVector(right, halfW);
    leftP.y += 0.01;
    rightP.y += 0.01;

    pos.push(leftP.x, leftP.y, leftP.z);
    pos.push(rightP.x, rightP.y, rightP.z);
    norm.push(0, 1, 0);
    norm.push(0, 1, 0);
    const v = lengths[i] / 5.0;
    uv.push(0, v);
    uv.push(1, v);
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2,
      b = a + 1,
      c = a + 2,
      d = a + 3;
    idx.push(a, c, b);
    idx.push(c, d, b);
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(norm, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeBoundingSphere();

  const mat = new THREE.MeshStandardMaterial({
    map: asphalt,
    roughness: 0.9,
    metalness: 0.0,
  });
  const repeatV = Math.max(1, Math.floor(length / 5));
  asphalt.repeat.set(6, repeatV);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  scene.add(mesh);
  return { mesh, centerCurve };
}

const roadCurve = createOvalCenterline(55, 120, 512);
const { mesh: roadMesh } = buildRoadStrip(roadCurve, 12, 900);

// ---------------- obstacles: trees & rocks with collisions ----------------
const treeGroup = new THREE.Group();
scene.add(treeGroup);
const treePositions = []; // for simple collision checks with billboards

function addStaticBox(center, size, quaternion = new THREE.Quaternion()) {
  const half = new CANNON.Vec3(size.x / 2, size.y / 2, size.z / 2);
  const body = new CANNON.Body({ mass: 0 });
  body.addShape(new CANNON.Box(half));
  body.position.set(center.x, center.y, center.z);
  body.quaternion.set(quaternion.x, quaternion.y, quaternion.z, quaternion.w);
  world.addBody(body);
  return body;
}
function addStaticSphere(center, radius) {
  const body = new CANNON.Body({ mass: 0 });
  body.addShape(new CANNON.Sphere(radius));
  body.position.set(center.x, center.y, center.z);
  world.addBody(body);
  return body;
}

function makeTreeMesh() {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.18, 0.18, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x6b3f19 })
  );
  trunk.position.y = 1.1;
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  g.add(trunk);
  const foliage = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 2.2, 8),
    new THREE.MeshStandardMaterial({ color: 0x157a2a })
  );
  foliage.position.y = 3.0;
  foliage.castShadow = true;
  foliage.receiveShadow = true;
  g.add(foliage);
  return g;
}

function makeRockMesh() {
  const geo = new THREE.IcosahedronGeometry(0.6, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) {
    pos.setX(i, pos.getX(i) + (Math.random() - 0.5) * 0.12);
    pos.setY(i, pos.getY(i) + (Math.random() - 0.5) * 0.12);
    pos.setZ(i, pos.getZ(i) + (Math.random() - 0.5) * 0.12);
  }
  geo.computeVertexNormals();
  const m = new THREE.MeshStandardMaterial({ color: 0x777777 });
  const mesh = new THREE.Mesh(geo, m);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// get a lateral position (side) for a t along curve
function getSidePosition(curve, t, lateral, side = 1) {
  const p = curve.getPointAt(t % 1);
  const tan = curve.getTangentAt(t % 1).normalize();
  const right = new THREE.Vector3()
    .crossVectors(new THREE.Vector3(0, 1, 0), tan)
    .normalize();
  const pos = p.clone().addScaledVector(right, lateral * side);
  return { pos, center: p, tangent: tan, right };
}

// place spread-out trees (minimum spacing)
function placeTrees(curve, count = 36, minDistance = 7.5) {
  const placed = [];
  let tries = 0;
  while (placed.length < count && tries < count * 40) {
    tries++;
    const t = Math.random();
    const side = Math.random() > 0.5 ? 1 : -1;
    const lateral = 6 + Math.random() * 8;
    const { pos } = getSidePosition(curve, t, lateral, side);
    pos.y = 0;
    let ok = true;
    for (const other of placed) {
      if (pos.distanceTo(other.position) < minDistance) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;
    const tree = makeTreeMesh();
    tree.scale.setScalar(0.9 + Math.random() * 1.5);
    tree.position.copy(pos);
    tree.rotation.y = Math.random() * Math.PI * 2;
    tree.updateMatrixWorld(true);
    treeGroup.add(tree);
    placed.push(tree);
    treePositions.push(tree.position.clone());

    // physics approx using bounding box
    const bbox = new THREE.Box3().setFromObject(tree);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const center = new THREE.Vector3();
    bbox.getCenter(center);
    addStaticBox(center, size);
  }
}
placeTrees(roadCurve, 36, 7.5);

// place some sparse rocks
function placeRocks(curve, count = 18) {
  for (let i = 0; i < count; i++) {
    const t = Math.random() * 0.95 + 0.02;
    const side = Math.random() > 0.5 ? 1 : -1;
    const { pos } = getSidePosition(curve, t, 6 + Math.random() * 8, side);
    const rock = makeRockMesh();
    rock.position.copy(pos);
    rock.position.y = 0.05;
    rock.scale.setScalar(0.4 + Math.random() * 1.0);
    scene.add(rock);
    rock.updateMatrixWorld(true);
    const bbox = new THREE.Box3().setFromObject(rock);
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    addStaticSphere(
      new THREE.Vector3(
        rock.position.x,
        rock.position.y + radius * 0.1,
        rock.position.z
      ),
      radius
    );
  }
}
placeRocks(roadCurve, 18);

// ---------------- Billboard data (edit these!) ----------------
const BILLBOARD_DATA = [
  {
    img: "/images/Acad_Building.jpg",
    href: "/pages/academic/index.html",
    desc: "Academic Building",
  },
  {
    img: "/images/cafe6.jpeg",
    href: "/pages/cafeteria/index.html",
    desc: "Canteen",
  },
  {
    img: "/images/cafe1.jpg",
    href: "/pages/nescafe/index.html",
    desc: "Nescafe",
  },
  {
    img: "/images/lib2.jpg",
    href: "/pages/centralLibrary/index.html",
    desc: "Central Library",
  },
  {
    img: "/images/tiger.jpg",
    href: "/pages/tigerRoad/index.html",
    desc: "Tiger Road",
  },
];

// ---------------- Billboards (replace buildings) ----------------
const gltfLoader = new GLTFLoader();
const pickables = []; // the front poster planes for raycasting

function makeBillboardLabel(text) {
  const div = document.createElement("div");
  div.textContent = text;
  div.style.padding = "6px 10px";
  div.style.fontSize = "12px";
  div.style.borderRadius = "8px";
  div.style.background = "rgba(0,0,0,0.75)";
  div.style.color = "#fff";
  div.style.whiteSpace = "nowrap";
  div.style.transform = "translateY(-8px)";
  div.style.backdropFilter = "blur(2px)";
  const label = new CSS2DObject(div);
  label.visible = false;
  return label;
}

/**
 * Simon-Bruno style billboard group:
 *  - steel post + simple frame
 *  - double-sided poster plane with your texture
 *  - faces the road center (yaw only)
 *  - clickable (link), hover label (CSS2D)
 *  - static Cannon collision box
 */
function createBillboard(position, lookAtPoint, options) {
  const {
    imageURL,
    description,
    width = 10,
    height = 4.5,
    postHeight = 3.5,
    link = "#",
  } = options;

  const group = new THREE.Group();

  // Post
  const postGeo = new THREE.CylinderGeometry(0.4, 0.4, postHeight, 12);
  const postMat = new THREE.MeshBasicMaterial({ color: 0x555555 });
  const post1 = new THREE.Mesh(postGeo, postMat);
  post1.castShadow = true;
  post1.receiveShadow = true;
  post1.position.set(-width / 2, postHeight / 2, 0);

  const post2 = new THREE.Mesh(postGeo, postMat);
  post2.castShadow = true;
  post2.receiveShadow = true;
  post2.position.set(width / 2, postHeight / 2, 0);
  group.add(post1);
  group.add(post2);

  // Frame (thin box behind the poster)
  const frameDepth = 1.5;
  const frameGeo = new THREE.BoxGeometry(width + 0.3, height + 0.3, frameDepth);
  const frameMat = new THREE.MeshStandardMaterial({
    color: 0x222222,
    metalness: 0.2,
    roughness: 0.7,
  });
  const frame = new THREE.Mesh(frameGeo, frameMat);
  frame.castShadow = true;
  frame.receiveShadow = true;
  frame.position.set(0, postHeight + height / 2, 0);
  group.add(frame);

  // Poster plane (front) – pickable
  const posterGeo = new THREE.PlaneGeometry(width, height);
  const tex = texLoader.load(
    imageURL,
    (t) => {
      t.colorSpace = THREE.SRGBColorSpace;
      t.anisotropy = 8;
    },
    undefined,
    () => console.warn("Failed to load billboard image:", imageURL)
  );
  const posterMatFront = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.8,
    metalness: 0.0,
    side: THREE.FrontSide,
  });
  const posterFront = new THREE.Mesh(posterGeo, posterMatFront);
  posterFront.castShadow = true;
  posterFront.position.set(0, postHeight + height / 2, frameDepth * 0.51);
  group.add(posterFront);

  // Poster plane (back) – same image for both sides
  const posterMatBack = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.8,
    metalness: 0.0,
    side: THREE.BackSide,
  });
  const posterBack = new THREE.Mesh(posterGeo, posterMatBack);
  posterBack.castShadow = false;
  posterBack.position.set(0, postHeight + height / 2, -frameDepth * 0.51);
  posterBack.rotateY(Math.PI);
  group.add(posterBack);

  // Rotate to face road center (yaw only)
  const yaw = Math.atan2(
    lookAtPoint.x - position.x,
    lookAtPoint.z - position.z
  );
  group.position.set(position.x, 0, position.z);
  group.rotation.y = yaw;

  // Hover label (CSS2D)
  const label = makeBillboardLabel(description || "");
  label.position.set(0, postHeight + height + 0.6, 0);
  group.add(label);

  // User data for raycast interactions
  posterFront.userData.href = link;
  posterFront.userData.label = label;

  // Physics: static box roughly covering the billboard
  const bbox = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  addStaticBox(center, size);

  scene.add(group);

  // add pickable
  pickables.push(posterFront);

  return group;
}

// Helper to get a clear roadside placement (avoids trees & other billboards)
function getClearRoadsideSpot(
  curve,
  tGuess,
  side,
  baseLateral,
  minDistToTrees,
  minDistToBillboards,
  placedPositions
) {
  // Try increasing lateral offset outward until space is clear
  for (let step = 0; step < 8; step++) {
    const lateral = baseLateral + step * 2.0;
    const { pos, center } = getSidePosition(curve, tGuess, lateral, side);
    pos.y = 0;

    // Check distance to trees
    let ok = true;
    for (const tp of treePositions) {
      if (pos.distanceTo(tp) < minDistToTrees) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    // Check distance to previously placed billboards
    for (const bp of placedPositions) {
      if (pos.distanceTo(bp) < minDistToBillboards) {
        ok = false;
        break;
      }
    }
    if (!ok) continue;

    return { pos, center };
  }
  return null;
}

// Place billboards using BILLBOARD_DATA
function placeBillboardsFromData(curve, data) {
  const count = data.length;
  const placedPositions = [];
  const roadHalfWidth = 6; // from your buildRoadStrip(12) width/2

  for (let i = 0; i < count; i++) {
    // spread them somewhat evenly and jitter a bit
    const tBase = (i / count) % 1;
    const t = (tBase * 0.94 + 0.03 + Math.random() * 0.02) % 1;

    // alternate sides, keep them just outside the road edge
    const side = i % 2 === 0 ? 1 : -1;
    const baseLateral = roadHalfWidth + 6; // road edge + margin

    // find a clear spot near this t
    const spot = getClearRoadsideSpot(
      curve,
      t,
      side,
      baseLateral,
      /*trees*/ 6.5,
      /*billboards*/ 10,
      placedPositions
    );
    if (!spot) continue;

    const { pos, center } = spot;
    placedPositions.push(pos.clone());

    const item = data[i];

    // size variety
    const w = 7 + Math.random() * 2.5;
    const h = 3.5 + Math.random() * 1.2;

    createBillboard(pos, center, {
      imageURL: item.img,
      description: item.desc,
      width: w + 8,
      height: h + 3,
      postHeight: 3.2 + Math.random() * 0.6,
      link: item.href,
    });
  }
}
placeBillboardsFromData(roadCurve, BILLBOARD_DATA);

// ---------------- Vehicle (chassis + wheels + collision) ----------------
const chassisBody = new CANNON.Body({ mass: 150 });
chassisBody.material = defaultMat;
const chassisShape = new CANNON.Box(new CANNON.Vec3(1, 0.5, 2));
chassisBody.addShape(chassisShape);
chassisBody.position.set(0, 2, 0);
world.addBody(chassisBody);

const contactMaterial = new CANNON.ContactMaterial(
  chassisShape,
  groundBody.shapes[0],
  {
    friction: 1,
    restitution: 0.05,
  }
);
world.addContactMaterial(contactMaterial);

let chassisMesh = null;
gltfLoader.load(
  "/models/cybertruck.glb",
  (gltf) => {
    chassisMesh = gltf.scene;
    chassisMesh.traverse((c) => {
      if (c.name.toLowerCase().includes("wheel")) c.visible = false;
      if (c.isMesh) {
        c.castShadow = true;
        c.receiveShadow = true;
        c.position.set(0.095, 0, 0.4);
      }
    });
    chassisMesh.scale.set(1, 1, 1);
    scene.add(chassisMesh);
  },
  undefined,
  (err) => console.warn("No cybertruck model found:", err)
);

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
  frictionSlip: 2,
  dampingRelaxation: 2.3,
  dampingCompression: 4.4,
  maxSuspensionForce: 100000,
  rollInfluence: 0.01,
  axleLocal: new CANNON.Vec3(-1, 0, 0),
  chassisConnectionPointLocal: new CANNON.Vec3(),
  maxSuspensionTravel: 0.3,
};
[
  new CANNON.Vec3(-1, 0, -1.6),
  new CANNON.Vec3(1, 0, -1.6),
  new CANNON.Vec3(-1, 0, 1.6),
  new CANNON.Vec3(1, 0, 1.6),
].forEach((p) => {
  wheelOptions.chassisConnectionPointLocal.copy(p);
  vehicle.addWheel(wheelOptions);
});
vehicle.addToWorld(world);

const wheelMeshes = vehicle.wheelInfos.map(() => {
  const geo = new THREE.CylinderGeometry(0.4, 0.4, 0.4, 16);
  geo.rotateZ(Math.PI / 2);
  const mat = new THREE.MeshStandardMaterial({
    map: wheelColor,
    normalMap: wheelNormal,
    roughnessMap: wheelRough,
    metalness: 0,
    roughness: 1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  scene.add(mesh);
  return mesh;
});

// ---------------- Controls & camera ----------------
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableZoom = true;
controls.zoomSpeed = 1;
controls.minDistance = 5;
controls.maxDistance = 50;
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.enablePan = false;
controls.enableRotate = false;
controls.minDistance = 5;
controls.maxDistance = 35;
controls.minPolarAngle = Math.PI / 7;
controls.maxPolarAngle = Math.PI / 2.1;
controls.enableRotate = true;
camera.position.set(0, 8, 20);
controls.target.copy(chassisBody.position);

let userIsRotating = false;

// Event listeners for when the user starts and stops rotating
controls.addEventListener("start", () => {
  userIsRotating = true;
});

controls.addEventListener("end", () => {
  userIsRotating = false;
});

// A new, separate function for the camera to follow the car
function followCamera() {
  // Convert CANNON.Vec3 to THREE.Vector3
  const carPos = new THREE.Vector3(
    chassisBody.position.x,
    chassisBody.position.y,
    chassisBody.position.z
  );

  // Find nearest billboard within focus distance
  let nearestBillboard = null;
  let minDist = Infinity;
  for (let obj of pickables) {
    if (!obj.userData.isBillboard) continue; // only billboards
    const dist = carPos.distanceTo(obj.position);
    if (dist < minDist && dist < BILLBOARD_FOCUS_DISTANCE) {
      minDist = dist;
      nearestBillboard = obj;
    }
  }

  if (nearestBillboard && !userIsRotating) {
    currentFocusBillboard = nearestBillboard;

    const billboardCenter = nearestBillboard.position.clone();
    const carToBillboard = billboardCenter.clone().sub(carPos).normalize();

    const desiredCamPos = carPos
      .clone()
      .add(carToBillboard.clone().multiplyScalar(-8)) // behind car
      .add(new THREE.Vector3(0, 6, 0)); // height above car

    camera.position.lerp(desiredCamPos, BILLBOARD_FOCUS_LERP);
    controls.target.lerp(billboardCenter, BILLBOARD_FOCUS_LERP);

  } else if (!userIsRotating) {
    currentFocusBillboard = null;

    const desiredCamPos = carPos.clone().add(
      cameraTargetOffset.clone().applyQuaternion(
        new THREE.Quaternion(
          chassisBody.quaternion.x,
          chassisBody.quaternion.y,
          chassisBody.quaternion.z,
          chassisBody.quaternion.w
        )
      )
    );

    camera.position.lerp(desiredCamPos, 0.1);
    controls.target.lerp(carPos, 0.1);
  }

  // Always update controls
  controls.update();
}



// ---------------- Input & audio ----------------
const keys = {};
window.addEventListener("keydown", (e) => (keys[e.key] = true));
window.addEventListener("keyup", (e) => (keys[e.key] = false));
// Optional: support WASD
window.addEventListener("keydown", (e) => {
  if (e.code === "Space") keys["Brake"] = true;
  if (e.code === "KeyW") keys["ArrowUp"] = true;
  if (e.code === "KeyS") keys["ArrowDown"] = true;
  if (e.code === "KeyA") keys["ArrowLeft"] = true;
  if (e.code === "KeyD") keys["ArrowRight"] = true;
});
window.addEventListener("keyup", (e) => {
  if (e.code === "Space") keys["Brake"] = false;
  if (e.code === "KeyW") keys["ArrowUp"] = false;
  if (e.code === "KeyS") keys["ArrowDown"] = false;
  if (e.code === "KeyA") keys["ArrowLeft"] = false;
  if (e.code === "KeyD") keys["ArrowRight"] = false;
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  labelRenderer.setSize(window.innerWidth, window.innerHeight);
});

const listener = new THREE.AudioListener();
camera.add(listener);
const engineSound = new THREE.Audio(listener);
const brakeSound = new THREE.Audio(listener);
const audioLoader = new THREE.AudioLoader();
audioLoader.load("/sounds/engine.mp3", (buf) => {
  engineSound.setBuffer(buf);
  engineSound.setLoop(true);
  engineSound.setVolume(0.5);
});
audioLoader.load("/sounds/brake.mp3", (buf) => {
  brakeSound.setBuffer(buf);
  brakeSound.setLoop(false);
  brakeSound.setVolume(0.8);
});
let isBraking = false;

// ---------------- Raycasting: click/hover for billboards (Desktop + Mobile) ----------------
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();
let hoveredPoster = null;

function setCursorPointer(on) {
  renderer.domElement.style.cursor = on ? "pointer" : "";
}

function updateRaycasterFromEvent(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  let clientX, clientY;

  if (event.touches && event.touches.length > 0) {
    // Touch input
    clientX = event.touches[0].clientX;
    clientY = event.touches[0].clientY;
  } else {
    // Mouse / Pointer input
    clientX = event.clientX;
    clientY = event.clientY;
  }

  mouse.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((clientY - rect.top) / rect.height) * 2 + 1;
}

function onPointerMove(event) {
  updateRaycasterFromEvent(event);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  const newHover = hits.length ? hits[0].object : null;

  if (hoveredPoster && hoveredPoster !== newHover) {
    if (hoveredPoster.userData?.label) {
      hoveredPoster.userData.label.visible = false;
    }
  }
  hoveredPoster = newHover;
  if (hoveredPoster && hoveredPoster.userData?.label) {
    hoveredPoster.userData.label.visible = true;
  }
  setCursorPointer(!!hoveredPoster);
}

function onPointerSelect(event) {
  updateRaycasterFromEvent(event);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  if (hits.length > 0) {
    const href = hits[0].object.userData?.href;
    if (href) window.open(href, "_blank");
  }
}

renderer.domElement.addEventListener("pointermove", onPointerMove);
renderer.domElement.addEventListener("pointerleave", () => {
  if (hoveredPoster && hoveredPoster.userData?.label) {
    hoveredPoster.userData.label.visible = false;
  }
  hoveredPoster = null;
  setCursorPointer(false);
});

// Works for both desktop click and mobile tap
renderer.domElement.addEventListener("click", onPointerSelect);
renderer.domElement.addEventListener("pointerup", onPointerSelect); 

// Set renderer output color
if ("outputColorSpace" in renderer) {
  renderer.outputColorSpace = THREE.SRGBColorSpace;
} else {
  renderer.outputEncoding = THREE.sRGBEncoding;
}




// ---------------- Place & orient vehicle on road ----------------
function placeVehicleOnRoad(curve) {
  const start = curve.getPointAt(0.02);
  const tng = curve.getTangentAt(0.02).normalize();
  chassisBody.position.set(start.x, 1.5, start.z);

  const lookAt = start.clone().add(tng);
  const m = new THREE.Matrix4();
  m.lookAt(start, lookAt, new THREE.Vector3(0, 1, 0));
  const q = new THREE.Quaternion().setFromRotationMatrix(m);
  chassisBody.quaternion.set(q.x, q.y, q.z, q.w);
  const loader = new FontLoader();
  loader.load("/fonts/font.json", function (font) {
    const textGeometry = new TextGeometry("WELCOME BATCH OF 2025", {
      font: font,
      size: 2, // Text size
      height: 0.5, // Extrusion depth
      curveSegments: 12,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelOffset: 0,
      bevelSegments: 5,
    });

    textGeometry.computeBoundingBox();
    textGeometry.center(); // Centers the text

    const textMaterial = new THREE.MeshStandardMaterial({
      color: 0xff6600, // Orange like Bruno Simon's
      metalness: 0.0,
      roughness: 0.9,
    });

    const textMesh = new THREE.Mesh(textGeometry, textMaterial);

    textMesh.scale.set(1, 1, 0.005);
    textMesh.castShadow = true;
    textMesh.rotation.y = -Math.PI; // Rotate to face camera
    textMesh.position.set(start.x, 20, start.z + 20);
    scene.add(textMesh);
    gsap.to(textMesh.position, {
      y: 1, // final resting height
      duration: 1.2, // time to fall
      ease: "bounce.out", // GSAP's bounce easing
      delay: 0.5, // slight delay before falling
    });
  });
}

placeVehicleOnRoad(roadCurve);

//vehicle controls for mobile
// Create container for all mobile controls
const mobileControls = document.createElement("div");
mobileControls.style.position = "fixed";
mobileControls.style.bottom = "20px";
mobileControls.style.width = "100%";
mobileControls.style.height = "200px"; // adjust as needed
mobileControls.style.pointerEvents = "none"; // allow individual buttons to receive events
document.body.appendChild(mobileControls);

// ----- Left side controls (ArrowLeft, ArrowRight, Brake) -----
const leftControls = document.createElement("div");
leftControls.style.position = "absolute";
leftControls.style.left = "20px";
leftControls.style.bottom = "20px";
leftControls.style.display = "flex";
leftControls.style.flexDirection = "column";
leftControls.style.alignItems = "center";
leftControls.style.gap = "20px";
leftControls.style.pointerEvents = "auto"; // enable touch
mobileControls.appendChild(leftControls);

// Row for left and right arrows
const lrRow = document.createElement("div");
lrRow.style.display = "flex";
lrRow.style.gap = "20px";
leftControls.appendChild(lrRow);

const leftBtn = createButton("left", "←", "ArrowLeft");
const rightBtn = createButton("right", "→", "ArrowRight");
lrRow.appendChild(leftBtn);
lrRow.appendChild(rightBtn);

// Brake button below arrows
const brakeBtn = createButton("brake", "Space", "Brake");
leftControls.appendChild(brakeBtn);

// ----- Right side controls (ArrowUp, ArrowDown) -----
const rightControls = document.createElement("div");
rightControls.style.position = "absolute";
rightControls.style.right = "20px";
rightControls.style.bottom = "20px";
rightControls.style.display = "flex";
rightControls.style.flexDirection = "column";
rightControls.style.gap = "20px";
rightControls.style.pointerEvents = "auto";
mobileControls.appendChild(rightControls);

const forwardBtn = createButton("forward", "↑", "ArrowUp");
const reverseBtn = createButton("reverse", "↓", "ArrowDown");
rightControls.appendChild(forwardBtn);
rightControls.appendChild(reverseBtn);

// ----- Button creation function -----
function createButton(id, text, key) {
  const button = document.createElement("button");
  button.id = id;
  button.textContent = text;
  button.style.padding = "15px 20px";
  button.style.fontSize = "36px";
  button.style.borderRadius = "12px";
  button.style.background = "rgba(0,0,0,0.5)";
  button.style.color = "#fff";
  button.style.border = "none";
  button.style.cursor = "pointer";
  button.style.userSelect = "none";

  // Press action
  button.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    keys[key] = true;
  });

  // Release action
  button.addEventListener("pointerup", (e) => {
    e.preventDefault();
    keys[key] = false;
  });

  // Release if finger slides away
  button.addEventListener("pointerleave", (e) => {
    e.preventDefault();
    keys[key] = false;
  });

  return button;
}

// ----- Show only on mobile -----
if (/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)) {
  mobileControls.style.display = "block";
} else {
  mobileControls.style.display = "none";
}




// ---------------- Animation loop ----------------
function animate() {
  requestAnimationFrame(animate);
  world.step(1 / 60);

  // vehicle control (simplified)
  const maxSteer = 0.25,
    maxForce = 900,
    brakeForce = 60,
    maxSpeed = 10; // tuned a bit
  vehicle.setSteeringValue(0, 2);
  vehicle.setSteeringValue(0, 3);

  const forward = !!keys["ArrowUp"];
  const reverse = !!keys["ArrowDown"];
  const left = !!keys["ArrowLeft"];
  const right = !!keys["ArrowRight"];
  const braking = !!keys["Brake"];

  // engine / brake
  if (forward && !braking) {
    vehicle.applyEngineForce(-maxForce, 2);
    vehicle.applyEngineForce(-maxForce, 3);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);
    if (engineSound.buffer && !engineSound.isPlaying) engineSound.play();
  } else if (reverse && !braking) {
    vehicle.applyEngineForce(maxForce * 0.7, 2);
    vehicle.applyEngineForce(maxForce * 0.7, 3);
    vehicle.setBrake(0, 2);
    vehicle.setBrake(0, 3);
    if (engineSound.buffer && !engineSound.isPlaying) engineSound.play();
  } else {
    // coasting
    vehicle.applyEngineForce(0, 2);
    vehicle.applyEngineForce(0, 3);
    vehicle.setBrake(brakeForce * 0.1, 2);
    vehicle.setBrake(brakeForce * 0.1, 3);
    if (engineSound.isPlaying) engineSound.pause();
  }

  // dedicated brake (Space)
  if (braking) {
    vehicle.setBrake(brakeForce, 2);
    vehicle.setBrake(brakeForce, 3);
    if (!isBraking) {
      isBraking = true;
      if (brakeSound.buffer) brakeSound.play();
    }
  } else {
    isBraking = false;
  }

  // steering (front wheels 2,3 in your layout)
  const steerVal = (left ? 1 : 0) - (right ? 1 : 0);
  vehicle.setSteeringValue(maxSteer * steerVal, 2);
  vehicle.setSteeringValue(maxSteer * steerVal, 3);

  // cap speed
  const speed = chassisBody.velocity.length();
  if (speed > maxSpeed)
    chassisBody.velocity.scale(maxSpeed / speed, chassisBody.velocity);

  // engine pitch
  if (engineSound.buffer) {
    engineSound.setPlaybackRate(
      THREE.MathUtils.clamp(0.6 + speed * 0.06, 0.6, 2)
    );
  }

  // sync chassis visual
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

  followCamera();

  renderer.render(scene, camera);
  labelRenderer.render(scene, camera);
}
animate();