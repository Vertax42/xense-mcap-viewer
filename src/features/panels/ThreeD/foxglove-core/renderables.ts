import * as THREE from 'three';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';

import { composeJointTransform, parseUrdf } from './urdf';
import { TransformTree, normalizeFrameId } from './transformTree';
import {
  eulerToQuaternion,
  type JointStateMsg,
  type ParsedUrdf,
  type TFMessage,
  type UrdfGeometryMesh,
  type UrdfMaterial,
  type UrdfVisual,
} from './types';

export type RobotRenderable = {
  root: THREE.Group;
  parsed: ParsedUrdf;
  transformTree: TransformTree;
  rootFrameId: string | undefined;
  frameObjects: Array<{ frameId: string; object: THREE.Object3D }>;
  hasRealtimeTf: boolean;
};

export type MeshLoadProgress = {
  total: number;
  loaded: number;
  failed: number;
};

type BuildRobotRenderableOptions = {
  resolveMeshUrl: (rawPath: string) => string;
  warn: (meshUrl: string, reason: string) => void;
  fallbackMeshColor?: string;
  outlineColor?: string;
  onMeshLoadProgress?: (progress: MeshLoadProgress) => void;
};

type MeshAsset =
  | { kind: 'stl'; buffer: ArrayBuffer }
  | { kind: 'dae'; text: string };

type MeshAssetLoadResult =
  | { ok: true; asset: MeshAsset }
  | { ok: false; reason: string };

const meshAssetCache = new Map<string, Promise<MeshAssetLoadResult>>();
const OUTLINE_NAME = '__ros3d_edge_outline__';
const OUTLINE_THRESHOLD_ANGLE = 30;
const MAX_OUTLINE_TRIANGLE_COUNT = 10_000;
const edgeGeometryCache = new WeakMap<THREE.BufferGeometry, THREE.EdgesGeometry>();

export async function buildRobotRenderable(
  urdfText: string,
  options: BuildRobotRenderableOptions,
): Promise<RobotRenderable> {
  const parsed = parseUrdf(urdfText);
  const transformTree = new TransformTree();
  for (const frameId of parsed.frames) {
    transformTree.addFrame(frameId);
  }
  for (const transform of parsed.transforms) {
    transformTree.addTransform(
      transform.parent,
      transform.child,
      0n,
      transform.translation,
      transform.rotation,
    );
  }

  const root = new THREE.Group();
  const frameObjects: Array<{ frameId: string; object: THREE.Object3D }> = [];
  const totalMeshVisuals = Array.from(parsed.robot.links.values()).reduce((count, link) => {
    return count + link.visuals.filter((visual) => visual.geometry.geometryType === 'mesh').length;
  }, 0);
  let loadedMeshVisuals = 0;
  let failedMeshVisuals = 0;

  if (totalMeshVisuals > 0) {
    options.onMeshLoadProgress?.({
      total: totalMeshVisuals,
      loaded: 0,
      failed: 0,
    });
  }

  for (const link of parsed.robot.links.values()) {
    for (let index = 0; index < link.visuals.length; index += 1) {
      const visual = link.visuals[index];
      const object = await createFrameObject(link.name, visual, parsed, index, options);
      if (visual.geometry.geometryType === 'mesh') {
        loadedMeshVisuals += 1;
        if (!object) {
          failedMeshVisuals += 1;
        }
        options.onMeshLoadProgress?.({
          total: totalMeshVisuals,
          loaded: loadedMeshVisuals,
          failed: failedMeshVisuals,
        });
      }
      if (!object) {
        continue;
      }
      frameObjects.push({ frameId: link.name, object });
      root.add(object);
    }
  }

  const rootFrameId = parsed.robot.links.has('world')
    ? 'world'
    : inferRootFrameId(parsed) ?? parsed.frames[0] ?? parsed.robot.name;

  return {
    root,
    parsed,
    transformTree,
    rootFrameId,
    frameObjects,
    hasRealtimeTf: false,
  };
}

function inferRootFrameId(parsed: ParsedUrdf): string | undefined {
  const childLinks = new Set(Array.from(parsed.robot.joints.values(), (joint) => joint.child));
  for (const link of parsed.robot.links.values()) {
    if (!childLinks.has(link.name)) {
      return link.name;
    }
  }
  return undefined;
}

