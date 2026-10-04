'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Container from '../Container/Container';
import { PORTAL_LOGIN_URL, PORTAL_REGISTER_URL, getClientPortalUrl } from '@/lib/portalUrl';
import {
  FaCalendarCheck,
  FaBars,
  FaTimes,
  FaPhone,
  FaEnvelope,
  FaFacebookF,
  FaInstagram,
  FaWhatsapp,
  FaMapMarkerAlt,
  FaSignInAlt,
  FaUserPlus,
} from 'react-icons/fa';
import { FiChevronDown, FiChevronRight } from 'react-icons/fi';
import { MdLanguage } from 'react-icons/md';
import { NavbarItem } from '@/types/cms';
import { DEFAULT_NAVBAR_TREE, fetchNavbarTree } from '@/lib/api';
import { useI18n } from '@/lib/i18nContext';
import { SupportedLanguage } from '@/lib/i18n';

interface NavbarProps {
  initialItems?: NavbarItem[];
}

export const Navbar: React.FC<NavbarProps> = ({ initialItems }) => {
  const { language, setLanguage, t, rtl } = useI18n();
  const [navTree, setNavTree] = useState<NavbarItem[]>(initialItems || DEFAULT_NAVBAR_TREE);
  const [menuOpen, setMenuOpen] = useState(false);
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null);
  const [activeNested, setActiveNested] = useState<string | null>(null);
  const [mobileExpanded, setMobileExpanded] = useState<Record<string, boolean>>({});
  const [langMenuOpen, setLangMenuOpen] = useState(false);
  const [portalUrls, setPortalUrls] = useState({
    login: PORTAL_LOGIN_URL,
    register: PORTAL_REGISTER_URL,
  });

  const navRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const base = getClientPortalUrl();
    setPortalUrls({
      login: `${base}/login`,
      register: `${base}/register`,
    });
  }, []);

  useEffect(() => {
    // Fetch live navbar tree from backend if not provided
    if (!initialItems || initialItems.length === 0) {
      fetchNavbarTree().then((items) => {
        if (items && items.length > 0) {
          setNavTree(items);
        }
      });
    }
  }, [initialItems]);

  // Click outside to close dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (navRef.current && !navRef.current.contains(e.target as Node)) {
        setActiveDropdown(null);
        setActiveNested(null);
      }
      if (langRef.current && !langRef.current.contains(e.target as Node)) {
        setLangMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMobileItem = (id: string) => {
    setMobileExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const languages: Array<{ code: SupportedLanguage; label: string; name: string }> = [
    { code: 'en', label: 'English', name: 'EN' },
    { code: 'bn', label: 'বাংলা', name: 'বাং' },
    { code: 'ar', label: 'العربية', name: 'عرب' },
    { code: 'ur', label: 'اردو', name: 'اردو' },
    { code: 'hi', label: 'हिन्दी', name: 'हिन्' },
  ];

  return (
    <header className="w-full bg-[#080f16] text-white" ref={navRef}>
      {/* =====================================================
          TOP CONTACT / SOCIAL BAR + LANGUAGE SELECTOR
      ====================================================== */}
      <div className="w-full border-b border-white/[0.06] bg-[#080f16]">
        <Container className="flex min-h-[52px] items-center justify-between">
          {/* LEFT SIDE */}
          <div className="flex items-center gap-3 text-[13px] text-gray-300">
            {/* PHONE */}
            <a
              href="tel:+8801703613394"
              className="flex items-center gap-2 transition-colors hover:text-white"
            >
              <FaPhone className="text-[11px] text-gray-100" />
              <span className="hidden sm:inline">+880 1703613394</span>
            </a>
            <span className="h-4 w-px bg-white/20" />

            {/* EMAIL */}
            <a
              href="mailto:antaraadiba5@gmail.com"
              className="flex items-center gap-2 transition-colors hover:text-white"
            >
              <FaEnvelope className="text-[11px] text-gray-100" />
              <span className="hidden md:inline">antaraadiba5@gmail.com</span>
            </a>
            <span className="hidden h-4 w-px bg-white/20 sm:block" />

            {/* SOCIAL ICONS */}
            <div className="hidden items-center gap-3 sm:flex">
              <a
                href="https://facebook.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Facebook"
                className="text-gray-300 transition-colors hover:text-white"
              >
                <FaFacebookF className="text-[12px]" />
              </a>
              <a
                href="https://instagram.com"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Instagram"
                className="text-gray-300 transition-colors hover:text-white"
              >
                <FaInstagram className="text-[13px]" />
              </a>
              <a
                href="https://wa.me/8801703613394"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                className="text-gray-300 transition-colors hover:text-white"
              >
                <FaWhatsapp className="text-[13px]" />
              </a>
              <a
                href="/contact"
                aria-label="Location"
                className="text-gray-300 transition-colors hover:text-white"
              >
                <FaMapMarkerAlt className="text-[13px]" />
              </a>
            </div>
          </div>

          {/* RIGHT SIDE (LANGUAGE + AUTH) */}
          <div className="flex items-center gap-3 text-[13px] text-gray-300">
            {/* REAL LANGUAGE SELECTOR */}
            <div className="relative" ref={langRef}>
              <button
                type="button"
                onClick={() => setLangMenuOpen(!langMenuOpen)}
                className="flex items-center gap-1.5 rounded px-2 py-1 text-[12px] text-gray-300 transition hover:bg-white/[0.06] hover:text-white"
                aria-expanded={langMenuOpen}
                aria-label="Language selector"
              >
                <MdLanguage className="text-[14px] text-[#20aaa0]" />
                <span>{languages.find((l) => l.code === language)?.label || 'English'}</span>
                <FiChevronDown className="text-[11px]" />
              </button>

              {langMenuOpen && (
                <div
                  className={`absolute mt-2 w-32 rounded-xl border border-white/[0.12] bg-[#0c1820] py-1.5 shadow-[0_10px_25px_rgba(0,0,0,0.5)] z-50 ${
                    rtl ? 'left-0' : 'right-0'
                  }`}
                >
                  {languages.map((l) => (
                    <button
                      key={l.code}
                      type="button"
                      onClick={() => {
                        setLanguage(l.code);
                        setLangMenuOpen(false);
                      }}
                      className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition ${
                        language === l.code
                          ? 'bg-[#20aaa0]/20 font-semibold text-[#20aaa0]'
                          : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                      }`}
                    >
                      <span>{l.label}</span>
                      <span className="text-[10px] text-gray-400">{l.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <span className="h-4 w-px bg-white/20" />

            {/* LOGIN — external link to the Vite portal (port 5173),
                the single source of truth for auth; not a Next.js route,
                so a plain anchor rather than next/link. */}
            <a
              href={portalUrls.login}
              className="flex items-center gap-2 transition-colors hover:text-white"
            >
              <FaSignInAlt className="text-[12px]" />
              <span>{t.nav.login}</span>
            </a>

            <span className="h-4 w-px bg-white/20" />

            {/* REGISTER — same external-portal link as above. */}
            <a
              href={portalUrls.register}
              className="flex items-center gap-2 transition-colors hover:text-white"
            >
              <FaUserPlus className="text-[12px]" />
              <span>{t.nav.register}</span>
            </a>
          </div>
        </Container>
      </div>

      {/* =====================================================
          MAIN DOCTOR NAVBAR
      ====================================================== */}
      <div className="px-3 py-2 sm:px-5">
        <div className="relative rounded-[17px] border border-white/[0.08] bg-[#111a23] shadow-[0_8px_30px_rgba(0,0,0,0.30)]">
          <Container>
            {/* DESKTOP NAVBAR */}
            <nav className="flex min-h-[74px] items-center justify-between gap-4">
              {/* ================= LOGO / DOCTOR ================= */}
              <Link href="/" className="flex shrink-0 items-center gap-3">
                {/* NT LOGO */}
                <div className="flex h-11 w-11 items-center justify-center rounded-full border border-white/[0.06] bg-[#1d2a34] shadow-inner">
                  <span className="text-[18px] font-semibold tracking-wide text-[#159c8b]">
                    NT
                  </span>
                </div>
                {/* DOCTOR NAME */}
                <div className="flex flex-col leading-tight">
                  <span className="text-[18px] font-semibold tracking-[0.01em] text-white">
                    {t.brand.doctorName}
                  </span>
                  <span className="mt-1 text-[13px] text-gray-400">
                    {t.brand.subSpecialty}
                  </span>
                </div>
              </Link>

              {/* ================= DESKTOP NAVIGATION ================= */}
              <div className="hidden items-center gap-1 lg:flex">
                {navTree.map((item) => {
                  const hasChildren = item.children && item.children.length > 0;
                  const isTopOpen = activeDropdown === item._id;

                  return (
                    <div
                      key={item._id}
                      className="relative"
                      onMouseEnter={() => {
                        setActiveDropdown(item._id);
                      }}
                      onMouseLeave={() => {
                        setActiveDropdown(null);
                        setActiveNested(null);
                      }}
                    >
                      <Link
                        href={item.href || '#'}
                        className={`flex items-center gap-1.5 rounded-lg px-3.5 py-2.5 text-[14px] font-medium transition-all duration-200 ${
                          isTopOpen
                            ? 'bg-white/[0.08] text-white'
                            : 'text-gray-300 hover:bg-white/[0.04] hover:text-white'
                        }`}
                      >
                        <span>{item.label}</span>
                        {hasChildren && (
                          <FiChevronDown
                            className={`text-[13px] transition-transform duration-200 ${
                              isTopOpen ? 'rotate-180 text-[#20aaa0]' : 'text-gray-400'
                            }`}
                          />
                        )}
                      </Link>

                      {/* LEVEL 1 DROPDOWN MENU */}
                      {hasChildren && isTopOpen && (
                        <div className="absolute left-0 top-full mt-1.5 w-60 rounded-xl border border-white/[0.12] bg-[#0c1822] py-2 shadow-[0_15px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl z-50 animate-fadeIn">
                          {item.children!.map((child) => {
                            const hasSubChildren =
                              child.children && child.children.length > 0;
                            const isNestedOpen = activeNested === child._id;

                            return (
                              <div
                                key={child._id}
                                className="relative"
                                onMouseEnter={() => {
                                  if (hasSubChildren) setActiveNested(child._id);
                                }}
                              >
                                <Link
                                  href={child.href || '#'}
                                  target={child.openInNewTab ? '_blank' : undefined}
                                  rel={child.openInNewTab ? 'noopener noreferrer' : undefined}
                                  className={`flex w-full items-center justify-between px-4 py-2.5 text-[13px] transition-colors ${
                                    isNestedOpen
                                      ? 'bg-[#20aaa0]/15 text-[#20aaa0]'
                                      : 'text-gray-300 hover:bg-white/[0.06] hover:text-white'
                                  }`}
                                >
                                  <span>{child.label}</span>
                                  {hasSubChildren && (
                                    <FiChevronRight className="text-[12px] text-gray-400" />
                                  )}
                                </Link>

                                {/* LEVEL 2 NESTED DROPDOWN */}
                                {hasSubChildren && isNestedOpen && (
                                  <div className="absolute left-full top-0 ml-1.5 w-56 rounded-xl border border-white/[0.12] bg-[#0c1822] py-2 shadow-[0_15px_40px_rgba(0,0,0,0.5)] backdrop-blur-xl z-50">
                                    {child.children!.map((subChild) => (
                                      <Link
                                        key={subChild._id}
                                        href={subChild.href || '#'}
                                        target={subChild.openInNewTab ? '_blank' : undefined}
                                        rel={subChild.openInNewTab ? 'noopener noreferrer' : undefined}
                                        className="block px-4 py-2.5 text-[13px] text-gray-300 transition-colors hover:bg-white/[0.06] hover:text-white"
                                      >
                                        {subChild.label}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* ================= APPOINTMENT CTA ================= */}
              <div className="hidden lg:block">
                <Link
                  href="/appointment"
                  className="flex items-center gap-2.5 rounded-full bg-[#159b89] px-5 py-3 text-[14px] font-semibold text-white shadow-[0_5px_18px_rgba(21,155,137,0.18)] transition-all duration-200 hover:bg-[#128b7b] hover:shadow-[0_7px_22px_rgba(21,155,137,0.25)]"
                >
                  <FaCalendarCheck className="text-[15px]" />
                  <span>{t.nav.bookAppointment}</span>
                </Link>
              </div>

              {/* ================= MOBILE TOGGLE BUTTON ================= */}
              <button
                type="button"
                onClick={() => setMenuOpen(!menuOpen)}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03] text-gray-200 transition hover:bg-white/[0.07] lg:hidden"
                aria-label="Toggle navigation menu"
                aria-expanded={menuOpen}
              >
                {menuOpen ? <FaTimes className="text-lg" /> : <FaBars className="text-lg" />}
              </button>
            </nav>

            {/* ================= MOBILE ACCORDION MENU ================= */}
            <div
              className={`overflow-hidden transition-all duration-300 lg:hidden ${
                menuOpen ? 'max-h-[600px] opacity-100 pb-5 overflow-y-auto' : 'max-h-0 opacity-0'
              }`}
            >
              <div className="border-t border-white/[0.07] pt-3 space-y-1">
                {navTree.map((item) => {
                  const hasChildren = item.children && item.children.length > 0;
                  const isExpanded = !!mobileExpanded[item._id];

                  return (
                    <div key={item._id} className="rounded-lg">
                      <div className="flex items-center justify-between">
                        <Link
                          href={item.href || '#'}
                          onClick={() => {
                            if (!hasChildren) setMenuOpen(false);
                          }}
                          className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-200 transition hover:text-white"
                        >
                          {item.label}
                        </Link>
                        {hasChildren && (
                          <button
                            type="button"
                            onClick={() => toggleMobileItem(item._id)}
                            className="p-2.5 text-gray-400 hover:text-white"
                            aria-label={`Toggle ${item.label} menu`}
                          >
                            <FiChevronDown
                              className={`transition-transform duration-200 ${
                                isExpanded ? 'rotate-180 text-[#20aaa0]' : ''
                              }`}
                            />
                          </button>
                        )}
                      </div>

                      {/* Mobile Nested Level 1 */}
                      {hasChildren && isExpanded && (
                        <div className="ml-4 border-l border-white/[0.08] pl-2 space-y-1 py-1">
                          {item.children!.map((child) => {
                            const hasSub = child.children && child.children.length > 0;
                            const isSubExpanded = !!mobileExpanded[child._id];

                            return (
                              <div key={child._id}>
                                <div className="flex items-center justify-between">
                                  <Link
                                    href={child.href || '#'}
                                    onClick={() => {
                                      if (!hasSub) setMenuOpen(false);
                                    }}
                                    className="flex-1 px-3 py-2 text-xs font-normal text-gray-300 hover:text-white"
                                  >
                                    {child.label}
                                  </Link>
                                  {hasSub && (
                                    <button
                                      type="button"
                                      onClick={() => toggleMobileItem(child._id)}
                                      className="p-2 text-gray-400 hover:text-white"
                                    >
                                      <FiChevronDown
                                        className={`text-xs transition-transform ${
                                          isSubExpanded ? 'rotate-180 text-[#20aaa0]' : ''
                                        }`}
                                      />
                                    </button>
                                  )}
                                </div>

                                {/* Mobile Nested Level 2 */}
                                {hasSub && isSubExpanded && (
                                  <div className="ml-3 border-l border-white/[0.08] pl-2 space-y-1 py-1">
                                    {child.children!.map((sub) => (
                                      <Link
                                        key={sub._id}
                                        href={sub.href || '#'}
                                        onClick={() => setMenuOpen(false)}
                                        className="block px-3 py-1.5 text-[11px] text-gray-400 hover:text-white"
                                      >
                                        {sub.label}
                                      </Link>
                                    ))}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Mobile Auth (Login & Register) — same external-portal
                    links as the desktop bar above. */}
                <div className="grid grid-cols-2 gap-2 pt-3 border-t border-white/[0.08]">
                  <a
                    href={portalUrls.login}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-white/[0.12] bg-white/[0.04] py-2.5 text-xs font-medium text-gray-200 transition hover:bg-white/[0.08] hover:text-white"
                  >
                    <FaSignInAlt className="text-[#20aaa0]" />
                    <span>{t.nav.login}</span>
                  </a>

                  <a
                    href={portalUrls.register}
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center justify-center gap-2 rounded-xl border border-[#20aaa0]/40 bg-[#20aaa0]/10 py-2.5 text-xs font-medium text-[#20aaa0] transition hover:bg-[#20aaa0]/20 hover:text-white"
                  >
                    <FaUserPlus />
                    <span>{t.nav.register}</span>
                  </a>
                </div>

                {/* Mobile Language Switcher */}
                <div className="flex items-center justify-between rounded-xl border border-white/[0.06] bg-white/[0.02] p-2 text-xs">
                  <span className="text-[11px] text-gray-400 flex items-center gap-1.5 pl-1">
                    <MdLanguage className="text-[#20aaa0]" />
                    <span>Language:</span>
                  </span>
                  <div className="flex items-center gap-1">
                    {languages.map((l) => (
                      <button
                        key={l.code}
                        type="button"
                        onClick={() => {
                          setLanguage(l.code);
                        }}
                        className={`rounded-lg px-2 py-1 text-[11px] font-medium transition ${
                          language === l.code
                            ? 'bg-[#20aaa0] text-[#030b0e] font-bold'
                            : 'text-gray-400 hover:bg-white/[0.06] hover:text-white'
                        }`}
                      >
                        {l.name}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Mobile Book an Appointment Button */}
                <Link
                  href="/appointment"
                  onClick={() => setMenuOpen(false)}
                  className="mt-2 flex items-center justify-center gap-2 rounded-full bg-[#159b89] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#128b7b] shadow-[0_4px_15px_rgba(21,155,137,0.25)]"
                >
                  <FaCalendarCheck />
                  <span>{t.nav.bookAppointment}</span>
                </Link>
              </div>
            </div>
          </Container>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
