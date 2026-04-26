export async function resolve(specifier, context, defaultResolve) {
  try {
    return await defaultResolve(specifier, context, defaultResolve)
  } catch (error) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      (error.code === 'ERR_MODULE_NOT_FOUND' || error.code === 'ERR_UNSUPPORTED_DIR_IMPORT') &&
      (specifier.startsWith('./') || specifier.startsWith('../') || specifier.startsWith('/'))
    ) {
      for (const candidate of [`${specifier}.ts`, `${specifier}.js`, `${specifier}/index.ts`, `${specifier}/index.js`]) {
        try {
          return await defaultResolve(candidate, context, defaultResolve)
        } catch {
          // Try the next suffix.
        }
      }
    }

    throw error
  }
}
