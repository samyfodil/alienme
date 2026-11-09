import { RoundedBox } from '@react-three/drei'

const GOLD = '#f2b632'

type V3 = [number, number, number]

function B({ args, at, color, rot, rough = 0.55, metal = 0 }: { args: V3; at: V3; color: string; rot?: V3; rough?: number; metal?: number }) {
  return (
    <RoundedBox args={args} radius={Math.min(...args) * 0.35} smoothness={2} position={at} rotation={rot}>
      <meshStandardMaterial color={color} roughness={rough} metalness={metal} />
    </RoundedBox>
  )
}

function Tag({ x = 0.13, y = 0.84, color = '#f4f4f4' }) {
  return <B args={[0.09, 0.045, 0.012]} at={[x, y, 0.39]} color={color} />
}

type Colors = { main?: string; accent?: string }

const DETAILS: Record<string, (c: Colors) => JSX.Element> = {
  'male-officer': ({ accent }) => (
    <group>
      <B args={[0.07, 0.085, 0.02]} at={[-0.13, 0.84, 0.39]} color={GOLD} metal={0.5} rough={0.3} />
      <B args={[0.11, 0.05, 0.02]} at={[-0.075, 0.95, 0.335]} rot={[0, 0, -0.55]} color={accent || '#9ec9ff'} />
      <B args={[0.11, 0.05, 0.02]} at={[0.075, 0.95, 0.335]} rot={[0, 0, 0.55]} color={accent || '#9ec9ff'} />
      <B args={[0.03, 0.03, 0.015]} at={[0, 0.56, 0.308]} color={GOLD} metal={0.5} />
      <B args={[0.03, 0.03, 0.015]} at={[0, 0.65, 0.322]} color={GOLD} metal={0.5} />
    </group>
  ),
  prisoner: () => (
    <group>
      <B args={[0.13, 0.075, 0.012]} at={[-0.12, 0.84, 0.39]} color="#f4f4f4" />
      <B args={[0.09, 0.012, 0.006]} at={[-0.12, 0.846, 0.398]} color="#222" />
      <B args={[0.06, 0.012, 0.006]} at={[-0.135, 0.826, 0.398]} color="#222" />
    </group>
  ),
  'food-worker': () => <Tag />,
  'retail-worker': ({ accent }) => (
    <group>
      <B args={[0.1, 0.42, 0.02]} at={[-0.14, 0.56, 0.31]} rot={[0.12, 0, 0]} color={accent || '#8a8f99'} />
      <B args={[0.1, 0.42, 0.02]} at={[0.14, 0.56, 0.31]} rot={[0.12, 0, 0]} color={accent || '#8a8f99'} />
      <Tag x={0.14} y={0.86} color="#ffd23f" />
    </group>
  ),
  'crypto-bro': () => (
    <mesh position={[0, 0.9, 0.13]} rotation={[1.25, 0, 0]}>
      <torusGeometry args={[0.2, 0.016, 6, 20]} />
      <meshStandardMaterial color={GOLD} metalness={0.7} roughness={0.25} />
    </mesh>
  ),
  'chicken-guy': ({ main }) => (
    <group>
      <B args={[0.06, 0.24, 0.26]} at={[-0.29, 0.66, 0.06]} rot={[0, 0, 0.25]} color={main || '#f7f7f7'} />
      <B args={[0.06, 0.24, 0.26]} at={[0.29, 0.66, 0.06]} rot={[0, 0, -0.25]} color={main || '#f7f7f7'} />
    </group>
  ),
}

export function OutfitDetails({ outfit, main, accent }: Colors & { outfit: string }) {
  const D = DETAILS[outfit]
  return D ? <D main={main} accent={accent} /> : null
}
