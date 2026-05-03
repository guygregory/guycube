
import './style.css'

import $ from 'jquery';
import { Subscription, interval } from 'rxjs';
import { TwistyPlayer } from 'cubing/twisty';
import { experimentalSolve3x3x3IgnoringCenters } from 'cubing/search';

import * as THREE from 'three';

import {
  now,
  connectGanCube,
  GanCubeConnection,
  GanCubeEvent,
  GanCubeMove,
  MacAddressProvider,
  makeTimeFromTimestamp,
  cubeTimestampCalcSkew,
  cubeTimestampLinearFit
} from 'gan-web-bluetooth';

import { faceletsToPattern, patternToFacelets } from './utils';

const SOLVED_STATE = "UUUUUUUUURRRRRRRRRFFFFFFFFFDDDDDDDDDLLLLLLLLLBBBBBBBBB";

var twistyPlayer = new TwistyPlayer({
  puzzle: '3x3x3',
  visualization: '3D',
  alg: '',
  experimentalSetupAnchor: 'start',
  background: 'none',
  controlPanel: 'none',
  hintFacelets: 'none',
  experimentalDragInput: 'none',
  cameraLatitude: 0,
  cameraLongitude: 0,
  cameraLatitudeLimit: 0,
  tempoScale: 5
});
twistyPlayer.experimentalFaceletScale = 0.985;

$('#cube').append(twistyPlayer);

var conn: GanCubeConnection | null;
var lastMoves: GanCubeMove[] = [];
var solutionMoves: GanCubeMove[] = [];

var twistyScene: THREE.Scene;
var twistyVantage: any;
var materialsPatched = false;

const HOME_ORIENTATION = new THREE.Quaternion().setFromEuler(new THREE.Euler(15 * Math.PI / 180, -20 * Math.PI / 180, 0));
var cubeQuaternion: THREE.Quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(30 * Math.PI / 180, -30 * Math.PI / 180, 0));

// ── GAN i4 appearance: rounded stickers, custom colours, gray body ──

// Rounded-rectangle alpha texture for sticker corners
// radii: single number or [top-left, top-right, bottom-right, bottom-left]
function makeRoundedAlpha(radii: number | number[]): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size; canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = 'white';
  ctx.beginPath();
  ctx.roundRect(0, 0, size, size, radii);
  ctx.fill();
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  return tex;
}
const R_SHARP = 14, R_CENTER = 80;
const stickerAlphaMap    = makeRoundedAlpha(R_SHARP);                           // corner cubies — sharper corners
const centerAlphaMap     = makeRoundedAlpha(R_CENTER);                          // center tiles — all corners rounded more
// Edge stickers: the side adjacent to the center gets center-level rounding.
// In cubie-local space, Y-sticker's top faces center; Z-sticker's bottom faces center.
const edgeAlphaTopMap    = makeRoundedAlpha([R_CENTER, R_CENTER, R_SHARP, R_SHARP]); // top corners rounded more
const edgeAlphaBottomMap = makeRoundedAlpha([R_SHARP, R_SHARP, R_CENTER, R_CENTER]); // bottom corners rounded more

// Custom face colours for the GAN i4
const CUSTOM_FACE_COLORS: Record<string, THREE.Color> = {
  U: new THREE.Color(0xeeeeee), D: new THREE.Color(0xfcfb58),
  F: new THREE.Color(0x00cf27), B: new THREE.Color(0x4a6ff6),
  R: new THREE.Color(0xf75e5d), L: new THREE.Color(0xf9932d),
};

const GAN_BODY_COLOR = new THREE.Color(0x8a8a8a);

