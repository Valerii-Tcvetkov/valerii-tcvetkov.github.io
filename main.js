import * as THREE from "https://unpkg.com/three@0.162.0/build/three.module.js";
import { OrbitControls } from "https://unpkg.com/three@0.162.0/examples/jsm/controls/OrbitControls.js";
import { TransformControls } from "https://unpkg.com/three@0.162.0/examples/jsm/controls/TransformControls.js";
import { GLTFExporter } from "https://unpkg.com/three@0.162.0/examples/jsm/exporters/GLTFExporter.js";

const viewport = document.getElementById("viewport");
const selectionInfo = document.getElementById("selectionInfo");
const meshStats = document.getElementById("meshStats");
const posXInput = document.getElementById("posX");
const posYInput = document.getElementById("posY");
const posZInput = document.getElementById("posZ");
const sizeXInput = document.getElementById("sizeX");
const sizeYInput = document.getElementById("sizeY");
const sizeZInput = document.getElementById("sizeZ");
const nameInput = document.getElementById("nameInput");
const colorInput = document.getElementById("colorInput");
const duplicateBtn = document.getElementById("duplicateBtn");
const deleteBtn = document.getElementById("deleteBtn");
const saveBtn = document.getElementById("saveBtn");
const exportGlbBtn = document.getElementById("exportGlbBtn");
const loadInput = document.getElementById("loadInput");
const topProjectionCanvas = document.getElementById("topProjection");
const refreshTopProjectionBtn = document.getElementById("refreshTopProjectionBtn");
const frontProjectionCanvas = document.getElementById("frontProjection");
const refreshProjectionBtn = document.getElementById("refreshProjectionBtn");
const exportSidePngBtn = document.getElementById("exportSidePngBtn");
const catalogItems = document.querySelectorAll(".catalog-item");
const preview3dRoot = document.getElementById("preview3d");
const uiMessage = document.getElementById("uiMessage");
const uiMessageText = document.getElementById("uiMessageText");
const uiMessageClose = document.getElementById("uiMessageClose");
const previewTiltAngleInput = document.getElementById("previewTiltAngle");
const previewTiltValue = document.getElementById("previewTiltValue");
const projectionCtx = frontProjectionCanvas.getContext("2d");
const topProjectionCtx = topProjectionCanvas.getContext("2d");

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.setClearColor(0x0b1020);
viewport.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(
  60,
  viewport.clientWidth / viewport.clientHeight,
  0.1,
  1000
);
camera.position.set(6, 6, 10);

const orbit = new OrbitControls(camera, renderer.domElement);
orbit.enableDamping = true;

const transform = new TransformControls(camera, renderer.domElement);
transform.addEventListener("dragging-changed", (event) => {
  orbit.enabled = !event.value;
});
scene.add(transform);

const ambient = new THREE.AmbientLight(0xffffff, 0.6);
scene.add(ambient);

const dir = new THREE.DirectionalLight(0xffffff, 1);
dir.position.set(7, 10, 4);
dir.castShadow = true;
scene.add(dir);

const grid = new THREE.GridHelper(100, 100, 0x334155, 0x1e293b);
scene.add(grid);

const axes = new THREE.AxesHelper(3);
scene.add(axes);

const objects = [];
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selected = null;
let objectCounter = 0;
const sizeBox = new THREE.Box3();
const sizeVector = new THREE.Vector3();
let syncingInputs = false;
let projectionDirty = true;
const products = new Map([
  ["product1", { id: "product1", name: "Товар 1", size: { x: 1, y: 1, z: 1 } }],
]);
const productPlacements = [];
const projectionRenderState = {
  front: { hitAreas: [], placementAreas: [], scale: 1, minA: 0, minB: 0, invertB: true, pad: 16 },
  top: { hitAreas: [], placementAreas: [], scale: 1, minA: 0, minB: 0, invertB: false, pad: 16 },
};
let selectedPlacementId = null;
let placementSwapState = null;
let activePlacementDrag = null;
const projectionHoverTarget = {
  front: null,
  top: null,
};
const projectionBlinkTarget = {
  front: null,
  top: null,
};
const projectionGuides = {
  front: [],
  top: [],
};
let previewDirty = true;
let uiMessageTimer = null;
let uiMessageClearTimer = null;
let uiMessageLastShownAt = 0;

function getPlacementDisplayName(placement) {
  const index = productPlacements.findIndex((item) => item.id === placement?.id);
  return index >= 0 ? `Товар ${index + 1}` : "Товар";
}

function setSelectedPlacement(placementId) {
  selectedPlacementId = placementId;
  if (placementSwapState?.sourcePlacementId && placementSwapState.sourcePlacementId !== placementId) {
    placementSwapState = null;
  }
  projectionDirty = true;
  previewDirty = true;
}

function clearPlacementSelection() {
  selectedPlacementId = null;
  placementSwapState = null;
  projectionDirty = true;
  previewDirty = true;
}

function startPlacementSwapMode(placementId) {
  if (!placementId) return;
  selectedPlacementId = placementId;
  placementSwapState = {
    sourcePlacementId: placementId,
    startedAt: performance.now(),
  };
  projectionDirty = true;
}

function stopPlacementSwapMode() {
  if (!placementSwapState) return;
  placementSwapState = null;
  projectionDirty = true;
}

function isPlacementSwapBlinkActive() {
  return Boolean(placementSwapState?.sourcePlacementId);
}

function swapPlacementPositions(sourcePlacement, targetPlacement) {
  const sourceState = {
    objectUuid: sourcePlacement.objectUuid,
    surface: sourcePlacement.surface,
    localPosition: { ...sourcePlacement.localPosition },
  };
  sourcePlacement.objectUuid = targetPlacement.objectUuid;
  sourcePlacement.surface = targetPlacement.surface;
  sourcePlacement.localPosition = { ...targetPlacement.localPosition };
  targetPlacement.objectUuid = sourceState.objectUuid;
  targetPlacement.surface = sourceState.surface;
  targetPlacement.localPosition = sourceState.localPosition;
  projectionDirty = true;
  previewDirty = true;
}

function getPlacementWorldPoint(placement) {
  const host = getObjectByUuid(placement.objectUuid);
  if (!host) return null;
  const world = new THREE.Vector3(
    placement.localPosition.x,
    placement.localPosition.y,
    placement.localPosition.z
  );
  host.localToWorld(world);
  return world;
}

function refreshPlacementSwapBlink() {
  if (!placementSwapState?.sourcePlacementId) return;
  placementSwapState.startedAt = performance.now();
  projectionDirty = true;
}

function swapSelectedPlacementWith(targetPlacementId) {
  const sourcePlacementId = placementSwapState?.sourcePlacementId || selectedPlacementId;
  if (!sourcePlacementId || sourcePlacementId === targetPlacementId) return false;
  const sourcePlacement = getPlacementById(sourcePlacementId);
  const targetPlacement = getPlacementById(targetPlacementId);
  if (!sourcePlacement || !targetPlacement) return false;
  swapPlacementPositions(sourcePlacement, targetPlacement);
  selectedPlacementId = sourcePlacement.id;
  if (placementSwapState?.sourcePlacementId) {
    refreshPlacementSwapBlink();
  }
  projectionDirty = true;
  previewDirty = true;
  return true;
}

function rangesIntersect(min1, max1, min2, max2) {
  return Math.max(min1, min2) <= Math.min(max1, max2);
}

function findNearestPlacementInDirection(sourcePlacementId, direction) {
  const sourcePlacement = getPlacementById(sourcePlacementId);
  const sourceBounds = sourcePlacement ? getPlacementProjectionBounds(sourcePlacement, "top") : null;
  if (!sourcePlacement || !sourceBounds) return null;

  const isHorizontal = direction === "left" || direction === "right";
  const axis = isHorizontal ? "A" : "B";
  const sign = direction === "left" || direction === "up" ? -1 : 1;
  let best = null;

  productPlacements.forEach((placement) => {
    if (placement.id === sourcePlacementId) return;
    const bounds = getPlacementProjectionBounds(placement, "top");
    if (!bounds) return;

    const overlapsPerpendicular = isHorizontal
      ? rangesIntersect(sourceBounds.minB, sourceBounds.maxB, bounds.minB, bounds.maxB)
      : rangesIntersect(sourceBounds.minA, sourceBounds.maxA, bounds.minA, bounds.maxA);
    if (!overlapsPerpendicular) return;

    const sourceCenter = axis === "A" ? sourceBounds.centerA : sourceBounds.centerB;
    const targetCenter = axis === "A" ? bounds.centerA : bounds.centerB;
    const primaryDelta = (targetCenter - sourceCenter) * sign;
    if (primaryDelta <= 0) return;

    const secondaryDelta = isHorizontal
      ? Math.abs(bounds.centerB - sourceBounds.centerB)
      : Math.abs(bounds.centerA - sourceBounds.centerA);
    const score = primaryDelta * 1000 + secondaryDelta;
    if (!best || score < best.score) {
      best = { placementId: placement.id, score };
    }
  });

  return best?.placementId || null;
}

function getPlacementSwapCandidateIds(sourcePlacementId) {
  if (!sourcePlacementId) return new Set();
  const directions = ["left", "right", "up", "down"];
  const ids = new Set();
  directions.forEach((direction) => {
    const candidateId = findNearestPlacementInDirection(sourcePlacementId, direction);
    if (candidateId) ids.add(candidateId);
  });
  return ids;
}

function getPlacementSwapCandidateSet() {
  return placementSwapState?.sourcePlacementId
    ? getPlacementSwapCandidateIds(placementSwapState.sourcePlacementId)
    : new Set();
}

const previewRenderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
previewRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
previewRenderer.setClearColor(0x0b1020);
preview3dRoot.appendChild(previewRenderer.domElement);

const previewScene = new THREE.Scene();
const previewCamera = new THREE.PerspectiveCamera(50, 1, 0.1, 2000);
previewCamera.position.set(7, 7, 10);
const previewControls = new OrbitControls(previewCamera, previewRenderer.domElement);
previewControls.enableDamping = true;
previewControls.enablePan = true;
previewControls.enableZoom = true;
previewControls.enableRotate = true;

