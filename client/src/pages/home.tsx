import { MessageList } from "@/components/messages/MessageList";
import { MessageForm } from "@/components/messages/MessageForm";
import { useParams } from "wouter";

export default function Home() {
  const params = useParams();
  const tag = params.tag;

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">
        {tag ? `#${tag}` : "All Messages"}
      </h1>
      <MessageForm />
      <MessageList tag={tag} />
    </div>
  );
}