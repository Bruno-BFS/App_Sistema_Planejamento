import type { CompanionType } from '../types/domain'
import { companionNames } from './companionConfig'

interface MoodCompanionProps {
  type: CompanionType
  mood: number
  size?: 'small' | 'large'
  interactive?: boolean
  onInteract?: () => void
}

const colors: Record<CompanionType, { main: string; light: string; accent: string }> = {
  fox: { main: '#cf704b', light: '#f7d5bd', accent: '#78452f' },
  cat: { main: '#8b83aa', light: '#ded9ee', accent: '#504969' },
  robot: { main: '#718b91', light: '#d5e4e3', accent: '#3f5c61' },
  sprout: { main: '#79a05e', light: '#dcebc8', accent: '#41643b' },
}

export function MoodCompanion({ type, mood, size = 'large', interactive = false, onInteract }: MoodCompanionProps) {
  const palette = colors[type]
  const eyeY = mood <= 2 ? 74 : 72
  const mouth = mood === 1 ? 'M 84 99 Q 100 88 116 99' : mood === 2 ? 'M 87 96 Q 100 91 113 96' : mood === 3 ? 'M 89 95 L 111 95' : mood === 4 ? 'M 85 91 Q 100 104 115 91' : 'M 82 88 Q 100 108 118 88'
  const content = <svg aria-hidden="true" className={`companion-svg ${size} mood-${mood}`} viewBox="0 0 200 200">
    <ellipse className="companion-shadow" cx="100" cy="176" rx="55" ry="10" />
    {type === 'sprout' && <g className="companion-leaves"><ellipse cx="80" cy="31" rx="14" ry="25" fill={palette.main} transform="rotate(-38 80 31)" /><ellipse cx="119" cy="29" rx="14" ry="26" fill={palette.light} stroke={palette.accent} strokeWidth="4" transform="rotate(38 119 29)" /><path d="M100 56V25" stroke={palette.accent} strokeWidth="6" strokeLinecap="round" /></g>}
    {type === 'robot' ? <g><rect x="48" y="44" width="104" height="106" rx="28" fill={palette.main} stroke={palette.accent} strokeWidth="5" /><rect x="61" y="58" width="78" height="67" rx="20" fill={palette.light} /><path d="M100 44V27" stroke={palette.accent} strokeWidth="6" /><circle cx="100" cy="23" r="7" fill="#d5a44f" /></g> : <g>
      {(type === 'fox' || type === 'cat') && <g><path d="M55 64 58 18 88 50Z" fill={palette.main} stroke={palette.accent} strokeWidth="5" strokeLinejoin="round" /><path d="M145 64 142 18 112 50Z" fill={palette.main} stroke={palette.accent} strokeWidth="5" strokeLinejoin="round" /><path d="M62 48 64 31 78 48Z" fill={palette.light} /><path d="M138 48 136 31 122 48Z" fill={palette.light} /></g>}
      <path d="M100 42C61 42 43 69 48 111c4 35 23 54 52 54s48-19 52-54c5-42-13-69-52-69Z" fill={palette.main} stroke={palette.accent} strokeWidth="5" />
      <ellipse cx="100" cy="101" rx="42" ry="43" fill={palette.light} opacity=".95" />
    </g>}
    <g className="companion-face">
      {mood === 5 ? <><path d="M70 73q10-10 20 0" fill="none" stroke={palette.accent} strokeWidth="6" strokeLinecap="round" /><path d="M110 73q10-10 20 0" fill="none" stroke={palette.accent} strokeWidth="6" strokeLinecap="round" /></> : <><ellipse cx="80" cy={eyeY} rx="5" ry={mood === 1 ? 6 : 8} fill={palette.accent} /><ellipse cx="120" cy={eyeY} rx="5" ry={mood === 1 ? 6 : 8} fill={palette.accent} /></>}
      {type !== 'robot' && <path d="M95 84 100 89 105 84" fill={palette.accent} stroke={palette.accent} strokeLinejoin="round" />}
      <path d={mouth} fill="none" stroke={palette.accent} strokeWidth="5" strokeLinecap="round" />
      {mood === 1 && <path className="companion-tear" d="M126 79c8 10 7 17 0 17s-8-7 0-17Z" fill="#78b9d1" />}
      {mood >= 4 && <><circle cx="68" cy="91" r="7" fill="#df847e" opacity=".45" /><circle cx="132" cy="91" r="7" fill="#df847e" opacity=".45" /></>}
    </g>
    {type === 'fox' && <path className="companion-tail" d="M145 133c38-5 42 28 13 37-18 6-29-3-31-14 20 6 28-9 18-23Z" fill={palette.main} stroke={palette.accent} strokeWidth="5" />}
    {type === 'cat' && <path className="companion-tail" d="M145 135c40 5 28 48 3 33 22-3 20-20 5-18" fill="none" stroke={palette.accent} strokeWidth="9" strokeLinecap="round" />}
    {type === 'sprout' && <path d="M60 153c15 18 65 20 80 0" fill={palette.light} stroke={palette.accent} strokeWidth="5" />}
  </svg>

  if (!interactive) return content
  return <button className={`companion-interaction ${size}`} type="button" onClick={onInteract} aria-label={`Interagir com ${companionNames[type]}`}>{content}<small>Toque para interagir</small></button>
}
