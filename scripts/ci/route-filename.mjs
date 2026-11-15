export function routeToFilename(route, extension) {
  const name = route === "/" ? "__root__" : route.replace(/^\//, "").replace(/\//g, "--");
  return `${name}.${extension}`;
}
