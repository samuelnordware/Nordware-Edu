export default function Logo({ size = 'md' }) {
  return (
    <span className={`logo logo--${size}`}>
      <img src={import.meta.env.BASE_URL + 'brand/nordware-arrow.png'} alt="" />
      <span className="logo__word">
        Nordware <span className="logo__edu">Edu</span>
      </span>
    </span>
  )
}
