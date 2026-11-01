import path from 'node:path';
import ignore from 'ignore';

export const isProtectedName = name => ['.git', 'node_modules'].includes(name.toLowerCase());

// Private documents live in <root>/.docatlas/private. They are a fixed source: include, exclude and ignore
// rules never apply to them. .docatlas itself counts only as the folder on the way there.
export const PRIVATE_FOLDER = '.docatlas/private';
export const isPrivatePath = (relative, directory = false) =>
  relative === PRIVATE_FOLDER || relative.startsWith(PRIVATE_FOLDER + '/') || (directory && relative === '.docatlas');

export function extendIgnoreLayers(layers, directory, rules) {
  return [...layers, { directory, matcher: ignore({ ignorecase: false }).add(rules) }];
}

export function isIgnored(filename, directory, layers) {
  let ignored = false;
  for (const layer of layers) {
    const relative = path.relative(layer.directory, filename).split(path.sep).join('/') + (directory ? '/' : '');
    const result = layer.matcher.test(relative);
    if (result.ignored) ignored = true;
    else if (result.unignored) ignored = false;
  }
  return ignored;
}
