import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import ConfirmDialog from './ConfirmDialog.jsx';
import { renderWithProviders } from '../../test/renderWithProviders.jsx';

describe('ConfirmDialog', () => {
  it('calls confirm handler when delete is pressed', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();

    renderWithProviders(
      <ConfirmDialog
        isOpen
        onClose={vi.fn()}
        onConfirm={onConfirm}
        description="Delete this item?"
      />
    );

    await user.click(screen.getByRole('button', { name: /delete/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
  });
});
