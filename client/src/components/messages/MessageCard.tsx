import { Message } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { format } from "date-fns";
import { Link } from "wouter";

interface MessageCardProps {
  message: Message;
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

  return (
    <Card className="mb-4">
      <CardHeader className="pb-2">
        <div className="text-sm text-muted-foreground">
          {format(new Date(message.timestamp), "PPp")}
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-foreground">{formattedContent}</p>
        {message.mediaUrl && (
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
