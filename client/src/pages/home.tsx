import { MessageList } from "@/components/messages/MessageList";
import { useParams } from "wouter";

export default function Home() {
  const params = useParams();
  const tag = params.tag;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">
        {tag ? `#${tag}` : "All Texts"}
      </h1>
      <MessageList tag={tag} />
    </div>
  );
}