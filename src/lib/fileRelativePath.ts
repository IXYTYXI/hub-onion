const relativePaths = new WeakMap<File, string>()

export function setClawhubRelativePath(file: File, path: string) {
  relativePaths.set(file, path)
  return file
}

export function getClawhubFilePath(file: File) {
  const storedPath = relativePaths.get(file)
  if (storedPath?.trim()) return storedPath

  const webkitPath = file.webkitRelativePath?.trim()
  if (webkitPath) return webkitPath

  return file.name
}
