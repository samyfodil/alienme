const g = globalThis as Record<string, unknown>
g.window ??= g
g.$RefreshReg$ ??= () => {}
g.$RefreshSig$ ??= () => (type: unknown) => type
