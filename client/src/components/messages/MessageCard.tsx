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
  // Handle both pin.it short links and full Pinterest URLs
  const shortMatch = url.match(/pin\.it\/(\w+)/);
  if (shortMatch) return shortMatch[1];
  
  const fullMatch = url.match(/pinterest\.com\/pin\/(\d+)/);
  return fullMatch ? fullMatch[1] : null;
}

function getTwitterPostId(url: string): string | null {
  // Match both x.com and twitter.com
  const match = url.match(/(?:twitter\.com|x\.com)\/\w+\/status\/(\d+)/);
  return match ? match[1] : null;
}

function getRedditPostInfo(url: string): { subreddit: string; postId: string } | null {
  const match = url.match(/reddit\.com\/r\/(\w+)\/comments\/(\w+)/);
  return match ? { subreddit: match[1], postId: match[2] } : null;
}

function getFacebookPostId(url: string): string | null {
  const match = url.match(/facebook\.com\/.*\/posts\/(\d+)|facebook\.com\/permalink\.php\?story_fbid=(\d+)/);
  return match ? (match[1] || match[2]) : null;
}

export function MessageCard({ message }: MessageCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  // Log for debugging
  console.log("MessageCard rendering for:", message.content);

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
  const twitterPostId = message.content ? getTwitterPostId(message.content) : null;
  const redditPostInfo = message.content ? getRedditPostInfo(message.content) : null;
  const facebookPostId = message.content ? getFacebookPostId(message.content) : null;

  // Debug logging
  if (instagramPostId) console.log("Instagram post detected:", instagramPostId);
  if (pinterestId) console.log("Pinterest pin detected:", pinterestId);
  if (twitterPostId) console.log("Twitter post detected:", twitterPostId);
  if (redditPostInfo) console.log("Reddit post detected:", redditPostInfo);
  if (facebookPostId) console.log("Facebook post detected:", facebookPostId);

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
          <div className="w-full max-w-lg mx-auto">
            <blockquote
              className="instagram-media"
              data-instgrm-permalink={`https://www.instagram.com/p/${instagramPostId}/`}
              data-instgrm-version="14"
              style={{
                background: '#FFF',
                border: '0',
                borderRadius: '3px',
                boxShadow: '0 0 1px 0 rgba(0,0,0,0.5),0 1px 10px 0 rgba(0,0,0,0.15)',
                margin: '1px',
                maxWidth: '540px',
                minWidth: '326px',
                padding: '0',
                width: '100%'
              }}
            >
              <div style={{ padding: '16px' }}>
                <a
                  href={`https://www.instagram.com/p/${instagramPostId}/`}
                  style={{
                    background: '#FFFFFF',
                    lineHeight: '0',
                    padding: '0 0',
                    textAlign: 'center',
                    textDecoration: 'none',
                    width: '100%'
                  }}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View Instagram Post
                </a>
              </div>
            </blockquote>
            <script
              async
              src="//www.instagram.com/embed.js"
            />
          </div>
        )}
        {pinterestId && (
          <div className="w-full max-w-lg mx-auto">
            <a
              data-pin-do="embedPin"
              data-pin-width="medium"
              data-pin-round="true"
              href={`https://www.pinterest.com/pin/${pinterestId}/`}
              className="block w-full min-h-[400px] bg-gray-50 rounded-md p-4 text-center text-gray-600"
            >
              Loading Pinterest Pin...
            </a>
            <script
              async
              defer
              src="//assets.pinterest.com/js/pinit.js"
              type="text/javascript"
            />
          </div>
        )}
        {twitterPostId && (
          <div className="w-full max-w-lg mx-auto">
            <blockquote className="twitter-tweet" data-theme="light">
              <a href={`https://x.com/twitter/status/${twitterPostId}`}>Loading post...</a>
            </blockquote>
            <script
              async
              src="https://platform.twitter.com/widgets.js"
              charSet="utf-8"
            />
          </div>
        )}
        {redditPostInfo && (
          <div className="w-full max-w-lg mx-auto">
            <blockquote
              className="reddit-embed-bq"
              data-embed-height="500"
            >
              <a href={`https://www.reddit.com/r/${redditPostInfo.subreddit}/comments/${redditPostInfo.postId}/`}>
                View Reddit Post
              </a>
            </blockquote>
            <script
              async
              src="https://embed.reddit.com/widgets.js"
              charSet="UTF-8"
            />
          </div>
        )}
        {facebookPostId && (
          <div className="w-full max-w-lg mx-auto">
            <div
              className="fb-post"
              data-href={`https://www.facebook.com/permalink.php?story_fbid=${facebookPostId}`}
              data-width="500"
              data-show-text="true"
            />
            <script
              async
              defer
              crossOrigin="anonymous"
              src="https://connect.facebook.net/en_US/sdk.js#xfbml=1&version=v18.0"
            />
          </div>
        )}
        {message.mediaUrl && !instagramPostId && !pinterestId && !twitterPostId && !redditPostInfo && !facebookPostId && (
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