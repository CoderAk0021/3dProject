import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as CANNON from "cannon-es";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RGBELoader } from "three/examples/jsm/loaders/RGBELoader.js";
import {CSS2DRenderer,CSS2DObject,} from "three/addons/renderers/CSS2DRenderer.js";
import { FontLoader } from "three/addons/loaders/FontLoader.js";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";

// ----------------- Basic setup -----------------
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(
  70,
  window.innerWidth / window.innerHeight,
  0.1,
  2000
);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
document.body.appendChild(renderer.domElement);



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

const textureLoader = new THREE.TextureLoader();
const snowTexture = textureLoader.load("/textures/snow2.jpg"); 
snowTexture.wrapS = THREE.RepeatWrapping;
snowTexture.wrapT = THREE.RepeatWrapping;
snowTexture.repeat.set(50, 50); 

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

const ASPHALT_URL =
  "https://cdn.jsdelivr.net/gh/ansimuz/3d-textures@master/asphalt/asphalt_diff_1k.jpg";
const asphalt = texLoader.load(ASPHALT_URL, () => {
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
  const pos = [], norm = [], uv = [], idx = [];
  const pts = [], tans = [], lengths = [];
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

  // Road surface
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], tan = tans[i];
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
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
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
  const roadMesh = new THREE.Mesh(geo, mat);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);

  // Center solid strip
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xffffff,
    emissiveIntensity: 0.8
  });

  const stripWidth = 0.25;
  const stripHeight = 0.02;
  const stripGeom = new THREE.BufferGeometry();
  const stripPos = [], stripNorm = [], stripIdx = [];

  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], tan = tans[i];
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(up, tan).normalize();

    const leftS = p.clone().addScaledVector(right, -stripWidth / 2);
    const rightS = p.clone().addScaledVector(right, stripWidth / 2);
    leftS.y += stripHeight;
    rightS.y += stripHeight;

    stripPos.push(leftS.x, leftS.y, leftS.z);
    stripPos.push(rightS.x, rightS.y, rightS.z);
    stripNorm.push(0, 1, 0);
    stripNorm.push(0, 1, 0);
  }

  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    stripIdx.push(a, c, b);
    stripIdx.push(c, d, b);
  }

  stripGeom.setAttribute("position", new THREE.Float32BufferAttribute(stripPos, 3));
  stripGeom.setAttribute("normal", new THREE.Float32BufferAttribute(stripNorm, 3));
  stripGeom.setIndex(stripIdx);
  const stripMesh = new THREE.Mesh(stripGeom, stripMat);
  stripMesh.receiveShadow = false;
  scene.add(stripMesh);

  return { mesh: roadMesh, centerCurve };
}



const roadCurve = createOvalCenterline(55, 120, 512);
 buildRoadStrip(roadCurve, 22, 900);

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

const billboardPositions = [];

