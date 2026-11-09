import { softArrays } from './soft'

self.onmessage = ({ data: { id, position, bevel } }: MessageEvent) => {
  const arrays = softArrays(position, bevel)
  self.postMessage({ id, arrays }, { transfer: Object.values(arrays).map((a) => a.buffer) })
}