const previewAmbient = new THREE.AmbientLight(0xffffff, 0.65);
const previewDir = new THREE.DirectionalLight(0xffffff, 0.9);
previewDir.position.set(6, 9, 4);
previewScene.add(previewAmbient, previewDir);

const previewContentGroup = new THREE.Group();
const previewObjectsGroup = new THREE.Group();
const previewProductsGroup = new THREE.Group();
previewContentGroup.add(previewObjectsGroup, previewProductsGroup);
previewScene.add(previewContentGroup);

function setPreviewTiltAngle(deg) {
  previewContentGroup.rotation.x = THREE.MathUtils.degToRad(deg);
  previewTiltValue.textContent = `${deg}deg`;
}

function markEditable(object) {
  object.userData.editable = true;
  objectCounter += 1;
  object.name = `${object.type}_${objectCounter}`;
  objects.push(object);
  projectionDirty = true;
}

function addPrimitive(kind) {
  let mesh;
  const mat = new THREE.MeshStandardMaterial({ color: 0x4dabf7 });

  if (kind === "box") mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat);
  if (kind === "sphere") mesh = new THREE.Mesh(new THREE.SphereGeometry(0.6, 32, 16), mat);
  if (kind === "cylinder") mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 1.2, 24), mat);
  if (kind === "torus") mesh = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.2, 16, 64), mat);

  if (kind === "plane") {
    mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 2.2), mat);
    mesh.rotation.x = -Math.PI * 0.5;
  }

  if (kind === "light") {
    const point = new THREE.PointLight(0xffffff, 1.4, 40);
    point.position.set(1.5, 2.5, 1.5);
    const helper = new THREE.PointLightHelper(point, 0.15, 0xfff3bf);
    point.add(helper);
    markEditable(point);
    scene.add(point);
    setSelection(point);
    return;
  }

  mesh.position.set(Math.random() * 2 - 1, 0.6, Math.random() * 2 - 1);
  markEditable(mesh);
  scene.add(mesh);
  setSelection(mesh);
}

function setSelection(object) {
  selected = object;
  if (selectedPlacementId !== null || placementSwapState) {
    clearPlacementSelection();
  }
  transform.detach();

  if (!selected) {
    selectionInfo.textContent = "Выберите объект";
    meshStats.textContent = "Нет выбранного mesh";
    nameInput.value = "";
    updateAttributeInputs();
    projectionDirty = true;
    return;
  }

  selectionInfo.textContent = `Выбран: ${selected.name}`;
  nameInput.value = selected.name || "";
  if (selected.isMesh && selected.material?.color) {
    colorInput.value = `#${selected.material.color.getHexString()}`;
  }
  updateMeshStats();
  updateAttributeInputs();
  transform.attach(selected);
  projectionDirty = true;
}

function updateMeshStats() {
  if (!selected) {
    meshStats.textContent = "Нет выбранного mesh";
    return;
  }

  if (!selected.isMesh) {
    const p = selected.position;
    meshStats.textContent =
      `Тип: ${selected.type}\n` +
      "Габариты: недоступны (не mesh)\n" +
      `Позиция: x=${p.x.toFixed(2)} y=${p.y.toFixed(2)} z=${p.z.toFixed(2)}`;
    return;
  }

  selected.updateMatrixWorld(true);
  sizeBox.setFromObject(selected);
  sizeBox.getSize(sizeVector);
  const p = selected.position;

  meshStats.textContent =
    "Габариты (world):\n" +
    `x=${sizeVector.x.toFixed(2)} y=${sizeVector.y.toFixed(2)} z=${sizeVector.z.toFixed(2)}\n` +
    "Позиция:\n" +
    `x=${p.x.toFixed(2)} y=${p.y.toFixed(2)} z=${p.z.toFixed(2)}`;
}

function drawProjection(canvas, ctx, options) {
  const w = canvas.width;
  const h = canvas.height;
  const pad = 16;
  const swapCandidateIds = getPlacementSwapCandidateSet();

  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0b1020";
  ctx.fillRect(0, 0, w, h);

  const bounds = [];
  objects.forEach((obj) => {
    obj.updateMatrixWorld(true);
    sizeBox.setFromObject(obj);
    if (sizeBox.isEmpty()) return;
    const minA = sizeBox.min[options.axisA];
    const maxA = sizeBox.max[options.axisA];
    const minB = sizeBox.min[options.axisB];
    const maxB = sizeBox.max[options.axisB];
    bounds.push({
      obj,
      minA,
      maxA,
      minB,
      maxB,
    });
  });

  if (!bounds.length) {
    ctx.fillStyle = "#94a3b8";
    ctx.font = "12px sans-serif";
    ctx.fillText("Нет объектов для проекции", 12, 24);
    return;
  }

  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;
  bounds.forEach((b) => {
    minA = Math.min(minA, b.minA);
    maxA = Math.max(maxA, b.maxA);
    minB = Math.min(minB, b.minB);
    maxB = Math.max(maxB, b.maxB);
  });

  const spanA = Math.max(maxA - minA, 1e-6);
  const spanB = Math.max(maxB - minB, 1e-6);
  const scale = Math.min((w - pad * 2) / spanA, (h - pad * 2) / spanB);
  const hitAreas = [];
  const placementAreas = [];

  const toCanvasX = (value) => pad + (value - minA) * scale;
  const toCanvasY = (value) => {
    if (options.invertB ?? true) {
      return h - (pad + (value - minB) * scale);
    }
    return pad + (value - minB) * scale;
  };

  bounds.forEach((b) => {
    const x = toCanvasX(b.minA);
    const y = toCanvasY((options.invertB ?? true) ? b.maxB : b.minB);
    const rw = Math.max((b.maxA - b.minA) * scale, 2);
    const rh = Math.max((b.maxB - b.minB) * scale, 2);

    ctx.strokeStyle = b.obj === selected ? "#4dabf7" : "#e2e8f0";
    ctx.lineWidth = b.obj === selected ? 2 : 1;
    ctx.strokeRect(x, y, rw, rh);
    if (projectionHoverTarget[options.key] === b.obj.uuid) {
      const blinkState = projectionBlinkTarget[options.key];
      const isBlinking = blinkState && blinkState.uuid === b.obj.uuid;
      let fillAlpha = 0;
      if (isBlinking) {
        const t = performance.now() - blinkState.startedAt;
        if (t >= 0) {
          // Smooth repeating pulse while user keeps cursor still.
          const phase = (t / 420) * Math.PI * 2;
          const pulse = (Math.sin(phase) + 1) * 0.5;
          fillAlpha = 0.08 + pulse * 0.24;
        }
      }
      if (fillAlpha > 0.01) {
        ctx.fillStyle = `rgba(34, 211, 238, ${fillAlpha.toFixed(3)})`;
        ctx.fillRect(x, y, rw, rh);
      }
      ctx.strokeStyle = "#22d3ee";
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 1, y - 1, rw + 2, rh + 2);
    }
    hitAreas.push({
      obj: b.obj,
      x,
      y,
      w: rw,
      h: rh,
      minA: b.minA,
      maxA: b.maxA,
      minB: b.minB,
      maxB: b.maxB,
    });
  });

  productPlacements.forEach((placement) => {
    const product = products.get(placement.productId);
    if (!product) return;
    const obj = objects.find((item) => item.uuid === placement.objectUuid);
    if (!obj) return;

    const world = new THREE.Vector3(
      placement.localPosition.x,
      placement.localPosition.y,
      placement.localPosition.z
    );
    obj.localToWorld(world);

    const projectedA = world[options.axisA];
    const projectedB = world[options.axisB];
    const cx = toCanvasX(projectedA);
    const cy = toCanvasY(projectedB);
    const projW = Math.max(product.size[options.axisA] * scale, 8);
    const projH = Math.max(product.size[options.axisB] * scale, 8);
    let px = cx - projW / 2;
    let py = cy - projH / 2;

    // Keep product outside object silhouette for matching surface in other projection.
    if (placement.surface === "top" && options.key === "front") {
      py = cy - projH;
    } else if (placement.surface === "front" && options.key === "front") {
      py = cy - projH;
    } else if (placement.surface === "front" && options.key === "top") {
      // Front surface in top view: stick to front border from inside perimeter.
      py = cy - projH;
    }

    const isSelectedPlacement = placement.id === selectedPlacementId;
    const isSwapSource = placement.id === placementSwapState?.sourcePlacementId;
    const isSwapCandidate = swapCandidateIds.has(placement.id);
    let fillStyle = "rgba(77, 171, 247, 0.35)";
    let strokeStyle = "#4dabf7";
    let lineWidth = isSelectedPlacement ? 2 : 1;
    if (isSwapSource) {
      const t = performance.now() - placementSwapState.startedAt;
      const phase = (t / 420) * Math.PI * 2;
      const pulse = (Math.sin(phase) + 1) * 0.5;
      const fillAlpha = 0.1 + pulse * 0.28;
      fillStyle = `rgba(250, 204, 21, ${fillAlpha.toFixed(3)})`;
      strokeStyle = "#facc15";
      lineWidth = 2;
    } else if (isSwapCandidate) {
      const t = performance.now() - (placementSwapState?.startedAt || performance.now());
      const phase = (t / 520) * Math.PI * 2;
      const pulse = (Math.sin(phase) + 1) * 0.5;
      const fillAlpha = 0.035 + pulse * 0.06;
      fillStyle = `rgba(74, 222, 128, ${fillAlpha.toFixed(3)})`;
      strokeStyle = "rgba(74, 222, 128, 0.55)";
      lineWidth = 1.5;
    } else if (isSelectedPlacement) {
      fillStyle = "rgba(77, 171, 247, 0.42)";
      strokeStyle = "#93c5fd";
    }
    ctx.fillStyle = fillStyle;
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth;
    ctx.fillRect(px, py, projW, projH);
    ctx.strokeRect(px, py, projW, projH);
    ctx.fillStyle = "#e2e8f0";
    ctx.font = "10px sans-serif";
    ctx.fillText(getPlacementDisplayName(placement), px + 2, py + 11);
    placementAreas.push({
      placementId: placement.id,
      x: px,
      y: py,
      w: projW,
      h: projH,
      projectedA,
      projectedB,
      objectUuid: placement.objectUuid,
    });
  });

  ctx.fillStyle = "#94a3b8";
  ctx.font = "11px sans-serif";
  ctx.fillText(options.label, 10, h - 8);

  const guides = projectionGuides[options.key] || [];
  if (guides.length) {
    ctx.save();
    ctx.strokeStyle = "rgba(56, 189, 248, 0.95)";
    ctx.fillStyle = "rgba(56, 189, 248, 0.95)";
    ctx.lineWidth = 1.2;
    ctx.setLineDash([4, 3]);
    const drawArrowHead = (x, y, dx, dy) => {
      const len = Math.hypot(dx, dy) || 1;
      const ux = dx / len;
      const uy = dy / len;
      const size = 5;
      const px = -uy;
      const py = ux;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x - ux * size + px * 2.6, y - uy * size + py * 2.6);
      ctx.lineTo(x - ux * size - px * 2.6, y - uy * size - py * 2.6);
      ctx.closePath();
      ctx.fill();
    };
    guides.forEach((guide) => {
      if (guide.type === "align-link") {
        ctx.beginPath();
        ctx.moveTo(guide.x1, guide.y1);
        ctx.lineTo(guide.x2, guide.y2);
        ctx.stroke();
      } else if (guide.type === "spacing-arrows" && Array.isArray(guide.segments)) {
        guide.segments.forEach((segment) => {
          const y = segment.y;
          const x1 = segment.x1;
          const x2 = segment.x2;
          if (x1 === null || x2 === null || y === null) return;
          ctx.beginPath();
          ctx.moveTo(x1, y);
          ctx.lineTo(x2, y);
          ctx.stroke();
          drawArrowHead(x1, y, x1 - x2, 0);
          drawArrowHead(x2, y, x2 - x1, 0);
        });
      } else if (guide.type === "spacing-arrows-vertical" && Array.isArray(guide.segments)) {
        guide.segments.forEach((segment) => {
          const x = segment.x;
          const y1 = segment.y1;
          const y2 = segment.y2;
          if (x === null || y1 === null || y2 === null) return;
          ctx.beginPath();
          ctx.moveTo(x, y1);
          ctx.lineTo(x, y2);
          ctx.stroke();
          drawArrowHead(x, y1, 0, y1 - y2);
          drawArrowHead(x, y2, 0, y2 - y1);
        });
      }
    });
    ctx.restore();
  }

  projectionRenderState[options.key] = {
    hitAreas,
    placementAreas,
    scale,
    minA,
    minB,
    invertB: options.invertB ?? true,
    pad,
  };
}