// Identify which cube face a sticker material belongs to by its default colour.
// Cube3D default colours (after linear→sRGB conversion applied by the library):
//   U=white  R≈1 G≈1 B≈1   |  D=yellow R≈1 G≈1 B≈0
//   R=red    R≈1 G≈0 B≈0   |  L=orange R≈1 G≈.7 B≈0
//   F=green  R≈0 G≈1 B≈0   |  B=blue   R≈.4 G≈.6 B≈1
function matchFace(c: THREE.Color): string | null {
  const { r, g, b } = c;
  if (r > 0.9 && g > 0.9 && b > 0.9) return 'U';
  if (r > 0.9 && g > 0.9 && b < 0.1) return 'D';
  if (r > 0.9 && g < 0.15 && b < 0.15) return 'R';
  if (r < 0.15 && g > 0.9 && b < 0.15) return 'F';
  if (r > 0.9 && g > 0.4 && g < 0.85 && b < 0.1) return 'L';
  if (b > 0.9 && r < 0.5) return 'B';
  return null;
}

function applyGanFinish(obj: THREE.Object3D) {
  const patched = new Set<THREE.MeshBasicMaterial>();
  obj.traverse((child) => {
    if (!('geometry' in child) || !('material' in child)) return;
    const mesh = child as THREE.Mesh;
    const mat = mesh.material as THREE.MeshBasicMaterial;
    if (!mat?.isMaterial || mat.visible === false || !('color' in mat)) return;

    // Foundation (body) pieces — black → gray
    if (mat.color.getHex() === 0x000000) {
      mat.color.copy(GAN_BODY_COLOR);
      return;
    }

    // Shared sticker materials — recolour + add rounded-corner alpha
    if (patched.has(mat)) return;
    const face = matchFace(mat.color);
    if (face && CUSTOM_FACE_COLORS[face]) {
      mat.color.copy(CUSTOM_FACE_COLORS[face]);
      mat.alphaMap = stickerAlphaMap;
      mat.transparent = true;
      mat.alphaTest = 0.5;
      mat.needsUpdate = true;
      patched.add(mat);
    }
  });

  // Center tiles get extra rounding.
  // Scene → Object3D → Groups. Center cubies have 3 children
  // (1 foundation + 1 sticker + 1 hint), edges have 5, corners have 7.
  obj.traverse((group) => {
    if (!group.children || group.children.length !== 3) return;
    // Apply rounder alpha to sticker (pos=0.50) — not the hint (pos=1.45)
    for (const c of group.children) {
      if (!('geometry' in c) || !('material' in c)) continue;
      const mesh = c as THREE.Mesh;
      if (mesh.position.length() < 0.3 || mesh.position.length() > 0.6) continue;
      const oldMat = mesh.material as THREE.MeshBasicMaterial;
      if (!oldMat?.alphaMap || oldMat.alphaMap === centerAlphaMap) continue;
      const centerMat = oldMat.clone();
      centerMat.alphaMap = centerAlphaMap;
      centerMat.needsUpdate = true;
      mesh.material = centerMat;
    }
  });

  // Edge stickers: round the 2 corners on the side adjacent to the center.
  // In cubie-local space every edge has sticker Y at (0,0.50,0) and sticker Z at (0,0,0.50).
  // Y-sticker's center-facing side is its TOP; Z-sticker's center-facing side is its BOTTOM.
  obj.traverse((group) => {
    if (!group.children || group.children.length !== 5) return;
    for (const c of group.children) {
      if (!('geometry' in c) || !('material' in c)) continue;
      const mesh = c as THREE.Mesh;
      const posLen = mesh.position.length();
      if (posLen < 0.3 || posLen > 0.6) continue; // skip foundation & hints
      const oldMat = mesh.material as THREE.MeshBasicMaterial;
      if (!oldMat?.alphaMap) continue;
      const isYSticker = mesh.position.y > 0.3;   // (0, 0.50, 0)
      const edgeMat = oldMat.clone();
      edgeMat.alphaMap = isYSticker ? edgeAlphaTopMap : edgeAlphaBottomMap;
      edgeMat.needsUpdate = true;
      mesh.material = edgeMat;
    }
  });
}

