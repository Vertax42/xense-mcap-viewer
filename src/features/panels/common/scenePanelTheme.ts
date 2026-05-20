import type * as THREE from 'three';

export type ScenePanelThemeColors = {
  panelBackgroundClassName: string;
  overlayClassName: string;
  sceneBackground: THREE.ColorRepresentation;
  gridPrimary: string;
  gridSecondary: string;
  gizmoLabelColor: string;
  pointCloudColor: string;
  placeholderColor: string;
  ambientLightIntensity: number;
  hemisphereLightIntensity: number;
  keyLightIntensity: number;
  fillLightIntensity: number;
  rimLightIntensity: number;
  fallbackMeshColor: string;
  meshOutlineColor: string;
};

export function getScenePanelThemeColors(resolvedTheme: 'light' | 'dark'): ScenePanelThemeColors {
  if (resolvedTheme === 'light') {
    return {
      panelBackgroundClassName: 'bg-slate-50',
      overlayClassName: 'bg-white/80 text-slate-800 border border-slate-200',
      sceneBackground: '#f8fafc',
      gridPrimary: '#cbd5e1',
      gridSecondary: '#e2e8f0',
      gizmoLabelColor: '#0f172a',
      pointCloudColor: '#0f766e',
      placeholderColor: '#f59e0b',
      ambientLightIntensity: 0.45,
      hemisphereLightIntensity: 0.55,
      keyLightIntensity: 1.2,
      fillLightIntensity: 0.6,
      rimLightIntensity: 0.85,
      fallbackMeshColor: '#cbd5e1',
      meshOutlineColor: '#1e293b',
    };
  }

  return {
    panelBackgroundClassName: 'bg-[#111]',
    overlayClassName: 'bg-black/50 text-white border border-white/10',
    sceneBackground: '#111111',
    gridPrimary: '#666',
    gridSecondary: '#444',
    gizmoLabelColor: 'white',
    pointCloudColor: '#00ff00',
    placeholderColor: 'orange',
    ambientLightIntensity: 0.35,
    hemisphereLightIntensity: 0.45,
    keyLightIntensity: 1.05,
    fillLightIntensity: 0.5,
    rimLightIntensity: 0.75,
    fallbackMeshColor: '#cbd5e1',
    meshOutlineColor: '#94a3b8',
  };
}
