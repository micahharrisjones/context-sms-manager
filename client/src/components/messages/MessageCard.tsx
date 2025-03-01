import { Message } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { format } from "date-fns";
import { Link } from "wouter";

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
    return word + " ";
  });

  const instagramPostId = message.content ? getInstagramPostId(message.content) : null;
  const pinterestId = message.content ? getPinterestId(message.content) : null;

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="text-sm text-muted-foreground">
          {format(new Date(message.timestamp), "PPp")}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-foreground">{formattedContent}</p>
        {instagramPostId && (
          <div className="mt-4">
            <iframe
              src={`https://www.instagram.com/p/${instagramPostId}/embed`}
              className="w-full aspect-square rounded-md border-0"
              loading="lazy"
              allowFullScreen
            />
          </div>
        )}
        {pinterestId && (
          <div className="mt-4">
            <a
              data-pin-do="embedPin"
              data-pin-width="large"
              href={`https://www.pinterest.com/pin/${pinterestId}/`}
              className="block w-full min-h-[400px]"
            />
            {/* Add Pinterest embed script dynamically */}
            <script 
              async 
              defer 
              src="//assets.pinterest.com/js/pinit.js"
              type="text/javascript"
            />
          </div>
        )}
        {message.mediaUrl && !instagramPostId && !pinterestId && (
          <div className="mt-4">
            {message.mediaType?.startsWith("image/") ? (
              <img 
                src={message.mediaUrl} 
                alt="Message attachment"
                className="rounded-md max-h-64 w-auto" 
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
  );
}