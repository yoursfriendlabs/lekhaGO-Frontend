const PRINT_CLONE_STYLE = [
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

const PRINT_DOCUMENT_CSS = `
html, body {
  background: #fff !important;
  color: #000 !important;
  color-scheme: light !important;
  margin: 0 !important;
  padding: 12px !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
}
.print-clone,
.thermal-print-clone {
  display: block !important;
  position: static !important;
  width: 100% !important;
  max-width: none !important;
  margin: 0 !important;
  background: #fff !important;
  color: #000 !important;
  visibility: visible !important;
  opacity: 1 !important;
}
@media print {
  html, body, body > * {
    display: block !important;
    visibility: visible !important;
    background: #fff !important;
    color: #000 !important;
  }
  @page { margin: 1.2cm; size: A4 portrait; }
}
`;

function waitForPrintLayout() {
  return new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        window.setTimeout(resolve, 50);
      });
    });
  });
}

export function isMobileLike() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/Android|iPhone|iPod|iPad|webOS|BlackBerry|IEMobile|Opera Mini|Mobi|Phone/i.test(ua)) {
    return true;
  }
  return navigator.platform === "MacIntel" && (navigator.maxTouchPoints || 0) > 1;
}

function classNameOf(node) {
  if (typeof node.className === "string") return node.className;
  return node.getAttribute?.("class") || "";
}

export function preparePrintClone(source, prepareClone) {
  const clone = source.cloneNode(true);
  clone.classList.add("print-clone");
  clone.style.cssText = PRINT_CLONE_STYLE;

  Array.from(clone.querySelectorAll("[class]")).forEach((node) => {
    if (/\bprint:hidden\b/.test(classNameOf(node))) {
      node.remove();
    }
  });

  Array.from(clone.querySelectorAll("[class]")).forEach((node) => {
    const className = classNameOf(node);
    const match = className.match(/\bprint:(block|flex|grid|table|inline-block|contents)\b/);
    if (!match) return;
    node.classList.remove("hidden");
    node.style.setProperty("display", match[1], "important");
    node.style.setProperty("visibility", "visible", "important");
    node.style.setProperty("opacity", "1", "important");
  });

  if (prepareClone) prepareClone(clone);
  return clone;
}

function getPageStylesHtml() {
  return Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
    .map((node) => {
      if (node.tagName === "LINK") {
        const href = node.href || node.getAttribute("href") || "";
        return href ? `<link rel="stylesheet" href="${href}">` : "";
      }
      return node.outerHTML;
    })
    .join("\n");
}

export function buildPrintDocumentHtml(clonedHtml, stylesHtml = "") {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta name="color-scheme" content="light"><title>Print</title>${stylesHtml}<style>${PRINT_DOCUMENT_CSS}</style></head><body>${clonedHtml}</body></html>`;
}

function writeHtmlToWindow(printWindow, html) {
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

function triggerWindowPrint(printWindow) {
  try {
    printWindow.focus();
    printWindow.print();
  } catch {
    // The printable page remains open if the print dialog cannot start.
  }
}

function printViaDedicatedDocument(clone, preOpenedWindow) {
  const html = buildPrintDocumentHtml(clone.outerHTML, getPageStylesHtml());
  const printWindow = preOpenedWindow && !preOpenedWindow.closed ? preOpenedWindow : null;

  if (printWindow) {
    try {
      writeHtmlToWindow(printWindow, html);
      const trigger = () => triggerWindowPrint(printWindow);
      if (printWindow.document.readyState === "complete") {
        printWindow.setTimeout(trigger, 250);
      } else {
        printWindow.onload = () => printWindow.setTimeout(trigger, 250);
      }
      return;
    } catch {
      try {
        printWindow.close();
      } catch {
        // Ignore close failures from a blocked or already-closed window.
      }
    }
  }

  printViaVisibleIframe(html);
}

function printViaVisibleIframe(html) {
  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;inset:0;width:100%;height:100%;border:0;z-index:-1;opacity:0;pointer-events:none;";
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) {
    iframe.remove();
    return;
  }

  writeHtmlToWindow(iframe.contentWindow, html);

  const cleanup = () => {
    if (document.body.contains(iframe)) document.body.removeChild(iframe);
  };

  const trigger = () => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } finally {
      window.setTimeout(cleanup, 60000);
    }
  };

  iframe.onload = () => window.setTimeout(trigger, 250);
  window.setTimeout(trigger, 800);
}

async function printViaCurrentDocument(clone) {
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

export async function printElement(source, { prepareClone } = {}) {
  if (!source) {
    window.print();
    return;
  }

  const mobile = isMobileLike();
  const printWindow = mobile ? window.open("", "_blank") : null;
  const clone = preparePrintClone(source, prepareClone);

  if (mobile) {
    printViaDedicatedDocument(clone, printWindow);
    return;
  }

  await printViaCurrentDocument(clone);
}

export async function printThermalReceipt(source, { prepareClone } = {}) {
  if (!source) {
    window.print();
    return;
  }

  const styleEl = document.createElement("style");
  styleEl.id = "thermal-page-style";
  styleEl.innerHTML = `@page { size: 80mm auto !important; margin: 0 !important; }`;
  document.head.appendChild(styleEl);
  document.body.classList.add("thermal-printing");

  const cleanup = () => {
    const el = document.getElementById("thermal-page-style");
    if (el) el.remove();
    document.body.classList.remove("thermal-printing");
  };

  const clone = source.cloneNode(true);
  clone.classList.add("thermal-print-clone");
  clone.style.cssText = [
    "display:block !important",
    "position:static !important",
    "box-sizing:border-box !important",
    "width:80mm !important",
    "max-width:80mm !important",
    "margin:0 auto !important",
    "padding:4mm !important",
    "opacity:1 !important",
    "visibility:visible !important",
    "background:#fff !important",
    "color:#000 !important",
    "font-family:ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace !important",
  ].join(";");

  if (prepareClone) prepareClone(clone);

  document.body.appendChild(clone);

  let cleanedUp = false;
  const desktopCleanup = () => {
    if (cleanedUp) return;
    cleanedUp = true;
    cleanup();
    if (document.body.contains(clone)) document.body.removeChild(clone);
    window.removeEventListener("afterprint", desktopCleanup);
  };

  window.addEventListener("afterprint", desktopCleanup);

  try {
    if (document.fonts?.ready) {
      await document.fonts.ready.catch(() => undefined);
    }
    await waitForPrintLayout();
    window.print();
    window.setTimeout(desktopCleanup, 60000);
  } catch {
    desktopCleanup();
    window.print();
  }
}
