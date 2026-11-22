export function LogoMark({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--accent)" />
      <path d="M14 40c4-10 12-16 18-16s14 6 18 16" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
      <path d="M20 46h24" stroke="#fff" strokeWidth="5" strokeLinecap="round" />
    </svg>
  )
}
