export default function SetupNeeded() {
  return (
    <div className="setup">
      <img src={import.meta.env.BASE_URL + 'brand/nordware-arrow.png'} alt="" width="48" />
      <h1>Configure o Supabase para iniciar o Nordware Edu</h1>
      <p>
        Crie o arquivo <code>.env</code> na raiz do projeto com <code>VITE_SUPABASE_URL</code> e{' '}
        <code>VITE_SUPABASE_PUBLISHABLE_KEY</code>. No GitHub, cadastre os mesmos nomes em Settings, Secrets and
        variables, Actions. O passo a passo completo está no README.
      </p>
    </div>
  )
}
