import type { Metadata } from 'next';
import { ContactForm } from '@/components/forms/ContactForm';
import {
  FaPhoneAlt,
  FaEnvelope,
  FaMapMarkerAlt,
  FaClock,
} from 'react-icons/fa';

export const metadata: Metadata = {
  title: 'Contact Us',
  description:
    'Get in touch with Ash-Shāfī\'s clinic. Call, email, or send a message — we respond within 24 hours.',
};

const contactDetails = [
  {
    icon: FaPhoneAlt,
    label: 'Phone',
    value: '+880 1703613394',
    href: 'tel:+8801703613394',
  },
  {
    icon: FaEnvelope,
    label: 'Email',
    value: 'antaraadiba5@gmail.com',
    href: 'mailto:antaraadiba5@gmail.com',
  },
  {
    icon: FaMapMarkerAlt,
    label: 'Clinic',
    value: 'City Hospital, Mohammadpur, Dhaka',
    href: null,
  },
  {
    icon: FaClock,
    label: 'Hours',
    value: 'Sat–Thu: 9 AM – 6 PM',
    href: null,
  },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen w-full bg-[#030b0e]">
      {/* PAGE HERO */}
      <section className="relative w-full overflow-hidden px-5 pb-16 pt-20 sm:px-8 lg:px-14">
        <div className="pointer-events-none absolute left-1/2 top-0 h-64 w-[700px] -translate-x-1/2 rounded-full bg-[#20aaa0]/[0.04] blur-[100px]" />
        <div className="relative mx-auto max-w-4xl text-center">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-8 bg-[#20aaa0]/60" />
            <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-[#20aaa0]">
              We'd Love to Hear from You
            </span>
            <span className="h-px w-8 bg-[#20aaa0]/60" />
          </div>
          <h1 className="font-serif text-4xl font-medium text-[#f4f1e9] sm:text-5xl">
            Get in Touch
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-[14px] leading-7 text-[#aab9bd]">
            Have a question about our services or want to schedule a consultation?
            Send us a message and our team will respond within 24 hours.
          </p>
        </div>
      </section>

      {/* CONTACT CONTENT */}
      <section className="px-5 pb-24 sm:px-8 lg:px-14">
        <div className="mx-auto max-w-6xl">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_1.5fr] lg:gap-16">
            {/* LEFT — CONTACT DETAILS */}
            <div className="space-y-6">
              <div>
                <h2 className="font-serif text-2xl font-medium text-[#f4f1e9]">
                  Contact Information
                </h2>
                <p className="mt-2 text-sm leading-6 text-[#aab9bd]">
                  Reach us through any of the channels below, or use the form to send a message directly.
                </p>
              </div>

              <div className="space-y-4">
                {contactDetails.map((detail) => {
                  const Icon = detail.icon;
                  return (
                    <div
                      key={detail.label}
                      className="flex items-center gap-4 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 transition-all hover:border-[#20aaa0]/20"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#20aaa0]/20 bg-[#20aaa0]/[0.07] text-[#20aaa0]">
                        <Icon className="text-sm" />
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-[0.2em] text-[#20aaa0]">
                          {detail.label}
                        </p>
                        {detail.href ? (
                          <a
                            href={detail.href}
                            className="mt-0.5 block text-sm text-[#f4f1e9] transition-colors hover:text-[#20aaa0]"
                          >
                            {detail.value}
                          </a>
                        ) : (
                          <p className="mt-0.5 text-sm text-[#aab9bd]">{detail.value}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* MAP PLACEHOLDER */}
              <div className="overflow-hidden rounded-2xl border border-white/[0.07]">
                <iframe
                  src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3652.5427428774764!2d90.35626247543!3d23.761890392636!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3755bf4def7cfb2d%3A0x46c8cdfb15eac95!2sMohammadpur%2C+Dhaka!5e0!3m2!1sen!2sbd!4v1700000000000"
                  width="100%"
                  height="200"
                  style={{ border: 0, filter: 'invert(85%) hue-rotate(180deg)' }}
                  allowFullScreen
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  title="Clinic Location"
                />
              </div>
            </div>

            {/* RIGHT — CONTACT FORM */}
            <ContactForm
              title="Send us a Message"
              subtitle="We'll respond to your enquiry within 24 hours."
            />
          </div>
        </div>
      </section>
    </main>
  );
}
