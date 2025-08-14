import { Message } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";
import { X, Edit } from "lucide-react";
import { useState, useEffect } from "react";
import { DeleteMessageModal } from "./DeleteMessageModal";
import { EditMessageModal } from "./EditMessageModal";

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

function getIMDbInfo(url: string): { type: string; id: string } | null {
  // Match IMDB URLs for movies and TV shows
  const movieMatch = url.match(/imdb\.com\/title\/(tt\d+)/);
  if (movieMatch) {
    return { type: 'title', id: movieMatch[1] };
  }
  return null;
}

interface MovieData {
  posterUrl: string | null;
  title: string | null;
  year: string | null;
  rating: number | null;
}

export function MessageCard({ message }: MessageCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [movieData, setMovieData] = useState<MovieData | null>(null);
  const [isLoadingMovie, setIsLoadingMovie] = useState(false);

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
  const imdbInfo = message.content ? getIMDbInfo(message.content) : null;

  // Fetch movie data from TMDB when IMDB link is detected
  useEffect(() => {
    async function fetchMovieData() {
      if (!imdbInfo) {
        setMovieData(null);
        return;
      }
      
      setIsLoadingMovie(true);
      
      try {
        const response = await fetch(`/api/tmdb/movie/${imdbInfo.id}`);
        if (response.ok) {
          const data = await response.json();
          setMovieData(data);
        }
      } catch (error) {
        console.error('Error fetching movie data:', error);
      } finally {
        setIsLoadingMovie(false);
      }
    }

    fetchMovieData();
  }, [imdbInfo?.id]);

  return (
    <>
      <Card className="w-full h-fit relative group">
        <div className="absolute top-2 right-2 z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowEditModal(true)}
            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
            aria-label="Edit message"
          >
            <Edit className="h-4 w-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDeleteModal(true)}
            className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
            aria-label="Delete message"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
        
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
            <div className="w-full rounded-md border bg-gradient-to-br from-red-50 to-pink-50 p-6">
              <div className="flex items-center justify-center">
                <a 
                  href={`https://pinterest.com/pin/${pinterestId}`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-red-600 hover:text-red-700 transition-colors flex items-center gap-3 text-lg font-medium hover:underline"
                >
                  <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M12 0C5.373 0 0 5.372 0 12c0 5.084 3.163 9.426 7.627 11.174-.105-.949-.2-2.405.042-3.441.219-.937 1.407-5.965 1.407-5.965s-.359-.719-.359-1.782c0-1.668.967-2.914 2.171-2.914 1.023 0 1.518.769 1.518 1.69 0 1.029-.655 2.568-.994 3.995-.283 1.194.599 2.169 1.777 2.169 2.133 0 3.772-2.249 3.772-5.495 0-2.873-2.064-4.882-5.012-4.882-3.414 0-5.418 2.562-5.418 5.207 0 1.031.397 2.138.893 2.738.098.119.112.224.083.345l-.333 1.36c-.053.22-.174.267-.402.161-1.499-.698-2.436-2.888-2.436-4.649 0-3.785 2.75-7.262 7.929-7.262 4.163 0 7.398 2.967 7.398 6.931 0 4.136-2.607 7.464-6.227 7.464-1.216 0-2.357-.631-2.75-1.378l-.748 2.853c-.271 1.043-1.002 2.35-1.492 3.146C9.57 23.812 10.763 24 12.001 24c6.624 0 11.999-5.373 11.999-12C24 5.372 18.626.001 12.001.001z"/>
                  </svg>
                  <div className="text-left">
                    <div className="font-semibold">View Pin on Pinterest</div>
                    <div className="text-sm font-normal text-red-500 mt-1">Click to open in new tab</div>
                  </div>
                </a>
              </div>
            </div>
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
        {imdbInfo && movieData?.posterUrl && (
          <div className="w-full">
            <img 
              src={movieData.posterUrl}
              alt={movieData.title || "Movie Poster"}
              className="w-full max-w-sm rounded-lg shadow-md"
            />
          </div>
        )}
        {message.mediaUrl && !instagramPostId && !pinterestId && !twitterPostId && !redditPostInfo && !facebookPostId && !youtubeVideoId && !tiktokVideoId && !imdbInfo && (
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
    
    <EditMessageModal
      message={message}
      isOpen={showEditModal}
      onClose={() => setShowEditModal(false)}
    />
    </>
  );
}