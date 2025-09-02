import { Message } from "@shared/schema";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { Link } from "wouter";
import { X, Edit, ExternalLink, User } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useState, useEffect } from "react";
import { DeleteMessageModal } from "./DeleteMessageModal";
import { EditMessageModal } from "./EditMessageModal";

interface MessageCardProps {
  message: Message;
}

function getInstagramPostId(url: string): string | null {
  // Handle posts, reels, and other Instagram content
  const postMatch = url.match(/instagram\.com\/p\/([^/?]+)/);
  if (postMatch) return postMatch[1];
  
  const reelMatch = url.match(/instagram\.com\/reel\/([^/?]+)/);
  if (reelMatch) return reelMatch[1];
  
  return null;
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
  // Handle standard Reddit post URLs with comments
  const commentsMatch = url.match(/reddit\.com\/r\/(\w+)\/comments\/([^/?]+)/);
  if (commentsMatch) return { subreddit: commentsMatch[1], postId: commentsMatch[2] };
  
  // Handle old Reddit URLs
  const oldMatch = url.match(/old\.reddit\.com\/r\/(\w+)\/comments\/([^/?]+)/);
  if (oldMatch) return { subreddit: oldMatch[1], postId: oldMatch[2] };
  
  return null;
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
  // Handle various TikTok URL formats
  const videoMatch = url.match(/tiktok\.com\/.*\/video\/(\d+)/);
  if (videoMatch) return videoMatch[1];
  
  // Handle vm.tiktok.com short URLs
  const vmMatch = url.match(/vm\.tiktok\.com\/([^/?]+)/);
  if (vmMatch) return vmMatch[1];
  
  // Handle tiktok.com/t/ short URLs
  const shortMatch = url.match(/tiktok\.com\/t\/([^/?]+)/);
  if (shortMatch) return shortMatch[1];
  
  return null;
}

function getIMDbInfo(url: string): { type: string; id: string } | null {
  // Match IMDB URLs for movies and TV shows
  const movieMatch = url.match(/imdb\.com\/title\/(tt\d+)/);
  if (movieMatch) {
    return { type: 'title', id: movieMatch[1] };
  }
  return null;
}

// Extract all URLs from message content
function extractUrls(content: string): string[] {
  const urlRegex = /https?:\/\/[^\s]+/g;
  const matches = content.match(urlRegex);
  return matches || [];
}

// Check if URL should get Open Graph preview (not already handled by social embeds)
function shouldFetchOpenGraph(url: string, hasSpecificEmbed: boolean = false): boolean {
  try {
    const urlObj = new URL(url);
    
    // If we already have a specific embed (Instagram, TikTok, etc.), don't fetch Open Graph
    if (hasSpecificEmbed) {
      return false;
    }
    
    // Always allow Open Graph for social media URLs when specific embed extraction fails
    // This provides fallback previews for unsupported URL formats
    const alwaysSkipDomains = [
      'youtube.com',
      'youtu.be',
      'imdb.com', // We have custom TMDB integration
    ];
    
    return !alwaysSkipDomains.some(domain => urlObj.hostname.includes(domain));
  } catch {
    return false;
  }
}

interface MovieData {
  posterUrl: string | null;
  title: string | null;
  year: string | null;
  rating: number | null;
}

interface OpenGraphData {
  title?: string;
  description?: string;
  image?: string;
  url?: string;
  site_name?: string;
  type?: string;
}

