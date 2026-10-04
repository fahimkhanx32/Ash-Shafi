import React from "react";
import Container from "../Container/Container";
import { Swiper, SwiperSlide } from "swiper/react";
import { Navigation, Pagination, Autoplay } from "swiper/modules";

// Swiper styles
import "swiper/css";
import "swiper/css/navigation";
import "swiper/css/pagination";

// Images
import jeans from "../../assets/jeans.jpg";
import jewelry from "../../assets/jewelry.jpg";
import perfume from "../../assets/perfume.jpg";
import phone from "../../assets/phone.jpg";
import watch from "../../assets/watch.jpg";
import importpic from "../../assets/importpic.jpg";
import discount from "../../assets/discount.jpg";

const Slider = () => {
  const slides = [
    { image: jeans, title: "Jeans Collection", desc: "Discover latest denim styles" },
    { image: jewelry, title: "Jewelry Collection", desc: "Elegant & stylish jewelry" },
    { image: perfume, title: "Perfume Collection", desc: "Luxury fragrance for everyone" },
    { image: phone, title: "Latest Phones", desc: "New arrivals smartphones" },
    { image: watch, title: "Smart Watches", desc: "Modern wearable tech" },
  ];

  return (
    <div className="bg-[#f5f5f5] dark:bg-[#263238] py-4">
      <Container>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

          {/* LEFT SLIDER */}
          <div className="lg:col-span-2">
            <Swiper
              modules={[Navigation, Pagination, Autoplay]}
              navigation
              pagination={{ clickable: true }}
              autoplay={{ delay: 3000 }}
              loop={true}
              className="h-[400px] rounded-lg overflow-hidden"
              style={{
                "--swiper-navigation-color": "#fff",
                "--swiper-pagination-color": "#fff",
              }}
            >
              {slides.map((slide, index) => (
                <SwiperSlide key={index}>
                  <div className="relative h-full">
                    <img
                      src={slide.image}
                      alt=""
                      className="w-full h-full object-cover"
                    />

                    {/* Overlay */}
                    <div className="absolute inset-0 bg-black/30 flex flex-col justify-center items-center text-white text-center px-4">
                      <h2 className="text-3xl md:text-4xl font-bold mb-3">
                        {slide.title}
                      </h2>
                      <p className="mb-4 text-sm md:text-base">
                        {slide.desc}
                      </p>
                      <button className="border px-5 py-2 hover:bg-white hover:text-black transition">
                        Shop Now
                      </button>
                    </div>
                  </div>
                </SwiperSlide>
              ))}
            </Swiper>
          </div>

          {/* RIGHT SIDE */}
          <div className="flex flex-col gap-4">

            {/* Top Banner */}
            <div className="relative h-[192px] rounded-lg overflow-hidden">
              <img src={discount} className="w-full h-full object-fill" />
              <div className="absolute inset-0 bg-black/30 flex flex-col justify-center items-center text-white text-center">
                <p>SAVE 20%</p>
                <h2 className="text-xl font-bold">Special Offer</h2>
                <button className="bg-yellow-400 text-black px-4 py-2 mt-2">
                  Shop Now
                </button>
              </div>
            </div>

            {/* Bottom Banner */}
            <div className="relative h-[192px] rounded-lg overflow-hidden">
              <img src={importpic} className="w-full h-full object-fill" />
              <div className="absolute inset-0 bg-black/30 flex flex-col justify-center items-center text-white text-center">
                <p>IMPORT FROM ABROAD</p>
                <h2 className="text-xl font-bold">Premium Products</h2>
                <button className="bg-yellow-400 text-black px-4 py-2 mt-2">
                  Shop Now
                </button>
              </div>
            </div>

          </div>

        </div>

      </Container>
    </div>
  );
};

export default Slider;