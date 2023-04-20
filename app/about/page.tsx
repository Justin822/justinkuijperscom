import WorkTimeline from "@/components/WorkTimeline";
import Sidebar from "@/components/sidebar";

const workPlaces = [
  {
    company: "Axians",
    position:
      "Working as a online marketer. Responsible for SEO, SEA and paid advertising",
    duration: "2020-now",
  },
  {
    company: "KPN",
    position:
      "Working as a online marketer. Responsible for SEO, SEA and paid advertising",
    duration: "2014-2020",
  },
  {
    company: "Axians",
    position:
      "Working as a online marketer. Responsible for SEO, SEA and paid advertising",
    duration: "2020-now",
  },
  {
    company: "KPN",
    position:
      "Working as a online marketer. Responsible for SEO, SEA and paid advertising",
    duration: "2014-2020",
  },
];

export default function About() {
  return (
    <div className="md:flex  h-screen max-w-4xl mt-5 md:mt-36 ml-5 md:mx-auto">
      <Sidebar />
      <div className=" ">
        <h1 className="text-3xl font-bold font-mono">About Justin</h1>
        <WorkTimeline workPlaces={workPlaces} />
      </div>
    </div>
  );
}