async function createFrameObject(
  frameId: string,
  visual: UrdfVisual,
  parsed: ParsedUrdf,
  index: number,
  options: BuildRobotRenderableOptions,
): Promise<THREE.Object3D | undefined> {
  const frameObject = new THREE.Group();
  frameObject.name = `${frameId}-${index}-${visual.geometry.geometryType}`;

  const visualGroup = new THREE.Group();
  const visualOrientation = eulerToQuaternion(visual.origin.rpy);
  visualGroup.position.set(visual.origin.xyz.x, visual.origin.xyz.y, visual.origin.xyz.z);
  visualGroup.quaternion.set(
    visualOrientation.x,
    visualOrientation.y,
    visualOrientation.z,
    visualOrientation.w,
  );

  const geometryObject = await createVisualObject(visual, parsed, options);
  if (!geometryObject) {
    return undefined;
  }

  visualGroup.add(geometryObject);
  frameObject.add(visualGroup);
  return frameObject;
}

async function createVisualObject(
  visual: UrdfVisual,
  parsed: ParsedUrdf,
  options: BuildRobotRenderableOptions,
): Promise<THREE.Object3D | undefined> {
  const color =
    getMaterialColor(visual.material, parsed) ??
    new THREE.Color(options.fallbackMeshColor ?? '#94a3b8');

  switch (visual.geometry.geometryType) {
    case 'box': {
      const { size } = visual.geometry;
      const geometry = new THREE.BoxGeometry(size.x, size.y, size.z);
      return makeLitMesh(geometry, color);
    }
    case 'sphere': {
      const geometry = new THREE.SphereGeometry(visual.geometry.radius, 24, 16);
      return makeLitMesh(geometry, color);
    }
    case 'cylinder': {
      const geometry = new THREE.CylinderGeometry(
        visual.geometry.radius,
        visual.geometry.radius,
        visual.geometry.length,
        24,
      );
      const mesh = makeLitMesh(geometry, color);
      mesh.rotateX(Math.PI / 2);
      return mesh;
    }
    case 'mesh':
      return await loadMeshObject(visual, color, options);
    default:
      return undefined;
  }
}

function makeLitMesh(geometry: THREE.BufferGeometry, color: THREE.Color): THREE.Mesh {
  const material = createFallbackMeshMaterial(color);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function createFallbackMeshMaterial(color: THREE.Color): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color,
    metalness: 0.08,
    roughness: 0.55,
    envMapIntensity: 0.25,
  });
}

function hasTextureMaterial(material: THREE.Material): boolean {
  const candidate = material as THREE.MeshStandardMaterial;
  return Boolean(candidate.map || candidate.normalMap || candidate.roughnessMap || candidate.metalnessMap);
}

function ensureMeshNormals(geometry: THREE.BufferGeometry): void {
  if (!geometry.getAttribute('normal')) {
    geometry.computeVertexNormals();
  }
  geometry.normalizeNormals();
}

function getGeometryTriangleCount(geometry: THREE.BufferGeometry): number {
  const indexCount = geometry.getIndex()?.count;
  if (indexCount != undefined) {
    return Math.ceil(indexCount / 3);
  }
  return Math.ceil((geometry.getAttribute('position')?.count ?? 0) / 3);
}

function getOutlineGeometry(geometry: THREE.BufferGeometry): THREE.EdgesGeometry | undefined {
  if (getGeometryTriangleCount(geometry) > MAX_OUTLINE_TRIANGLE_COUNT) {
    return undefined;
  }
  let edgeGeometry = edgeGeometryCache.get(geometry);
  if (!edgeGeometry) {
    edgeGeometry = new THREE.EdgesGeometry(geometry, OUTLINE_THRESHOLD_ANGLE);
    edgeGeometryCache.set(geometry, edgeGeometry);
  }
  return edgeGeometry;
}

