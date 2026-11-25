// Recorta a imagem no centro em formato quadrado e reduz para JPEG
export function squareJpeg(file, size = 320) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const side = Math.min(img.width, img.height)
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, size, size)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível ler a imagem.'))), 'image/jpeg', 0.88)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Arquivo de imagem inválido.'))
    }
    img.src = url
  })
}

// Reduz a imagem para no maximo maxWidth de largura.
// WebP preserva a transparencia de PNGs (JPEG deixava o fundo preto).
export function fitImage(file, maxWidth = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const scale = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(img.width * scale)
      canvas.height = Math.round(img.height * scale)
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Não foi possível ler a imagem.'))), 'image/webp', 0.88)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Arquivo de imagem inválido.'))
    }
    img.src = url
  })
}
