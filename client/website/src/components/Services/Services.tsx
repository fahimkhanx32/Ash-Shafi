'use client';

import React from 'react';
import Link from 'next/link';
import {
  FaVenus,
  FaBaby,
  FaLeaf,
  FaFemale,
  FaRibbon,
  FaShieldAlt,
  FaArrowRight,
  FaStethoscope,
} from 'react-icons/fa';
import { CMSService } from '@/types/cms';

interface ServicesProps {
  servicesData?: CMSService[] | null;
}

const DEFAULT_SERVICES = [
  {
    icon: FaVenus,
    title: 'Gynecological\nCare',
    description: "Comprehensive care for\nwomen's reproductive\nhealth and wellness.",
    slug: 'gynecological-care',
  },
  {
    icon: FaBaby,
    title: 'Pregnancy &\nPrenatal Care',
    description: 'Personalized care for a\nhealthy pregnancy and\na safe delivery.',
    slug: 'prenatal-care',
  },
  {
    icon: FaLeaf,
    title: 'Menstrual Health',
    description: 'Diagnosis and treatment\nfor irregular periods,\nPCOS, and more.',
    slug: 'menstrual-health',
  },
  {
    icon: FaFemale,
    title: 'Fertility\nConsultation',
    description: 'Expert evaluation and\nguidance for your\nfertility journey.',
    slug: 'fertility',
  },
  {
    icon: FaRibbon,
    title: 'Menopause\nManagement',
    description: 'Support and solutions\nfor a healthier and\nbalanced life.',
    slug: 'menopause',
  },
  {
    icon: FaShieldAlt,
    title: 'Preventive\nCare',
    description: 'Screenings and vaccines\nto keep you protected\nand empowered.',
    slug: 'preventive-care',
  },
];

const getIconComponent = (iconKey?: string, index: number = 0) => {
  const iconMap: Record<string, any> = {
    venus: FaVenus,
    baby: FaBaby,
    leaf: FaLeaf,
    female: FaFemale,
    ribbon: FaRibbon,
    shield: FaShieldAlt,
  };
  if (iconKey && iconMap[iconKey.toLowerCase()]) {
    return iconMap[iconKey.toLowerCase()];
  }
  const fallbackIcons = [FaVenus, FaBaby, FaLeaf, FaFemale, FaRibbon, FaShieldAlt, FaStethoscope];
  return fallbackIcons[index % fallbackIcons.length];
};

export const Services: React.FC<ServicesProps> = ({ servicesData }) => {
  const displayServices =
    servicesData && servicesData.length > 0
      ? servicesData.map((s, idx) => ({
          icon: getIconComponent(s.icon, idx),
          title: s.title,
          description: s.description,
          slug: s.slug || `service-${idx}`,
        }))
      : DEFAULT_SERVICES;

  return (
    <section
      id="services"
      className="relative w-full overflow-hidden bg-[#06151a] px-4 py-14 sm:px-6 lg:px-8"
    >
      {/* Subtle teal background glow */}
      <div className="pointer-events-none absolute left-1/2 top-0 h-40 w-[600px] -translate-x-1/2 rounded-full bg-[#20aaa0]/[0.045] blur-3xl" />

      <div className="relative mx-auto max-w-[1500px]">
        {/* ================= SECTION TITLE ================= */}
        <div className="mb-8 text-center">
          <h2 className="font-serif text-3xl font-medium tracking-wide text-[#f4f1e9] sm:text-4xl">
            Our Care Services
          </h2>

          {/* Decorative divider */}
          <div className="mx-auto mt-3 flex items-center justify-center">
            <span className="h-px w-14 bg-[#20aaa0]/50" />
            <span className="mx-2 flex h-2.5 w-2.5 rotate-45 items-center justify-center border border-[#20aaa0]/80">
              <span className="h-1 w-1 bg-[#20aaa0]" />
            </span>
            <span className="h-px w-14 bg-[#20aaa0]/50" />
          </div>
        </div>

        {/* ================= SERVICE CARDS GRID ================= */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-6">
          {displayServices.map((service, index) => {
            const Icon = service.icon;

            return (
              <div
                key={index}
                className="group flex min-h-[267px] flex-col items-center rounded-[8px] border border-[#1b5558]/40 bg-[#081b20] px-4 py-5 text-center shadow-[0_5px_20px_rgba(0,0,0,0.25)] transition-all duration-300 hover:-translate-y-1 hover:border-[#20aaa0]/60 hover:bg-[#0a2429] hover:shadow-[0_10px_30px_rgba(0,0,0,0.35)]"
              >
                {/* ICON */}
                <div className="mb-4 flex h-16 items-center justify-center text-[#20aaa0] transition-transform duration-300 group-hover:scale-110">
                  <Icon className="text-[47px]" />
                </div>

                {/* TITLE */}
                <h3 className="min-h-[52px] font-serif text-[22px] font-medium leading-[1.15] text-[#f4f1e9] transition-colors duration-300 group-hover:text-[#35c0b7] whitespace-pre-line">
                  {service.title}
                </h3>

                {/* DESCRIPTION */}
                <p className="mt-4 font-serif text-[14px] leading-[1.55] text-[#aebfc1] whitespace-pre-line">
                  {service.description}
                </p>
              </div>
            );
          })}
        </div>

        {/* ================= VIEW ALL BUTTON ================= */}
        <div className="mt-8 flex justify-center">
          <Link
            href="/services"
            className="group flex items-center gap-2 rounded-md border border-[#20aaa0]/60 bg-transparent px-7 py-3 font-serif text-[14px] font-medium text-[#20aaa0] transition-all duration-300 hover:bg-[#20aaa0]/10 hover:text-[#5bd2ca]"
          >
            <span>View All Services</span>
            <FaArrowRight className="text-[11px] transition-transform duration-300 group-hover:translate-x-1" />
          </Link>
        </div>
      </div>
    </section>
  );
};

export default Services;