export function MessageCard({ message }: MessageCardProps) {
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [movieData, setMovieData] = useState<MovieData | null>(null);
  const [isLoadingMovie, setIsLoadingMovie] = useState(false);
  const [ogData, setOgData] = useState<OpenGraphData | null>(null);
  const [isLoadingOg, setIsLoadingOg] = useState(false);

  const formattedContent = message.content.split(" ").map((word, i) => {
    // Support hyphenated hashtags like #toyota-parts-list
    if (word.startsWith("#") && /^#[\w-]+$/.test(word)) {
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
  
  // Extract URLs for Open Graph previews
  const urls = extractUrls(message.content);
  const hasSpecificEmbed = !!(instagramPostId || pinterestId || twitterPostId || redditPostInfo || facebookPostId || youtubeVideoId || tiktokVideoId || imdbInfo);
  const previewUrl = urls.find(url => shouldFetchOpenGraph(url, hasSpecificEmbed)) || null;
  

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

  // Fetch Open Graph data for general URLs
  useEffect(() => {
    async function fetchOpenGraphData() {
      if (!previewUrl) {
        setOgData(null);
        return;
      }
      
      setIsLoadingOg(true);
      
      try {
        const response = await fetch(`/api/og-preview?url=${encodeURIComponent(previewUrl)}`);
        if (response.ok) {
          const data = await response.json();
          if (!data.skip && !data.error) {
            setOgData(data);
          }
        }
      } catch (error) {
        console.error('Error fetching Open Graph data:', error);
      } finally {
        setIsLoadingOg(false);
      }
    }

    fetchOpenGraphData();
  }, [previewUrl]);

  return (
    <>
      <Card className="w-full h-fit relative group">
        <div className="absolute top-2 right-2 z-10 flex gap-1">
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
        {/* Open Graph Preview - Show first */}
        {ogData && ogData.title && (
          <div className="w-full">
            <div className="border border-[#e3cac0] rounded-lg overflow-hidden bg-white hover:shadow-md transition-shadow">
              <a 
                href={previewUrl || ogData.url} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                {ogData.image && (
                  <div className="aspect-video w-full bg-gray-100 overflow-hidden">
                    <img
                      src={ogData.image}
                      alt={ogData.title}
                      className="w-full h-full object-cover"
                      loading="lazy"
                      onError={(e) => {
                        e.currentTarget.style.display = 'none';
                      }}
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 line-clamp-2 text-sm">
                        {ogData.title}
                      </h3>
                      {ogData.description && (
                        <p className="text-gray-600 text-sm mt-1 line-clamp-2">
                          {ogData.description}
                        </p>
                      )}
                      {ogData.site_name && (
                        <p className="text-gray-500 text-xs mt-2 uppercase tracking-wide">
                          {ogData.site_name}
                        </p>
                      )}
                    </div>
                    <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                  </div>
                </div>
              </a>
            </div>
          </div>
        )}
        
        {/* Fallback: Show raw URL when preview fails and we're not loading */}
        {previewUrl && !isLoadingOg && (!ogData || !ogData.title) && (
          <div className="w-full">
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline text-sm break-all block p-3 border border-[#e3cac0] rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors"
            >
              {previewUrl}
            </a>
          </div>
        )}
        
        
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
              className="w-full h-[400px] rounded-md border border-[#e3cac0]"
              loading="lazy"
              frameBorder="0"
              scrolling="no"
            />
          </div>
        )}
        {redditPostInfo && (
          <div className="w-full">
            <div className="border border-[#e3cac0] rounded-lg bg-white hover:shadow-md transition-shadow">
              <a 
                href={urls.find(url => url.includes('reddit.com')) || '#'} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-orange-500 rounded-full flex items-center justify-center flex-shrink-0">
                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M12 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0zm5.01 4.744c.688 0 1.25.561 1.25 1.249a1.25 1.25 0 0 1-2.498.056l-2.597-.547-.8 3.747c1.824.07 3.48.632 4.674 1.488.308-.309.73-.491 1.207-.491.968 0 1.754.786 1.754 1.754 0 .716-.435 1.333-1.01 1.614a3.111 3.111 0 0 1 .042.52c0 2.694-3.13 4.87-7.004 4.87-3.874 0-7.004-2.176-7.004-4.87 0-.183.015-.366.043-.534A1.748 1.748 0 0 1 4.028 12c0-.968.786-1.754 1.754-1.754.463 0 .898.196 1.207.49 1.207-.883 2.878-1.43 4.744-1.487l.885-4.182a.342.342 0 0 1 .14-.197.35.35 0 0 1 .238-.042l2.906.617a1.214 1.214 0 0 1 1.108-.701zM9.25 12C8.561 12 8 12.562 8 13.25c0 .687.561 1.248 1.25 1.248.687 0 1.248-.561 1.248-1.249 0-.688-.561-1.249-1.249-1.249zm5.5 0c-.687 0-1.248.561-1.248 1.25 0 .687.561 1.248 1.249 1.248.688 0 1.249-.561 1.249-1.249 0-.687-.562-1.249-1.25-1.249zm-5.466 3.99a.327.327 0 0 0-.231.094.33.33 0 0 0 0 .463c.842.842 2.484.913 2.961.913.477 0 2.105-.056 2.961-.913a.361.361 0 0 0 .029-.463.33.33 0 0 0-.464 0c-.547.533-1.684.73-2.512.73-.828 0-1.979-.196-2.512-.73a.326.326 0 0 0-.232-.095z"/>
                    </svg>
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 text-sm">
                      Reddit Post in r/{redditPostInfo.subreddit}
                    </h3>
                    <p className="text-gray-600 text-sm mt-1">
                      Click to view full discussion on Reddit
                    </p>
                    <p className="text-gray-500 text-xs mt-2 uppercase tracking-wide">
                      REDDIT
                    </p>
                  </div>
                  <ExternalLink className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                </div>
              </a>
            </div>
          </div>
        )}
        
        {/* Message text - Show after embeds, with URLs removed */}
        <p className="text-foreground break-words">
          {message.content.split(" ").map((word, i) => {
            // Support hyphenated hashtags like #toyota-parts-list
            if (word.startsWith("#") && /^#[\w-]+$/.test(word)) {
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
            // Skip HTTP/HTTPS URLs completely since they're shown separately above
            if (word.startsWith('http://') || word.startsWith('https://')) {
              return null; // Don't render URLs in the message text
            }
            return word + " ";
          })}
        </p>
        
        {facebookPostId && (
          <div className="w-full">
            <iframe
              src={`https://www.facebook.com/plugins/post.php?href=https://www.facebook.com/permalink.php?story_fbid=${facebookPostId}&width=500&show_text=true&height=500`}
              className="w-full h-[500px] rounded-md border border-[#e3cac0]"
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
            {/* For numeric video IDs, use iframe embed */}
            {/^\d+$/.test(tiktokVideoId) ? (
              <iframe
                src={`https://www.tiktok.com/embed/v2/${tiktokVideoId}`}
                className="w-full h-[500px] rounded-md border-0"
                loading="lazy"
                frameBorder="0"
                allow="encrypted-media"
                allowFullScreen
              />
            ) : (
              /* For short URLs (vm.tiktok.com, tiktok.com/t/), show a styled link */
              <div className="w-full rounded-md border bg-gradient-to-br from-black to-gray-800 p-6">
                <div className="flex items-center justify-center">
                  <a 
                    href={urls.find(url => url.includes('tiktok.com')) || '#'}
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-white hover:text-gray-200 transition-colors flex items-center gap-3 text-lg font-medium hover:underline"
                  >
                    <svg className="w-8 h-8 flex-shrink-0" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/>
                    </svg>
                    <div className="text-left">
                      <div className="font-semibold">View on TikTok</div>
                      <div className="text-sm font-normal text-gray-300 mt-1">Click to open in new tab</div>
                    </div>
                  </a>
                </div>
              </div>
            )}
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
        
        
        {/* Loading state for Open Graph */}
        {isLoadingOg && previewUrl && (
          <div className="w-full">
            <div className="border border-[#e3cac0] rounded-lg bg-white p-4">
              <div className="animate-pulse">
                <div className="w-full h-48 bg-gray-200 rounded mb-3"></div>
                <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
              </div>
            </div>
          </div>
        )}
        
        {message.mediaUrl && !instagramPostId && !pinterestId && !twitterPostId && !redditPostInfo && !facebookPostId && !youtubeVideoId && !tiktokVideoId && !imdbInfo && !ogData && (
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
        
        {/* Show sender info for shared board messages at bottom */}
        {(message.senderFirstName || message.senderLastName || message.senderId) && (
          <div className="flex items-center gap-2 pt-2 border-t border-[#e3cac0]">
            <Avatar className="h-6 w-6">
              <AvatarImage src={message.senderAvatarUrl || undefined} />
              <AvatarFallback className="bg-[#ed2024] text-white text-xs">
                {message.senderFirstName && message.senderLastName
                  ? `${message.senderFirstName[0]}${message.senderLastName[0]}`.toUpperCase()
                  : message.senderDisplayName?.[0]?.toUpperCase() || 
                    (message.senderId?.replace(/^\+?1?/, '')?.slice(-4)?.[0] || <User className="h-3 w-3" />)
                }
              </AvatarFallback>
            </Avatar>
            <span className="text-xs text-muted-foreground">
              {message.senderFirstName && message.senderLastName
                ? `${message.senderFirstName} ${message.senderLastName}`
                : message.senderDisplayName || 
                  (message.senderId ? 
                    `+${message.senderId.replace(/^\+?1?/, '').replace(/(\d{3})(\d{3})(\d{4})/, '$1-$2-$3')}` : 
                    'Unknown')
              }
            </span>
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