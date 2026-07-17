import { useId, type ReactNode } from 'react'
import type { CompanionType } from '../types/domain'
import { companionNames } from './companionConfig'

interface MoodCompanionProps {
  type: CompanionType
  mood: number
  size?: 'small' | 'large'
  interactive?: boolean
  onInteract?: () => void
}

interface Palette {
  main: string
  light: string
  accent: string
  dark: string
}

const colors: Record<CompanionType, Palette> = {
  fox: { main: '#d97945', light: '#f8ddc1', accent: '#7c452f', dark: '#4f3329' },
  cat: { main: '#9a8db6', light: '#e6dff0', accent: '#574f70', dark: '#39344b' },
  robot: { main: '#75a2a0', light: '#d6ece8', accent: '#3e6667', dark: '#243f43' },
  sprout: { main: '#8fa866', light: '#e4edc9', accent: '#4e6c40', dark: '#354a31' },
  owl: { main: '#9a6945', light: '#ead1a5', accent: '#5f3e2c', dark: '#39281f' },
  capybara: { main: '#b97b4e', light: '#dfb27d', accent: '#70452f', dark: '#493126' },
}

function Face({ type, mood, palette }: { type: CompanionType; mood: number; palette: Palette }) {
  const eyeY = type === 'capybara' ? 75 : 73
  const eyes = mood === 5
    ? <><path d={`M70 ${eyeY + 2}q10-10 20 0`} /><path d={`M110 ${eyeY + 2}q10-10 20 0`} /></>
    : <><ellipse cx="80" cy={eyeY} rx={mood === 1 ? 5.5 : 6} ry={mood === 1 ? 6 : 8} /><ellipse cx="120" cy={eyeY} rx={mood === 1 ? 5.5 : 6} ry={mood === 1 ? 6 : 8} /></>
  const mouthY = type === 'capybara' ? 108 : 99
  const mouth = mood === 1
    ? `M84 ${mouthY} Q100 ${mouthY - 11} 116 ${mouthY}`
    : mood === 2 ? `M87 ${mouthY - 2} Q100 ${mouthY - 7} 113 ${mouthY - 2}`
      : mood === 3 ? `M89 ${mouthY - 3} L111 ${mouthY - 3}`
        : mood === 4 ? `M85 ${mouthY - 7} Q100 ${mouthY + 6} 115 ${mouthY - 7}`
          : `M82 ${mouthY - 10} Q100 ${mouthY + 10} 118 ${mouthY - 10}`

  return <g className="companion-face" fill={palette.dark} stroke={palette.dark} strokeLinecap="round">
    <g className="companion-eyes" fill={palette.dark} stroke="none">{eyes}</g>
    {mood <= 2 && <g className="companion-brows" fill="none" strokeWidth="3"><path d="M69 60q10-5 20 0" /><path d="M111 60q10-5 20 0" /></g>}
    {type === 'capybara' && <ellipse cx="100" cy="93" rx="10" ry="7" fill={palette.dark} stroke="none" />}
    {type !== 'robot' && type !== 'owl' && type !== 'capybara' && <path d="M95 84 100 89 105 84" strokeLinejoin="round" />}
    {type === 'owl' && <path d="M94 88 100 97 106 88Z" fill="#d99a43" stroke={palette.accent} strokeWidth="2" strokeLinejoin="round" />}
    {type !== 'owl' && <path d={mouth} fill="none" strokeWidth="4.5" />}
    {mood === 1 && <path className="companion-tear" d="M128 80c8 10 7 18 0 18s-8-8 0-18Z" fill="#78b9d1" stroke="none" />}
    {mood >= 4 && <g className="companion-blush" fill="#df847e" stroke="none"><circle cx="67" cy="92" r="7" /><circle cx="133" cy="92" r="7" /></g>}
  </g>
}

function AnimalHead({ palette, fill, children }: { palette: Palette; fill: string; children?: ReactNode }) {
  return <g>
    <path d="M100 39C61 39 42 67 47 111c4 36 23 55 53 55s49-19 53-55c5-44-14-72-53-72Z" fill={fill} stroke={palette.accent} strokeWidth="4.5" />
    {children}
  </g>
}

