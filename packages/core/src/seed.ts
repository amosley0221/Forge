import type { Asset } from './types.js';

/**
 * Demo project contents. Replaced by the real project on first sync; kept so a
 * fresh install (and the offline Android build) has something to show.
 */
export function seed(): Asset[] {
  const t = Date.now();
  return [
    {
      id: 'a1',
      name: 'wasteland_rover',
      category: 'Vehicle',
      kind: 'vehicle',
      device: 'desktop',
      updatedAt: t - 3.6e6,
      cur: 2,
      versions: [
        {
          label: 'v1',
          tris: '11,290',
          mats: 2,
          note: 'generated from prompt',
          size: '3.4 m',
          prompt: 'Rusty six-wheeled desert rover, low-poly, hand-painted',
          device: 'desktop',
        },
        {
          label: 'v2',
          tris: '12,132',
          mats: 2,
          note: 'prompt edit',
          size: '3.4 m',
          prompt: 'Add a turret mount on the roof',
          device: 'desktop',
        },
        {
          label: 'v3',
          tris: '12,438',
          mats: 2,
          note: 'edit on selection',
          size: '3.4 m',
          prompt: 'Make the front wheels bigger',
          device: 'android',
        },
      ],
    },
    {
      id: 'a2',
      name: 'knight_paladin',
      category: 'Character',
      kind: 'character',
      device: 'desktop',
      updatedAt: t - 8.6e7,
      cur: 0,
      versions: [
        {
          label: 'v1',
          tris: '24,102',
          mats: 4,
          note: 'generated from prompt',
          size: '1.8 m',
          prompt: 'Armored paladin, chunky proportions, T-pose',
          device: 'desktop',
        },
      ],
    },
    {
      id: 'a3',
      name: 'oil_barrel',
      category: 'Prop',
      kind: 'prop',
      device: 'android',
      updatedAt: t - 1.2e5,
      cur: 0,
      versions: [
        {
          label: 'v1',
          tris: '3,210',
          mats: 1,
          note: 'from photo',
          size: '0.9 m',
          prompt: 'Oil barrel from photo',
          device: 'android',
        },
      ],
    },
    {
      id: 'a4',
      name: 'embertail',
      category: 'Creature',
      kind: 'creature',
      variant: 0,
      device: 'desktop',
      updatedAt: t - 6e5,
      cur: 1,
      anims: [
        { name: 'idle', status: 'approved' },
        { name: 'walk', status: 'approved' },
        { name: 'run', status: 'review' },
      ],
      versions: [
        {
          label: 'v1',
          tris: '6,120',
          mats: 1,
          note: 'from sprite sheet',
          size: '0.7 m',
          prompt: 'embertail_sheet.png · 8 dir × 6 frames',
          device: 'desktop',
        },
        {
          label: 'v2',
          tris: '6,480',
          mats: 1,
          note: 'prompt edit',
          size: '0.7 m',
          prompt: 'Add a flame tip to the tail',
          device: 'desktop',
        },
      ],
    },
  ];
}
