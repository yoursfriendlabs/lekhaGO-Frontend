function waitForPrintLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 50);
      });
    });
  });
}

function isMobileDevice() {
  return /Mobi|Android|iPhone|iPad|iPod|Phone/i.test(navigator.userAgent || "");
}

function getPageStylesHtml() {
  return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => node.outerHTML)
    .join("\n");
}

function printViaIframe(source, { prepareClone } = {}) {
  const iframe = document.createElement("iframe");
  iframe.style.position = "fixed";
  iframe.style.top = "0";
  iframe.style.left = "0";
  iframe.style.width = "0";
  iframe.style.height = "0";
  iframe.style.border = "0";
  iframe.style.opacity = "0";
  iframe.style.pointerEvents = "none";
  iframe.setAttribute("aria-hidden", "true");

  document.body.appendChild(iframe);

  const doc = iframe.contentWindow.document;
  doc.open();

  const clone = source.cloneNode(true);
  clone.classList.add("print-clone");
  clone.style.cssText = [
    "display:block !important",
    "position:static !important",
    "box-sizing:border-box !important",
    "width:100% !important",
    "max-width:none !important",
    "margin:0 !important",
    "opacity:1 !important",
    "visibility:visible !important",
    "background:#fff !important",
    "color:#000 !important",
  ].join(";");

  if (prepareClone) prepareClone(clone);

  const clonedHtml = clone.outerHTML;
  const stylesHtml = getPageStylesHtml();

  doc.write(
    `<!doctype html><html><head><meta charset="utf-8">${stylesHtml}</head><body>${clonedHtml}</body></html>`,
  );
  doc.close();

  const cleanup = () => {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  };

  const printWindow = iframe.contentWindow;
  if (printWindow) {
    printWindow.focus();
    printWindow.print();
    setTimeout(cleanup, 60000);
  } else {
    cleanup();
  }
}

export async function printElement(source, { prepareClone } = {}) {
  if (!source) {
    window.print();
    return;
  }

  if (isMobileDevice()) {
    printViaIframe(source, { prepareClone });
    return;
  }

  const clone = source.cloneNode(true);
  clone.classList.add("print-clone");
  clone.style.cssText = [
    "display:block !important",
    "position:static !important",
    "box-sizing:border-box !important",
    "width:100% !important",
    "max-width:none !important",
    "margin:0 !important",
    "opacity:1 !important",
    "visibility:visible !important",
    "background:#fff !important",
    "color:#000 !important",
  ].join(";");

  if (prepareClone) prepareClone(clone);

  document.body.appendChild(clone);

  let cleanedUp = false;
  const cleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    if (document.body.contains(clone)) document.body.removeChild(clone);
    window.removeEventListener("afterprint", cleanup);
  };

  window.addEventListener("afterprint", cleanup);

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
