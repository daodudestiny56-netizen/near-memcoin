import type { Mood } from '../chain/types'

const FACE: Record<Mood, { body: [string, string, string]; mouth: string; brow: boolean; lids: number }> = {
  THRIVING: { body: ['#f2ffc4', '#9be564', '#2fb26a'], mouth: 'M92 168 Q120 204 148 168', brow: false, lids: 0 },
  STEADY: { body: ['#e6fbd3', '#8fd9a8', '#2f9d72'], mouth: 'M96 170 Q120 188 144 170', brow: false, lids: 0 },
  HUNGRY: { body: ['#fbf0c7', '#e6c26a', '#c4923a'], mouth: 'M98 176 L142 176', brow: false, lids: 10 },
  STARVING: { body: ['#e8dcd6', '#c2a39a', '#8e6a63'], mouth: 'M96 184 Q120 160 144 184', brow: true, lids: 14 },
}

// The coin's face is the contract's mood. Pulse ratio sets how fast it breathes.
export default function Mascot({ mood, ratio }: { mood: Mood; ratio: number }) {
  const f = FACE[mood]
  const speed = Math.max(0.9, 3.6 - Math.min(ratio, 1.6) * 1.8)
  const id = `body-${mood}`
  return (
    <svg
      className={`mascot mood-${mood.toLowerCase()}`}
      viewBox="0 0 240 240"
      role="img"
      aria-label={`MIRA is ${mood.toLowerCase()}`}
      style={{ ['--beat' as string]: `${speed}s` }}
    >
      <defs>
        <radialGradient id={id} cx="34%" cy="28%" r="85%">
          <stop offset="0" stopColor={f.body[0]} />
          <stop offset="0.55" stopColor={f.body[1]} />
          <stop offset="1" stopColor={f.body[2]} />
        </radialGradient>
      </defs>
      <circle className="mascot-halo" cx="120" cy="120" r="108" />
      <circle className="mascot-halo halo-2" cx="120" cy="120" r="108" />
      <g className="mascot-body">
        <circle cx="120" cy="120" r="94" fill={`url(#${id})`} />
        <circle cx="120" cy="120" r="80" fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.5" />
        <g className="mascot-eyes">
          <ellipse cx="92" cy="118" rx="12" ry="14" fill="#0c1a13" />
          <ellipse cx="148" cy="118" rx="12" ry="14" fill="#0c1a13" />
          <circle cx="96" cy="112" r="4" fill="#fff" />
          <circle cx="152" cy="112" r="4" fill="#fff" />
          {f.lids > 0 && (
            <>
              <rect x="78" y="102" width="28" height={f.lids} rx="3" fill={f.body[1]} />
              <rect x="134" y="102" width="28" height={f.lids} rx="3" fill={f.body[1]} />
            </>
          )}
        </g>
        {f.brow && (
          <>
            <path d="M76 96 L106 104" stroke="#0c1a13" strokeWidth="5" strokeLinecap="round" />
            <path d="M164 96 L134 104" stroke="#0c1a13" strokeWidth="5" strokeLinecap="round" />
          </>
        )}
        <path d={f.mouth} fill="none" stroke="#0c1a13" strokeWidth="6" strokeLinecap="round" />
        {mood === 'THRIVING' && (
          <>
            <circle cx="66" cy="150" r="9" fill="#ff9aa8" opacity=".55" />
            <circle cx="174" cy="150" r="9" fill="#ff9aa8" opacity=".55" />
          </>
        )}
        {mood === 'STARVING' && <path className="sweat" d="M176 84 q8 14 0 22 q-8 -8 0 -22z" fill="#a9d6ff" />}
      </g>
      {mood === 'THRIVING' && (
        <g className="sparks" fill="#d8f06b">
          <path d="M28 54 l4 10 10 4 -10 4 -4 10 -4 -10 -10 -4 10 -4z" />
          <path d="M206 34 l3 8 8 3 -8 3 -3 8 -3 -8 -8 -3 8 -3z" />
          <path d="M214 176 l3 7 7 3 -7 3 -3 7 -3 -7 -7 -3 7 -3z" />
        </g>
      )}
    </svg>
  )
}
