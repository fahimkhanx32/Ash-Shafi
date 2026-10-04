import React from "react";
import Container from "../Container/Container";

// React Icons
import { FaCheck, FaTruck, FaExchangeAlt, FaHeadset } from "react-icons/fa";

const Smallcards = () => {
  return (
    <div className="bg-[#f5f5f5] dark:bg-[#263238] py-6">
      <Container>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">

          {/* Card 1 */}
          <div className="flex items-center rounded-lg gap-4 bg-white p-5">
            <FaCheck className="text-yellow-500 text-2xl" />
            <h3 className="font-semibold">Quality Product</h3>
          </div>

          {/* Card 2 */}
          <div className="flex items-center rounded-lg gap-4 bg-white p-5">
            <FaTruck className="text-yellow-500 text-2xl" />
            <h3 className="font-semibold">Free Shipping</h3>
          </div>

          {/* Card 3 */}
          <div className="flex items-center rounded-lg gap-4 bg-white p-5">
            <FaExchangeAlt className="text-yellow-500 text-2xl" />
            <h3 className="font-semibold">14-Day Return</h3>
          </div>

          {/* Card 4 */}
          <div className="flex items-center rounded-lg gap-4 bg-white p-5">
            <FaHeadset className="text-yellow-500 text-2xl" />
            <h3 className="font-semibold">24/7 Support</h3>
          </div>

        </div>

      </Container>
    </div>
  );
};

export default Smallcards;