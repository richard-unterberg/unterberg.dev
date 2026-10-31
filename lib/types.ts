export type StageConfigMinMax = {
  min: number
  max: number
}

export type StageConfigSingleValue = {
  value: number
} & StageConfigMinMax

export type StageConfigMultiValue = {
  value: [number, number]
} & StageConfigMinMax

export type StageConfig = {
  maxDivider: number
  minDivider: number
  minDividerThreshold: number
  maxDividerThreshold: number
  emitter: {
    cursorRadius: StageConfigSingleValue
    scaleModifier: StageConfigSingleValue
    bufferCount: StageConfigSingleValue
    gravity: StageConfigSingleValue
    pointerInertia: StageConfigSingleValue
    pointerMissRate: StageConfigSingleValue
    scaleHitboxIn: StageConfigMultiValue
    inDuration: StageConfigMultiValue
    skewFrom: StageConfigMultiValue
    skewTo: StageConfigMultiValue
    scaleIn: StageConfigMultiValue
    rotationIn: StageConfigMultiValue
    alphaIn: StageConfigMultiValue
    pixelSpread: StageConfigMultiValue
    outDuration: StageConfigMultiValue
    outDelay: StageConfigMultiValue
    tailOpacity: StageConfigSingleValue
    tailMissRate: StageConfigSingleValue
  }
}
