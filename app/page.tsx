import Image from "next/image";
import logo from "@/images/logo.svg";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-5">
      <Image src={logo} width={40} height={59} alt="Justin Kuijpers logo" priority />
      <h1 className="text-3xl font-bold font-mono">Justin Kuijpers</h1>
    </main>
  );
}