function hasActiveBlink() {
  const frontBlink = projectionBlinkTarget.front;
  const topBlink = projectionBlinkTarget.top;
  const frontActive = Boolean(frontBlink);
  const topActive = Boolean(topBlink);
  return Boolean(frontActive || topActive);
}

function drawFrontProjection() {
  drawProjection(frontProjectionCanvas, projectionCtx, {
    key: "front",
    axisA: "x",
    axisB: "y",
    label: "Front view (X/Y)",
    invertB: true,
  });
}

function drawTopProjection() {
  drawProjection(topProjectionCanvas, topProjectionCtx, {
    key: "top",
    axisA: "x",
    axisB: "z",
    label: "Top view (X/Z)",
    invertB: false,
  });
}

function updateAttributeInputs() {
  syncingInputs = true;

  if (!selected) {
    [posXInput, posYInput, posZInput, sizeXInput, sizeYInput, sizeZInput].forEach((input) => {
      input.value = "";
      input.disabled = true;
    });
    syncingInputs = false;
    return;
  }

  posXInput.disabled = false;
  posYInput.disabled = false;
  posZInput.disabled = false;
  posXInput.value = selected.position.x.toFixed(2);
  posYInput.value = selected.position.y.toFixed(2);
  posZInput.value = selected.position.z.toFixed(2);

  if (!selected.isMesh) {
    sizeXInput.value = "";
    sizeYInput.value = "";
    sizeZInput.value = "";
    sizeXInput.disabled = true;
    sizeYInput.disabled = true;
    sizeZInput.disabled = true;
    syncingInputs = false;
    return;
  }

  selected.updateMatrixWorld(true);
  sizeBox.setFromObject(selected);
  sizeBox.getSize(sizeVector);
  sizeXInput.value = sizeVector.x.toFixed(2);
  sizeYInput.value = sizeVector.y.toFixed(2);
  sizeZInput.value = sizeVector.z.toFixed(2);
  sizeXInput.disabled = false;
  sizeYInput.disabled = false;
  sizeZInput.disabled = false;

  syncingInputs = false;
}

function pick(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const hits = raycaster.intersectObjects(objects, true);
  if (!hits.length) {
    setSelection(null);
    return;
  }

  let top = hits[0].object;
  while (top && !top.userData.editable) {
    top = top.parent;
  }
  setSelection(top || null);
}

renderer.domElement.addEventListener("pointerdown", (event) => {
  // Do not run object picking while user grabs transform gizmo.
  if (transform.dragging || transform.axis) return;
  pick(event);
});

document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => addPrimitive(button.dataset.add));
});

document.querySelectorAll("[data-mode]").forEach((button) => {
  button.addEventListener("click", () => transform.setMode(button.dataset.mode));
});

transform.addEventListener("objectChange", () => {
  updateMeshStats();
  updateAttributeInputs();
  projectionDirty = true;
});

nameInput.addEventListener("input", () => {
  if (!selected) return;
  selected.name = nameInput.value.trim() || selected.type;
  selectionInfo.textContent = `Выбран: ${selected.name}`;
});

colorInput.addEventListener("input", () => {
  if (!selected || !selected.isMesh || !selected.material?.color) return;
  selected.material.color.set(colorInput.value);
});

function applyPositionInputs() {
  if (!selected || syncingInputs) return;

  const x = Number(posXInput.value);
  const y = Number(posYInput.value);
  const z = Number(posZInput.value);

  if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(z)) return;
  selected.position.set(x, y, z);
  selected.updateMatrixWorld(true);
  updateMeshStats();
  updateAttributeInputs();
  projectionDirty = true;
}

function applySizeInputs() {
  if (!selected || !selected.isMesh || syncingInputs) return;

  const targetX = Number(sizeXInput.value);
  const targetY = Number(sizeYInput.value);
  const targetZ = Number(sizeZInput.value);
  if (!Number.isFinite(targetX) || !Number.isFinite(targetY) || !Number.isFinite(targetZ)) return;
  if (targetX <= 0 || targetY <= 0 || targetZ <= 0) return;

  selected.updateMatrixWorld(true);
  sizeBox.setFromObject(selected);
  sizeBox.getSize(sizeVector);
  const currentX = Math.max(sizeVector.x, 1e-6);
  const currentY = Math.max(sizeVector.y, 1e-6);
  const currentZ = Math.max(sizeVector.z, 1e-6);

  selected.scale.x *= targetX / currentX;
  selected.scale.y *= targetY / currentY;
  selected.scale.z *= targetZ / currentZ;
  selected.updateMatrixWorld(true);
  updateMeshStats();
  updateAttributeInputs();
  projectionDirty = true;
}

function cloneEditableObject(object) {
  const clone = object.clone(true);
  clone.position.copy(object.position);
  clone.quaternion.copy(object.quaternion);
  clone.scale.copy(object.scale);

  if (clone.isMesh) {
    clone.geometry = object.geometry.clone();
    if (Array.isArray(object.material)) {
      clone.material = object.material.map((mat) => mat.clone());
    } else if (object.material) {
      clone.material = object.material.clone();
    }
  }

  return clone;
}

[posXInput, posYInput, posZInput].forEach((input) => {
  input.addEventListener("change", applyPositionInputs);
});

[sizeXInput, sizeYInput, sizeZInput].forEach((input) => {
  input.addEventListener("change", applySizeInputs);
});

duplicateBtn.addEventListener("click", () => {
  if (!selected || !selected.userData?.editable) return;
  const clone = cloneEditableObject(selected);
  markEditable(clone);
  scene.add(clone);
  setSelection(clone);
  projectionDirty = true;
});

deleteBtn.addEventListener("click", () => {
  if (!selected) return;
  const removedPlacementIds = new Set();
  for (let i = productPlacements.length - 1; i >= 0; i -= 1) {
    if (productPlacements[i].objectUuid === selected.uuid) {
      removedPlacementIds.add(productPlacements[i].id);
      productPlacements.splice(i, 1);
    }
  }
  if (removedPlacementIds.has(selectedPlacementId) || removedPlacementIds.has(placementSwapState?.sourcePlacementId)) {
    clearPlacementSelection();
  }
  scene.remove(selected);
  const idx = objects.indexOf(selected);
  if (idx >= 0) objects.splice(idx, 1);
  setSelection(null);
  projectionDirty = true;
});

window.addEventListener("keydown", (event) => {
  const activeTag = document.activeElement?.tagName;
  if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;
  if (event.code === "KeyR") {
    if (!selectedPlacementId) return;
    event.preventDefault();
    if (placementSwapState?.sourcePlacementId === selectedPlacementId) {
      stopPlacementSwapMode();
    } else {
      startPlacementSwapMode(selectedPlacementId);
    }
    return;
  }
  if (placementSwapState?.sourcePlacementId && selectedPlacementId) {
    const directionByCode = {
      ArrowUp: "up",
      ArrowDown: "down",
      ArrowLeft: "left",
      ArrowRight: "right",
    };
    const direction = directionByCode[event.code];
    if (direction) {
      event.preventDefault();
      const targetPlacementId = findNearestPlacementInDirection(selectedPlacementId, direction);
      if (targetPlacementId) {
        swapSelectedPlacementWith(targetPlacementId);
      }
      return;
    }
  }
  if (event.key !== "Backspace") return;
  if (!selected || !selected.userData?.editable) return;
  event.preventDefault();
  deleteBtn.click();
});

