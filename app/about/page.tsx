import Sidebar from "@/components/sidebar";

export default function About() {
  return (
    <div className="flex mx-auto h-screen max-w-4xl mt-36">
      <Sidebar />
      <div className=" ">
        <h1 className="text-3xl font-bold font-mono">About Justin</h1>
        <p className="max-w-md mt-5">About page coming soon!</p>
      </div>
    </div>
  );
}
