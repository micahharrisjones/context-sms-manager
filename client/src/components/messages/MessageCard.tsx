import { Message } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";
import { X } from "lucide-react";
import { useState } from "react";
import { DeleteMessageModal } from "./DeleteMessageModal";

interface MessageCardProps {
  message: Message;
}

function getInstagramPostId(url: string): string | null {
  const match = url.match(/instagram\.com\/p\/([^/?]+)/);
  return match ? match[1] : null;
}

function getPinterestId(url: string): string | null {
  const match = url.match(/pin\.it\/(\w+)|pinterest\.com\/pin\/(\d+)/);
  return match ? (match[1] || match[2]) : null;
}

export function MessageCard({ message }: MessageCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const formattedContent = message.content.split(" ").map((word, i) => {
    if (word.startsWith("#")) {
      return (
        <Link
          key={i}
          href={`/tag/${word.slice(1)}`}
          className="text-primary hover:underline"
        >
          {word}{" "}
        </Link>
      );
    }

    // Check if the word is a URL
    try {
      new URL(word);
      return (
        <a
          key={i}
          href={word}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary hover:underline"
        >
          {word}{" "}
        </a>
      );
    } catch {
      return word + " ";
    }
  });

  const instagramPostId = message.content ? getInstagramPostId(message.content) : null;
  const pinterestId = message.content ? getPinterestId(message.content) : null;

  return (
    <>
      <Card className="mb-4 mx-auto max-w-2xl relative group">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowDeleteModal(true)}
          className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
          aria-label="Delete message"
        >
          <X className="h-4 w-4" />
        </Button>
        
        <CardHeader className="pb-2 space-y-1">
          <div className="text-sm text-muted-foreground">
            {format(new Date(message.timestamp), "PPp")}
          </div>
        </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-foreground break-words">{formattedContent}</p>
        {instagramPostId && (
          <div className="aspect-square w-full max-w-lg mx-auto">
            <iframe
              src={`https://www.instagram.com/p/${instagramPostId}/embed`}
              className="w-full h-full rounded-md border-0"
              loading="lazy"
              allowFullScreen
            />
          </div>
        )}
        {pinterestId && (
          <div className="w-full max-w-lg mx-auto">
            <a
              data-pin-do="embedPin"
              data-pin-width="medium"
              href={`https://www.pinterest.com/pin/${pinterestId}/`}
              className="block w-full min-h-[400px]"
            />
            <script
              async
              defer
              src="//assets.pinterest.com/js/pinit.js"
              type="text/javascript"
            />
          </div>
        )}
        {message.mediaUrl && !instagramPostId && !pinterestId && (
          <div className="w-full max-w-lg mx-auto">
            {message.mediaType?.startsWith("image/") ? (
              <img
                src={message.mediaUrl}
                alt="Message attachment"
                className="rounded-md max-h-96 w-auto mx-auto object-contain"
                loading="lazy"
              />
            ) : message.mediaType?.startsWith("video/") ? (
              <video
                src={message.mediaUrl}
                className="rounded-md max-h-96 w-auto mx-auto"
                controls
                preload="metadata"
              />
            ) : (
              <a
                href={message.mediaUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                View Attachment
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>

    <DeleteMessageModal
      isOpen={showDeleteModal}
      onClose={() => setShowDeleteModal(false)}
      messageId={message.id}
      messagePreview={message.content}
    />
    </>
  );
}