saveBtn.addEventListener("click", () => {
  const editable = scene.children.filter((item) => item.userData.editable);
  const pack = editable.map((item) => item.toJSON());
  const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "scene.json";
  link.click();
  URL.revokeObjectURL(link.href);
});

function buildExportSceneRoot() {
  const root = new THREE.Group();
  root.name = "ExportRoot";

  objects.forEach((obj) => {
    obj.updateMatrixWorld(true);
    const clone = obj.clone(true);
    // Export clone in world-space without re-applying local transform twice.
    clone.matrixAutoUpdate = false;
    clone.matrix.copy(obj.matrixWorld);
    clone.matrix.decompose(clone.position, clone.quaternion, clone.scale);
    clone.matrixAutoUpdate = false;
    root.add(clone);
  });

  productPlacements.forEach((placement) => {
    const product = products.get(placement.productId);
    const host = getObjectByUuid(placement.objectUuid);
    if (!product || !host) return;

    host.updateMatrixWorld(true);
    const world = new THREE.Vector3(
      placement.localPosition.x,
      placement.localPosition.y,
      placement.localPosition.z
    );
    host.localToWorld(world);
    if (placement.surface === "top") world.y += product.size.y * 0.5;
    if (placement.surface === "front") {
      world.y += product.size.y * 0.5;
      world.z += product.size.z * 0.5;
    }

    const productMesh = new THREE.Mesh(
      new THREE.BoxGeometry(product.size.x, product.size.y, product.size.z),
      new THREE.MeshStandardMaterial({ color: 0x4dabf7 })
    );
    productMesh.position.copy(world);
    productMesh.name = getPlacementDisplayName(placement);
    root.add(productMesh);
  });

  return root;
}

