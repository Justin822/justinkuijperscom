import Sidebar from "@/components/sidebar";
import Image from "next/image";
import justinkuijpers from "@/images/justinkuijpers.png";
import { FaTwitter } from "react-icons/fa";
import { AiOutlineRise } from "react-icons/ai";
import { BsArrowUpRight } from "react-icons/bs";
import { getTweetCount } from "@/lib/metrics";

export default async function Home() {
  let tweetCount;

  try {
    [tweetCount] = await Promise.all([getTweetCount()]);
  } catch (error) {
    console.error(error);
  }

  return (
    <div className="flex mx-auto h-screen max-w-4xl mt-36">
      <Sidebar />
      <div className=" ">
        <h1 className="text-3xl font-bold font-mono">Justin Kuijpers</h1>
        <p className="max-w-md mt-5">
          Hey, I'm Justin. I work as a SEA freelancer and digital marketer at
          Axians. I <strong>love</strong> programming for the web.
        </p>
        <div className="flex items-start  mt-7">
          <Image
            className=" rounded-full overflow-hidden"
            src={justinkuijpers}
            height={100}
            width={100}
            priority
          />
          <div>
            <div className="ml-5 mt-3">
              <a
                rel="noopener noreferrer"
                target="_blank"
                href="https://twitter.com/justinkuijpers"
                className="flex items-center gap-2"
              >
                <FaTwitter />
                {tweetCount} tweets all tim
              </a>
            </div>
            <div className="ml-5 mt-3">
              <a
                rel="noopener noreferrer"
                href="/blog"
                className="flex items-center gap-2"
              >
                <AiOutlineRise />
                1.700 blog views all time
              </a>
            </div>
          </div>
        </div>
        <p className="mt-7 max-w-md">
          I'm passionate about frond-end development and have knowledge in React
          & Next.js. Read my blog posts about marketing & growth or have a look
          at my portfolio to see things I have created.
        </p>
        <div className="flex items-center gap-2 mt-5 text-neutral-500 hover:text-neutral-800">
          <BsArrowUpRight />
          <a
            rel="noopener noreferrer"
            target="_blank"
            href="https://twitter.com/justinkuijpers"
          >
            Follow me on Twitter
          </a>
        </div>
      </div>
    </div>
  );
}
