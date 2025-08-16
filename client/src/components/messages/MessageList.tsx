import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MessageCard } from "./MessageCard";
import { Message } from "@shared/schema";
import { Skeleton } from "@/components/ui/skeleton";
import { useEffect, useRef } from "react";
import { useToast } from "@/hooks/use-toast";
import Masonry from "react-masonry-css";

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
    enabled: !propMessages, // Only fetch if no messages provided as props
    refetchInterval: 30000, // Faster polling for better real-time feel
    refetchIntervalInBackground: false, // Disable background polling to reduce load
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
      
      // Removed toast notification to reduce UI noise
    };

    ws.onmessage = (event) => {
      try {
        console.log("WebSocket message received:", event.data);
        const data = JSON.parse(event.data);
        if (data.type === "NEW_MESSAGE") {
          console.log("Invalidating queries due to new message");
          
          // Batch invalidate all queries at once for better performance
          const queriesToInvalidate = [
            ["/api/messages"],
            ["/api/tags"],
            ["/api/shared-boards"]
          ];
          
          // Add specific queries based on current view
          if (tag) {
            queriesToInvalidate.push([`/api/messages/tag/${tag}`]);
          }
          
          if (sharedBoard) {
            queriesToInvalidate.push([`/api/shared-boards/${sharedBoard}/messages`]);
          }
          
          // Invalidate all queries simultaneously for faster updates
          Promise.all(
            queriesToInvalidate.map(queryKey => 
              queryClient.invalidateQueries({ 
                queryKey,
                refetchType: 'active'
              })
            )
          ).then(() => {
            console.log("All queries invalidated and refetched");
          });
          
          // Removed toast notification to reduce UI noise - messages appear automatically
        }
      } catch (error) {
        console.error("Error processing message:", error);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
      // Removed toast notification to reduce UI noise
    };

    ws.onclose = (event) => {
      console.log("WebSocket connection closed", event.code, event.reason);
      // Only attempt to reconnect if it wasn't a normal closure
      if (event.code !== 1000 && event.code !== 1001) {
        if (reconnectTimeoutRef.current) {
          clearTimeout(reconnectTimeoutRef.current);
        }
        reconnectTimeoutRef.current = setTimeout(() => {
          console.log("Attempting to reconnect...");
          connectWebSocket();
        }, 10000); // Increased to 10 seconds to reduce connection churn
      }
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

  const breakpointColumnsObj = {
    default: 3,
    1100: 2,
    700: 1
  };

  if (isLoading) {
    return (
      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="masonry-grid"
        columnClassName="masonry-grid_column"
      >
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-32 w-full mb-4" />
        ))}
      </Masonry>
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
    <Masonry
      breakpointCols={breakpointColumnsObj}
      className="masonry-grid"
      columnClassName="masonry-grid_column"
    >
      {messages?.map((message) => (
        <div key={message.id} className="mb-4">
          <MessageCard message={message} />
        </div>
      ))}
    </Masonry>
  );
}