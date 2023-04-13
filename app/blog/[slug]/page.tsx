import { allPosts } from "contentlayer/generated";
import { getMDXComponent } from "next-contentlayer/hooks";
import { format, parseISO } from "date-fns";
import Image from "next/image";
import justinkuijpers from "@/images/justinkuijpers.png";
import Sidebar from "@/components/sidebar";

export const generateStaticParams = async () =>
  allPosts.map((post: any) => ({ slug: post._raw.flattenedPath }));
export const generateMetadata = ({ params }: any) => {
  const post = allPosts.find(
    (post: any) => post._raw.flattenedPath === params.slug
  );
  return { title: post?.title, description: post?.description };
};

const PostLayout = ({ params }: { params: { slug: string } }) => {
  const post = allPosts.find((post) => post._raw.flattenedPath === params.slug);

  const JustinImage = (props: any) => (
    <Image {...props} src={justinkuijpers} alt={props.alt} />
  );

  let MDXContent;

  if (!post) {
    return <div>404</div>;
  } else {
    MDXContent = getMDXComponent(post!.body.code);
  }

  return (
    <div className="flex mx-auto h-screen max-w-4xl mt-36">
      <Sidebar />
      <div>
        <h1 className="text-3xl font-bold font-mono mb-2">{post.title}</h1>
        <p className="font-light">
          {format(parseISO(post.date), "LLLL d, yyyy")}
        </p>
        <article className="mt-4 prose prose-slate">
          <MDXContent components={{ JustinImage }} />
        </article>
      </div>
    </div>
  );
};

export default PostLayout;
