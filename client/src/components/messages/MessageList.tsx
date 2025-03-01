import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCard } from "./MessageCard";
import { Message } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect } from "react";

interface MessageListProps {
  tag?: string;
}

export function MessageList({ tag }: MessageListProps) {
  const queryClient = useQueryClient();
  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: tag ? [`/api/messages/tag/${tag}`] : ["/api/messages"],
  });

  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/messages`);

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.type === "NEW_MESSAGE") {
        // Invalidate both messages and tags queries
        queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
        queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
        if (tag) {
          queryClient.invalidateQueries({ queryKey: [`/api/messages/tag/${tag}`] });
        }
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
    };

    return () => {
      ws.close();
    };
  }, [queryClient, tag]);

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