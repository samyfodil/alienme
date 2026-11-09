import { build } from './sculpt'

self.onmessage = ({ data: { key, parts } }: MessageEvent) => {
  const arrays = build(parts)
  self.postMessage({ key, arrays }, { transfer: Object.values(arrays).flatMap((a) => (a ? [a.buffer] : [])) })
}
