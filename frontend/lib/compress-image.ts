export interface CompressImageOptions {
  maxWidth?: number
  maxHeight?: number
  maxBytes?: number
  mimeType?: "image/jpeg" | "image/webp"
  initialQuality?: number
  minQuality?: number
}

export interface CompressImageResult {
  file: File
  wasCompressed: boolean
  originalBytes: number
  outputBytes: number
}

const DEFAULT_OPTIONS = {
  maxWidth: 2048,
  maxHeight: 2048,
  maxBytes: 2 * 1024 * 1024,
  mimeType: "image/jpeg" as const,
  initialQuality: 0.86,
  minQuality: 0.55,
}

function loadImageElement(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(image)
    }

    image.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Could not read the selected image."))
    }

    image.src = objectUrl
  })
}

function scaleDimensions(
  width: number,
  height: number,
  maxWidth: number,
  maxHeight: number,
): { width: number; height: number } {
  if (width <= maxWidth && height <= maxHeight) {
    return { width, height }
  }

  const ratio = Math.min(maxWidth / width, maxHeight / height)
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, mimeType: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error("Image compression failed."))
          return
        }
        resolve(blob)
      },
      mimeType,
      quality,
    )
  })
}

function buildCompressedFileName(sourceName: string, mimeType: string) {
  const baseName = sourceName.replace(/\.[^.]+$/, "").trim() || "product-image"
  const extension = mimeType === "image/webp" ? "webp" : "jpg"
  return `${baseName}.${extension}`
}

async function renderCompressedBlob(
  image: HTMLImageElement,
  targetWidth: number,
  targetHeight: number,
  mimeType: string,
  maxBytes: number,
  initialQuality: number,
  minQuality: number,
): Promise<Blob> {
  const canvas = document.createElement("canvas")
  canvas.width = targetWidth
  canvas.height = targetHeight

  const context = canvas.getContext("2d")
  if (!context) {
    throw new Error("Image compression is not supported in this browser.")
  }

  context.drawImage(image, 0, 0, targetWidth, targetHeight)

  let quality = initialQuality
  let blob = await canvasToBlob(canvas, mimeType, quality)

  while (blob.size > maxBytes && quality > minQuality) {
    quality = Math.max(minQuality, Number((quality - 0.08).toFixed(2)))
    blob = await canvasToBlob(canvas, mimeType, quality)
  }

  let currentWidth = targetWidth
  let currentHeight = targetHeight

  while (blob.size > maxBytes && currentWidth > 640 && currentHeight > 640) {
    currentWidth = Math.max(640, Math.round(currentWidth * 0.85))
    currentHeight = Math.max(640, Math.round(currentHeight * 0.85))
    canvas.width = currentWidth
    canvas.height = currentHeight
    context.drawImage(image, 0, 0, currentWidth, currentHeight)
    quality = initialQuality
    blob = await canvasToBlob(canvas, mimeType, quality)

    while (blob.size > maxBytes && quality > minQuality) {
      quality = Math.max(minQuality, Number((quality - 0.08).toFixed(2)))
      blob = await canvasToBlob(canvas, mimeType, quality)
    }
  }

  if (blob.size > maxBytes) {
    throw new Error("Image is still too large after compression. Try a smaller photo.")
  }

  return blob
}

export async function compressImageForUpload(
  file: File,
  options: CompressImageOptions = {},
): Promise<CompressImageResult> {
  if (!file.type.startsWith("image/")) {
    throw new Error("Please select a valid image file.")
  }

  const opts = { ...DEFAULT_OPTIONS, ...options }
  const image = await loadImageElement(file)
  const scaled = scaleDimensions(image.naturalWidth, image.naturalHeight, opts.maxWidth, opts.maxHeight)
  const needsResize =
    scaled.width !== image.naturalWidth ||
    scaled.height !== image.naturalHeight ||
    file.size > opts.maxBytes ||
    !["image/jpeg", "image/jpg", "image/webp"].includes(file.type.toLowerCase())

  if (!needsResize) {
    return {
      file,
      wasCompressed: false,
      originalBytes: file.size,
      outputBytes: file.size,
    }
  }

  const blob = await renderCompressedBlob(
    image,
    scaled.width,
    scaled.height,
    opts.mimeType,
    opts.maxBytes,
    opts.initialQuality,
    opts.minQuality,
  )

  const compressedFile = new File([blob], buildCompressedFileName(file.name, opts.mimeType), {
    type: opts.mimeType,
    lastModified: Date.now(),
  })

  return {
    file: compressedFile,
    wasCompressed: true,
    originalBytes: file.size,
    outputBytes: compressedFile.size,
  }
}
