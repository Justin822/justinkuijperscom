import Sidebar from "@/components/sidebar";

export default function About() {
  return (
    <div className="md:flex  h-screen max-w-4xl mt-5 md:mt-36 ml-5 md:mx-auto">
      <Sidebar />
      <div className=" ">
        <h1 className="text-3xl font-bold font-mono">About Justin</h1>
        <p className="max-w-md mt-5">About page coming soon!</p>
      </div>
    </div>
  );
}
