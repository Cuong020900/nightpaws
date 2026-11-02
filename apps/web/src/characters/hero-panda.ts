import type { CharacterTypeDescriptor, OutfitDescriptor } from "@nightpaws/shared";
import * as THREE from "three";
import { environmentMap, lighter, rimify } from "../engine/shading.ts";
import { captureRest, collectBones, leftSideSign, type CharacterModel } from "./character-model.ts";

const TAU = Math.PI * 2;
const V2 = (x: number, y: number) => new THREE.Vector2(x, y);
const sphere = new THREE.SphereGeometry(1, 32, 22);
const sphereLow = new THREE.SphereGeometry(1, 14, 10);
const upperHemisphere = new THREE.SphereGeometry(1, 24, 12, 0, TAU, 0, Math.PI / 2);
const surfaceZ = (hx: number, hy: number, hz: number, x: number, y: number) =>
  hz * Math.sqrt(Math.max(0, 1 - (x / hx) ** 2 - (y / hy) ** 2));

const materialCache = new Map<string, THREE.Material>();

function cachedMaterial(key: string, create: () => THREE.Material): THREE.Material {
  let material = materialCache.get(key);
  if (!material) {
    material = create();
    materialCache.set(key, material);
  }
  return material;
}

const fur = (hex: string) =>
  cachedMaterial(`fur${hex}`, () =>
    rimify(
      new THREE.MeshPhysicalMaterial({
        color: hex,
        roughness: 0.85,
        sheen: 0.5,
        sheenRoughness: 0.55,
        sheenColor: lighter(hex, 0.15),
        envMap: environmentMap(),
        envMapIntensity: 0.25,
      }),
      0.35,
    ),
  );

const gloss = (hex: string) =>
  cachedMaterial(`gloss${hex}`, () =>
    rimify(
      new THREE.MeshPhysicalMaterial({ color: hex, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1, envMap: environmentMap(), envMapIntensity: 0.8 }),
      0.4,
    ),
  );

const cloth = (hex: string) =>
  cachedMaterial(`cloth${hex}`, () =>
    rimify(
      new THREE.MeshPhysicalMaterial({
        color: hex,
        roughness: 0.6,
        sheen: 0.8,
        sheenRoughness: 0.5,
        sheenColor: lighter(hex, 0.45),
        envMap: environmentMap(),
        envMapIntensity: 0.35,
        side: THREE.DoubleSide,
      }),
      0.6,
    ),
  );

const pupilMaterial = new THREE.MeshBasicMaterial({ color: 0x07040a });
const shineMaterial = new THREE.MeshBasicMaterial({ color: 0xd8d8d8 });

interface TorsoProfile {
  points: THREE.Vector2[];
  radiusAt: (y: number) => number;
}

interface TorsoShape {
  h: number;
  hip: number;
  waist: number;
  chest: number;
  shoulder: number;
  neck: number;
  depth: number;
}

function torsoProfile(shape: TorsoShape): TorsoProfile {
  const H = shape.h;
  const key: [number, number][] = [
    [0.001, 0],
    [shape.hip * 0.72, H * 0.03],
    [shape.hip, H * 0.2],
    [shape.waist, H * 0.46],
    [shape.chest, H * 0.7],
    [shape.shoulder, H * 0.86],
    [shape.neck, H * 0.97],
    [0.001, H],
  ];
  const curve = new THREE.SplineCurve(key.map(([x, y]) => V2(x, y)));
  const points = curve.getPoints(48).map((point) => V2(Math.max(0.001, point.x), point.y));
  const dense = curve.getPoints(220);
  const radiusAt = (y: number) => {
    let best = dense[0]!;
    let bestDistance = Infinity;
    for (const point of dense) {
      const distance = Math.abs(point.y - y);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = point;
      }
    }
    return Math.max(0.02, best.x);
  };
  return { points, radiusAt };
}

