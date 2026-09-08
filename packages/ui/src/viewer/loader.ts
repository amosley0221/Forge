import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js';
import { KTX2Loader } from 'three/examples/jsm/loaders/KTX2Loader.js';
import { MeshoptDecoder } from 'three/examples/jsm/libs/meshopt_decoder.module.js';

/**
 * A GLTFLoader that can open what the providers actually return.
 *
 * Meshy and Tripo emit Draco-compressed geometry and KTX2 textures on some
 * models. A bare GLTFLoader rejects those with an unhelpful error *after* the
 * provider has already charged for the model, so the decoders are wired up
 * here and shipped inside the app (see scripts/copy-decoders.mjs).
 */

/** Where the decoder files sit relative to the app's base URL. */
const decoderBase = () => {
  if (typeof document === 'undefined') return './';
  // Vite builds with base './', so resolve against the document itself.
  return new URL('./', document.baseURI).href;
};

let draco: DRACOLoader | null = null;
let ktx2: KTX2Loader | null = null;

function dracoLoader(): DRACOLoader {
  if (!draco) {
    draco = new DRACOLoader();
    draco.setDecoderPath(`${decoderBase()}draco/`);
    draco.setDecoderConfig({ type: 'js' });
  }
  return draco;
}

function ktx2Loader(renderer?: THREE.WebGLRenderer): KTX2Loader {
  if (!ktx2) {
    ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(`${decoderBase()}basis/`);
  }
  if (renderer) ktx2.detectSupport(renderer);
  return ktx2;
}

/**
 * @param renderer lets the KTX2 transcoder pick a texture format the GPU
 * supports. Omitted when a model is only being measured, not displayed.
 */
export function createGltfLoader(renderer?: THREE.WebGLRenderer): GLTFLoader {
  const loader = new GLTFLoader();
  loader.setDRACOLoader(dracoLoader());
  loader.setKTX2Loader(ktx2Loader(renderer));
  loader.setMeshoptDecoder(MeshoptDecoder);
  return loader;
}

/** Free the shared decoder workers, e.g. when the last viewer unmounts. */
export function disposeLoaders(): void {
  draco?.dispose();
  draco = null;
  ktx2?.dispose();
  ktx2 = null;
}
