import { describe, expect, it } from 'vitest';
import { buildPrintDocumentHtml, preparePrintClone } from './print.js';

describe('preparePrintClone', () => {
  it('reveals print-only markup and drops screen-only markup', () => {
    const source = document.createElement('div');
    source.innerHTML = `
      <div class="hidden print:block" data-print>Statement</div>
      <div class="space-y-6 print:hidden" data-screen>Filters</div>
    `;

    const clone = preparePrintClone(source);

    expect(clone.classList.contains('print-clone')).toBe(true);
    expect(clone.querySelector('[data-print]')).not.toBeNull();
    expect(clone.querySelector('[data-print]').style.display).toBe('block');
    expect(clone.querySelector('[data-screen]')).toBeNull();
  });

  it('runs prepareClone after the print layout is normalized', () => {
    const source = document.createElement('div');
    source.innerHTML = `<p data-printed-at>old</p>`;

    const clone = preparePrintClone(source, (next) => {
      next.querySelector('[data-printed-at]').textContent = 'printed';
    });

    expect(clone.querySelector('[data-printed-at]').textContent).toBe('printed');
  });
});

describe('buildPrintDocumentHtml', () => {
  it('builds a light-themed standalone print document', () => {
    const html = buildPrintDocumentHtml('<div class="print-clone">Ledger</div>', '<style>.x{}</style>');

    expect(html).toContain('color-scheme" content="light"');
    expect(html).toContain('background: #fff !important');
    expect(html).toContain('<div class="print-clone">Ledger</div>');
    expect(html).toContain('<style>.x{}</style>');
  });
});