exportGlbBtn.addEventListener("click", () => {
  try {
    const exporter = new GLTFExporter();
    const exportRoot = buildExportSceneRoot();
    exporter.parse(
      exportRoot,
      (result) => {
        const blob = new Blob([result], { type: "model/gltf-binary" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "model.glb";
        link.click();
        URL.revokeObjectURL(link.href);
      },
      (error) => {
        console.error(error);
        alert("Не удалось экспортировать GLB");
      },
      { binary: true, onlyVisible: true }
    );
  } catch (error) {
    console.error(error);
    alert("Не удалось экспортировать GLB");
  }
});

loadInput.addEventListener("change", async (event) => {
  const file = event.target.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const raw = JSON.parse(text);

    objects.forEach((obj) => scene.remove(obj));
    objects.length = 0;
    productPlacements.length = 0;
    setSelection(null);

    const loader = new THREE.ObjectLoader();
    raw.forEach((json) => {
      const obj = loader.parse(json);
      markEditable(obj);
      scene.add(obj);
    });
    clearPlacementSelection();
    projectionDirty = true;
  } catch (error) {
    console.error(error);
    alert("Не удалось загрузить файл сцены");
  } finally {
    loadInput.value = "";
  }
});

refreshProjectionBtn.addEventListener("click", () => {
  projectionDirty = true;
  drawFrontProjection();
});

exportSidePngBtn.addEventListener("click", () => {
  const bounds = [];
  objects.forEach((obj) => {
    obj.updateMatrixWorld(true);
    sizeBox.setFromObject(obj);
    if (sizeBox.isEmpty()) return;
    bounds.push({
      minA: sizeBox.min.x,
      maxA: sizeBox.max.x,
      minB: sizeBox.min.y,
      maxB: sizeBox.max.y,
    });
  });

  if (!bounds.length) {
    alert("Нет объектов для выгрузки side view.");
    return;
  }

  const exportCanvas = document.createElement("canvas");
  exportCanvas.width = frontProjectionCanvas.width;
  exportCanvas.height = frontProjectionCanvas.height;
  const ctx = exportCanvas.getContext("2d", { alpha: true });
  if (!ctx) return;
  ctx.clearRect(0, 0, exportCanvas.width, exportCanvas.height);

  const pad = 16;
  let minA = Infinity;
  let maxA = -Infinity;
  let minB = Infinity;
  let maxB = -Infinity;
  bounds.forEach((b) => {
    minA = Math.min(minA, b.minA);
    maxA = Math.max(maxA, b.maxA);
    minB = Math.min(minB, b.minB);
    maxB = Math.max(maxB, b.maxB);
  });

  const spanA = Math.max(maxA - minA, 1e-6);
  const spanB = Math.max(maxB - minB, 1e-6);
  const scale = Math.min(
    (exportCanvas.width - pad * 2) / spanA,
    (exportCanvas.height - pad * 2) / spanB
  );
  const toCanvasX = (value) => pad + (value - minA) * scale;
  const toCanvasY = (value) => exportCanvas.height - (pad + (value - minB) * scale);

  bounds.forEach((b) => {
    const x = toCanvasX(b.minA);
    const y = toCanvasY(b.maxB);
    const rw = Math.max((b.maxA - b.minA) * scale, 2);
    const rh = Math.max((b.maxB - b.minB) * scale, 2);
    ctx.fillStyle = "rgba(217, 217, 217, 0.6)";
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 1.5;
    ctx.fillRect(x, y, rw, rh);
    ctx.strokeRect(x, y, rw, rh);
  });

  exportCanvas.toBlob((blob) => {
    if (!blob) return;
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "side-view.png";
    link.click();
    URL.revokeObjectURL(link.href);
  }, "image/png");
});

refreshTopProjectionBtn.addEventListener("click", () => {
  projectionDirty = true;
  drawTopProjection();
});

previewTiltAngleInput.addEventListener("input", () => {
  const value = Number(previewTiltAngleInput.value);
  if (!Number.isFinite(value)) return;
  setPreviewTiltAngle(value);
});

function eventToCanvasCoords(event, canvas) {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}

function canvasToProjectionAxes(projectionKey, x, y, canvas) {
  const state = projectionRenderState[projectionKey];
  if (!state || state.scale <= 0) return null;
  const axisA = state.minA + (x - state.pad) / state.scale;
  const axisB = state.invertB
    ? state.minB + (canvas.height - state.pad - y) / state.scale
    : state.minB + (y - state.pad) / state.scale;
  return { axisA, axisB };
}

function getPlacementById(placementId) {
  return productPlacements.find((placement) => placement.id === placementId) || null;
}

function showPlacementWarning() {
  if (!uiMessage) return;
  const now = performance.now();
  // Prevent warning spam during drag loops from continuously extending visibility.
  if (now - uiMessageLastShownAt < 900 && uiMessage.classList.contains("visible")) {
    return;
  }
  uiMessageLastShownAt = now;
  if (uiMessageText) {
    uiMessageText.textContent =
      "Невозможно разместить товар: объект слишком мал, товар выходит за его габариты.";
  }
  if (uiMessageClearTimer) {
    clearTimeout(uiMessageClearTimer);
    uiMessageClearTimer = null;
  }
  uiMessage.classList.add("visible");
  if (uiMessageTimer) clearTimeout(uiMessageTimer);
  uiMessageTimer = setTimeout(() => {
    uiMessage.classList.remove("visible");
    uiMessageClearTimer = setTimeout(() => {
      if (uiMessageText) uiMessageText.textContent = "";
      uiMessageClearTimer = null;
    }, 520);
    uiMessageTimer = null;
  }, 2200);
}

function hideUiMessage() {
  if (!uiMessage) return;
  if (uiMessageTimer) {
    clearTimeout(uiMessageTimer);
    uiMessageTimer = null;
  }
  if (uiMessageClearTimer) {
    clearTimeout(uiMessageClearTimer);
    uiMessageClearTimer = null;
  }
  uiMessage.classList.remove("visible");
  uiMessageClearTimer = setTimeout(() => {
    if (uiMessageText) uiMessageText.textContent = "";
    uiMessageClearTimer = null;
  }, 520);
}

if (uiMessageClose) {
  uiMessageClose.addEventListener("click", hideUiMessage);
}

function getObjectByUuid(uuid) {
  return objects.find((obj) => obj.uuid === uuid) || null;
}

function getPlacementProjectionBounds(placement, projectionKey) {
  const product = products.get(placement.productId);
  const host = getObjectByUuid(placement.objectUuid);
  if (!product || !host) return null;

  host.updateMatrixWorld(true);
  const world = new THREE.Vector3(
    placement.localPosition.x,
    placement.localPosition.y,
    placement.localPosition.z
  );
  host.localToWorld(world);

  if (projectionKey === "top") {
    const sizeA = product.size.x;
    const sizeB = product.size.z;
    const minA = world.x - sizeA * 0.5;
    const maxA = world.x + sizeA * 0.5;
    let minB;
    let maxB;
    if (placement.surface === "front") {
      minB = world.z - sizeB;
      maxB = world.z;
    } else {
      minB = world.z - sizeB * 0.5;
      maxB = world.z + sizeB * 0.5;
    }
    return {
      minA,
      maxA,
      centerA: (minA + maxA) * 0.5,
      minB,
      maxB,
      centerB: (minB + maxB) * 0.5,
    };
  }

  // front
  const sizeA = product.size.x;
  const sizeB = product.size.y;
  const minA = world.x - sizeA * 0.5;
  const maxA = world.x + sizeA * 0.5;
  const minB = world.y - sizeB;
  const maxB = world.y;
  return {
    minA,
    maxA,
    centerA: (minA + maxA) * 0.5,
    minB,
    maxB,
    centerB: (minB + maxB) * 0.5,
  };
}

function axisToCanvasCoord(projectionKey, axisKind, value, canvas) {
  const state = projectionRenderState[projectionKey];
  if (!state || state.scale <= 0) return null;
  if (axisKind === "A") {
    return state.pad + (value - state.minA) * state.scale;
  }
  const yRaw = state.pad + (value - state.minB) * state.scale;
  return state.invertB ? canvas.height - yRaw : yRaw;
}

function applyAlignmentSnapping({
  projectionKey,
  placement,
  hostObj,
  product,
  desiredA,
  desiredB,
  canvas,
}) {
  const state = projectionRenderState[projectionKey];
  if (!state || state.scale <= 0) {
    return { snappedA: desiredA, snappedB: desiredB, guides: [] };
  }

  const tolPx = 8;
  const tolWorld = tolPx / state.scale;
  const movableB = projectionKey === "top";
  const bounds = {
    minA: desiredA - product.size.x * 0.5,
    maxA: desiredA + product.size.x * 0.5,
    centerA: desiredA,
    minB: 0,
    maxB: 0,
    centerB: 0,
  };
  if (projectionKey === "top") {
    const sizeB = product.size.z;
    if (placement.surface === "front") {
      bounds.minB = desiredB - sizeB;
      bounds.maxB = desiredB;
      bounds.centerB = desiredB - sizeB * 0.5;
    } else {
      bounds.minB = desiredB - sizeB * 0.5;
      bounds.maxB = desiredB + sizeB * 0.5;
      bounds.centerB = desiredB;
    }
  } else {
    const sizeB = product.size.y;
    bounds.minB = desiredB - sizeB;
    bounds.maxB = desiredB;
    bounds.centerB = desiredB - sizeB * 0.5;
  }

  const others = productPlacements
    .filter((p) => p.id !== placement.id && p.objectUuid === placement.objectUuid)
    .map((p) => getPlacementProjectionBounds(p, projectionKey))
    .filter(Boolean);

  let bestADelta = null;
  let bestBDelta = null;
  let bestAMatch = null;
  let bestBMatch = null;
  const guides = [];
  const axes = ["minA", "centerA", "maxA"];
  const axesB = ["minB", "centerB", "maxB"];
  const sameTypeMatch = (selfKey, otherKey) => {
    const selfIsCenter = selfKey.startsWith("center");
    const otherIsCenter = otherKey.startsWith("center");
    return selfIsCenter === otherIsCenter;
  };
  const rangesIntersect = (min1, max1, min2, max2) => Math.max(min1, min2) <= Math.min(max1, max2);
  const rangesIntersectWithTolerance = (min1, max1, min2, max2, tol) =>
    Math.max(min1 - tol, min2 - tol) <= Math.min(max1 + tol, max2 + tol);
  const findSpacingCandidate = (axis) => {
    const centerKey = axis === "A" ? "centerA" : "centerB";
    const orthoMinKey = axis === "A" ? "minB" : "minA";
    const orthoMaxKey = axis === "A" ? "maxB" : "maxA";
    const main = {
      center: bounds[centerKey],
      orthoMin: bounds[orthoMinKey],
      orthoMax: bounds[orthoMaxKey],
    };

    const overlappingWithMain = others.filter((other) =>
      rangesIntersectWithTolerance(main.orthoMin, main.orthoMax, other[orthoMinKey], other[orthoMaxKey], tolWorld)
    );
    if (overlappingWithMain.length < 2) return null;

    let best = null;
    const tryDirection = (direction) => {
      const neighbors = overlappingWithMain
        .filter((other) => (direction > 0 ? other[centerKey] > main.center : other[centerKey] < main.center))
        .sort((a, b) =>
          direction > 0 ? a[centerKey] - b[centerKey] : b[centerKey] - a[centerKey]
        );
      for (const neighbor of neighbors) {
        const helpers = others
          .filter(
            (other) =>
              other !== neighbor &&
              (direction > 0 ? other[centerKey] > neighbor[centerKey] : other[centerKey] < neighbor[centerKey]) &&
              rangesIntersectWithTolerance(
                neighbor[orthoMinKey],
                neighbor[orthoMaxKey],
                other[orthoMinKey],
                other[orthoMaxKey],
                tolWorld
              )
          )
          .sort((a, b) =>
            direction > 0 ? a[centerKey] - b[centerKey] : b[centerKey] - a[centerKey]
          );
        if (!helpers.length) continue;

        const helper = helpers[0];
        const referenceDistance = Math.abs(helper[centerKey] - neighbor[centerKey]);
        const expectedCenter = neighbor[centerKey] - direction * referenceDistance;
        const delta = expectedCenter - main.center;
        if (Math.abs(delta) > tolWorld) continue;

        const candidate = {
          axis,
          direction,
          neighbor,
          helper,
          delta,
        };
        if (!best || Math.abs(delta) < Math.abs(best.delta)) best = candidate;
      }
    };

    tryDirection(1);
    tryDirection(-1);
    return best;
  };
  const isBetterMatch = (delta, nextMatch, currentDelta, currentMatch) => {
    if (currentDelta === null || currentMatch === null) return true;
    const nextAbs = Math.abs(delta);
    const currentAbs = Math.abs(currentDelta);
    if (nextAbs < currentAbs) return true;
    if (nextAbs > currentAbs) return false;
    // Equal delta: prefer center-to-center over edge-to-edge.
    if (nextMatch.mode === "center" && currentMatch.mode !== "center") return true;
    return false;
  };

  others.forEach((other) => {
    axes.forEach((selfKey) => {
      axes.forEach((otherKey) => {
        if (!sameTypeMatch(selfKey, otherKey)) return;
        const delta = other[otherKey] - bounds[selfKey];
        if (Math.abs(delta) <= tolWorld) {
          const candidateMatch = {
            mode: selfKey === "centerA" && otherKey === "centerA" ? "center" : "edge",
            selfKey,
            otherKey,
            otherBounds: other,
          };
          if (isBetterMatch(delta, candidateMatch, bestADelta, bestAMatch)) {
            bestADelta = delta;
            bestAMatch = candidateMatch;
          }
        }
      });
    });

    if (movableB) {
      axesB.forEach((selfKey) => {
        axesB.forEach((otherKey) => {
          if (!sameTypeMatch(selfKey, otherKey)) return;
          const delta = other[otherKey] - bounds[selfKey];
          if (Math.abs(delta) <= tolWorld) {
            const candidateMatch = {
              mode: selfKey === "centerB" && otherKey === "centerB" ? "center" : "edge",
              selfKey,
              otherKey,
              otherBounds: other,
            };
            if (isBetterMatch(delta, candidateMatch, bestBDelta, bestBMatch)) {
              bestBDelta = delta;
              bestBMatch = candidateMatch;
            }
          }
        });
      });
    }
  });

  const spacingGuideA = findSpacingCandidate("A");
  const spacingGuideB = movableB ? findSpacingCandidate("B") : null;
  const spacingMatch = spacingGuideA;
  const spacingMatchB = spacingGuideB;
  if (spacingMatch && (bestADelta === null || Math.abs(spacingMatch.delta) < Math.abs(bestADelta))) {
    bestADelta = spacingMatch.delta;
    bestAMatch = null;
  }
  if (spacingMatchB && (bestBDelta === null || Math.abs(spacingMatchB.delta) < Math.abs(bestBDelta))) {
    bestBDelta = spacingMatchB.delta;
    bestBMatch = null;
  }

  let snappedA = desiredA;
  let snappedB = desiredB;
  const buildHorizontalSpacingGuide = (match, snappedBounds) => {
    const movingMinA = snappedBounds.minA;
    const movingMaxA = snappedBounds.maxA;
    const neighborMinA = match.neighbor.minA;
    const neighborMaxA = match.neighbor.maxA;
    const helperMinA = match.helper.minA;
    const helperMaxA = match.helper.maxA;
    const stationaryCenterB = (match.neighbor.centerB + match.helper.centerB) * 0.5;
    const movingToNeighborCenterB =
      (match.neighbor.centerB + bounds.centerB) * 0.5;
    const movingIntersectsNeighbor = rangesIntersectWithTolerance(
      bounds.minB,
      bounds.maxB,
      match.neighbor.minB,
      match.neighbor.maxB,
      tolWorld
    );
    if (!movingIntersectsNeighbor) return null;
    const segments = [];
    if (match.direction > 0) {
      segments.push({ from: neighborMaxA, to: helperMinA, yValue: stationaryCenterB });
      segments.push({ from: movingMaxA, to: neighborMinA, yValue: movingToNeighborCenterB });
    } else {
      segments.push({ from: helperMaxA, to: neighborMinA, yValue: stationaryCenterB });
      segments.push({ from: neighborMaxA, to: movingMinA, yValue: movingToNeighborCenterB });
    }
    return {
      type: "spacing-arrows",
      segments: segments
        .map((seg) => ({
          x1: axisToCanvasCoord(projectionKey, "A", seg.from, canvas),
          x2: axisToCanvasCoord(projectionKey, "A", seg.to, canvas),
          y: axisToCanvasCoord(projectionKey, "B", seg.yValue, canvas),
        }))
        .filter((seg) => seg.x1 !== null && seg.x2 !== null && seg.y !== null),
    };
  };
  const buildVerticalSpacingGuide = (match, snappedBounds) => {
    const movingMinB = snappedBounds.minB;
    const movingMaxB = snappedBounds.maxB;
    const neighborMinB = match.neighbor.minB;
    const neighborMaxB = match.neighbor.maxB;
    const helperMinB = match.helper.minB;
    const helperMaxB = match.helper.maxB;
    const stationaryCenterA = (match.neighbor.centerA + match.helper.centerA) * 0.5;
    const movingToNeighborCenterA =
      (match.neighbor.centerA + bounds.centerA) * 0.5;
    const movingIntersectsNeighbor = rangesIntersectWithTolerance(
      bounds.minA,
      bounds.maxA,
      match.neighbor.minA,
      match.neighbor.maxA,
      tolWorld
    );
    if (!movingIntersectsNeighbor) return null;
    const segments = [];
    if (match.direction > 0) {
      segments.push({ from: neighborMaxB, to: helperMinB, xValue: stationaryCenterA });
      segments.push({ from: movingMaxB, to: neighborMinB, xValue: movingToNeighborCenterA });
    } else {
      segments.push({ from: helperMaxB, to: neighborMinB, xValue: stationaryCenterA });
      segments.push({ from: neighborMaxB, to: movingMinB, xValue: movingToNeighborCenterA });
    }
    return {
      type: "spacing-arrows-vertical",
      segments: segments
        .map((seg) => ({
          y1: axisToCanvasCoord(projectionKey, "B", seg.from, canvas),
          y2: axisToCanvasCoord(projectionKey, "B", seg.to, canvas),
          x: axisToCanvasCoord(projectionKey, "A", seg.xValue, canvas),
        }))
        .filter((seg) => seg.y1 !== null && seg.y2 !== null && seg.x !== null),
    };
  };
  if (bestADelta !== null) {
    snappedA += bestADelta;
    const snappedBoundsA = {
      minA: bounds.minA + bestADelta,
      maxA: bounds.maxA + bestADelta,
      centerA: bounds.centerA + bestADelta,
    };
    if (spacingMatch) {
      const guide = buildHorizontalSpacingGuide(spacingMatch, snappedBoundsA);
      if (guide) guides.push(guide);
    } else if (bestAMatch) {
      const xFrom = axisToCanvasCoord(
        projectionKey,
        "A",
        snappedBoundsA[bestAMatch.selfKey],
        canvas
      );
      const xTo = axisToCanvasCoord(
        projectionKey,
        "A",
        bestAMatch.otherBounds[bestAMatch.otherKey],
        canvas
      );
      const ySelf = axisToCanvasCoord(projectionKey, "B", bounds.centerB, canvas);
      const yOther = axisToCanvasCoord(projectionKey, "B", bestAMatch.otherBounds.centerB, canvas);
      if (xFrom !== null && xTo !== null && ySelf !== null && yOther !== null) {
        guides.push({ type: "align-link", x1: xFrom, y1: ySelf, x2: xTo, y2: yOther });
      }
    }
  }
  if (movableB && bestBDelta !== null) {
    snappedB += bestBDelta;
    const snappedBoundsB =
      projectionKey === "top"
        ? placement.surface === "front"
          ? { minB: bounds.minB + bestBDelta, maxB: bounds.maxB + bestBDelta, centerB: bounds.centerB + bestBDelta }
          : { minB: bounds.minB + bestBDelta, maxB: bounds.maxB + bestBDelta, centerB: bounds.centerB + bestBDelta }
        : { minB: bounds.minB + bestBDelta, maxB: bounds.maxB + bestBDelta, centerB: bounds.centerB + bestBDelta };
    if (spacingMatchB) {
      const guide = buildVerticalSpacingGuide(spacingMatchB, snappedBoundsB);
      if (guide) guides.push(guide);
    } else if (bestBMatch) {
      const yFrom = axisToCanvasCoord(
        projectionKey,
        "B",
        snappedBoundsB[bestBMatch.selfKey],
        canvas
      );
      const yTo = axisToCanvasCoord(
        projectionKey,
        "B",
        bestBMatch.otherBounds[bestBMatch.otherKey],
        canvas
      );
      const xSelf = axisToCanvasCoord(projectionKey, "A", bounds.centerA, canvas);
      const xOther = axisToCanvasCoord(projectionKey, "A", bestBMatch.otherBounds.centerA, canvas);
      if (xSelf !== null && xOther !== null && yFrom !== null && yTo !== null) {
        guides.push({ type: "align-link", x1: xSelf, y1: yFrom, x2: xOther, y2: yTo });
      }
    }
  }

  // Keep distance guides visible even when another snap mode wins.
  if (spacingGuideA && !guides.some((g) => g.type === "spacing-arrows")) {
    const guide = buildHorizontalSpacingGuide(spacingGuideA, {
      minA: bounds.minA,
      maxA: bounds.maxA,
      centerA: bounds.centerA,
    });
    if (guide) guides.push(guide);
  }
  if (movableB && spacingGuideB && !guides.some((g) => g.type === "spacing-arrows-vertical")) {
    const baseBoundsB = {
      minB: bounds.minB,
      maxB: bounds.maxB,
      centerB: bounds.centerB,
    };
    const guide = buildVerticalSpacingGuide(spacingGuideB, baseBoundsB);
    if (guide) guides.push(guide);
  }

  return { snappedA, snappedB, guides };
}

function getDropTargetArea(projectionKey, x, y) {
  const areas = projectionRenderState[projectionKey].hitAreas;
  for (let i = areas.length - 1; i >= 0; i -= 1) {
    const area = areas[i];
    if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
      return area;
    }
  }
  return null;
}

