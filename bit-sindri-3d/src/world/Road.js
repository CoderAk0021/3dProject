import * as THREE from 'three';

export default class Road {
  constructor({ width = 6, radiusX = 40, radiusZ = 25, segments = 256 } = {}) {
    this.width = width;
    this.radiusX = radiusX;
    this.radiusZ = radiusZ;
    this.segments = segments;

    const geometry = this.createOvalRibbonGeometry();
    const texture = this.createAsphaltTexture();

    const material = new THREE.MeshStandardMaterial({
      map: texture,
      color: 0xffffff,
      metalness: 0.0,
      roughness: 0.95,
    });

    const mesh = new THREE.Mesh(geometry, material);
    // geometry already lies on XZ plane
    mesh.position.y = 0.0;
    mesh.receiveShadow = true;

    this.mesh = mesh;
  }

  // Build a ribbon following an oval centerline: x=a*cos(t), z=b*sin(t)
  createOvalRibbonGeometry() {
    const vertexCount = (this.segments + 1) * 2; // left + right per segment, closed loop
    const positions = new Float32Array(vertexCount * 3);
    const uvs = new Float32Array(vertexCount * 2);
    const indices = new Uint32Array(this.segments * 6);

    let posIndex = 0;
    let uvIndex = 0;

    // Build vertices
    for (let i = 0; i <= this.segments; i++) {
      const t = (i / this.segments) * Math.PI * 2;
      const centerX = this.radiusX * Math.cos(t);
      const centerZ = this.radiusZ * Math.sin(t);

      // Tangent of the oval parametric curve
      const tangent = new THREE.Vector3(
        -this.radiusX * Math.sin(t),
        0,
        this.radiusZ * Math.cos(t)
      ).normalize();

      // Normal in XZ plane is perpendicular to tangent
      const normal = new THREE.Vector3(-tangent.z, 0, tangent.x).normalize();

      const left = new THREE.Vector3(centerX, 0, centerZ).addScaledVector(normal, this.width * 0.5);
      const right = new THREE.Vector3(centerX, 0, centerZ).addScaledVector(normal, -this.width * 0.5);

      // Left vertex
      positions[posIndex + 0] = left.x;
      positions[posIndex + 1] = 0;
      positions[posIndex + 2] = left.z;
      // Right vertex
      positions[posIndex + 3] = right.x;
      positions[posIndex + 4] = 0;
      positions[posIndex + 5] = right.z;
      posIndex += 6;

      // UVs: v is across width, u is along length; tile u based on distance around track
      const u = i / this.segments * 20; // repeat lengthwise
      uvs[uvIndex + 0] = u; // left
      uvs[uvIndex + 1] = 0;
      uvs[uvIndex + 2] = u; // right
      uvs[uvIndex + 3] = 1;
      uvIndex += 4;
    }

    // Build indices (two triangles per segment)
    let indexPtr = 0;
    for (let i = 0; i < this.segments; i++) {
      const i0 = i * 2;
      const i1 = i0 + 1;
      const i2 = i0 + 2;
      const i3 = i0 + 3;

      // First triangle: i0, i2, i1
      indices[indexPtr++] = i0;
      indices[indexPtr++] = i2;
      indices[indexPtr++] = i1;
      // Second triangle: i2, i3, i1
      indices[indexPtr++] = i2;
      indices[indexPtr++] = i3;
      indices[indexPtr++] = i1;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2));
    geometry.setIndex(new THREE.BufferAttribute(indices, 1));

    geometry.computeVertexNormals();
    return geometry;
  }

  // Procedural asphalt-like texture using a small canvas then repeating
  createAsphaltTexture() {
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');

    // Base dark grey
    ctx.fillStyle = '#2a2d33';
    ctx.fillRect(0, 0, size, size);

    // Add noise speckles
    const imageData = ctx.getImageData(0, 0, size, size);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const n = Math.random();
      const v = 30 + Math.floor(n * 40); // small brightness variance
      data[i] = 42 + v;    // R
      data[i + 1] = 45 + v; // G
      data[i + 2] = 51 + v; // B
      data[i + 3] = 255;
    }
    ctx.putImageData(imageData, 0, 0);

    // Center dashed line
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 6;
    ctx.setLineDash([24, 24]);
    ctx.beginPath();
    ctx.moveTo(size / 2, 0);
    ctx.lineTo(size / 2, size);
    ctx.stroke();
    ctx.setLineDash([]);

    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(10, 1);
    texture.anisotropy = 8;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    return texture;
  }

  dispose() {
    this.mesh.geometry?.dispose();
    if (Array.isArray(this.mesh.material)) {
      this.mesh.material.forEach((m) => m.dispose());
    } else {
      this.mesh.material?.dispose();
    }
  }
}