function attachMeshOutline(mesh: THREE.Mesh, outlineColor: string): void {
  if (mesh.children.some((child) => child.name === OUTLINE_NAME)) {
    return;
  }
  const edgeGeometry = getOutlineGeometry(mesh.geometry);
  if (!edgeGeometry) {
    return;
  }
  const edgeMaterial = new THREE.LineBasicMaterial({
    color: outlineColor,
    transparent: true,
    opacity: 0.35,
    depthTest: true,
    depthWrite: false,
    toneMapped: false,
  });
  const edgeLines = new THREE.LineSegments(edgeGeometry, edgeMaterial);
  edgeLines.name = OUTLINE_NAME;
  edgeLines.renderOrder = 1;
  mesh.add(edgeLines);
}

async function loadMeshObject(
  visual: UrdfVisual,
  color: THREE.Color,
  options: BuildRobotRenderableOptions,
): Promise<THREE.Object3D | undefined> {
  const geometry = visual.geometry as UrdfGeometryMesh;
  const meshUrl = options.resolveMeshUrl(geometry.filename);
  const ext = meshUrl.split('?')[0]?.split('.').pop()?.toLowerCase();

  const asset = await loadMeshAsset(meshUrl, ext);
  if (asset.ok === false) {
    options.warn(meshUrl, asset.reason);
    return undefined;
  }

  try {
    let object: THREE.Object3D | undefined;
    if (asset.asset.kind === 'stl') {
      object = loadStl(asset.asset.buffer, color);
    } else {
      object = loadCollada(asset.asset.text, meshUrl);
    }
    if (geometry.scale) {
      object.scale.set(geometry.scale.x, geometry.scale.y, geometry.scale.z);
    }

    object.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) {
        return;
      }
      if (mesh.geometry) {
        ensureMeshNormals(mesh.geometry);
      }
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      let usedFallbackMaterial = false;
      let hasTexturedMaterial = false;
      if (Array.isArray(mesh.material)) {
        hasTexturedMaterial = mesh.material.some((material) => hasTextureMaterial(material));
        return;
      }
      if (!mesh.material || mesh.material instanceof THREE.MeshBasicMaterial) {
        mesh.material = createFallbackMeshMaterial(color);
        usedFallbackMaterial = true;
      } else {
        hasTexturedMaterial = hasTextureMaterial(mesh.material);
      }
      if (asset.asset.kind === 'stl' || (usedFallbackMaterial && !hasTexturedMaterial)) {
        attachMeshOutline(mesh, options.outlineColor ?? '#94a3b8');
      }
    });

    return object;
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    options.warn(meshUrl, reason);
    return undefined;
  }
}

async function loadMeshAsset(meshUrl: string, ext: string | undefined): Promise<MeshAssetLoadResult> {
  let cached = meshAssetCache.get(meshUrl);
  if (!cached) {
    cached = (async () => {
      if (ext !== 'stl' && ext !== 'dae') {
        return { ok: false, reason: `unsupported extension: ${ext ?? 'unknown'}` } satisfies MeshAssetLoadResult;
      }
      try {
        const response = await fetch(meshUrl);
        if (!response.ok) {
          throw new Error(`${response.status} ${response.statusText}`);
        }
        if (ext === 'stl') {
          return { ok: true, asset: { kind: 'stl', buffer: await response.arrayBuffer() } } satisfies MeshAssetLoadResult;
        }
        return { ok: true, asset: { kind: 'dae', text: await response.text() } } satisfies MeshAssetLoadResult;
      } catch (error) {
        const reason = error instanceof Error ? error.message : String(error);
        return { ok: false, reason } satisfies MeshAssetLoadResult;
      }
    })();
    meshAssetCache.set(meshUrl, cached);
  }
  return await cached;
}

function loadStl(buffer: ArrayBuffer, color: THREE.Color): THREE.Object3D {
  const geometry = new STLLoader().parse(buffer);
  const mesh = makeLitMesh(geometry, color);
  const group = new THREE.Group();
  group.add(mesh);
  group.rotateX(Math.PI / 2);
  return group;
}

function loadCollada(text: string, meshUrl: string): THREE.Object3D {
  const xml = new DOMParser().parseFromString(text, 'application/xml');
  const upAxis = (xml.querySelector('up_axis')?.textContent ?? 'Y_UP').trim().toUpperCase();
  const collada = new ColladaLoader().parse(xml.documentElement.outerHTML, meshUrl);
  if (upAxis === 'Y_UP') {
    collada.scene.rotateX(Math.PI / 2);
  }
  return collada.scene;
}

