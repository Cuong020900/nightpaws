import * as THREE from "three";

export class ViewSample {
  readonly cameraPosition = new THREE.Vector3();
  readonly frustum = new THREE.Frustum();
  frame = 0;
  private readonly projection = new THREE.Matrix4();

  capture(camera: THREE.PerspectiveCamera): void {
    camera.updateMatrixWorld();
    this.cameraPosition.setFromMatrixPosition(camera.matrixWorld);
    this.projection.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.projection);
    this.frame += 1;
  }
}
