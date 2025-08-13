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

function getYouTubeVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/);
  return match ? match[1] : null;
}

function getTikTokVideoId(url: string): string | null {
  const match = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
  return match ? match[1] : null;
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
  const twitterPostId = message.content ? getTwitterPostId(message.content) : null;
  const redditPostInfo = message.content ? getRedditPostInfo(message.content) : null;
  const facebookPostId = message.content ? getFacebookPostId(message.content) : null;
  const youtubeVideoId = message.content ? getYouTubeVideoId(message.content) : null;
  const tiktokVideoId = message.content ? getTikTokVideoId(message.content) : null;

  return (
    <>
      <Card className="w-full h-fit relative group">
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
          <div className="w-full">
            <iframe
              src={`https://www.instagram.com/p/${instagramPostId}/embed/captioned/`}
              className="w-full h-[600px] rounded-md border-0"
              loading="lazy"
              allowFullScreen
              scrolling="no"
              frameBorder="0"
            />
          </div>
        )}
        {pinterestId && (
          <div className="w-full">
            <iframe
              src={`https://assets.pinterest.com/ext/embed.html?id=${pinterestId}`}
              className="w-full h-[500px] rounded-md border-0"
              loading="lazy"
              frameBorder="0"
              scrolling="no"
            />
          </div>
        )}
        {twitterPostId && (
          <div className="w-full">
            <iframe
              src={`https://twitframe.com/show?url=https://x.com/i/status/${twitterPostId}`}
              className="w-full h-[400px] rounded-md border border-gray-200"
              loading="lazy"
              frameBorder="0"
              scrolling="no"
            />
          </div>
        )}
        {redditPostInfo && (
          <div className="w-full">
            <iframe
              src={`https://www.redditmedia.com/r/${redditPostInfo.subreddit}/comments/${redditPostInfo.postId}?ref_source=embed&amp;ref=share&amp;embed=true&amp;theme=light`}
              className="w-full h-[500px] rounded-md border border-gray-200"
              loading="lazy"
              frameBorder="0"
              scrolling="yes"
            />
          </div>
        )}
        {facebookPostId && (
          <div className="w-full">
            <iframe
              src={`https://www.facebook.com/plugins/post.php?href=https://www.facebook.com/permalink.php?story_fbid=${facebookPostId}&width=500&show_text=true&height=500`}
              className="w-full h-[500px] rounded-md border border-gray-200"
              loading="lazy"
              frameBorder="0"
              scrolling="no"
            />
          </div>
        )}
        {youtubeVideoId && (
          <div className="w-full">
            <iframe
              src={`https://www.youtube.com/embed/${youtubeVideoId}`}
              className="w-full h-[315px] rounded-md border-0"
              loading="lazy"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            />
          </div>
        )}
        {tiktokVideoId && (
          <div className="w-full">
            <iframe
              src={`https://www.tiktok.com/embed/v2/${tiktokVideoId}`}
              className="w-full h-[500px] rounded-md border-0"
              loading="lazy"
              frameBorder="0"
              allow="encrypted-media"
              allowFullScreen
            />
          </div>
        )}
        {message.mediaUrl && !instagramPostId && !pinterestId && !twitterPostId && !redditPostInfo && !facebookPostId && !youtubeVideoId && !tiktokVideoId && (
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