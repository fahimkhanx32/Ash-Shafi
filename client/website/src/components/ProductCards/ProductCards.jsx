import React from "react";
import Container from "../Container/Container";
import { FaHeart, FaStar, FaPlus, FaMinus } from "react-icons/fa";

// images
import product1 from "../../assets/jeans.jpg";
import product2 from "../../assets/jewelry.jpg";
import product3 from "../../assets/perfume.jpg";
import product4 from "../../assets/phone.jpg";
import product5 from "../../assets/watch.jpg";

const ProductCards = () => {
  return (
    <div className="bg-[#f5f5f5] dark:bg-[#263238] py-10">
      <Container>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">

          {/* CARD 1 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="relative bg-gray-100 rounded-lg p-6">
              <img src={product1} alt="" className="mx-auto h-32 object-contain" />
            </div>

            <h3 className="mt-4 font-semibold">Jeans Collection</h3>

            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <span>1 UNIT</span>
              <FaStar className="text-yellow-400" />
              <span className="font-semibold text-black">4.5</span>
            </div>

            <h2 className="text-xl font-bold mt-2">$18.00</h2>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="border px-2 py-1 rounded"><FaMinus /></button>
                <span>1</span>
                <button className="border px-2 py-1 rounded"><FaPlus /></button>
              </div>
              <button className="text-gray-600">Add to Cart</button>
            </div>
          </div>

          {/* CARD 2 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="relative bg-gray-100 rounded-lg p-6">
              <img src={product2} alt="" className="mx-auto h-32 object-contain" />              
            </div>

            <h3 className="mt-4 font-semibold">Jewelry Collection</h3>

            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <span>1 UNIT</span>
              <FaStar className="text-yellow-400" />
              <span className="font-semibold text-black">4.5</span>
            </div>

            <h2 className="text-xl font-bold mt-2">$25.00</h2>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="border px-2 py-1 rounded"><FaMinus /></button>
                <span>1</span>
                <button className="border px-2 py-1 rounded"><FaPlus /></button>
              </div>
              <button className="text-gray-600">Add to Cart</button>
            </div>
          </div>

          {/* CARD 3 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="relative bg-gray-100 rounded-lg p-6">
              <img src={product3} alt="" className="mx-auto h-32 object-contain" />              
            </div>

            <h3 className="mt-4 font-semibold">Perfume Collection</h3>

            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <span>1 UNIT</span>
              <FaStar className="text-yellow-400" />
              <span className="font-semibold text-black">4.5</span>
            </div>

            <h2 className="text-xl font-bold mt-2">$30.00</h2>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="border px-2 py-1 rounded"><FaMinus /></button>
                <span>1</span>
                <button className="border px-2 py-1 rounded"><FaPlus /></button>
              </div>
              <button className="text-gray-600">Add to Cart</button>
            </div>
          </div>

          {/* CARD 4 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="relative bg-gray-100 rounded-lg p-6">
              <img src={product4} alt="" className="mx-auto h-32 object-contain" />              
            </div>

            <h3 className="mt-4 font-semibold">Latest Phone</h3>

            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <span>1 UNIT</span>
              <FaStar className="text-yellow-400" />
              <span className="font-semibold text-black">4.5</span>
            </div>

            <h2 className="text-xl font-bold mt-2">$200.00</h2>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="border px-2 py-1 rounded"><FaMinus /></button>
                <span>1</span>
                <button className="border px-2 py-1 rounded"><FaPlus /></button>
              </div>
              <button className="text-gray-600">Add to Cart</button>
            </div>
          </div>

          {/* CARD 5 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="relative bg-gray-100 rounded-lg p-6">
              <img src={product5} alt="" className="mx-auto h-32 object-contain" />              
            </div>

            <h3 className="mt-4 font-semibold">Smart Watch</h3>

            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <span>1 UNIT</span>
              <FaStar className="text-yellow-400" />
              <span className="font-semibold text-black">4.5</span>
            </div>

            <h2 className="text-xl font-bold mt-2">$80.00</h2>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="border px-2 py-1 rounded"><FaMinus /></button>
                <span>1</span>
                <button className="border px-2 py-1 rounded"><FaPlus /></button>
              </div>
              <button className="text-gray-600">Add to Cart</button>
            </div>
          </div>


          {/* CARD 6 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="relative bg-gray-100 rounded-lg p-6">
              <img src={product5} alt="" className="mx-auto h-32 object-contain" />              
            </div>

            <h3 className="mt-4 font-semibold">Smart Watch</h3>

            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <span>1 UNIT</span>
              <FaStar className="text-yellow-400" />
              <span className="font-semibold text-black">4.5</span>
            </div>

            <h2 className="text-xl font-bold mt-2">$80.00</h2>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="border px-2 py-1 rounded"><FaMinus /></button>
                <span>1</span>
                <button className="border px-2 py-1 rounded"><FaPlus /></button>
              </div>
              <button className="text-gray-600">Add to Cart</button>
            </div>
          </div>

          {/* CARD 7 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="relative bg-gray-100 rounded-lg p-6">
              <img src={product5} alt="" className="mx-auto h-32 object-contain" />              
            </div>

            <h3 className="mt-4 font-semibold">Smart Watch</h3>

            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <span>1 UNIT</span>
              <FaStar className="text-yellow-400" />
              <span className="font-semibold text-black">4.5</span>
            </div>

            <h2 className="text-xl font-bold mt-2">$80.00</h2>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="border px-2 py-1 rounded"><FaMinus /></button>
                <span>1</span>
                <button className="border px-2 py-1 rounded"><FaPlus /></button>
              </div>
              <button className="text-gray-600">Add to Cart</button>
            </div>
          </div>

          {/* CARD 8 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="relative bg-gray-100 rounded-lg p-6">
              <img src={product5} alt="" className="mx-auto h-32 object-contain" />              
            </div>

            <h3 className="mt-4 font-semibold">Smart Watch</h3>

            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <span>1 UNIT</span>
              <FaStar className="text-yellow-400" />
              <span className="font-semibold text-black">4.5</span>
            </div>

            <h2 className="text-xl font-bold mt-2">$80.00</h2>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="border px-2 py-1 rounded"><FaMinus /></button>
                <span>1</span>
                <button className="border px-2 py-1 rounded"><FaPlus /></button>
              </div>
              <button className="text-gray-600">Add to Cart</button>
            </div>
          </div>

          {/* CARD 9 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="relative bg-gray-100 rounded-lg p-6">
              <img src={product5} alt="" className="mx-auto h-32 object-contain" />              
            </div>

            <h3 className="mt-4 font-semibold">Smart Watch</h3>

            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <span>1 UNIT</span>
              <FaStar className="text-yellow-400" />
              <span className="font-semibold text-black">4.5</span>
            </div>

            <h2 className="text-xl font-bold mt-2">$80.00</h2>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="border px-2 py-1 rounded"><FaMinus /></button>
                <span>1</span>
                <button className="border px-2 py-1 rounded"><FaPlus /></button>
              </div>
              <button className="text-gray-600">Add to Cart</button>
            </div>
          </div>

          {/* CARD 10 */}
          <div className="bg-white rounded-xl p-4 shadow-sm">
            <div className="relative bg-gray-100 rounded-lg p-6">
              <img src={product5} alt="" className="mx-auto h-32 object-contain" />              
            </div>

            <h3 className="mt-4 font-semibold">Smart Watch</h3>

            <div className="flex items-center gap-2 text-sm text-gray-500 mt-2">
              <span>1 UNIT</span>
              <FaStar className="text-yellow-400" />
              <span className="font-semibold text-black">4.5</span>
            </div>

            <h2 className="text-xl font-bold mt-2">$80.00</h2>

            <div className="flex items-center justify-between mt-3">
              <div className="flex items-center gap-3">
                <button className="border px-2 py-1 rounded"><FaMinus /></button>
                <span>1</span>
                <button className="border px-2 py-1 rounded"><FaPlus /></button>
              </div>
              <button className="text-gray-600">Add to Cart</button>
            </div>
          </div>

        </div>

      </Container>
    </div>
  );
};

export default ProductCards;