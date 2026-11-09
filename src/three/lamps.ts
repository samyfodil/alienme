import { useEffect, useMemo } from 'react'
import { Color, Vector3 } from 'three'

export type Loan = { pos: Vector3; color: Color; power: number; reach: number }

export const LOANS = new Set<Loan>()

export function useLoan() {
  const loan = useMemo((): Loan => ({ pos: new Vector3(), color: new Color(), power: 0, reach: 5 }), [])
  useEffect(() => {
    LOANS.add(loan)
    return () => {
      LOANS.delete(loan)
    }
  }, [loan])
  return loan
}
