import Link from "next/link";
import { allPosts, Post } from "contentlayer/generated";
import { compareDesc, format, parseISO } from "date-fns";
import Sidebar from "@/components/sidebar";

function PostCard(post: Post) {
  return (
    <div className="py-2 w-auto ">
      <h2 className=" font-medium text-lg">
        <Link href={post.url} legacyBehavior>
          {post.title}
        </Link>
      </h2>
      <p className="font-light">
        {format(parseISO(post.date), "LLLL d, yyyy")}
      </p>
    </div>
  );
}

function page() {
  const posts = allPosts.sort((a, b) =>
    compareDesc(new Date(a.date), new Date(b.date))
  );

  return (
    <div className="md:flex  h-screen max-w-4xl mt-5 md:mt-36 ml-5 md:mx-auto">
      <Sidebar />
      <div>
        <h1 className="text-3xl font-bold font-mono mb-2">Blog</h1>
        {posts.map((post, idx) => (
          <PostCard key={idx} {...post} />
        ))}
      </div>
    </div>
  );
}

export default page;
