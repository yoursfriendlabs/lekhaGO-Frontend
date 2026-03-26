import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../lib/auth.jsx';
import { I18nProvider } from '../lib/i18n.jsx';

export function renderWithProviders(ui, { route = '/', withAuth = false } = {}) {
  const Wrapper = ({ children }) => (
    <MemoryRouter
      initialEntries={[route]}
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <I18nProvider>
        {withAuth ? <AuthProvider>{children}</AuthProvider> : children}
      </I18nProvider>
    </MemoryRouter>
  );

  return render(ui, { wrapper: Wrapper });
}
