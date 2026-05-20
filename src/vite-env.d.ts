/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL for URDF `package://` mesh resolution in the 3D panel */
  readonly VITE_ROSVIEW_URDF_PACKAGE_BASE?: string;
  /** @deprecated Use `VITE_ROSVIEW_URDF_PACKAGE_BASE` */
  readonly VITE_ROS_STUDIO_URDF_PACKAGE_BASE?: string;
  /** Same as LeRobot: base URL for `sample-datasets.manifest.json` */
  readonly VITE_SAMPLES_BASE_URL?: string;
  readonly VITE_SAMPLE_DATASETS_MANIFEST_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module '*?worker' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}

declare module '*?worker&inline' {
  const workerConstructor: {
    new (): Worker;
  };
  export default workerConstructor;
}