function getMaterialColor(
  material: UrdfMaterial | undefined,
  parsed: ParsedUrdf,
): THREE.Color | undefined {
  const directColor = material?.color;
  if (directColor) {
    return new THREE.Color(directColor.r, directColor.g, directColor.b);
  }

  if (material?.name) {
    const namedMaterial = parsed.robot.materials.get(material.name);
    if (namedMaterial?.color) {
      return new THREE.Color(namedMaterial.color.r, namedMaterial.color.g, namedMaterial.color.b);
    }
  }
  return undefined;
}

export function applyTfMessage(model: RobotRenderable, tfMsg: TFMessage): void {
  for (const transform of tfMsg.transforms) {
    const parent = normalizeFrameId(transform.header.frame_id);
    const child = normalizeFrameId(transform.child_frame_id);
    const stamp = BigInt(transform.header.stamp.sec) * 1_000_000_000n + BigInt(transform.header.stamp.nsec);
    model.transformTree.addTransform(
      parent,
      child,
      stamp,
      transform.transform.translation,
      transform.transform.rotation,
    );
    model.hasRealtimeTf = true;
  }
}

export function applyJointStates(model: RobotRenderable, jointState: JointStateMsg | null): void {
  if (!jointState || model.hasRealtimeTf) {
    return;
  }

  for (let index = 0; index < jointState.name.length; index += 1) {
    const jointName = jointState.name[index];
    const position = jointState.position[index];
    if (jointName == undefined || position == undefined) {
      continue;
    }
    const joint = model.parsed.robot.joints.get(jointName);
    if (!joint) {
      continue;
    }
    const transform = composeJointTransform(joint, position);
    model.transformTree.addTransform(joint.parent, joint.child, 0n, transform.translation, transform.rotation);
  }
}

export function applyFramePoses(model: RobotRenderable, playbackTimeNs: bigint): void {
  const rootFrameId =
    model.transformTree.getRootFrameId(model.rootFrameId) ??
    model.rootFrameId ??
    inferRootFrameId(model.parsed) ??
    model.parsed.frames[0];

  if (!rootFrameId) {
    return;
  }

  const queryTime = model.hasRealtimeTf ? playbackTimeNs : 0n;
  for (const entry of model.frameObjects) {
    // Write pose directly into the entry's object to avoid per-frame
    // Vector3/Quaternion/Matrix4 allocations (previously ~3 allocs * N
    // frameObjects * 60Hz = major GC pressure).
    const ok = model.transformTree.getRelativeTransformInto(
      rootFrameId,
      entry.frameId,
      queryTime,
      entry.object.position,
      entry.object.quaternion,
    );
    entry.object.visible = ok;
  }
}

function disposeMaterial(material: THREE.Material): void {
  // MeshStandardMaterial and its kin own texture references via numerous
  // optional slots (map, normalMap, roughnessMap, ...). THREE does NOT auto-
  // dispose them, so every URDF rebuild would otherwise leak GPU textures.
  const mat = material as unknown as Record<string, unknown>;
  for (const key of Object.keys(mat)) {
    const value = mat[key];
    if (value && typeof value === 'object' && 'isTexture' in value && (value as THREE.Texture).isTexture) {
      (value as THREE.Texture).dispose();
    }
  }
  material.dispose();
}

function disposeObjectMaterials(material: THREE.Material | THREE.Material[] | undefined): void {
  if (!material) return;
  if (Array.isArray(material)) {
    for (const entry of material) {
      disposeMaterial(entry);
    }
    return;
  }
  disposeMaterial(material);
}

export function disposeRobotRenderable(model: RobotRenderable | null): void {
  if (!model) {
    return;
  }
  model.root.traverse((child) => {
    const mesh = child as THREE.Mesh;
    if (mesh.isMesh || (child as THREE.LineSegments).isLineSegments) {
      const renderObject = child as THREE.Mesh | THREE.LineSegments;
      if (renderObject.geometry) {
        renderObject.geometry.dispose();
      }
      disposeObjectMaterials(renderObject.material);
    }
  });
  model.root.clear();
}
