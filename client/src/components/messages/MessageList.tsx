import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCard } from "./MessageCard";
import { Message } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";

interface MessageListProps {
  tag?: string;
  sharedBoard?: string;
  messages?: Message[];
  isLoading?: boolean;
}

export function MessageList({ tag, sharedBoard, messages: propMessages, isLoading: propIsLoading }: MessageListProps) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();

  // Get user session for WebSocket identification
  const { data: session } = useQuery<{ authenticated: boolean; userId?: number }>({
    queryKey: ["/api/auth/session"],
  });

  const getQueryKey = () => {
    if (sharedBoard) return [`/api/shared-boards/${sharedBoard}/messages`];
    if (tag) return [`/api/messages/tag/${tag}`];
    return ["/api/messages"];
  };

  const { data: fetchedMessages, isLoading: fetchIsLoading } = useQuery<Message[]>({
    queryKey: getQueryKey(),
    enabled: !propMessages // Only fetch if no messages provided as props
  });

  // Use prop messages if provided, otherwise use fetched messages
  const messages = propMessages || fetchedMessages;
  const isLoading = propIsLoading !== undefined ? propIsLoading : fetchIsLoading;

  const connectWebSocket = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      console.log("WebSocket already connected");
      return;
    }

    // Close any existing connection before creating a new one
    if (wsRef.current) {
      console.log("Closing existing WebSocket connection");
      wsRef.current.close();
      wsRef.current = null;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws/messages`);
    console.log("Attempting WebSocket connection to:", `${protocol}//${window.location.host}/ws/messages`);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log("WebSocket connected successfully");
      
      // Send user identification if authenticated
      if (session?.authenticated && session.userId) {
        ws.send(JSON.stringify({
          type: "IDENTIFY",
          userId: session.userId
        }));
        console.log(`Sent user identification: ${session.userId}`);
      }
      
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
          // Invalidate relevant queries
          queryClient.invalidateQueries({ queryKey: ["/api/messages"] });
          queryClient.invalidateQueries({ queryKey: ["/api/tags"] });
          if (tag) {
            queryClient.invalidateQueries({ queryKey: [`/api/messages/tag/${tag}`] });
          }
          if (sharedBoard) {
            queryClient.invalidateQueries({ queryKey: [`/api/shared-boards/${sharedBoard}/messages`] });
          }
          // Note: No toast notification since this should only be received by the message owner
          // and user-initiated actions (like adding messages) already have their own feedback
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
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      reconnectTimeoutRef.current = setTimeout(() => {
        console.log("Attempting to reconnect...");
        connectWebSocket();
      }, 5000);
    };
  };

  useEffect(() => {
    // Connect WebSocket regardless of authentication status
    // but only send identification if authenticated
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current) {
        console.log("Cleaning up WebSocket connection");
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [session?.authenticated, session?.userId]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (messages?.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">
          {tag ? `No messages found with #${tag}` : "No messages yet"}
        </p>
        <p className="text-sm text-muted-foreground mt-2">
          Send a text message to your Twilio number to get started
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 auto-rows-max">
      {messages?.map((message) => (
        <div key={message.id} className="break-inside-avoid">
          <MessageCard message={message} />
        </div>
      ))}
    </div>
  );
}