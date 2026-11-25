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
