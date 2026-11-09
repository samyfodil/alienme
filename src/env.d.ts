import 'react'

declare global {
  interface Window {
    __specimenReady?: boolean
    __townReady?: boolean
    __step?: (t: number) => void
    __loop?: number
    __layout?: unknown
    __story?: unknown
  }
}

declare module 'react' {
  interface CSSProperties {
    [key: `--${string}`]: string | number | undefined
  }
  interface HTMLAttributes<T> {
    inert?: ''
  }
}
