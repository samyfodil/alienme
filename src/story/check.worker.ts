import './worker-window'
import { checkStory } from './check'

const { errors, warnings } = checkStory()
postMessage({ errors, warnings })
