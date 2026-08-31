import { screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../../lib/auth.jsx";
import { I18nProvider } from "../../lib/i18n.jsx";
import { ThemeProvider } from "../../lib/theme.jsx";
import { BusinessSettingsProvider } from "../../lib/business/businessSettings.jsx";
import { render } from "@testing-library/react";
import Sidebar from "./Sidebar.jsx";

function renderSidebar() {
  return render(
    <MemoryRouter>
      <ThemeProvider>
        <I18nProvider>
          <AuthProvider>
            <BusinessSettingsProvider>
              <Sidebar />
            </BusinessSettingsProvider>
          </AuthProvider>
        </I18nProvider>
      </ThemeProvider>
    </MemoryRouter>,
  );
}

describe("Sidebar", () => {
  it("renders grouped icon links and the brand mark by default", () => {
    window.localStorage.setItem("mms_token", "token-123");
    window.localStorage.setItem("mms_role", "owner");
    window.localStorage.setItem(
      "mms_user",
      JSON.stringify({ name: "Dipesh", role: "owner" }),
    );
    window.localStorage.setItem(
      "mms_business_profile",
      JSON.stringify({
        label: "Demo Shop",
        type: "retail",
        navigation: [
          { key: "dashboard", label: "Dashboard", route: "/app" },
          { key: "inventory", label: "Inventory", route: "/app/inventory" },
          { key: "settings", label: "Settings", route: "/app/settings" },
        ],
      }),
    );

    renderSidebar();

    expect(
      screen
        .getAllByRole("img", { name: "PasalManager", hidden: true })
        .some((img) => String(img.getAttribute("src") || "").includes("pasalmanager-icon")),
    ).toBe(true);
    expect(screen.getByRole("link", { name: /dashboard/i, hidden: true })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /inventory/i, hidden: true })).toBeInTheDocument();
    expect(screen.getByText("Overview")).toBeInTheDocument();
    expect(screen.getByText("Operations")).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
  });
});
