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

  const instagramPostId = getInstagramPostId(message.content);

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
        {message.mediaUrl && !instagramPostId && (
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