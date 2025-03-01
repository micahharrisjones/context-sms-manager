import { useQuery } from "@tanstack/react-query";
import { MessageCard } from "./MessageCard";
import { Message } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";

interface MessageListProps {
  tag?: string;
}

export function MessageList({ tag }: MessageListProps) {
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: tag ? [`/api/messages/tag/${tag}`] : ["/api/messages"],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  return (
    <div>
      {messages?.map((message) => (
        <MessageCard key={message.id} message={message} />
      ))}
      {messages?.length === 0 && (
        <p className="text-muted-foreground text-center mt-8">
          No messages found
        </p>
      )}
    </div>
  );
}