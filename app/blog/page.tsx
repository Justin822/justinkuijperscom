import Link from "next/link";
import { allPosts, Post } from "contentlayer/generated";
import { compareDesc, format, parseISO } from "date-fns";
import Sidebar from "@/components/sidebar";

function PostCard(post: Post) {
  return (
    <div>
      <h2>
        <Link href={post.url} legacyBehavior>
          {post.title}
        </Link>
      </h2>
      <p>{post.description}</p>
      <p>{format(parseISO(post.date), "LLLL d, yyyy")}</p>
    </div>
  );
}

function page() {
  const posts = allPosts.sort((a, b) =>
    compareDesc(new Date(a.date), new Date(b.date))
  );

  return (
    <div className="flex mx-auto h-screen max-w-4xl mt-36">
      <Sidebar />
      <div>
        {posts.map((post, idx) => (
          <PostCard key={idx} {...post} />
        ))}
      </div>
    </div>
  );
}

export default page;
