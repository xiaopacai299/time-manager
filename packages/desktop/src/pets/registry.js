import badCatAnimation from '../assets/bad-cat.json'
import runCatAnimation from '../assets/run-cat.json'
import turtleAnimation from '../assets/turtle.json'
import runTurtleAnimation from '../assets/run-turtle.json'
import camaleonAnimation from '../assets/Camaleon.json'
import monitoAnimation from '../assets/monito.json'
import { getBadCatRestAnimationData } from '../utils/badCatRestVariant'
import BlackCoalEffects from './black-coal/BlackCoalEffects'
import LittleTurtleEffects from './little-turtle/LittleTurtleEffects'
import LittleTurtleSplash from './little-turtle/LittleTurtleSplash'
import RunCatTailSparks from '../components/RunCatTailSparks'

const badCatRestAnimation = getBadCatRestAnimationData()

export const PET_REGISTRY = {
  'black-coal': {
    id: 'black-coal',
    name: '黑煤球',
    enabled: true,
    previewAnimation: badCatAnimation,
    effectsComponent: BlackCoalEffects,
    idleByMood: {
      work: badCatAnimation,
      rest: badCatRestAnimation,
      remind: badCatAnimation,
      'long-work': badCatAnimation,
    },
    chaseAnimation: runCatAnimation,
    chaseEffectsComponent: RunCatTailSparks,
    chaseSpeed: 1,
    invertChaseFacing: false,
    idleSegmentsByMood: {
      work: [0, 24],
      rest: [0, 65],
      remind: [0, 24],
      'long-work': [0, 24],
    },
    idleSpeedByMood: {
      work: 1,
      rest: 0.5,
      remind: 1,
      'long-work': 1,
    },
  },
  'little-turtle': {
    id: 'little-turtle',
    name: '小乌龟',
    enabled: true,
    previewAnimation: turtleAnimation,
    effectsComponent: LittleTurtleEffects,
    idleByMood: {
      work: turtleAnimation,
      rest: turtleAnimation,
      remind: turtleAnimation,
      'long-work': turtleAnimation,
    },
    chaseAnimation: runTurtleAnimation,
    chaseEffectsComponent: LittleTurtleSplash,
    chaseSpeed: 2,
    invertChaseFacing: true,
    idleSegmentsByMood: {},
    idleSpeedByMood: {
      work: 0.9,
      rest: 0.7,
      remind: 0.9,
      'long-work': 0.9,
    },
  },
  camaleon: {
    id: 'camaleon',
    name: '变色龙',
    enabled: true,
    previewAnimation: camaleonAnimation,
    effectsComponent: null,
    idleByMood: {
      work: camaleonAnimation,
      rest: camaleonAnimation,
      remind: camaleonAnimation,
      'long-work': camaleonAnimation,
    },
    chaseAnimation: camaleonAnimation,
    chaseEffectsComponent: null,
    chaseSpeed: 1,
    invertChaseFacing: false,
    idleSegmentsByMood: {},
    idleSpeedByMood: {
      work: 1,
      rest: 1,
      remind: 1,
      'long-work': 1,
    },
  },
  monito: {
    id: 'monito',
    name: '猴哥',
    enabled: true,
    previewAnimation: monitoAnimation,
    effectsComponent: null,
    idleByMood: {
      work: monitoAnimation,
      rest: monitoAnimation,
      remind: monitoAnimation,
      'long-work': monitoAnimation,
    },
    chaseAnimation: monitoAnimation,
    chaseEffectsComponent: null,
    chaseSpeed: 1,
    invertChaseFacing: false,
    idleSegmentsByMood: {},
    idleSpeedByMood: {
      work: 1,
      rest: 1,
      remind: 1,
      'long-work': 1,
    },
  },
  'coming-soon-2': {
    id: 'coming-soon-2',
    name: '敬请期待',
    enabled: false,
    previewAnimation: null,
    effectsComponent: null,
    idleByMood: {},
    chaseAnimation: null,
    chaseEffectsComponent: null,
    chaseSpeed: 1,
    invertChaseFacing: false,
    idleSegmentsByMood: {},
    idleSpeedByMood: {},
  },
}

export const PET_LIST = Object.values(PET_REGISTRY)

export function getPetDefinition(selectedPet) {
  return PET_REGISTRY[selectedPet] || PET_REGISTRY['black-coal']
}
