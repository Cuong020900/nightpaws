import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { ShaderPass } from "three/examples/jsm/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { initEnvironment } from "./shading.ts";

export interface WorldLook {
  fogColor: THREE.Color;
  fogDensity: number;
  bloomStrength: number;
  gradeTint: THREE.Color;
}

const maxPixelRatio = 1.5;

const gradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    sat: { value: 1.12 },
    contrast: { value: 1.08 },
    tint: { value: new THREE.Color(1, 1, 1) },
    vig: { value: 0.55 },
    lift: { value: new THREE.Color(0.012, 0, 0.025) },
  },
  vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
  fragmentShader: `uniform sampler2D tDiffuse; uniform float sat; uniform float contrast; uniform vec3 tint; uniform float vig; uniform vec3 lift; varying vec2 vUv;
void main(){ vec4 c = texture2D(tDiffuse, vUv); vec3 col = c.rgb; float l = dot(col, vec3(0.2126, 0.7152, 0.0722)); col = mix(vec3(l), col, sat); col = (col - 0.5) * contrast + 0.5; col = col * tint + lift; vec2 d = vUv - 0.5; col *= 1.0 - vig * dot(d, d) * 1.5; gl_FragColor = vec4(clamp(col, 0.0, 1.0), c.a); }`,
};

export class WorldRenderer {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(55, 1, 0.1, 160);
  private readonly fog = new THREE.FogExp2("#16052c", 0.017);
  private readonly background = new THREE.Color("#07040d");
  private readonly composer: EffectComposer;
  private readonly bloom: UnrealBloomPass;
  private readonly grade: ShaderPass;

  constructor(readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, maxPixelRatio));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.1;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.shadowMap.enabled = false;
    initEnvironment(this.renderer);

    this.scene.background = this.background;
    this.scene.fog = this.fog;

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.75, 0.45, 0.86);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.grade = new ShaderPass(gradeShader);
    this.composer.addPass(this.grade);

    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  get drawCalls(): number {
    return this.renderer.info.render.calls;
  }

  applyLook(look: WorldLook): void {
    this.fog.color.copy(look.fogColor);
    this.fog.density = look.fogDensity;
    this.background.copy(look.fogColor).multiplyScalar(0.6);
    this.bloom.strength = look.bloomStrength;
    (this.grade.uniforms.tint!.value as THREE.Color).copy(look.gradeTint);
  }

  render(): void {
    this.composer.render();
  }

  private resize(): void {
    const width = window.innerWidth;
    const height = window.innerHeight;
    this.camera.aspect = width / height;
    this.camera.fov = width < height ? 66 : 52;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.composer.setPixelRatio(this.renderer.getPixelRatio());
    this.composer.setSize(width, height);
  }
}
