let trustedTypesWarned = false;

function warnTrustedTypesBlocked(error: unknown) {
  if (trustedTypesWarned) {
    return;
  }
  trustedTypesWarned = true;
  console.warn('[VerseVibe] 当前页面启用了严格 Trusted Types，已跳过页面内 Vue UI 挂载。', error);
}

export function mountVueWithTrustedTypesBypass<T>(mountFn: () => T): T | null {
  const currentWindow = window as Window & { trustedTypes?: unknown };
  const hasTrustedTypes = 'trustedTypes' in currentWindow && currentWindow.trustedTypes;

  if (!hasTrustedTypes) {
    return mountFn();
  }

  const hadOwnProperty = Object.prototype.hasOwnProperty.call(currentWindow, 'trustedTypes');
  const ownDescriptor = hadOwnProperty ? Object.getOwnPropertyDescriptor(currentWindow, 'trustedTypes') : undefined;

  try {
    Object.defineProperty(currentWindow, 'trustedTypes', {
      configurable: true,
      writable: true,
      value: undefined,
    });
  } catch (error) {
    warnTrustedTypesBlocked(error);
    return null;
  }

  try {
    return mountFn();
  } catch (error) {
    warnTrustedTypesBlocked(error);
    return null;
  } finally {
    try {
      if (hadOwnProperty && ownDescriptor) {
        Object.defineProperty(currentWindow, 'trustedTypes', ownDescriptor);
      } else {
        delete currentWindow.trustedTypes;
      }
    } catch {
      // ignore restore failures
    }
  }
}
