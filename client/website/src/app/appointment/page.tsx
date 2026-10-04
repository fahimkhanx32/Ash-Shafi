import type { Metadata } from 'next';
import { AppointmentForm } from '@/components/forms/AppointmentForm';
import { FaCalendarCheck, FaClock, FaPhoneAlt } from 'react-icons/fa';

export const metadata: Metadata = {
  title: 'Book an Appointment',
  description:
    'Book an appointment with Ash-Shāfī. Fill in the form to request a consultation for gynecology, obstetrics, pregnancy care, and more.',
};

const highlights = [
  {
    icon: FaCalendarCheck,
    title: 'Quick Confirmation',
    desc: 'Our staff will confirm your appointment within a few hours.',
  },
  {
    icon: FaClock,
    title: 'Flexible Hours',
    desc: 'Appointments available Saturday through Thursday, 9 AM to 6 PM.',
  },
  {
    icon: FaPhoneAlt,
    title: 'Phone Booking',
    desc: 'Prefer to call? Reach us at +880 1703613394.',
  },
];

export default function AppointmentPage() {
  return (
    <main className="min-h-screen w-full bg-[#030b0e]">
      {/* PAGE HERO */}
      <section className="relative overflow-hidden px-5 pb-14 pt-20 sm:px-8 lg:px-14">
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[700px] -translate-x-1/2 rounded-full bg-[#20aaa0]/[0.04] blur-[100px]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-[#20aaa0]/60" />
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-[#20aaa0]">
              Your Health Matters
            </span>
            <span className="h-px w-8 bg-[#20aaa0]/60" />
          </div>
          <h1 className="font-serif text-4xl font-medium text-[#f4f1e9] sm:text-5xl">
            Book an Appointment
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-7 text-[#aab9bd]">
            Complete the form below and our clinic team will get in touch to confirm
            your preferred date and time.
          </p>
        </div>
      </section>

      {/* HIGHLIGHTS */}
      <section className="px-5 pb-10 sm:px-8 lg:px-14">
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 sm:grid-cols-3">
          {highlights.map((h) => {
            const Icon = h.icon;
            return (
              <div
                key={h.title}
                className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#20aaa0]/20 bg-[#20aaa0]/[0.07] text-[#20aaa0]">
                  <Icon className="text-sm" />
                </div>
                <div>
                  <p className="text-sm font-medium text-[#f4f1e9]">{h.title}</p>
                  <p className="mt-0.5 text-xs text-[#aab9bd]">{h.desc}</p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* APPOINTMENT FORM */}
      <section className="px-5 pb-24 sm:px-8 lg:px-14">
        <div className="mx-auto max-w-3xl">
          <AppointmentForm
            title="Request Your Appointment"
            subtitle="Fill in your details below. All fields marked with * are required."
          />
        </div>
      </section>
    </main>
  );
}
