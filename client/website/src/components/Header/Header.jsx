import { useRef, useState, useEffect } from "react";

import Fox from "../../assets/fox.png";
import { RxDividerVertical } from "react-icons/rx";

import {
    FaSignInAlt,
    FaSearch,
    FaHouseUser,
    FaPhone,
    FaEnvelope,
    FaFacebookF,
    FaInstagram,
    FaWhatsapp,
    FaMapMarkerAlt,
    FaUserPlus,
    FaBars,
    FaTimes,
} from "react-icons/fa";

import {
    TbShoppingBagHeart,
    TbShoppingBagX,
} from "react-icons/tb";

import { LuNotebookPen } from "react-icons/lu";
import { VscTriangleDown } from "react-icons/vsc";

import { ThemeToggleButton } from "../ThemeChanger/Theme";
import Container from "../Container/Container.jsx";
import Cart from "../Cart/Cart.jsx";

export default function Navbar() {
    const sideMenuRef = useRef(null);
    const dropdownRef = useRef(null);

    // Cart count
    const [cartCount] = useState(69);

    // Account dropdown
    const [authOpen, setAuthOpen] = useState(false);

    // Open mobile menu
    const openMenu = () => {
        if (sideMenuRef.current) {
            sideMenuRef.current.style.transform = "translateX(-16rem)";
        }
    };

    // Close mobile menu
    const closeMenu = () => {
        if (sideMenuRef.current) {
            sideMenuRef.current.style.transform = "translateX(16rem)";
        }
    };

    // Close account dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(e.target)
            ) {
                setAuthOpen(false);
            }
        };

        document.addEventListener("mousedown", handleClickOutside);

        return () => {
            document.removeEventListener(
                "mousedown",
                handleClickOutside
            );
        };
    }, []);

    return (
        <>
            {/* =====================================================
                TOP CONTACT / SOCIAL BAR
            ====================================================== */}
            <div className="w-full bg-[#263238] text-white text-sm">
                <Container className="flex items-center justify-between py-2">

                    {/* ================= LEFT SIDE ================= */}
                    <div className="flex items-center gap-2">

                        {/* PHONE */} 
                        <a href="tel:+8801753563877" className="flex items-center gap-2 hover:text-blue-300 transition" > <FaPhone className="text-xs" /> <span className="hidden sm:inline"> +880 1753563877 </span> </a>

                        {/* DIVIDER AFTER PHONE */}
                        <RxDividerVertical className="text-gray-500 text-xl" />

                        {/* EMAIL */}
                        <a
                            href="mailto:fahimkhan9859@gmail.com"
                            className="flex items-center gap-2 hover:text-blue-300 transition"
                        >
                            <FaEnvelope className="text-xs" />

                            <span className="hidden md:inline">
                                fahimkhan9859@gmail.com
                            </span>
                        </a>

                        {/* DIVIDER AFTER EMAIL */}
                        <RxDividerVertical className="text-gray-500 text-xl" />

                        {/* FACEBOOK */}
                        <a
                            href="#"
                            aria-label="Facebook"
                            className="hover:text-blue-400 transition"
                        >
                            <FaFacebookF />
                        </a>

                        {/* INSTAGRAM */}
                        <a
                            href="#"
                            aria-label="Instagram"
                            className="hover:text-pink-400 transition"
                        >
                            <FaInstagram />
                        </a>

                        {/* WHATSAPP */}
                        <a
                            href="https://wa.me/8801753563877"
                            target="_blank"
                            rel="noopener noreferrer"
                            aria-label="WhatsApp"
                            className="hover:text-green-400 transition"
                        >
                            <FaWhatsapp />
                        </a>

                        {/* GOOGLE LOCATION */}
                        <a
                            href="#"
                            aria-label="Google Location"
                            className="hover:text-red-400 transition"
                        >
                            <FaMapMarkerAlt />
                        </a>
                    </div>


                    {/* ================= RIGHT SIDE ================= */}
                    <div className="flex items-center gap-4">

                        {/* LOGIN */}
                        <button
                            type="button"
                            className="flex items-center gap-2 hover:text-blue-300 transition"
                        >
                            <FaSignInAlt />

                            <span>Login</span>
                        </button>

                        {/* DIVIDER */}
                        <span className="text-gray-500">
                            |
                        </span>

                        {/* REGISTER */}
                        <button
                            type="button"
                            className="flex items-center gap-2 hover:text-blue-300 transition"
                        >
                            <FaUserPlus />

                            <span>Register</span>
                        </button>
                    </div>
                </Container>
            </div>

            
        </>
    );
}