function buildTemplate(height: number, outfit: OutfitDescriptor): THREE.Group {
  const W = fur("#dcd6cb");
  const W2 = fur("#e8e3d9");
  const K = fur("#1d1a22");
  const NOSE = gloss("#141118");
  const IRIS = gloss("#34d84e");
  const SCLERA = gloss("#f8f6f2");
  const PAD = fur("#5a4448");
  const MOUTH = gloss("#3a0c16");
  const TONGUE = gloss("#e46a86");
  const CHEEK = fur("#f2c6c0");
  const TOOTH = gloss("#fbf6ec");
  const SHORTS = cloth(outfit.colors.outfit);
  const SASH = cloth(outfit.colors.outfitTrim);
  const WRAP = cloth(outfit.colors.accent);
  const T: TorsoShape = { h: 1.12, hip: 0.7, waist: 0.84, chest: 0.7, shoulder: 0.52, neck: 0.32, depth: 1.0 };
  const L = { a: 0.2, b: 0.17, r: 0.235, foot: 0.15 };
  const A = { u: 0.3, f: 0.27, r: 0.18 };

  const template = new THREE.Group();
  const group = (name: string, parent: THREE.Object3D, position: [number, number, number] = [0, 0, 0]) => {
    const node = new THREE.Group();
    node.name = name;
    node.position.set(...position);
    parent.add(node);
    return node;
  };
  const mesh = (
    parent: THREE.Object3D,
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    position: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
    rotation: [number, number, number] = [0, 0, 0],
  ) => {
    const node = new THREE.Mesh(geometry, material);
    node.position.set(...position);
    node.scale.set(...scale);
    node.rotation.set(...rotation);
    parent.add(node);
    return node;
  };
  const capsule = (radius: number, length: number) => new THREE.CapsuleGeometry(radius, length, 6, 16);

  const legLength = L.a + L.b + L.foot;
  const H = T.h;
  const Root = group("Root", template);
  const Body = group("Body", Root, [0, legLength, 0]);
  const Hips = group("Hips", Body);
  const Abdomen = group("Abdomen", Hips);
  const Torso = group("Torso", Abdomen, [0, 0.12, 0]);
  const profile = torsoProfile(T);
  const rAt = profile.radiusAt;
  const base = -H * 0.12 - 0.12;
  const Y = (y: number) => y + base;
  mesh(Torso, new THREE.LatheGeometry(profile.points, 48), W, [0, base, 0], [1, 1, T.depth]);
  const bellyY = H * 0.42;
  const bellyR = rAt(bellyY);
  mesh(Torso, sphere, W2, [0, Y(bellyY), bellyR * T.depth * 0.42], [bellyR * 0.86, H * 0.36, bellyR * T.depth * 0.68]);
  const shell = (y0: number, y1: number, material: THREE.Material, grow: number) => {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i <= 18; i += 1) {
      const y = y0 + ((y1 - y0) * i) / 18;
      points.push(V2(rAt(y) * (1 + grow) + 0.01, y));
    }
    return mesh(Torso, new THREE.LatheGeometry(points, 48), material, [0, base, 0], [1, 1, T.depth]);
  };
  shell(H * 0.63, H * 0.95, K, 0.012);
  shell(0, H * 0.32, SHORTS, 0.075);
  const sashY = H * 0.32;
  const sashR = rAt(sashY) * 1.09 + 0.012;
  mesh(Torso, new THREE.TorusGeometry(sashR, 0.06, 10, 48), SASH, [0, Y(sashY), 0], [1, T.depth, 1], [Math.PI / 2, 0, 0]);
  const knotX = rAt(sashY) * 0.9;
  const knotZ = rAt(sashY) * T.depth * 0.5;
  mesh(Torso, sphere, SASH, [knotX, Y(sashY), knotZ], [0.09, 0.08, 0.07]);
  mesh(Torso, capsule(0.045, 0.2), SASH, [knotX + 0.03, Y(sashY) - 0.17, knotZ + 0.03], [1, 1, 0.45], [0.1, 0, 0.25]);
  mesh(Torso, capsule(0.045, 0.16), SASH, [knotX + 0.1, Y(sashY) - 0.13, knotZ], [1, 1, 0.45], [0.05, 0, 0.6]);
  mesh(Torso, sphere, W, [0, Y(H * 0.16), -rAt(H * 0.16) * T.depth * 0.95], [0.12, 0.12, 0.1]);

  const Neck = group("Neck", Torso, [0, Y(H * 0.95), 0]);
  const Head = group("Head", Neck);
  const headR = 0.5;
  const hx = headR * 1.07;
  const hy = headR * 0.9;
  const hz = headR * 0.92;
  const head = group("HeadShape", Head, [0, hy * 0.8, 0]);
  mesh(head, sphere, W, [0, 0, 0], [hx, hy, hz]);
  for (const sx of [-1, 1]) mesh(head, sphere, W, [sx * hx * 0.6, -hy * 0.3, hz * 0.3], [hx * 0.44, hy * 0.38, hz * 0.52], [0, 0, sx * 0.4]);
  const mw = hx * 0.4;
  const mh = hy * 0.3;
  const md = hz * 0.34;
  const my = -hy * 0.3;
  const mzc = hz * 0.66;
  mesh(head, sphere, W2, [0, my, mzc], [mw, mh, md]);
  mesh(head, sphere, NOSE, [0, my + mh * 0.5, mzc + md * 0.84], [hx * 0.14, hy * 0.095, hz * 0.085]);
  mesh(head, sphere, MOUTH, [0, my - mh * 0.4, mzc + md * 0.55], [mw * 0.92, mh * 0.42, md * 0.5]);
  mesh(head, sphere, TOOTH, [0, my - mh * 0.12, mzc + md * 0.78], [mw * 0.5, mh * 0.12, md * 0.22]);
  mesh(head, sphere, TONGUE, [0, my - mh * 0.62, mzc + md * 0.62], [mw * 0.5, mh * 0.18, md * 0.4]);
  for (const sx of [-1, 1]) mesh(head, capsule(mh * 0.07, mw * 0.32), MOUTH, [sx * mw * 0.86, my - mh * 0.16, mzc + md * 0.42], [1, 1, 1], [0.3, sx * 0.5, sx * 0.85]);
  const er = 0.11;
  for (const sx of [-1, 1]) {
    const ex = sx * hx * 0.36;
    const ey = hy * 0.1;
    const ez = surfaceZ(hx, hy, hz, ex, ey) * 0.9;
    mesh(head, sphere, K, [ex * 1.05, ey - hy * 0.03, ez - er * 0.2], [er * 1.75, er * 2.2, er * 0.75], [0, sx * 0.3, sx * -0.55]);
    mesh(head, sphere, CHEEK, [sx * hx * 0.56, -hy * 0.2, surfaceZ(hx, hy, hz, hx * 0.56, -hy * 0.2) * 0.96], [er * 0.9, er * 0.55, er * 0.28], [0, sx * 0.5, 0]);
    const eye = group("eye", head, [ex, ey, ez]);
    eye.rotation.set(0, sx * 0.28, 0);
    const eyeScale = group("eyeScale", eye);
    eyeScale.scale.set(er, er * 1.1, er * 0.72);
    mesh(eyeScale, sphere, SCLERA);
    mesh(eyeScale, sphere, IRIS, [0, -0.06, 0.72], [0.64, 0.68, 0.3]);
    mesh(eyeScale, sphere, pupilMaterial, [0, -0.06, 0.86], [0.32, 0.38, 0.14]);
    mesh(eyeScale, sphereLow, shineMaterial, [0.24, 0.24, 0.96], [0.15, 0.15, 0.07]);
    mesh(eyeScale, sphereLow, shineMaterial, [-0.18, -0.32, 0.95], [0.07, 0.07, 0.04]);
    const lid = mesh(eyeScale, upperHemisphere, K, [0, 0, 0], [1.09, 1.09, 1.09]);
    lid.name = "eyelid";
    const browY = ey + er * 1.1 * 1.35;
    mesh(head, capsule(er * 0.2, er * 1.1), K, [ex * 0.96, browY, surfaceZ(hx, hy, hz, ex * 0.96, browY) * 0.985], [1, 1, 1], [0, sx * 0.3, Math.PI / 2 + sx * 0.2]);
    const ear = group("ear", head, [sx * hx * 0.64, hy * 0.72, -hz * 0.06]);
    ear.rotation.z = -sx * 0.35;
    mesh(ear, sphere, K, [0, 0, 0], [0.2, 0.2, 0.1]);
  }

  const shoulderY = Y(H * 0.84);
  const shoulderX = rAt(H * 0.84) * 0.9 + A.r * 0.4;
  for (const [side, sx] of [["L", 1], ["R", -1]] as const) {
    const shoulder = group(`Shoulder.${side}`, Torso, [sx * shoulderX, shoulderY, 0]);
    const upperArm = group(`UpperArm.${side}`, shoulder);
    mesh(upperArm, capsule(A.r, A.u), K, [0, -A.u / 2, 0]);
    const lowerArm = group(`LowerArm.${side}`, upperArm, [0, -A.u, 0]);
    mesh(lowerArm, capsule(A.r * 0.92, A.f), K, [0, -A.f / 2, 0]);
    for (const y of [-A.f * 0.6, -A.f * 0.8]) mesh(lowerArm, new THREE.TorusGeometry(A.r, 0.035, 8, 24), WRAP, [0, y, 0], [1, 1, 1], [Math.PI / 2, 0, 0]);
    mesh(lowerArm, sphere, K, [0, -A.f - A.r * 0.55, 0.01], [A.r * 1.3, A.r * 1.4, A.r * 1.15]);
    mesh(lowerArm, sphere, K, [-sx * A.r * 0.75, -A.f - A.r * 0.2, A.r * 0.55], [A.r * 0.45, A.r * 0.62, A.r * 0.45], [0, 0, sx * 0.6]);
    const hipX = sx * T.hip * 0.48;
    const upperLeg = group(`UpperLeg.${side}`, Hips, [hipX, 0, 0]);
    mesh(upperLeg, capsule(L.r, L.a), K, [0, -L.a / 2, 0]);
    mesh(upperLeg, capsule(L.r * 1.32, L.a * 0.45), SHORTS, [0, -L.a * 0.1, 0]);
    const lowerLeg = group(`LowerLeg.${side}`, upperLeg, [0, -L.a, 0]);
    mesh(lowerLeg, capsule(L.r * 0.9, L.b), K, [0, -L.b / 2, 0]);
    const foot = group(`Foot.${side}`, Root, [hipX, L.foot, 0]);
    mesh(foot, sphere, K, [0, -L.foot * 0.5, L.r * 0.45], [L.r * 1.25, L.foot * 0.6, L.r * 1.7]);
    for (const tx of [-1, 0, 1]) mesh(foot, sphereLow, K, [tx * L.r * 0.55, -L.foot * 0.55, L.r * 1.9], [L.r * 0.36, L.foot * 0.32, L.r * 0.36]);
    mesh(foot, sphere, PAD, [0, -L.foot * 0.93, L.r * 0.5], [L.r, L.foot * 0.1, L.r * 1.35]);
  }

  template.updateMatrixWorld(true);
  const bounds = new THREE.Box3().setFromObject(template);
  template.scale.setScalar(height / (bounds.max.y - bounds.min.y));
  return template;
}

const templates = new Map<string, THREE.Group>();

export function buildHeroPanda(descriptor: CharacterTypeDescriptor, outfit: OutfitDescriptor): CharacterModel {
  const key = `${descriptor.id}|${outfit.id}`;
  let template = templates.get(key);
  if (!template) {
    template = buildTemplate(descriptor.height, outfit);
    templates.set(key, template);
  }
  const object = template.clone(true);
  const root = new THREE.Group();
  root.name = `character:${descriptor.id}`;
  root.add(object);
  const bones = collectBones(object, (node) => node instanceof THREE.Group);
  const eyelids: THREE.Object3D[] = [];
  object.traverse((node) => {
    if (node.name === "eyelid") eyelids.push(node);
  });
  return {
    root,
    bones,
    rest: captureRest(bones),
    mixer: null,
    idle: null,
    walk: null,
    size: descriptor.height / 1.6,
    sideL: leftSideSign(root, bones),
    eyelids,
    procedural: true,
  };
}
