export type ProductCapabilityArea = 'Advanced Plot' | '3D' | 'Image';

export type CapabilityStatus = 'shipped' | 'partial' | 'planned';

export interface CapabilityMatrixEntry {
  area: ProductCapabilityArea;
  foxgloveCapability: string;
  rosViewStatus: CapabilityStatus;
  rosViewSurface: string;
  priority: 'P0' | 'P1' | 'P2';
}

export const productCapabilityMatrix: readonly CapabilityMatrixEntry[] = [
  {
    area: 'Advanced Plot',
    foxgloveCapability: 'Multiple series from message paths, timestamp modes, range loading, and downsampling',
    rosViewStatus: 'partial',
    rosViewSurface: 'Plot panel',
    priority: 'P0',
  },
  {
    area: '3D',
    foxgloveCapability: 'Topic-level visualization settings for point clouds, paths, poses, markers, scans, and depth',
    rosViewStatus: 'partial',
    rosViewSurface: '3D panel',
    priority: 'P1',
  },
  {
    area: 'Image',
    foxgloveCapability: 'Raw/compressed image viewing, depth colormap, fit and transform controls',
    rosViewStatus: 'partial',
    rosViewSurface: 'Image panel',
    priority: 'P1',
  },
];
