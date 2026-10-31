import type { StageConfig } from '@lib/types'

export const PixiConfig: StageConfig = {
  maxDivider: 80,
  minDivider: 15,
  minDividerThreshold: 500,
  maxDividerThreshold: 1900,
  emitter: {
    cursorRadius: {
      value: 1,
      min: 0,
      max: 1.5,
    },
    scaleModifier: {
      value: 1,
      min: 0.3,
      max: 2,
    },
    gravity: {
      value: 0,
      min: -3,
      max: 3,
    },
    pointerInertia: {
      value: 1.2,
      min: 1,
      max: 3,
    },
    pointerMissRate: {
      value: 0.4, // 0.1 = 10%,
      min: 0,
      max: 1,
    },
    inDuration: {
      min: 0.1,
      max: 0.9,
      value: [0.14, 0.4],
    },
    outDuration: {
      min: 0.6,
      max: 2,
      value: [0.9, 1.5],
    },
    skewFrom: {
      min: -2,
      max: 2,
      value: [-1.1, 1.1],
    },
    skewTo: {
      min: -2,
      max: 2,
      value: [-0.2, 0.2],
    },
    // dev only
    scaleHitboxIn: {
      min: 0.1,
      max: 0.3,
      value: [0.1, 0.3],
    },
    scaleIn: {
      min: 0.1,
      max: 1.9,
      value: [0.5, 1.9],
    },
    rotationIn: {
      min: -3.6,
      max: 3.6,
      value: [-1.6, 1.6], // 1.6 = 160 deg
    },
    alphaIn: {
      min: 0.1,
      max: 1,
      value: [0.1, 1],
    },
    pixelSpread: {
      min: 0,
      max: 150,
      value: [0, 10],
    },
    outDelay: {
      min: 0.04,
      max: 0.15,
      value: [0.04, 0.15],
    },
    bufferCount: {
      min: 10,
      max: 40000,
      value: 4000,
    },
    tailOpacity: {
      min: 0,
      max: 0.4,
      value: 0.05,
    },
    tailMissRate: {
      min: 0.7,
      max: 1,
      value: 0.9,
    },
  },
}
