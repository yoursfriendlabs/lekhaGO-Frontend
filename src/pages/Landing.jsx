import { Link } from 'react-router-dom';
import BrandLogo from '../components/BrandLogo.jsx';

const features = [
  { title: 'Inventory & Units', desc: 'Track stock with primary and secondary units.' },
  { title: 'Purchases', desc: 'Capture incoming stock with tax, totals, and supplier context.' },
  { title: 'Sales', desc: 'Record sales in seconds and keep stock accurate.' },
  { title: 'Service Orders', desc: 'Combine labor and parts into one clean service ticket.' },
  { title: 'Unit Conversion', desc: 'Sell smaller units while stock updates correctly.' },
  { title: 'Secure Access', desc: 'JWT-based login with business-level separation.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen gradient-bg bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex flex-wrap items-center justify-between gap-4 px-6 py-6">
        <div className="space-y-3">
          <BrandLogo className="h-10 w-full max-w-[240px]" />
          <p className="text-sm text-slate-500 dark:text-slate-400">Inventory, sales, purchases, service</p>
        </div>
        <div className="flex items-center gap-3">
          <Link className="btn-ghost" to="/login">Log in</Link>
          <Link className="btn-primary" to="/register">Get started</Link>
        </div>
      </header>

      <main className="px-6 pb-16">
        <section className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="card">
            <p className="text-xs uppercase tracking-[0.3em] text-slate-500">All-in-one operations</p>
            <h2 className="mt-4 font-serif text-4xl text-slate-900 dark:text-white">
              Run your shop like a pro — from your phone.
            </h2>
            <p className="mt-4 text-slate-600 dark:text-slate-300">
              Manage products, purchases, sales, and service orders in one place. Mobile-first layouts help your team
              update stock on the go.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link className="btn-primary" to="/register">Start free setup</Link>
              <Link className="btn-secondary" to="/login">See demo workspace</Link>
            </div>
          </div>
          <div className="card">
            <h3 className="font-serif text-2xl text-slate-900 dark:text-white">What you can do</h3>
            <ul className="mt-4 space-y-3 text-sm text-slate-600 dark:text-slate-300">
              <li>Fast item creation with unit conversions.</li>
              <li>Smart sales + purchase forms with automatic totals.</li>
              <li>Service tickets that combine labor and parts.</li>
              <li>Accurate stock updates in primary units.</li>
              <li>Works great on mobile and desktop.</li>
            </ul>
          </div>
        </section>

        <section className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="card">
              <h4 className="font-serif text-xl text-slate-900 dark:text-white">{feature.title}</h4>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{feature.desc}</p>
            </div>
          ))}
        </section>

        <section className="mt-10 card">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="font-serif text-2xl text-slate-900 dark:text-white">Ready to streamline your shop?</h3>
              <p className="text-slate-600 dark:text-slate-300">Create your workspace in minutes.</p>
            </div>
            <Link className="btn-primary" to="/register">Create your account</Link>
          </div>
        </section>
      </main>
    </div>
  );
}
