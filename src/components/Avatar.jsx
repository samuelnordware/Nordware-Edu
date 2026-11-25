// Foto do usuario ou, na falta dela, as iniciais do nome
export default function Avatar({ name = '', url, size = 36 }) {
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0].toUpperCase())
      .join('') || '?'
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {url ? <img src={url} alt="" /> : initials}
    </span>
  )
}