async function amimateCubeOrientation() {
  if (!twistyScene || !twistyVantage) {
    var vantageList = await twistyPlayer.experimentalCurrentVantages();
    twistyVantage = [...vantageList][0];
    twistyScene = await twistyVantage.scene.scene();
  }
  if (!materialsPatched && twistyScene.children.length > 0) {
    applyGanFinish(twistyScene);
    materialsPatched = true;
  }
  twistyScene.quaternion.slerp(cubeQuaternion, 0.25);
  twistyVantage.render();
  requestAnimationFrame(amimateCubeOrientation);
}
requestAnimationFrame(amimateCubeOrientation);

var basis: THREE.Quaternion | null;

async function handleGyroEvent(event: GanCubeEvent) {
  if (event.type == "GYRO") {
    let { x: qx, y: qy, z: qz, w: qw } = event.quaternion;
    let quat = new THREE.Quaternion(qx, qz, -qy, qw).normalize();
    if (!basis) {
      basis = quat.clone().conjugate();
    }
    cubeQuaternion.copy(quat.premultiply(basis).premultiply(HOME_ORIENTATION));
    $('#quaternion').val(`x: ${qx.toFixed(3)}, y: ${qy.toFixed(3)}, z: ${qz.toFixed(3)}, w: ${qw.toFixed(3)}`);
    if (event.velocity) {
      let { x: vx, y: vy, z: vz } = event.velocity;
      $('#velocity').val(`x: ${vx}, y: ${vy}, z: ${vz}`);
    }
  }
}

async function handleMoveEvent(event: GanCubeEvent) {
  if (event.type == "MOVE") {
    if (timerState == "READY") {
      setTimerState("RUNNING");
    }
    twistyPlayer.experimentalAddMove(event.move, { cancel: false });
    lastMoves.push(event);
    if (timerState == "RUNNING") {
      solutionMoves.push(event);
    }
    if (lastMoves.length > 256) {
      lastMoves = lastMoves.slice(-256);
    }
    if (lastMoves.length > 10) {
      var skew = cubeTimestampCalcSkew(lastMoves);
      $('#skew').val(skew + '%');
    }
  }
}

var cubeStateInitialized = false;

async function handleFaceletsEvent(event: GanCubeEvent) {
  if (event.type == "FACELETS" && !cubeStateInitialized) {
    if (event.facelets != SOLVED_STATE) {
      var kpattern = faceletsToPattern(event.facelets);
      var solution = await experimentalSolve3x3x3IgnoringCenters(kpattern);
      var scramble = solution.invert();
      twistyPlayer.alg = scramble;
    } else {
      twistyPlayer.alg = '';
    }
    cubeStateInitialized = true;
    console.log("Initial cube state is applied successfully", event.facelets);
  }
}

function handleCubeEvent(event: GanCubeEvent) {
  if (event.type != "GYRO")
    console.log("GanCubeEvent", event);
  if (event.type == "GYRO") {
    handleGyroEvent(event);
  } else if (event.type == "MOVE") {
    handleMoveEvent(event);
  } else if (event.type == "FACELETS") {
    handleFaceletsEvent(event);
  } else if (event.type == "HARDWARE") {
    $('#hardwareName').val(event.hardwareName || '- n/a -');
    $('#hardwareVersion').val(event.hardwareVersion || '- n/a -');
    $('#softwareVersion').val(event.softwareVersion || '- n/a -');
    $('#productDate').val(event.productDate || '- n/a -');
    $('#gyroSupported').val(event.gyroSupported ? "YES" : "NO");
  } else if (event.type == "BATTERY") {
    $('#batteryLevel').val(event.batteryLevel + '%');
  } else if (event.type == "DISCONNECT") {
    twistyPlayer.alg = '';
    $('.info input').val('- n/a -');
    $('#connect').html('Connect');
  }
}

