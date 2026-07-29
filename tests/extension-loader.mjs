import { extname } from 'node:path';

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (error) {
    const isRelativeImport = specifier.startsWith('./') || specifier.startsWith('../');

    if (error?.code !== 'ERR_MODULE_NOT_FOUND' || !isRelativeImport || extname(specifier)) {
      throw error;
    }

    return nextResolve(`${specifier}.js`, context);
  }
}
