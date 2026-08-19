import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../lib/auth.jsx';
import { I18nProvider } from '../lib/i18n.jsx';
import { ThemeProvider } from '../lib/theme.jsx';

export function renderWithProviders(ui, { route = '/', withAuth = false } = {}) {
  const Wrapper = ({ children }) => (
    <MemoryRouter
      initialEntries={[route]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <ThemeProvider>
        <I18nProvider>
          {withAuth ? <AuthProvider>{children}</AuthProvider> : children}
        </I18nProvider>
      </ThemeProvider>
    </MemoryRouter>
  );

  return render(ui, { wrapper: Wrapper });
}