const customMacAddressProvider: MacAddressProvider = async (device, isFallbackCall): Promise<string | null> => {
  if (isFallbackCall) {
    return prompt('Unable do determine cube MAC address!\nPlease enter MAC address manually:');
  } else {
    return typeof device.watchAdvertisements == 'function' ? null :
      prompt('Seems like your browser does not support Web Bluetooth watchAdvertisements() API. Enable following flag in Chrome:\n\nchrome://flags/#enable-experimental-web-platform-features\n\nor enter cube MAC address manually:');
  }
};

$('#reset-state').on('click', async () => {
  await conn?.sendCubeCommand({ type: "REQUEST_RESET" });
  twistyPlayer.alg = '';
});

$('#reset-gyro').on('click', async () => {
  basis = null;
});

$('#connect').on('click', async () => {
  if (conn) {
    conn.disconnect();
    conn = null;
  } else {
    conn = await connectGanCube(customMacAddressProvider);
    conn.events$.subscribe(handleCubeEvent);
    await conn.sendCubeCommand({ type: "REQUEST_HARDWARE" });
    await conn.sendCubeCommand({ type: "REQUEST_FACELETS" });
    await conn.sendCubeCommand({ type: "REQUEST_BATTERY" });
    $('#deviceName').val(conn.deviceName);
    $('#deviceMAC').val(conn.deviceMAC);
    $('#connect').html('Disconnect');
  }
});

var timerState: "IDLE" | "READY" | "RUNNING" | "STOPPED" = "IDLE";

function setTimerState(state: typeof timerState) {
  timerState = state;
  switch (state) {
    case "IDLE":
      stopLocalTimer();
      $('#timer').hide();
      break;
    case 'READY':
      setTimerValue(0);
      $('#timer').show();
      $('#timer').css('color', '#0f0');
      break;
    case 'RUNNING':
      solutionMoves = [];
      startLocalTimer();
      $('#timer').css('color', '#999');
      break;
    case 'STOPPED':
      stopLocalTimer();
      $('#timer').css('color', '#fff');
      var fittedMoves = cubeTimestampLinearFit(solutionMoves);
      var lastMove = fittedMoves.slice(-1).pop();
      setTimerValue(lastMove ? lastMove.cubeTimestamp! : 0);
      break;
  }
}

twistyPlayer.experimentalModel.currentPattern.addFreshListener(async (kpattern) => {
  var facelets = patternToFacelets(kpattern);
  if (facelets == SOLVED_STATE) {
    if (timerState == "RUNNING") {
      setTimerState("STOPPED");
    }
    twistyPlayer.alg = '';
  }
});

function setTimerValue(timestamp: number) {
  let t = makeTimeFromTimestamp(timestamp);
  $('#timer').html(`${t.minutes}:${t.seconds.toString(10).padStart(2, '0')}.${t.milliseconds.toString(10).padStart(3, '0')}`);
}

var localTimer: Subscription | null = null;
function startLocalTimer() {
  var startTime = now();
  localTimer = interval(30).subscribe(() => {
    setTimerValue(now() - startTime);
  });
}

function stopLocalTimer() {
  localTimer?.unsubscribe();
  localTimer = null;
}

function activateTimer() {
  if (timerState == "IDLE" && conn) {
    setTimerState("READY");
  } else {
    setTimerState("IDLE");
  }
}

$(document).on('keydown', (event) => {
  if (event.which == 32) {
    event.preventDefault();
    activateTimer();
  }
});

$("#cube").on('touchstart', () => {
  activateTimer();
});

// ── Sidebar fly-out toggle ──────────────────
function toggleSidebar(open: boolean) {
  $('#sidebar').toggleClass('open', open);
  $('#sidebar-overlay').toggleClass('open', open);
}

$('#menu-toggle').on('click', () => toggleSidebar(true));
$('#sidebar-close').on('click', () => toggleSidebar(false));
$('#sidebar-overlay').on('click', () => toggleSidebar(false));
