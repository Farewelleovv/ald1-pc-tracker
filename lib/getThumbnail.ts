export function getThumbnail(path: string) {
  const dot = path.lastIndexOf(".");
  if (dot === -1) return path;
  return path.slice(0, dot) + "_thumb.webp";
}