function placeTrees(curve, count = 18, minDistToObjects = 10) {
  for (let i = 0; i < count; i++) {
    let tries = 0;
    let placed = false;

    while (!placed && tries < 30) {
      tries++;

      // Pick random spot along the curve
      const t = Math.random() * 0.95 + 0.02;
      const side = Math.random() > 0.5 ? 1 : -1;
      const { pos } = getSidePosition(curve, t, 15 + Math.random() * 8, side);
      pos.y = 0.05;

      // Check distance from billboards
      let tooClose = false;
      for (const bp of billboardPositions) {
        if (pos.distanceTo(bp) < minDistToObjects) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Check distance from already placed trees
      for (const tp of treePositions) {
        if (pos.distanceTo(tp) < minDistToObjects) {
          tooClose = true;
          break;
        }
      }
      if (tooClose) continue;

      // Place tree
      const tree = makeTreeMesh();
      tree.position.copy(pos);
      tree.scale.setScalar(1 + Math.random() * 1.0);
      tree.rotation.y = Math.random() * Math.PI * 2;
      scene.add(tree);

      // Save tree position
      treePositions.push(tree.position.clone());

      // Physics
      tree.updateMatrixWorld(true);
      const bbox = new THREE.Box3().setFromObject(tree);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const center = new THREE.Vector3();
      bbox.getCenter(center);
      addStaticBox(center, size);

      placed = true;
    }
  }
}




placeTrees(roadCurve, 36, 7.5);

// place some sparse rocks
function placeRocks(curve, count = 18) {
  for (let i = 0; i < count; i++) {
    const t = Math.random() * 0.95 + 0.02;
    const side = Math.random() > 0.5 ? 1 : -1;
    const { pos } = getSidePosition(curve, t, 15 + Math.random() * 8, side);
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
placeRocks(roadCurve, 28);

// ---------------- Billboard data (edit these!) ----------------
const BILLBOARD_DATA = [
  {
    img: "/images/Acad_Building.jpg",
    href: "https://aadarshagarwal1.github.io/experiences/",
    desc: "ACADEMIC",
  },
  {
    img: "/images/cafe6.jpeg",
    href: "/pages/cafeteria/index.html",
    desc: "CANTEEN",
  },
  {
    img: "/images/cafe1.jpg",
    href: "/pages/nescafe/index.html",
    desc: "NESCAFE",
  },
  {
    img: "/images/lib2.jpg",
    href: "/pages/centralLibrary/index.html",
    desc: "LIBRARY",
  },
  {
    img: "/images/tiger.jpg",
    href: "/pages/tigerRoad/index.html",
    desc: "TIGER ROAD",
  },
];

// ---------------- Billboards (replace buildings) ----------------
const gltfLoader = new GLTFLoader();
const pickables = []; // the front poster planes for raycasting

function createBanner(position, mainText, options = {}) {
  const width = options.width || 15;
  const height = options.height || 4;
  const poleHeight = options.poleHeight || 6;
  const secondaryText = options.secondaryText || "ISTE"; 

  const group = new THREE.Group();

  // ---- Poles ----
  const poleGeo = new THREE.CylinderGeometry(0.2, 0.2, poleHeight, 12);
  const poleMat = new THREE.MeshStandardMaterial({ color: 0x555555 });
  const leftPole = new THREE.Mesh(poleGeo, poleMat);
  const rightPole = leftPole.clone();
  leftPole.position.set(-width / 2, poleHeight / 2, 0);
  rightPole.position.set(width / 2, poleHeight / 2, 0);
  group.add(leftPole, rightPole);

  // ---- Banner plane ----
  const bannerGeo = new THREE.BoxGeometry(width, height, 0.5);
  const bannerMat = new THREE.MeshStandardMaterial({ color: 0xff6600, metalness: 0.1, roughness: 0.8 });
  const bannerPlane = new THREE.Mesh(bannerGeo, bannerMat);
  bannerPlane.position.set(0, poleHeight - height / 2, 0);
  group.add(bannerPlane);

  // ---- Main Text ----
  const loader = new FontLoader();
  loader.load("/fonts/Roboto.json", function (font) {
    const textGeo = new TextGeometry(mainText, {
      font: font,
      size: 1.2,
      height: 0.3,
      bevelEnabled: true,
      bevelThickness: 0.03,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    textGeo.center();
    const textMat = new THREE.MeshStandardMaterial({ color: 0xffffff });
    const textMesh = new THREE.Mesh(textGeo, textMat);
    textMesh.scale.set(1,1,0.002);
    textMesh.rotation.set(0,-Math.PI,0);
    textMesh.position.set(0, poleHeight -0.5- height / 2, -0.5);
    group.add(textMesh);

    // ---- Secondary Text (smaller) ----
    const secGeo = new TextGeometry(secondaryText, {
      font: font,
      size: 0.8,
      height: 0.2,
      bevelEnabled: true,
      bevelThickness: 0.02,
      bevelSize: 0.01,
      bevelSegments: 2,
    });
    secGeo.center();
    const secTextMat = new THREE.MeshStandardMaterial({ color: 0x000000 });
    const secMesh = new THREE.Mesh(secGeo, secTextMat);
    secMesh.position.set(0, poleHeight - height / 2 + 1.2, -0.3); // slightly above main text
    secMesh.scale.set(1,1,0.002);
    secMesh.rotation.set(0,-Math.PI,0);
    group.add(secMesh);
  });

  group.position.copy(position);
  scene.add(group);

  return group;
}

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

  // ----- Posts -----
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
  group.add(post1, post2);

  // ----- Frame -----
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

  // ----- Poster planes -----
  const posterGeo = new THREE.PlaneGeometry(width, height);
  const tex = texLoader.load(imageURL);
  const posterMatFront = new THREE.MeshBasicMaterial({
    map: tex,
    side: THREE.FrontSide,
  });
  const posterFront = new THREE.Mesh(posterGeo, posterMatFront);
  posterFront.receiveShadow = false;
  posterFront.castShadow = true;
  posterFront.position.set(0, postHeight + height / 2, frameDepth * 0.51);
  group.add(posterFront);

  const posterMatBack = new THREE.MeshStandardMaterial({
    map: tex,
    roughness: 0.8,
    metalness: 0.0,
    side: THREE.BackSide,
  });
  const posterBack = new THREE.Mesh(posterGeo, posterMatBack);
  posterBack.position.set(0, postHeight + height / 2, -frameDepth * 0.51);
  posterBack.rotateY(Math.PI);
  group.add(posterBack);

  // ----- Small name board -----
  if (description) {
    const boardWidth = width * 0.5;
    const boardHeight = 0.5;
    const boardGeo = new THREE.BoxGeometry(boardWidth, boardHeight, 0.2);
    const boardMat = new THREE.MeshStandardMaterial({
      color: 0x000000,
      metalness: 0.3,
      roughness: 0.7,
    });
    const nameBoard = new THREE.Mesh(boardGeo, boardMat);
    nameBoard.position.set(0, postHeight + height + boardHeight / 2 + 0.2, 0);
    group.add(nameBoard);

    const loader = new FontLoader();
    loader.load("/fonts/font.json", function (font) {
      const textGeo = new TextGeometry(description, {
        font: font,
        size: 1.5,
        height: 0.05,
      });
      textGeo.center();
      const textMat = new THREE.MeshStandardMaterial({ color: 0xfc5e03 });
      const textMesh = new THREE.Mesh(textGeo, textMat);
      textMesh.scale.set(1, 1, 0.02);
      textMesh.position.set(0.5, 1, 0.11);
      group.add(textMesh);
    });
  }

  // ----- Rotate to face road center (yaw only) -----
  const yaw = Math.atan2(lookAtPoint.x - position.x, lookAtPoint.z - position.z);
  group.position.set(position.x, 0, position.z);
  group.rotation.y = yaw;

  // ----- User data for picking -----
  posterFront.userData.href = link;

  // ----- Physics -----
  const bbox = new THREE.Box3().setFromObject(group);
  const size = new THREE.Vector3();
  bbox.getSize(size);
  const center = new THREE.Vector3();
  bbox.getCenter(center);
  addStaticBox(center, size);

  // Add billboard position for tree avoidance
  billboardPositions.push(position.clone());

  scene.add(group);
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
  for (let step = 0; step < 8; step++) {
    const lateral = baseLateral + step * 2.0;
    const { pos, center } = getSidePosition(curve, tGuess, lateral, side);
    pos.y = 0;

    // Billboard forward direction
    const forward = center.clone().sub(pos).normalize();
    const forwardCheckDist = 8; // distance in front to check for trees

    let ok = true;

    // Check trees not in front
    for (const tp of treePositions) {
      const toTree = tp.clone().sub(pos);
      const proj = toTree.dot(forward); // projection along forward
      const lateralDist = new THREE.Vector3(toTree.x, 0, toTree.z)
        .length(); // approximate lateral distance
      if (proj > 0 && proj < forwardCheckDist && lateralDist < minDistToTrees) {
        ok = false; // tree in front
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
  const roadHalfWidth = 6; 

  for (let i = 0; i < count; i++) {
    // evenly spaced along the curve
    const t = (i + 0.5) / count; // 
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

    // size variety (optional)
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
  "/models/vehicle2.glb",
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
  if (!userIsRotating) {
    const offset = new THREE.Vector3(2, 3, -8)
      .applyQuaternion(chassisBody.quaternion)
      .add(chassisBody.position);
    camera.position.lerp(offset, 0.1);
    controls.target.copy(chassisBody.position);
  }
  controls.target.copy(chassisBody.position);
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
function onPointerSelect(event) {
  updateRaycasterFromEvent(event);
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObjects(pickables, false);
  if (hits.length > 0) {
    const href = hits[0].object.userData?.href;
    if (href) window.open(href, "_blank");
  }
}
// Works for both desktop click and mobile tap
renderer.domElement.addEventListener("click", onPointerSelect);

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
  const bannerPosition = new THREE.Vector3(start.x, 0, start.z+11);
  createBanner(bannerPosition, "WELCOME BATCH OF 2025", {
  width: 25,
  height: 4,
  poleHeight: 7
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
  button.addEventListener("touchstart", (e) => {
    e.preventDefault();
    keys[key] = true;
  });

  // Release action
  button.addEventListener("touchcancel", (e) => {
    e.preventDefault();
    keys[key] = false;
  });

  // Release if finger slides away
  button.addEventListener("touchend", (e) => {
    e.preventDefault();
    keys[key] = false;
  });

  return button;
}

// ----- Show only on mobile -----
if (
  /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
    navigator.userAgent
  )
) {
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
    maxSpeed = 14; // tuned a bit
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
}
animate();
