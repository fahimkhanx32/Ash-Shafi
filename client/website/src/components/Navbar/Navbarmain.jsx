import React from "react";
import Container from "../Container/Container";
import { TbGridDots, TbPerfume } from "react-icons/tb";
import { LuNotebookPen } from "react-icons/lu";
import { FaLaptop, FaGasPump, FaHeart, FaAppleAlt} from "react-icons/fa";
import { VscTriangleDown } from "react-icons/vsc";
import { MdLanguage, MdLocationOn } from "react-icons/md";

const Navbar = () => {
  return (
    <div className="w-full bg-[#F5F5F5] dark:bg-[#37474F] shadow-sm">
      <Container className="flex items-center justify-start py-2">
        <div className="flex items-center gap-4">

          <div className="relative group">
          <button className="flex items-center gap-1 px-3 py-1 text-black dark:text-white border border-black dark:border-white rounded-full hover:bg-gray-100 dark:hover:bg-[#232f3e] text-sm">
            <TbGridDots/> All Categories
          </button>

          {/* Dropdown */}
          <div className="absolute left-0 mt-2 w-44 bg-white dark:bg-gray-200 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-50 
            opacity-0 scale-95 invisible 
            group-hover:opacity-100 group-hover:scale-100 group-hover:visible 
            transition-all duration-200"
          >
            {/* Clothes */}
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100">
              <LuNotebookPen /> Clothes
            </button>

            {/* Divider */}
            <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

            {/* Electronics */}
            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100">
              <FaLaptop /> Electronics
            </button> {/* Divider */}<div className="h-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100">
              <TbPerfume /> perfumes
            </button> <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100">
              <FaAppleAlt/> Fruits
            </button> <div className="h-px bg-gray-200 dark:bg-gray-700 mx-2"></div>

            <button className="w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-gray-100">
              <FaGasPump/> Fuel
            </button>
          </div>
        </div>


        {/* Clothes */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-3 py-1 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-[#232f3e] rounded-full">
              Clothes 
            </button>
            <div className="absolute left-0 mt-2 w-40 bg-white dark:bg-gray-200 border rounded-lg shadow-lg z-50 opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible transition-all duration-200">
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Men</button>
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Women</button>
            </div>
          </div>

          {/* Electronics */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-3 py-1 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-[#232f3e] rounded-full">
              Electronics 
            </button>
            <div className="absolute left-0 mt-2 w-40 bg-white dark:bg-gray-200 border rounded-lg shadow-lg z-50 opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible transition-all duration-200">
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Laptop</button>
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Mobile</button>
            </div>
          </div>

          {/* Perfumes */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-3 py-1 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-[#232f3e] rounded-full">
              Perfumes 
            </button>
            <div className="absolute left-0 mt-2 w-40 bg-white dark:bg-gray-200 border rounded-lg shadow-lg z-50 opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible transition-all duration-200">
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Men</button>
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Women</button>
            </div>
          </div>


          {/* watch */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-3 py-1 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-[#232f3e] rounded-full">
              watches / Clocks
            </button>
            <div className="absolute left-0 mt-2 w-40 bg-white dark:bg-gray-200 border rounded-lg shadow-lg z-50 opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible transition-all duration-200">
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Men</button>
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Women</button>
            </div>
          </div>

          

          {/* Jewelry */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-3 py-1 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-[#232f3e] rounded-full">
              Jewelry
            </button>
            <div className="absolute left-0 mt-2 w-40 bg-white dark:bg-gray-200 border rounded-lg shadow-lg z-50 opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible transition-all duration-200">
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Bracelets</button>
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Earrings</button>
            </div>
          </div>

          {/* Fruits */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-3 py-1 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-[#232f3e] rounded-full">
              Fruits
            </button>
            <div className="absolute left-0 mt-2 w-40 bg-white dark:bg-gray-200 border rounded-lg shadow-lg z-50 opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible transition-all duration-200">
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Mango</button>
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Litche</button>
            </div>
          </div>

                  

          {/* More */}
          <div className="relative group">
            <button className="flex items-center gap-1 px-3 py-1 text-black dark:text-white hover:bg-gray-100 dark:hover:bg-[#232f3e] rounded-full">
              More 
            </button>
            <div className="absolute left-0 mt-2 w-40 bg-white dark:bg-gray-200 border rounded-lg shadow-lg z-50 opacity-0 scale-95 invisible group-hover:opacity-100 group-hover:scale-100 group-hover:visible transition-all duration-200">
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">Offers</button>
              <button className="block w-full px-3 py-2 text-sm hover:bg-gray-100">New</button>
            </div>
          </div>


        </div>


       

      </Container>
    </div>
  );
};

export default Navbar;