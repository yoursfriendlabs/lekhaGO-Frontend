import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import FileUpload from './FileUpload';

vi.mock('../lib/api', () => ({
  api: {
    uploadAttachment: vi.fn(),
    uploadAttachments: vi.fn(),
  },
  API_BASE: 'http://localhost:4000',
}));

vi.mock('../lib/i18n.jsx', () => ({
  useI18n: () => ({
    t: (key) => key,
  }),
}));

describe('FileUpload', () => {
  it('does not enter a render loop in single-file mode when initialUrls is omitted', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      render(
        <FileUpload
          label="Attachment"
          initialUrl="/uploads/test.png"
          onUpload={vi.fn()}
        />
      );

      expect(screen.getByAltText('Preview')).toHaveAttribute(
        'src',
        'http://localhost:4000/uploads/test.png'
      );
      expect(
        consoleError.mock.calls.some((call) => call.some((value) => String(value).includes('Maximum update depth exceeded')))
      ).toBe(false);
    } finally {
      consoleError.mockRestore();
    }
  });
});
