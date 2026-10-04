'use client';

import React, { useState } from 'react';
import { Star, ChevronLeft, ChevronRight, Heart } from 'lucide-react';

const testimonials = [
  {
    id: 1,
    name: 'Nusrat Jahan',
    location: 'Dhaka, Bangladesh',
    text: 'Ash-Shāfī took the time to understand my concerns and explained everything so clearly. I felt in the safest hands throughout my pregnancy.',
    image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 2,
    name: 'Sadia Rahman',
    location: 'Chittagong, Bangladesh',
    text: 'Her professional approach and warm personality made my high-risk pregnancy journey much smoother. Forever grateful for her care.',
    image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=300&q=80',
  },
  {
    id: 3,
    name: 'Afreen Sultana',
    location: 'Sylhet, Bangladesh',
    text: 'I always felt heard, respected, and supported. Ash-Shāfī is not just an excellent doctor but also an amazing human being.',
    image: 'https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=300&q=80',
  },
];

export const Testimonials: React.FC = () => {
  const [active, setActive] = useState(0);

  const nextSlide = () => {
    setActive((prev) => (prev + 1) % testimonials.length);
  };

  const prevSlide = () => {
    setActive((prev) => (prev - 1 + testimonials.length) % testimonials.length);
  };

  return (
    <section id="testimonials" className="min-h-screen flex flex-col items-center justify-center bg-[#061116] px-4 py-16 sm:px-6 lg:px-8">
      {/* Top Decorative Heart Divider */}
      <div className="mb-4 flex w-full items-center justify-center">
        {/* Left Line */}
        <div className="relative flex items-center">
          <div className="h-px w-16 bg-gradient-to-r from-transparent via-[#d39a70] to-[#d39a70] sm:w-24 md:w-32" />
          <span className="mx-2 h-[4px] w-[4px] rotate-45 bg-[#e5ad7c] shadow-[0_0_8px_rgba(229,173,124,0.8)]" />
          <span className="mr-3 h-[5px] w-[5px] rounded-full bg-[#efbd91] shadow-[0_0_10px_3px_rgba(239,189,145,0.45)]" />
        </div>
        {/* Heart Circle */}
        <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-[1.5px] border-[#e5ad7c] bg-[#11111c] shadow-[0_0_18px_rgba(229,173,124,0.12)]">
          <Heart size={20} strokeWidth={1.4} className="text-[#e9b889]" />
          <span className="absolute -left-[3px] top-1/2 h-[4px] w-[4px] -translate-y-1/2 rounded-full bg-[#e5ad7c] shadow-[0_0_7px_2px_rgba(229,173,124,0.45)]" />
          <span className="absolute -right-[3px] top-1/2 h-[4px] w-[4px] -translate-y-1/2 rounded-full bg-[#e5ad7c] shadow-[0_0_7px_2px_rgba(229,173,124,0.45)]" />
        </div>
        {/* Right Line */}
        <div className="relative flex items-center">
          <span className="ml-3 h-[5px] w-[5px] rounded-full bg-[#efbd91] shadow-[0_0_10px_3px_rgba(239,189,145,0.45)]" />
          <span className="mx-2 h-[4px] w-[4px] rotate-45 bg-[#e5ad7c] shadow-[0_0_8px_rgba(229,173,124,0.8)]" />
          <div className="h-px w-16 bg-gradient-to-l from-transparent via-[#d39a70] to-[#d39a70] sm:w-24 md:w-32" />
        </div>
      </div>

      <div className="w-full max-w-6xl mx-auto">
        {/* Header Section */}
        <div className="text-center mb-10">
          <p className="text-sm font-medium tracking-wider text-[#20aaa0] uppercase">
            Patient Impact
          </p>
          <h2 className="mt-2 text-2xl md:text-4xl font-serif font-medium leading-tight tracking-tight text-[#f4f1e9]">
            What Our Patients Say
          </h2>
          <p className="mt-2 text-[#d8dedc]/70 max-w-2xl mx-auto text-sm sm:text-base">
            Real experiences from women who have trusted <br className="hidden md:block" /> compassionate, thoughtful and professional care
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.id}
              className={`rounded-2xl p-6 border transition-all duration-300 ${
                index === active
                  ? 'border-[#e5ad7c] bg-[#302a33] shadow-[0_0_20px_rgba(229,173,124,0.12)]'
                  : 'border-white/5 bg-[#0d1c24]'
              }`}
            >
              <p className="text-[#f4f1e9] text-base leading-relaxed">
                {testimonial.text}
              </p>
              <div className="mt-7 mb-4 h-px w-full bg-white/[0.07]" />
              <div className="flex items-center gap-4">
                <div className="w-[50px] h-[50px] shrink-0 overflow-hidden rounded-full border-2 border-[#e5ad7c]">
                  <img
                    src={testimonial.image}
                    alt={testimonial.name}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div>
                  <p className="text-[#f4f1e9] text-md font-medium leading-tight">
                    {testimonial.name}
                  </p>
                  <p className="mt-1 text-[#d7a276] text-sm">
                    {testimonial.location}
                  </p>
                  <div className="mt-1 flex items-center gap-1">
                    {[...Array(5)].map((_, i) => (
                      <Star
                        key={i}
                        className="w-[10px] h-[10px] fill-[#f3bf67] text-[#f3bf67]"
                        strokeWidth={1.5}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Slider Controls */}
        <div className="mt-8 flex items-center justify-center gap-8">
          <button
            type="button"
            onClick={prevSlide}
            aria-label="Previous testimonial"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#282631] text-[#d9a27a] transition-all duration-300 hover:bg-[#332e38]"
          >
            <ChevronLeft size={22} strokeWidth={1.4} />
          </button>
          <div className="flex items-center gap-4">
            {testimonials.map((testimonial, index) => (
              <button
                key={testimonial.id}
                type="button"
                onClick={() => setActive(index)}
                aria-label={`Show testimonial ${index + 1}`}
                className={`rounded-full transition-all duration-300 ${
                  index === active ? 'h-3.5 w-3.5 bg-[#efb68b]' : 'h-1.5 w-1.5 bg-[#756f78]'
                }`}
              />
            ))}
          </div>
          <button
            type="button"
            onClick={nextSlide}
            aria-label="Next testimonial"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-[#282631] text-[#d9a27a] transition-all duration-300 hover:bg-[#332e38]"
          >
            <ChevronRight size={22} strokeWidth={1.4} />
          </button>
        </div>

        {/* Care • Trust • Wellbeing */}
        <div className="mx-auto mt-8 flex w-full max-w-[900px] items-center gap-4">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#c7837e]/30 to-[#c7837e]/30" />
          <span className="whitespace-nowrap font-serif text-[9px] uppercase tracking-[0.3em] text-[#c7837e]/70">
            Care • Trust • Wellbeing
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#c7837e]/30 to-[#c7837e]/30" />
        </div>
      </div>
    </section>
  );
};

export default Testimonials;
