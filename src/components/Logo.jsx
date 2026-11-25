// Logo oficial: texto azul no modo claro, branco no modo escuro
export default function Logo({ size = 'md' }) {
  const base = import.meta.env.BASE_URL + 'brand/'
  return (
    <span className={`logo logo--${size}`}>
      <img className="logo__light" src={base + 'logo-blue-text.png'} alt="Nordware" />
      <img className="logo__dark" src={base + 'logo-full-white.png'} alt="Nordware" />
      <span className="logo__edu">Edu</span>
    </span>
  )
}
