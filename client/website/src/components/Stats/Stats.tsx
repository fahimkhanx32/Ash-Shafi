'use client';

import React from 'react';
import {
  FaUserMd,
  FaUsers,
  FaBaby,
  FaStar,
  FaShieldAlt,
  FaPhoneAlt,
} from 'react-icons/fa';
import { CMSStat } from '@/types/cms';

interface StatsProps {
  statsData?: CMSStat[] | null;
}

const DEFAULT_STATS = [
  {
    icon: <FaUserMd />,
    value: '15+',
    label: 'Years of\nExcellence',
  },
  {
    icon: <FaUsers />,
    value: '18,500+',
    label: 'Happy\nPatients',
  },
  {
    icon: <FaBaby />,
    value: '2,500+',
    label: 'Babies\nDelivered',
  },
  {
    icon: <FaStar />,
    value: '4.9/5',
    label: 'Patient\nSatisfaction',
  },
  {
    icon: <FaShieldAlt />,
    value: '100%',
    label: 'Safe & Hygienic\nEnvironment',
  },
  {
    icon: <FaPhoneAlt />,
    value: '24/7',
    label: 'Emergency\nSupport',
  },
];

export const StatsSection: React.FC<StatsProps> = ({ statsData }) => {
  const displayStats =
    statsData && statsData.length > 0
      ? statsData.map((s, idx) => ({
          icon: DEFAULT_STATS[idx % DEFAULT_STATS.length].icon,
          value: s.value,
          label: s.label,
        }))
      : DEFAULT_STATS;

  return (
    <section className="relative w-full overflow-hidden border-y border-[#20aaa0]/[0.10] bg-[#06151a] bg-[radial-gradient(circle_at_50%_50%,rgba(32,170,160,0.10)_0%,rgba(5,16,20,0)_55%)] py-0 max-[700px]:py-[22px]">
      {/* Premium side shadow */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,rgba(0,0,0,0.22),transparent_20%,transparent_80%,rgba(0,0,0,0.22))]" />

      {/* Stats Container */}
      <div className="relative z-[1] mx-auto grid min-h-[112px] w-[94%] max-w-[1400px] grid-cols-6 items-center max-[1100px]:grid-cols-3 max-[700px]:grid-cols-2 max-[700px]:min-h-0 max-[700px]:w-[90%] max-[700px]:gap-y-6 max-[420px]:grid-cols-1 max-[420px]:gap-y-[18px]">
        {displayStats.map((stat, index) => (
          <div
            key={index}
            className="group relative flex min-w-0 items-center justify-center gap-3 px-2 max-[1100px]:py-4 max-[700px]:justify-start max-[700px]:px-1 max-[420px]:justify-center"
          >
            {/* ICON */}
            <div className="flex h-[45px] w-[45px] shrink-0 items-center justify-center text-[28px] text-[#20aaa0] drop-shadow-[0_0_10px_rgba(32,170,160,0.12)] transition-all duration-300 group-hover:-translate-y-0.5 group-hover:text-[#43c8c0] group-hover:drop-shadow-[0_0_14px_rgba(32,170,160,0.25)] max-[1100px]:h-[42px] max-[1100px]:w-[42px] max-[1100px]:text-[26px] max-[700px]:h-[38px] max-[700px]:w-[38px] max-[700px]:text-[23px]">
              {stat.icon}
            </div>

            {/* CONTENT */}
            <div className="flex min-w-0 flex-col justify-center">
              {/* VALUE */}
              <div className="mb-[5px] whitespace-nowrap text-[22px] font-medium leading-[1.05] tracking-[0.2px] text-[#31b7af] transition-colors duration-300 group-hover:text-[#58cec7] max-[1100px]:text-[21px] max-[700px]:text-[20px]">
                {stat.value}
              </div>

              {/* LABEL */}
              <div className="whitespace-pre-line text-[11px] font-normal leading-[1.35] tracking-[0.15px] text-[#b7c7c9]/75 max-[1100px]:text-[11px] max-[700px]:text-[10px]">
                {stat.label}
              </div>
            </div>

            {/* DIVIDER */}
            {index < displayStats.length - 1 && (
              <div className="absolute -right-px top-1/2 h-[58px] w-px -translate-y-1/2 bg-[linear-gradient(to_bottom,transparent,rgba(32,170,160,0.25),transparent)] max-[1100px]:hidden" />
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

export default StatsSection;