function getDropTargetAreas(projectionKey, x, y) {
  const areas = projectionRenderState[projectionKey].hitAreas;
  const stack = [];
  for (let i = areas.length - 1; i >= 0; i -= 1) {
    const area = areas[i];
    if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
      stack.push(area);
    }
  }
  if (projectionKey === "front" && stack.length > 1) {
    // For front projection prefer objects closest to viewer (larger max Z).
    stack.sort((a, b) => {
      const boxA = new THREE.Box3().setFromObject(a.obj);
      const boxB = new THREE.Box3().setFromObject(b.obj);
      return boxB.max.z - boxA.max.z;
    });
  }
  return stack;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function resolveTopSurfacePosition(object, product, desiredX, desiredZ, currentX, currentZ) {
  object.updateMatrixWorld(true);
  const hostBox = new THREE.Box3().setFromObject(object);
  const halfSizeX = Math.max(product.size.x * 0.5, 1e-6);
  const halfSizeZ = Math.max(product.size.z * 0.5, 1e-6);
  const eps = 1e-4;

  const minX = hostBox.min.x + halfSizeX;
  const maxX = hostBox.max.x - halfSizeX;
  const minZ = hostBox.min.z + halfSizeZ;
  const maxZ = hostBox.max.z - halfSizeZ;
  const topY = hostBox.max.y;

  // Product does not fit on host top surface at all.
  if (minX > maxX || minZ > maxZ) {
    return { x: null, z: null, topY, hostBox, valid: false };
  }

  let x = clamp(desiredX, minX, maxX);
  let z = clamp(desiredZ, minZ, maxZ);
  const blockedRects = [];

  const productTopY = topY + product.size.y;
  const zDelta = desiredZ - currentZ;
  const obstacleOrder = objects
    .filter((other) => other.uuid !== object.uuid)
    .map((other) => {
      other.updateMatrixWorld(true);
      return new THREE.Box3().setFromObject(other);
    });

  if (Math.abs(zDelta) > 1e-6) {
    // Custom traversal order for Z-axis movement: process blockers in movement direction first.
    obstacleOrder.sort((a, b) =>
      zDelta > 0 ? a.min.z - b.min.z : b.max.z - a.max.z
    );
  }

  obstacleOrder.forEach((otherBox) => {

    const hasVerticalConflict =
      otherBox.max.y > topY + eps && otherBox.min.y < productTopY - eps;
    if (!hasVerticalConflict) return;

    const rectMinX = Math.max(minX, otherBox.min.x - halfSizeX);
    const rectMaxX = Math.min(maxX, otherBox.max.x + halfSizeX);
    const rectMinZ = Math.max(minZ, otherBox.min.z - halfSizeZ);
    const rectMaxZ = Math.min(maxZ, otherBox.max.z + halfSizeZ);
    if (rectMinX >= rectMaxX || rectMinZ >= rectMaxZ) return;
    blockedRects.push({ minX: rectMinX, maxX: rectMaxX, minZ: rectMinZ, maxZ: rectMaxZ });
  });

  const isBlockedPoint = (px, pz) =>
    blockedRects.some(
      (rect) => px >= rect.minX - eps && px <= rect.maxX + eps && pz >= rect.minZ - eps && pz <= rect.maxZ + eps
    );

  for (let iter = 0; iter < 12; iter += 1) {
    let moved = false;
    for (let i = 0; i < blockedRects.length; i += 1) {
      const rect = blockedRects[i];
      if (x <= rect.minX || x >= rect.maxX || z <= rect.minZ || z >= rect.maxZ) continue;

      const dLeft = Math.abs(x - rect.minX);
      const dRight = Math.abs(rect.maxX - x);
      const dDown = Math.abs(z - rect.minZ);
      const dUp = Math.abs(rect.maxZ - z);
      const best = Math.min(dLeft, dRight, dDown, dUp);

      if (best === dLeft) x = rect.minX - eps;
      else if (best === dRight) x = rect.maxX + eps;
      else if (best === dDown) z = rect.minZ - eps;
      else z = rect.maxZ + eps;

      x = clamp(x, minX, maxX);
      z = clamp(z, minZ, maxZ);
      moved = true;
    }
    if (!moved) break;
  }

  // If still blocked by overlapping obstacles, snap to closest guaranteed-safe candidate.
  if (isBlockedPoint(x, z)) {
    const candidates = [
      { x: clamp(desiredX, minX, maxX), z: clamp(desiredZ, minZ, maxZ) },
      // Sliding candidates: move on one axis and keep the other.
      { x: clamp(desiredX, minX, maxX), z: clamp(currentZ, minZ, maxZ) },
      { x: clamp(currentX, minX, maxX), z: clamp(desiredZ, minZ, maxZ) },
      { x: clamp(currentX, minX, maxX), z: clamp(currentZ, minZ, maxZ) },
    ];
    blockedRects.forEach((rect) => {
      candidates.push({ x: clamp(rect.minX - eps, minX, maxX), z: clamp(z, minZ, maxZ) });
      candidates.push({ x: clamp(rect.maxX + eps, minX, maxX), z: clamp(z, minZ, maxZ) });
      candidates.push({ x: clamp(x, minX, maxX), z: clamp(rect.minZ - eps, minZ, maxZ) });
      candidates.push({ x: clamp(x, minX, maxX), z: clamp(rect.maxZ + eps, minZ, maxZ) });
      candidates.push({ x: clamp(rect.minX - eps, minX, maxX), z: clamp(rect.minZ - eps, minZ, maxZ) });
      candidates.push({ x: clamp(rect.minX - eps, minX, maxX), z: clamp(rect.maxZ + eps, minZ, maxZ) });
      candidates.push({ x: clamp(rect.maxX + eps, minX, maxX), z: clamp(rect.minZ - eps, minZ, maxZ) });
      candidates.push({ x: clamp(rect.maxX + eps, minX, maxX), z: clamp(rect.maxZ + eps, minZ, maxZ) });
    });

    let best = null;
    let bestDist = Infinity;
    candidates.forEach((cand) => {
      if (isBlockedPoint(cand.x, cand.z)) return;
      const dx = cand.x - desiredX;
      const dz = cand.z - desiredZ;
      const dist = dx * dx + dz * dz;
      if (dist < bestDist) {
        bestDist = dist;
        best = cand;
      }
    });

    if (best) {
      x = best.x;
      z = best.z;
    }
  }

  if (isBlockedPoint(x, z)) {
    return { x: null, z: null, topY, hostBox, valid: false };
  }
  return { x, z, topY, hostBox, valid: true };
}

