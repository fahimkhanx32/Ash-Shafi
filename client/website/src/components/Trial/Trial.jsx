import login from "../../assets/login.jpg";
import loginbg1 from "../../assets/loginbg1.png";
import { FcGoogle } from "react-icons/fc";
import { FaUserAlt, FaLock, FaSignInAlt, FaUserPlus } from "react-icons/fa";

const Login = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cover bg-center p-6"
      style={{ backgroundImage: `url(${loginbg1})`, backgroundColor: "#202124", }} >

      <div className="p-10 rounded-lg w-full max-w-sm bg-transparent">

        {/* Signup Link */}
        <div className="text-center">
          <button className="w-full flex items-center justify-center gap-2 text-black font-medium py-2 mt-12 mb-4 rounded-md transition-all bg-[#a6a6a6] hover:bg-[#bfbfbf] outline tracking-wider">
            No account ?  Sign up <FaUserPlus />
          </button>
        </div>

        {/* username Input */}
        <div className="relative mt-6 mb-6">
          <input id="username" type="text" required placeholder="Enter your username here" className="peer w-full px-4 pr-10 pt-2 pb-2 text-white bg-transparent border border-gray-500 rounded-md outline-none focus:border-[#fff] placeholder-transparent tracking-wide" />
          <label htmlFor="username" className="absolute left-3 top-1/2 -translate-y-1/2 text-black transition-all duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-base peer-focus:top-0 peer-focus:text-sm peer-focus:text-black peer-focus:-translate-y-1/2 peer-focus:bg-[#bfbfbf] peer-focus:px-1 tracking-wider">Username
          </label> <FaUserAlt className="absolute right-3 top-1/2 -translate-y-1/2 text-black text-base" />
        </div>


        {/* Password Input */}
        <div className="relative mb-6"> 
            <input type="password" id="password" required placeholder=" " className="peer w-full px-4 pr-10 pt-6 pb-2 text-white bg-transparent border border-gray-500 rounded-md outline-none focus:border-[#fff] placeholder-transparent tracking-wide" /> 
            <label htmlFor="password" className="absolute left-3 top-1/2 -translate-y-1/2 text-black transition-all duration-200 peer-placeholder-shown:top-1/2 peer-placeholder-shown:text-base peer-focus:top-0 peer-focus:text-sm peer-focus:text-black peer-focus:-translate-y-1/2 peer-focus:bg-[#bfbfbf] peer-focus:px-1 tracking-wider" > Password </label> 
            <FaLock className="absolute right-3 top-1/2 -translate-y-1/2 text-black" /> 
        </div>

        {/* Login Button */}
        <button className="w-full flex items-center justify-center gap-2 text-black font-medium py-2 rounded-md mb-4 transition-all tracking-wider bg-transparent hover:bg-[#bfbfbf] outline">
          <FaSignInAlt />
          Login
        </button>


        {/* Divider */}
        <div className="flex items-center justify-center my-2">
          <div className="flex-grow h-px bg-black"></div>
          <span className="px-2 text-white text-sm">Or</span>
          <div className="flex-grow h-px bg-black"></div>
        </div>

        {/* Google Login */}
        <button className="w-full flex items-center justify-center gap-3 text-black font-medium py-2 rounded-md transition-all bg-transparent hover:bg-[#bfbfbf] outline tracking-wider">
          <span className="bg-[#fff] rounded-full p-.5">
            <FcGoogle className="text-xl" />
          </span>
          Login with Google
        </button>



      </div>
    </div>
  );
};

export default Login;
