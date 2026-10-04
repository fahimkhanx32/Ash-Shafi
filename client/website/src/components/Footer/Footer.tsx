'use client';

import React from 'react';
import Link from 'next/link';
import {
  FaFacebookF,
  FaInstagram,
  FaLinkedinIn,
  FaWhatsapp,
  FaPhoneAlt,
  FaEnvelope,
  FaMapMarkerAlt,
  FaArrowRight,
} from 'react-icons/fa';
import { useI18n } from '@/lib/i18nContext';

export const Footer: React.FC = () => {
  const { t } = useI18n();

  return (
    <footer className="relative overflow-hidden bg-[#030b0e] text-[#f4f1e9]">
      {/* SUBTLE BACKGROUND GLOW */}
      <div className="pointer-events-none absolute -right-40 top-0 h-[500px] w-[500px] rounded-full bg-[#20aaa0]/[0.035] blur-[120px]" />
      <div className="pointer-events-none absolute -left-40 bottom-0 h-[400px] w-[400px] rounded-full bg-[#20aaa0]/[0.025] blur-[120px]" />

      {/* TOP DECORATIVE LINE */}
      <div className="relative mx-auto w-[92%] max-w-[1450px]">
        <div className="flex items-center justify-center">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#20aaa0]/20 to-[#20aaa0]/50" />
          <div className="mx-5 flex items-center gap-2">
            <span className="h-1 w-1 rounded-full bg-[#20aaa0]/60" />
            <span className="h-1.5 w-1.5 rounded-full bg-[#20aaa0]" />
            <span className="h-1 w-1 rounded-full bg-[#20aaa0]/60" />
          </div>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#20aaa0]/20 to-[#20aaa0]/50" />
        </div>
      </div>

      {/* MAIN FOOTER */}
      <div className="relative z-10 mx-auto w-[92%] max-w-[1450px] py-16 lg:py-20">
        <div className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1.2fr_1.3fr] lg:gap-14">
          {/* BRAND */}
          <div className="max-w-[390px]">
            <Link href="/" className="group inline-flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full border border-[#20aaa0]/30 bg-[#20aaa0]/[0.07] text-[#20aaa0] shadow-[0_0_25px_rgba(32,170,160,0.06)] transition-all duration-300 group-hover:border-[#20aaa0]/60 group-hover:bg-[#20aaa0]/[0.12]">
                <span className="font-serif text-xl">N</span>
              </div>

              <div>
                <h2 className="font-serif text-[21px] leading-none tracking-wide text-[#f4f1e9]">
                  {t.brand.doctorName}
                </h2>
                <p className="mt-1 text-[9px] font-medium uppercase tracking-[0.25em] text-[#20aaa0]">
                  {t.brand.specialty}
                </p>
              </div>
            </Link>

            <p className="mt-7 max-w-[360px] font-sans text-[14px] font-light leading-7 text-[#aab9bd]">
              {t.footer.description}
            </p>

            {/* Social Icons */}
            <div className="mt-7 flex items-center gap-3">
              {[
                { icon: <FaFacebookF />, label: 'Facebook', href: 'https://facebook.com' },
                { icon: <FaInstagram />, label: 'Instagram', href: 'https://instagram.com' },
                { icon: <FaLinkedinIn />, label: 'LinkedIn', href: 'https://linkedin.com' },
                { icon: <FaWhatsapp />, label: 'WhatsApp', href: 'https://wa.me/8801703613394' },
              ].map((social) => (
                <a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={social.label}
                  className="flex h-9 w-9 items-center justify-center rounded-full border border-white/[0.10] bg-white/[0.025] text-[13px] text-[#9caeb2] transition-all duration-300 hover:border-[#20aaa0]/50 hover:bg-[#20aaa0]/10 hover:text-[#20aaa0]"
                >
                  {social.icon}
                </a>
              ))}
            </div>
          </div>

          {/* QUICK LINKS */}
          <div>
            <h3 className="font-serif text-[18px] text-[#f4f1e9]">{t.footer.explore}</h3>
            <div className="mt-3 h-px w-8 bg-[#20aaa0]" />

            <ul className="mt-6 space-y-3.5">
              {[
                { label: 'Home', href: '/' },
                { label: 'About Ash-Shāfī', href: '/about' },
                { label: 'Care Services', href: '/services' },
                { label: 'Professional Practice', href: '/#office' },
                { label: "Women's Health", href: '/#women-health' },
                { label: 'Contact Us', href: '/contact' },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="group inline-flex items-center gap-2 font-sans text-[13px] font-light text-[#9eafb3] transition-colors duration-300 hover:text-[#20aaa0]"
                  >
                    <span className="h-px w-0 bg-[#20aaa0] transition-all duration-300 group-hover:w-3" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* SERVICES */}
          <div>
            <h3 className="font-serif text-[18px] text-[#f4f1e9]">{t.footer.servicesTitle}</h3>
            <div className="mt-3 h-px w-8 bg-[#20aaa0]" />

            <ul className="mt-6 space-y-3.5">
              {[
                { label: 'Gynecological Care', href: '/services#gynecological-care' },
                { label: 'Pregnancy & Prenatal Care', href: '/services#prenatal-care' },
                { label: 'Menstrual Health', href: '/services#menstrual-health' },
                { label: 'Fertility Consultation', href: '/services#fertility' },
                { label: 'Menopause Management', href: '/services#menopause' },
                { label: 'Preventive Care', href: '/services#preventive-care' },
              ].map((item) => (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    className="group inline-flex items-center gap-2 font-sans text-[13px] font-light text-[#9eafb3] transition-colors duration-300 hover:text-[#20aaa0]"
                  >
                    <span className="h-1 w-1 rounded-full bg-[#20aaa0]/40 transition-all duration-300 group-hover:bg-[#20aaa0] group-hover:shadow-[0_0_7px_rgba(32,170,160,0.6)]" />
                    {item.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CONTACT */}
          <div>
            <h3 className="font-serif text-[18px] text-[#f4f1e9]">{t.footer.getInTouch}</h3>
            <div className="mt-3 h-px w-8 bg-[#20aaa0]" />

            <div className="mt-6 space-y-5">
              {/* Location */}
              <div className="flex items-start gap-3">
                <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#20aaa0]/20 bg-[#20aaa0]/[0.06] text-[#20aaa0]">
                  <FaMapMarkerAlt className="text-sm" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-[#20aaa0]">Clinic</p>
                  <p className="mt-1 text-[13px] leading-5 text-[#aab9bd]">
                    City Hospital<br />Mohammadpur, Dhaka
                  </p>
                </div>
              </div>

              {/* Phone */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#20aaa0]/20 bg-[#20aaa0]/[0.06] text-[#20aaa0]">
                  <FaPhoneAlt className="text-sm" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-[#20aaa0]">Phone</p>
                  <a
                    href="tel:+8801703613394"
                    className="mt-1 block text-[13px] text-[#aab9bd] transition-colors hover:text-[#20aaa0]"
                  >
                    +880 1703613394
                  </a>
                </div>
              </div>

              {/* Email */}
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#20aaa0]/20 bg-[#20aaa0]/[0.06] text-[#20aaa0]">
                  <FaEnvelope className="text-sm" />
                </div>
                <div>
                  <p className="text-[11px] uppercase tracking-[0.15em] text-[#20aaa0]">Email</p>
                  <a
                    href="mailto:antaraadiba5@gmail.com"
                    className="mt-1 block text-[13px] text-[#aab9bd] transition-colors hover:text-[#20aaa0]"
                  >
                    antaraadiba5@gmail.com
                  </a>
                </div>
              </div>
            </div>

            {/* Appointment CTA */}
            <Link
              href="/appointment"
              className="group mt-7 inline-flex items-center gap-3 rounded-lg border border-[#20aaa0]/40 bg-[#20aaa0]/[0.10] px-5 py-3 text-[12px] font-medium tracking-wide text-[#dff7f4] transition-all duration-300 hover:border-[#20aaa0] hover:bg-[#20aaa0]/20 hover:shadow-[0_0_25px_rgba(32,170,160,0.10)]"
            >
              <span>Book an Appointment</span>
              <FaArrowRight className="text-[10px] transition-transform duration-300 group-hover:translate-x-1" />
            </Link>
          </div>
        </div>
      </div>

      {/* DECORATIVE BOTTOM WAVE */}
      <div className="pointer-events-none relative h-[70px] overflow-hidden">
        <div className="absolute -bottom-12 left-[-10%] h-[100px] w-[65%] rotate-[4deg] rounded-[50%] border-t border-[#20aaa0]/20" />
        <div className="absolute -bottom-14 left-[28%] h-[100px] w-[65%] rotate-[-4deg] rounded-[50%] border-t border-[#20aaa0]/15" />
        <div className="absolute -bottom-16 right-[-15%] h-[110px] w-[55%] rotate-[-8deg] rounded-[50%] border-t border-[#20aaa0]/20" />
      </div>

      {/* BOTTOM LEGAL BAR */}
      <div className="border-t border-white/[0.06] bg-black/20">
        <div className="mx-auto flex w-[92%] max-w-[1450px] flex-col items-center justify-between gap-3 py-5 text-center sm:flex-row sm:text-left">
          <p className="text-[11px] font-light tracking-wide text-[#718387]">
            © {new Date().getFullYear()} {t.brand.doctorName}. {t.footer.copyright}
          </p>

          <div className="flex items-center gap-5">
            <Link href="/privacy" className="text-[11px] text-[#718387] transition-colors hover:text-[#20aaa0]">
              {t.footer.privacyPolicy}
            </Link>
            <span className="h-3 w-px bg-white/10" />
            <Link href="/terms" className="text-[11px] text-[#718387] transition-colors hover:text-[#20aaa0]">
              {t.footer.terms}
            </Link>
            <span className="h-3 w-px bg-white/10" />
            <Link href="/disclaimer" className="text-[11px] text-[#718387] transition-colors hover:text-[#20aaa0]">
              {t.footer.disclaimer}
            </Link>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
