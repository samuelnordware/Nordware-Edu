// Notificacoes simples via evento global
export function toast(message, kind = 'ok') {
  window.dispatchEvent(new CustomEvent('nw-toast', { detail: { message, kind } }))
}

export function toastError(err) {
  toast(err?.message || String(err), 'error')
}
