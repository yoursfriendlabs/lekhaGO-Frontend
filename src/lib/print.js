function waitForPrintLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 50);
      });
    });
  });
}

export async function printElement(source, { prepareClone } = {}) {
  if (!source) {
    window.print();
    return;
  }

  const clone = source.cloneNode(true);
  clone.classList.add('print-clone');
  clone.style.cssText = [
    'display:block !important',
    'position:static !important',
    'box-sizing:border-box !important',
    'width:100% !important',
    'max-width:none !important',
    'margin:0 !important',
    'opacity:1 !important',
    'visibility:visible !important',
    'background:#fff !important',
    'color:#000 !important',
  ].join(';');

  if (prepareClone) prepareClone(clone);

  document.body.appendChild(clone);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (document.body.contains(clone)) document.body.removeChild(clone);
    window.removeEventListener('afterprint', cleanup);
  };

  window.addEventListener('afterprint', cleanup);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined);
    }
    await waitForPrintLayout();
    window.print();
    window.setTimeout(cleanup, 60000);
  } catch {
    cleanup();
    window.print();
  }
}
