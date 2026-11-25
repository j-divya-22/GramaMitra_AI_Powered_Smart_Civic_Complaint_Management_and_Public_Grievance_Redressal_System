import { motion } from 'framer-motion';
import { Headphones, Phone } from 'lucide-react';
import { CUSTOMER_CARE_ADMINS } from '../../config/customerCare';
import BilingualText from '../../components/i18n/BilingualText';

export default function CustomerCare() {
  return (
    <div className="min-h-screen bg-[#f4f8f3] pb-14">
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:py-12">
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <p className="inline-flex items-center gap-2 rounded-full bg-saffron-light/50 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.12em] text-saffron-muted">
            <Headphones className="h-4 w-4" aria-hidden="true" /> <BilingualText english="Support" />
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold text-brand-ink sm:text-4xl"><BilingualText english="Customer Care" /></h1>
          <p className="mt-2 text-sm text-neutral-muted"><BilingualText english="Contact a Gramamitra administrator for complaint or reward help." /></p>
        </motion.header>
        <section className="grid gap-4 sm:grid-cols-2">
          {CUSTOMER_CARE_ADMINS.map((admin) => (
            <article key={admin.phone} className="rounded-3xl border border-neutral-light bg-surface-card p-6 shadow-card">
              <p className="text-sm font-bold text-brand-ink">{admin.label}</p>
              <p className="mt-2 text-lg font-semibold text-neutral-text">{admin.phone}</p>
              <a href={`tel:+91${admin.phone}`} className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-full bg-brand-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-brand-ink-dark">
                <Phone className="h-4 w-4" aria-hidden="true" /> <BilingualText english="Call administrator" />
              </a>
            </article>
          ))}
        </section>
      </main>
    </div>
  );
}