function dropToSurfaceWorldPoint(targetArea, projectionKey, canvasX, canvasY) {
  const u = clamp((canvasX - targetArea.x) / Math.max(targetArea.w, 1e-6), 0, 1);
  const v = clamp((canvasY - targetArea.y) / Math.max(targetArea.h, 1e-6), 0, 1);
  const axisAValue = targetArea.minA + (targetArea.maxA - targetArea.minA) * u;
  const axisBValue =
    projectionKey === "front"
      ? targetArea.maxB - (targetArea.maxB - targetArea.minB) * v
      : targetArea.minB + (targetArea.maxB - targetArea.minB) * v;

  targetArea.obj.updateMatrixWorld(true);
  sizeBox.setFromObject(targetArea.obj);
  if (projectionKey === "front") {
    // Side/front drop means product sits on front surface and on top edge (+Y).
    return new THREE.Vector3(axisAValue, sizeBox.max.y, sizeBox.max.z);
  }
  return new THREE.Vector3(axisAValue, sizeBox.max.y, axisBValue);
}

function clearGroup(group) {
  while (group.children.length) {
    const child = group.children.pop();
    if (child.geometry) child.geometry.dispose();
    if (Array.isArray(child.material)) {
      child.material.forEach((mat) => mat.dispose?.());
    } else if (child.material) {
      child.material.dispose?.();
    }
  }
}

function syncPreviewSceneContent() {
  clearGroup(previewObjectsGroup);
  clearGroup(previewProductsGroup);

  objects.forEach((obj) => {
    obj.updateMatrixWorld(true);

    if (obj.isMesh && obj.geometry) {
      const material = Array.isArray(obj.material)
        ? obj.material.map((mat) => mat.clone())
        : obj.material.clone();
      const mesh = new THREE.Mesh(obj.geometry.clone(), material);
      mesh.applyMatrix4(obj.matrixWorld);
      mesh.matrixAutoUpdate = false;
      previewObjectsGroup.add(mesh);
      return;
    }

    const box = new THREE.Box3().setFromObject(obj);
    if (box.isEmpty()) return;
    const boxSize = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(boxSize);
    box.getCenter(center);
    const marker = new THREE.Mesh(
      new THREE.BoxGeometry(Math.max(boxSize.x, 0.04), Math.max(boxSize.y, 0.04), Math.max(boxSize.z, 0.04)),
      new THREE.MeshBasicMaterial({ color: 0x94a3b8, wireframe: true })
    );
    marker.position.copy(center);
    previewObjectsGroup.add(marker);
  });

  productPlacements.forEach((placement) => {
    const product = products.get(placement.productId);
    const host = getObjectByUuid(placement.objectUuid);
    if (!product || !host) return;

    host.updateMatrixWorld(true);
    const world = new THREE.Vector3(
      placement.localPosition.x,
      placement.localPosition.y,
      placement.localPosition.z
    );
    host.localToWorld(world);
    if (placement.surface === "top") world.y += product.size.y * 0.5;
    if (placement.surface === "front") {
      world.y += product.size.y * 0.5;
      world.z += product.size.z * 0.5;
    }

    const productMesh = new THREE.Mesh(
      new THREE.BoxGeometry(product.size.x, product.size.y, product.size.z),
      new THREE.MeshStandardMaterial({
        color: 0x4dabf7,
        transparent: true,
        opacity: 0.55,
        roughness: 0.35,
      })
    );
    productMesh.position.copy(world);
    productMesh.name = getPlacementDisplayName(placement);
    previewProductsGroup.add(productMesh);
  });
}

function resizePreviewRenderer() {
  const w = Math.max(1, preview3dRoot.clientWidth);
  const h = Math.max(1, preview3dRoot.clientHeight);
  previewRenderer.setSize(w, h);
  previewCamera.aspect = w / h;
  previewCamera.updateProjectionMatrix();
}

