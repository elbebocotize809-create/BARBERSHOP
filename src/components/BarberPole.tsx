export default function BarberPole({ height = 44 }: { height?: number }) {
  return (
    <svg height={height} viewBox="0 0 40 80" aria-hidden="true">
      <defs>
        <clipPath id="pole-clip">
          <rect x="12" y="14" width="16" height="52" rx="3" />
        </clipPath>
      </defs>
      <rect x="10" y="4" width="20" height="10" rx="5" fill="currentColor" />
      <rect x="10" y="66" width="20" height="10" rx="5" fill="currentColor" />
      <rect x="12" y="14" width="16" height="52" fill="#fff" stroke="currentColor" strokeWidth="2" />
      <g clipPath="url(#pole-clip)">
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} d={`M4 ${4 + i * 9} l32 -16 v6 l-32 16Z`} fill={i % 2 ? '#2f5fd0' : '#d33a3a'} />
        ))}
      </g>
      <rect x="12" y="14" width="16" height="52" fill="none" stroke="currentColor" strokeWidth="2" />
    </svg>
  )
}
