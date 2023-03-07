import Image from "next/image";
import logo from "@/images/logo.svg";
import Link from "next/link";

export default function Sidebar() {
  return (
    <div className="  w-36">
      <Image src={logo} width={25} height={37} alt="Justin Kuijpers logo " />

      <nav className="flex flex-col mt-4">
        <div className="w-16 h-8 text-neutral-500 hover:text-neutral-800 hover:bg-slate-100">
          <Link href="/">Home</Link>
        </div>
        <div className="w-16 h-8 text-neutral-500 hover:text-neutral-800 hover:bg-slate-100">
          <Link href="/about">About</Link>
        </div>
        <div className="w-16 h-8 text-neutral-500 hover:text-neutral-800 hover:bg-slate-100">
          <Link href="/blog">Blog</Link>
        </div>
        <div className="w-16 h-8 text-neutral-500 hover:text-neutral-800 hover:bg-slate-100 ">
          <Link href="/portfolio">Portfolio</Link>
        </div>
      </nav>
    </div>
  );
}
