import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
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
    t: (key) => ({
      'common.imageOnlyUploadError': 'Only image files can be uploaded.',
    }[key] || key),
  }),
}));

describe('FileUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

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

  it('rejects pdf uploads before calling the attachments API', async () => {
    const onUpload = vi.fn();

    render(
      <FileUpload
        label="Attachment"
        multiple
        onUpload={onUpload}
      />
    );

    const input = screen.getByLabelText('Attachment');
    const pdfFile = new File(['%PDF-1.4'], 'invoice.pdf', { type: '' });

    fireEvent.change(input, {
      target: {
        files: [pdfFile],
      },
    });

    expect(input).toHaveAttribute('accept', 'image/*');
    expect(await screen.findByText('Only image files can be uploaded.')).toBeInTheDocument();
    expect(api.uploadAttachments).not.toHaveBeenCalled();
    expect(onUpload).not.toHaveBeenCalled();
  });
});
