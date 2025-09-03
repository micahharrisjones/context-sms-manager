import { MessageList } from "@/components/messages/MessageList";
import { useParams } from "wouter";

export default function AllTexts() {
  const params = useParams();
  const tag = params.tag;
  const boardName = params.boardName;

  const getTitle = () => {
    if (boardName) return `#${boardName} (Shared)`;
    if (tag) return `#${tag}`;
    return "All Texts";
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold mb-6">
        {getTitle()}
      </h1>
      <MessageList tag={tag} sharedBoard={boardName} />
    </div>
  );
}