import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCard } from "./MessageCard";
import { Message } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface MessageListProps {
  tag?: string;
}

export function MessageList({ tag }: MessageListProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  const { data: messages, isLoading } = useQuery<Message[]>({
    queryKey: tag ? [`/api/messages/tag/${tag}`] : ["/api/messages"],
  });

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/messages`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected successfully");
      toast({
        description: "Connected to message service",
        duration: 2000,
      });
    };

    ws.onmessage = (event) => {
      try {
        console.log("WebSocket message received:", event.data);
        const data = JSON.parse(event.data);
        if (data.type === "NEW_MESSAGE") {
          console.log("Invalidating queries due to new message");
          // Invalidate both messages and tags queries
          queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
          if (tag) {
            queryClient.invalidateQueries({ queryKey: [`/api/messages/tag/${tag}`] });
          }
          toast({
            description: "New message received",
            duration: 2000,
          });
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      toast({
        variant: "destructive",
        description: "Connection error. Trying to reconnect...",
      });
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
      // Attempt to reconnect after 5 seconds
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting to reconnect...");
        connectWebSocket();
      }, 5000);
    };
  };

  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

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