import { BsCart } from "react-icons/bs";

export default function Cart({ count = 0, onClick }) {
    return (
        <button onClick={onClick} className="hidden lg:flex items-center gap-1 text-gray-500 dark:text-white dark:hover:text-[#a8c7fa] transition" >
            <div className="relative w-8 h-8 flex items-center justify-center hover:scale-110 transition">
                <BsCart className="text-6xl" />
                {count > 0 && (
                    <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-[12px] text-gray-800 dark:text-gray-200"> {count > 99 ? "99+" : count} </span>
                )}
            </div>

            <span className="text-sm font-medium tracking-wider"> Cart </span>
        </button>
    );
}