function attachProjectionDnD(canvas, projectionKey) {
  canvas.addEventListener("dragleave", () => {
    if (projectionHoverTarget[projectionKey] !== null) {
      projectionHoverTarget[projectionKey] = null;
      projectionDirty = true;
    }
  });

  canvas.addEventListener("dragover", (event) => {
    event.preventDefault();
    const point = eventToCanvasCoords(event, canvas);
    const targetArea = getDropTargetArea(projectionKey, point.x, point.y);
    const nextHover = targetArea ? targetArea.obj.uuid : null;
    if (projectionHoverTarget[projectionKey] !== nextHover) {
      projectionHoverTarget[projectionKey] = nextHover;
      projectionDirty = true;
    }
  });

  canvas.addEventListener("drop", (event) => {
    event.preventDefault();
    const productId = event.dataTransfer?.getData("text/product-id");
    if (!productId || !products.has(productId)) return;

    const point = eventToCanvasCoords(event, canvas);
    const targetArea = getDropTargetArea(projectionKey, point.x, point.y);
    if (!targetArea) return;
    const product = products.get(productId);
    const pointerAxes = canvasToProjectionAxes(projectionKey, point.x, point.y, canvas);
    if (!product || !pointerAxes) return;

    const resolved = resolveTopSurfacePosition(
      targetArea.obj,
      product,
      pointerAxes.axisA,
      projectionKey === "top" ? pointerAxes.axisB : targetArea.maxB,
      pointerAxes.axisA,
      projectionKey === "top" ? pointerAxes.axisB : targetArea.maxB
    );
    if (!resolved.valid) {
      showPlacementWarning();
      projectionHoverTarget[projectionKey] = null;
      projectionDirty = true;
      return;
    }

    const worldPoint = new THREE.Vector3();
    if (projectionKey === "front") {
      worldPoint.set(resolved.x, resolved.topY, resolved.hostBox.max.z);
    } else {
      worldPoint.set(resolved.x, resolved.topY, resolved.z);
    }
    const localPoint = targetArea.obj.worldToLocal(worldPoint.clone());
    const newPlacement = {
      id: `${productId}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      productId,
      objectUuid: targetArea.obj.uuid,
      surface: projectionKey === "top" ? "top" : "front",
      localPosition: { x: localPoint.x, y: localPoint.y, z: localPoint.z },
    };
    productPlacements.push(newPlacement);
    setSelectedPlacement(newPlacement.id);
    projectionHoverTarget[projectionKey] = null;
    projectionDirty = true;
  });
}

function getPlacementAreaAtPoint(projectionKey, x, y) {
  const areas = projectionRenderState[projectionKey].placementAreas;
  for (let i = areas.length - 1; i >= 0; i -= 1) {
    const area = areas[i];
    if (x >= area.x && x <= area.x + area.w && y >= area.y && y <= area.y + area.h) {
      return area;
    }
  }
  return null;
}

function clearProjectionTransferState(projectionKey, dragState) {
  projectionHoverTarget.front = null;
  projectionHoverTarget.top = null;
  projectionBlinkTarget.front = null;
  projectionBlinkTarget.top = null;
  if (dragState?.hoverTimer) clearTimeout(dragState.hoverTimer);
  if (dragState?.blinkTimer) clearTimeout(dragState.blinkTimer);
  if (dragState?.switchTimer) clearTimeout(dragState.switchTimer);
  if (dragState) {
    dragState.hoverTimer = null;
    dragState.blinkTimer = null;
    dragState.switchTimer = null;
    dragState.pendingTargetUuid = null;
    dragState.pendingTargetPoint = null;
  }
  projectionDirty = true;
  previewDirty = true;
}

function setSynchronizedProjectionTarget(uuid, withBlink = false) {
  projectionHoverTarget.front = uuid;
  projectionHoverTarget.top = uuid;
  if (withBlink && uuid) {
    const blinkState = { uuid, startedAt: performance.now() };
    projectionBlinkTarget.front = blinkState;
    projectionBlinkTarget.top = blinkState;
  } else if (!withBlink) {
    projectionBlinkTarget.front = null;
    projectionBlinkTarget.top = null;
  }
  projectionDirty = true;
}

function scheduleTransferCandidate(dragState, projectionKey, targetUuid, point, immediateBlink = false) {
  clearProjectionTransferState(projectionKey, dragState);
  dragState.pendingTargetUuid = targetUuid;
  dragState.pendingTargetPoint = point;

  const startBlinkNow = () => {
    if (!activePlacementDrag || activePlacementDrag.pendingTargetUuid !== targetUuid) return;
    setSynchronizedProjectionTarget(targetUuid, true);

    dragState.switchTimer = setTimeout(() => {
      if (!activePlacementDrag || activePlacementDrag.pendingTargetUuid !== targetUuid) return;
      const p = dragState.pendingTargetPoint;
      if (!p) return;
      const stackedAreas = getDropTargetAreas(projectionKey, p.x, p.y);
      const currentIndex = stackedAreas.findIndex((a) => a.obj.uuid === targetUuid);
      if (stackedAreas.length > 1 && currentIndex >= 0) {
        const nextArea = stackedAreas[(currentIndex + 1) % stackedAreas.length];
        if (nextArea.obj.uuid !== targetUuid) {
          scheduleTransferCandidate(dragState, projectionKey, nextArea.obj.uuid, p, true);
        }
      }
    }, 2000);
  };

  if (immediateBlink) {
    startBlinkNow();
    return;
  }

  dragState.hoverTimer = setTimeout(() => {
    if (!activePlacementDrag || activePlacementDrag.pendingTargetUuid !== targetUuid) return;
    setSynchronizedProjectionTarget(targetUuid, false);
  }, 500);

  dragState.blinkTimer = setTimeout(startBlinkNow, 500);
}

function attemptTransferPlacement(dragState, projectionKey) {
  if (!dragState?.pendingTargetUuid || !dragState.pendingTargetPoint) return;
  const stackedAreas = getDropTargetAreas(
    projectionKey,
    dragState.pendingTargetPoint.x,
    dragState.pendingTargetPoint.y
  );
  const targetArea = stackedAreas.find((area) => area.obj.uuid === dragState.pendingTargetUuid);
  if (!targetArea) return;

  const placement = getPlacementById(dragState.placementId);
  if (!placement) return;
  const product = products.get(placement.productId);
  if (!product) return;
  const pointerAxes = canvasToProjectionAxes(
    projectionKey,
    dragState.pendingTargetPoint.x,
    dragState.pendingTargetPoint.y,
    dragState.canvas
  );
  if (!pointerAxes) return;

  const resolved = resolveTopSurfacePosition(
    targetArea.obj,
    product,
    pointerAxes.axisA - dragState.grabOffsetA,
    projectionKey === "top" ? pointerAxes.axisB - dragState.grabOffsetB : targetArea.maxB,
    pointerAxes.axisA - dragState.grabOffsetA,
    projectionKey === "top" ? pointerAxes.axisB - dragState.grabOffsetB : targetArea.maxB
  );
  if (!resolved.valid) {
    showPlacementWarning();
    return;
  }

  const world = new THREE.Vector3();
  if (projectionKey === "front") {
    world.set(resolved.x, resolved.topY, resolved.hostBox.max.z);
    placement.surface = "front";
  } else {
    world.set(resolved.x, resolved.topY, resolved.z);
    placement.surface = "top";
  }
  const local = targetArea.obj.worldToLocal(world.clone());
  placement.objectUuid = targetArea.obj.uuid;
  placement.localPosition = { x: local.x, y: local.y, z: local.z };
  projectionDirty = true;
}

function attachPlacementMove(canvas, projectionKey) {
  canvas.addEventListener("pointerdown", (event) => {
    const point = eventToCanvasCoords(event, canvas);
    const hit = getPlacementAreaAtPoint(projectionKey, point.x, point.y);
    if (!hit) return;
    const swapSourcePlacementId = placementSwapState?.sourcePlacementId || null;
    if (swapSourcePlacementId) {
      if (swapSourcePlacementId !== hit.placementId) {
        swapSelectedPlacementWith(hit.placementId);
      } else {
        selectedPlacementId = hit.placementId;
        refreshPlacementSwapBlink();
        projectionDirty = true;
      }
      event.preventDefault();
      return;
    }
    setSelectedPlacement(hit.placementId);

    const pointerAxes = canvasToProjectionAxes(projectionKey, point.x, point.y, canvas);
    if (!pointerAxes) return;
    activePlacementDrag = {
      projectionKey,
      canvas,
      placementId: hit.placementId,
      grabOffsetA: pointerAxes.axisA - hit.projectedA,
      grabOffsetB: pointerAxes.axisB - hit.projectedB,
      hoverTimer: null,
      blinkTimer: null,
      pendingTargetUuid: null,
      pendingTargetPoint: null,
      transferThresholdPx: 1,
      switchTimer: null,
    };
    clearProjectionTransferState(projectionKey, activePlacementDrag);
    canvas.setPointerCapture(event.pointerId);
    event.preventDefault();
  });

  canvas.addEventListener("pointermove", (event) => {
    if (!activePlacementDrag || activePlacementDrag.projectionKey !== projectionKey) return;

    const point = eventToCanvasCoords(event, canvas);
    const pointerAxes = canvasToProjectionAxes(projectionKey, point.x, point.y, canvas);
    if (!pointerAxes) return;

    const placement = getPlacementById(activePlacementDrag.placementId);
    if (!placement) return;
    const obj = getObjectByUuid(placement.objectUuid);
    if (!obj) return;
    const product = products.get(placement.productId);
    if (!product) return;

    const world = new THREE.Vector3(
      placement.localPosition.x,
      placement.localPosition.y,
      placement.localPosition.z
    );
    obj.localToWorld(world);

    let desiredA = pointerAxes.axisA - activePlacementDrag.grabOffsetA;
    let desiredB = projectionKey === "top" ? pointerAxes.axisB - activePlacementDrag.grabOffsetB : world.z;
    const snap = applyAlignmentSnapping({
      projectionKey,
      placement,
      hostObj: obj,
      product,
      desiredA,
      desiredB,
      canvas,
    });
    desiredA = snap.snappedA;
    desiredB = snap.snappedB;
    projectionGuides[projectionKey] = snap.guides;
    projectionGuides[projectionKey === "top" ? "front" : "top"] = [];

    const resolved = resolveTopSurfacePosition(
      obj,
      product,
      desiredA,
      desiredB,
      world.x,
      world.z
    );
    if (!resolved.valid) {
      event.preventDefault();
      return;
    }
    if (projectionKey === "front") {
      world.x = resolved.x;
      world.y = resolved.topY;
      if (placement.surface === "front") {
        world.z = resolved.hostBox.max.z;
      }
    } else {
      world.x = resolved.x;
      world.z = resolved.z;
      world.y = resolved.topY;
    }

    const local = obj.worldToLocal(world.clone());
    placement.localPosition = { x: local.x, y: local.y, z: local.z };

    const stackedAreas = getDropTargetAreas(projectionKey, point.x, point.y);
    let targetArea = stackedAreas[0] || null;
    if (activePlacementDrag.pendingTargetUuid) {
      const pendingArea = stackedAreas.find(
        (area) => area.obj.uuid === activePlacementDrag.pendingTargetUuid
      );
      if (pendingArea) targetArea = pendingArea;
    }
    const hoveredUuid = targetArea?.obj.uuid || null;
    const alternativeArea = stackedAreas.find((area) => area.obj.uuid !== placement.objectUuid) || null;
    const candidateUuid =
      hoveredUuid === placement.objectUuid ? alternativeArea?.obj.uuid || null : hoveredUuid;
    const canTransfer = Boolean(candidateUuid && candidateUuid !== placement.objectUuid);
    if (!canTransfer) {
      clearProjectionTransferState(projectionKey, activePlacementDrag);
    } else if (activePlacementDrag.pendingTargetUuid !== candidateUuid) {
      scheduleTransferCandidate(activePlacementDrag, projectionKey, candidateUuid, point);
    } else {
      const dx = point.x - activePlacementDrag.pendingTargetPoint.x;
      const dy = point.y - activePlacementDrag.pendingTargetPoint.y;
      const movedEnough =
        dx * dx + dy * dy >
        activePlacementDrag.transferThresholdPx * activePlacementDrag.transferThresholdPx;
      if (movedEnough) {
        scheduleTransferCandidate(activePlacementDrag, projectionKey, candidateUuid, point);
      } else {
        activePlacementDrag.pendingTargetPoint = point;
      }
    }

    projectionDirty = true;
    event.preventDefault();
  });

  canvas.addEventListener("pointerup", (event) => {
    if (activePlacementDrag?.projectionKey === projectionKey) {
      projectionGuides.front = [];
      projectionGuides.top = [];
      const pendingUuid = activePlacementDrag.pendingTargetUuid;
      const blinkFront = projectionBlinkTarget.front?.uuid;
      const blinkTop = projectionBlinkTarget.top?.uuid;
      const shouldTransfer = Boolean(
        pendingUuid && (pendingUuid === blinkFront || pendingUuid === blinkTop)
      );
      if (shouldTransfer) {
        attemptTransferPlacement(activePlacementDrag, projectionKey);
      }
      clearProjectionTransferState(projectionKey, activePlacementDrag);
      activePlacementDrag = null;
      canvas.releasePointerCapture(event.pointerId);
      event.preventDefault();
    }
  });

  canvas.addEventListener("pointercancel", (event) => {
    if (activePlacementDrag?.projectionKey === projectionKey) {
      projectionGuides.front = [];
      projectionGuides.top = [];
      clearProjectionTransferState(projectionKey, activePlacementDrag);
      activePlacementDrag = null;
      canvas.releasePointerCapture(event.pointerId);
      event.preventDefault();
    }
  });
}

catalogItems.forEach((item) => {
  item.addEventListener("dragstart", (event) => {
    const productId = item.dataset.productId;
    if (!productId) return;
    event.dataTransfer?.setData("text/product-id", productId);
    event.dataTransfer.effectAllowed = "copy";
  });
  item.addEventListener("dragend", () => {
    projectionHoverTarget.front = null;
    projectionHoverTarget.top = null;
    projectionDirty = true;
  });
});

attachProjectionDnD(frontProjectionCanvas, "front");
attachProjectionDnD(topProjectionCanvas, "top");
attachPlacementMove(frontProjectionCanvas, "front");
attachPlacementMove(topProjectionCanvas, "top");

function animate() {
  requestAnimationFrame(animate);
  orbit.update();
  previewControls.update();
  renderer.render(scene, camera);
  if (hasActiveBlink() || isPlacementSwapBlinkActive()) {
    projectionDirty = true;
  }
  if (projectionDirty) {
    drawFrontProjection();
    drawTopProjection();
    projectionDirty = false;
    previewDirty = true;
  }
  if (previewDirty) {
    syncPreviewSceneContent();
    previewDirty = false;
  }
  previewRenderer.render(previewScene, previewCamera);
}
animate();

window.addEventListener("resize", () => {
  const w = viewport.clientWidth;
  const h = viewport.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
  resizePreviewRenderer();
});

addPrimitive("box");
addPrimitive("sphere");
updateAttributeInputs();
resizePreviewRenderer();
setPreviewTiltAngle(Number(previewTiltAngleInput.value) || 0);
previewDirty = true;
