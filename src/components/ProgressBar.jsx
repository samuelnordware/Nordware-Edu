export default function ProgressBar({ value = 0, label }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuenow={v}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label || 'Progresso'}
    >
      <span style={{ width: `${v}%` }} />
    </div>
  )
}
