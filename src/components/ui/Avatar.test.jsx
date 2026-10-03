import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import Avatar from './Avatar.jsx';

describe('Avatar', () => {
  it('renders a photo when src is provided', () => {
    render(<Avatar src="https://cdn.example.com/hari.jpg" name="Hari" alt="Hari" />);

    expect(screen.getByAltText('Hari')).toHaveAttribute('src', 'https://cdn.example.com/hari.jpg');
  });

  it('falls back to initials when there is no photo', () => {
    render(<Avatar name="Hari Sharma" />);

    expect(screen.getByText('HS')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });
});
