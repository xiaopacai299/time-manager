import badCatAnimation from '../assets/bad-cat.json'
import runCatAnimation from '../assets/run-cat.json'
import turtleAnimation from '../assets/Turtle.json'
import runTurtleAnimation from '../assets/run-turtle.json'
import { getBadCatRestAnimationData } from '../utils/badCatRestVariant'
import BlackCoalEffects from './black-coal/BlackCoalEffects'
import LittleTurtleEffects from './little-turtle/LittleTurtleEffects'

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
    showTailSparks: true,
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
    idleSegmentsByMood: {},
    idleSpeedByMood: {
      work: 0.9,
      rest: 0.7,
      remind: 0.9,
      'long-work': 0.9,
    },
    showTailSparks: false,
  },
  'coming-soon-2': {
    id: 'coming-soon-2',
    name: '敬请期待',
    enabled: false,
    previewAnimation: null,
    effectsComponent: null,
    idleByMood: {},
    chaseAnimation: null,
    idleSegmentsByMood: {},
    idleSpeedByMood: {},
    showTailSparks: false,
  },
}

export const PET_LIST = Object.values(PET_REGISTRY)

export function getPetDefinition(selectedPet) {
  return PET_REGISTRY[selectedPet] || PET_REGISTRY['black-coal']
}
