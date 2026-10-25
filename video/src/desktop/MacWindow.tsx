// A macOS window: rounded corners, a hairline edge, the shadow of the window
// in front or behind, and the three traffic lights.
import type { CSSProperties, ReactNode } from 'react'

export function TrafficLights({ active, style }: { active: boolean; style?: CSSProperties }) {
  const colors = active ? ['#ff5f57', '#febc2e', '#28c840'] : ['#d4d1cc', '#d4d1cc', '#d4d1cc']
  const edges = active ? ['#e2463f', '#e1a116', '#14ae2c'] : ['#c4c1bb', '#c4c1bb', '#c4c1bb']
  return (
    <div style={{ display: 'flex', gap: 8, ...style }}>
      {colors.map((c, i) => (
        <span key={i} style={{ width: 12, height: 12, borderRadius: 6, background: c, boxShadow: `inset 0 0 0 0.5px ${edges[i]}` }} />
      ))}
    </div>
  )
}

export interface MacWindowProps {
  frame: { x: number; y: number; w: number; h: number }
  active: boolean
  radius?: number
  children: ReactNode
  style?: CSSProperties
}

export function MacWindow({ frame, active, radius = 16, children, style }: MacWindowProps) {
  return (
    <div
      style={{
        position: 'absolute',
        left: frame.x,
        top: frame.y,
        width: frame.w,
        height: frame.h,
        borderRadius: radius,
        overflow: 'hidden',
        boxShadow: active
          ? '0 0 0 0.5px rgba(0,0,0,0.22), 0 28px 70px rgba(30,24,20,0.34), 0 8px 22px rgba(30,24,20,0.18)'
          : '0 0 0 0.5px rgba(0,0,0,0.16), 0 16px 40px rgba(30,24,20,0.2), 0 4px 12px rgba(30,24,20,0.1)',
        ...style,
      }}
    >
      {children}
    </div>
  )
}