function Character({ type, palette, mainFill, lightFill }: { type: CompanionType; palette: Palette; mainFill: string; lightFill: string }) {
  if (type === 'robot') return <g className="companion-body robot-body">
    <path d="M100 42V25" stroke={palette.accent} strokeWidth="6" strokeLinecap="round" /><circle cx="100" cy="20" r="8" fill="#d6ad57" stroke={palette.accent} strokeWidth="3" />
    <rect x="43" y="43" width="114" height="91" rx="31" fill={mainFill} stroke={palette.accent} strokeWidth="5" />
    <rect x="57" y="57" width="86" height="62" rx="22" fill={palette.dark} stroke={palette.light} strokeWidth="3" />
    <path d="M62 127Q51 143 55 161M138 127q11 16 7 34" fill="none" stroke={palette.accent} strokeWidth="12" strokeLinecap="round" />
    <path d="M71 130v28h-14M129 130v28h14" fill="none" stroke={palette.accent} strokeWidth="13" strokeLinecap="round" strokeLinejoin="round" />
    <circle cx="100" cy="142" r="11" fill={lightFill} stroke={palette.accent} strokeWidth="4" />
  </g>

  if (type === 'sprout') return <g className="companion-body sprout-body">
    <g className="companion-leaves"><ellipse cx="79" cy="28" rx="14" ry="28" fill={mainFill} stroke={palette.accent} strokeWidth="4" transform="rotate(-42 79 28)" /><ellipse cx="121" cy="27" rx="14" ry="29" fill={lightFill} stroke={palette.accent} strokeWidth="4" transform="rotate(42 121 27)" /><path d="M100 53V24" stroke={palette.accent} strokeWidth="6" strokeLinecap="round" /></g>
    <AnimalHead palette={palette} fill={mainFill}><ellipse cx="100" cy="99" rx="43" ry="42" fill={lightFill} opacity=".92" /></AnimalHead>
    <g className="sprout-collar" fill={palette.main} stroke={palette.accent} strokeWidth="3"><path d="M48 126q13 3 19 16 8-12 18-7 8-12 16 0 11-6 18 7 8-13 32-16-8 41-51 42-43-1-52-42Z" /></g>
  </g>

  if (type === 'owl') return <g className="companion-body owl-body">
    <path d="M58 67 49 34 78 50M142 67l9-33-29 16" fill={mainFill} stroke={palette.accent} strokeWidth="4" strokeLinejoin="round" />
    <path d="M100 38c-38 0-58 28-54 75 3 36 20 56 54 56s51-20 54-56c4-47-16-75-54-75Z" fill={mainFill} stroke={palette.accent} strokeWidth="5" />
    <path d="M50 101q-20 23 6 52 14-14 17-40M150 101q20 23-6 52-14-14-17-40" fill={palette.main} stroke={palette.accent} strokeWidth="4" />
    <path d="M71 122q29 28 58 0-3 43-29 43t-29-43Z" fill={lightFill} opacity=".86" />
    <circle cx="80" cy="75" r="22" fill={lightFill} stroke={palette.accent} strokeWidth="3" /><circle cx="120" cy="75" r="22" fill={lightFill} stroke={palette.accent} strokeWidth="3" />
  </g>

  if (type === 'capybara') return <g className="companion-body capybara-body">
    <ellipse cx="100" cy="130" rx="61" ry="42" fill={mainFill} stroke={palette.accent} strokeWidth="5" />
    <circle cx="68" cy="47" r="11" fill={palette.main} stroke={palette.accent} strokeWidth="4" /><circle cx="132" cy="47" r="11" fill={palette.main} stroke={palette.accent} strokeWidth="4" />
    <path d="M100 38c-37 0-55 25-52 65 3 38 21 56 52 56s49-18 52-56c3-40-15-65-52-65Z" fill={mainFill} stroke={palette.accent} strokeWidth="5" />
    <ellipse cx="100" cy="101" rx="33" ry="27" fill={lightFill} opacity=".9" />
    <path d="M62 153v16M138 153v16" stroke={palette.accent} strokeWidth="12" strokeLinecap="round" />
  </g>

  const isFox = type === 'fox'
  return <g className={`companion-body ${type}-body`}>
    <path d="M54 65 57 17 89 51Z" fill={mainFill} stroke={palette.accent} strokeWidth="5" strokeLinejoin="round" /><path d="M146 65 143 17 111 51Z" fill={mainFill} stroke={palette.accent} strokeWidth="5" strokeLinejoin="round" />
    <path d="M62 49 64 31 79 49Z" fill={lightFill} /><path d="M138 49 136 31 121 49Z" fill={lightFill} />
    <AnimalHead palette={palette} fill={mainFill}>
      {isFox ? <><path d="M48 94q17 4 30-2l22 10 22-10q13 6 30 2-5 47-52 67-47-20-52-67Z" fill={lightFill} opacity=".96" /><ellipse cx="100" cy="96" rx="20" ry="15" fill={palette.light} /></> : <ellipse cx="100" cy="104" rx="41" ry="43" fill={lightFill} opacity=".92" />}
    </AnimalHead>
    {isFox ? <path className="companion-tail" d="M145 128c42-6 49 31 17 44-20 8-34-2-35-16 18 6 30-8 18-28Z" fill={mainFill} stroke={palette.accent} strokeWidth="5" /> : <path className="companion-tail" d="M145 136c41 5 30 48 3 34 22-4 20-21 5-19" fill="none" stroke={palette.accent} strokeWidth="10" strokeLinecap="round" />}
  </g>
}

export function MoodCompanion({ type, mood, size = 'large', interactive = false, onInteract }: MoodCompanionProps) {
  const palette = colors[type]
  const uid = useId().replace(/:/g, '')
  const mainGradient = `${uid}-main`
  const lightGradient = `${uid}-light`
  const shadowFilter = `${uid}-shadow`
  const facePalette = type === 'robot' ? { ...palette, dark: '#b9fff0' } : palette
  const content = <svg aria-hidden="true" className={`companion-svg ${size} mood-${mood} type-${type}`} viewBox="0 0 200 200">
    <defs>
      <linearGradient id={mainGradient} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={palette.light} /><stop offset=".36" stopColor={palette.main} /><stop offset="1" stopColor={palette.accent} /></linearGradient>
      <linearGradient id={lightGradient} x1="0" y1="0" x2="0" y2="1"><stop stopColor="#fff" stopOpacity=".82" /><stop offset="1" stopColor={palette.light} /></linearGradient>
      <filter id={shadowFilter} x="-25%" y="-25%" width="150%" height="170%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodColor={palette.dark} floodOpacity=".23" /></filter>
    </defs>
    <ellipse className="companion-shadow" cx="100" cy="177" rx="58" ry="10" />
    <g filter={`url(#${shadowFilter})`}><Character type={type} palette={palette} mainFill={`url(#${mainGradient})`} lightFill={`url(#${lightGradient})`} /><Face type={type} mood={mood} palette={facePalette} /></g>
    <path className="companion-highlight" d="M73 51q18-13 37-7" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" opacity=".22" />
  </svg>

  if (!interactive) return content
  return <button className={`companion-interaction ${size}`} type="button" onClick={onInteract} aria-label={`Interagir com ${companionNames[type]}`}>{content}<small>Toque para interagir</small></button>
}
